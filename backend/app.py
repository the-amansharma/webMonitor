from flask import Flask, request, jsonify
import requests
import json
import os
import time
import threading
from threading import Lock
from flask_cors import CORS
from datetime import datetime
from http.client import responses
from concurrent.futures import ThreadPoolExecutor
import socket

# ------------------ App Setup ------------------
app = Flask(__name__)
CORS(app)  # Allow all origins

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, "websites.json")

lock = Lock()

MAX_HISTORY = 500        # Rolling history cap
DEFAULT_INTERVAL = 30    # seconds
DEGRADED_MS = 3000       # ms threshold for degraded
MAX_RETRIES = 2          # Retry attempts for failures

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; WebMonitor/1.0)"}  # Avoid blocks

# Ensure JSON file exists
if not os.path.exists(DATA_FILE):
    with open(DATA_FILE, "w") as f:
        json.dump([], f, indent=2)

# ------------------ JSON Helper ------------------
def load_data():
    with lock:
        with open(DATA_FILE, "r") as f:
            return json.load(f)


def save_data(data):
    with lock:
        with open(DATA_FILE, "w") as f:
            json.dump(data, f, indent=2)

# ------------------ Website Check ------------------
def check_website(url, retries=MAX_RETRIES, timeout=15):
    """Check website with retries and return human-readable status."""
    for attempt in range(retries):
        try:
            start = time.time()
            res = requests.get(url, timeout=timeout, headers=HEADERS)
            elapsed = int((time.time() - start) * 1000)

            # Status classification
            if res.status_code >= 500:
                status = "down"
            elif res.status_code >= 400:
                status = "down"
            elif res.status_code >= 300:
                status = "high_latency"
            elif elapsed > DEGRADED_MS:
                status = "high_latency"
            else:
                status = "up"

            # Human-readable error message
            if status == "up":
                error_msg = responses.get(res.status_code, "OK")
            elif status == "high_latency":
                error_msg = responses.get(res.status_code, "OK")
            else:  # down
                error_msg = f"HTTP {res.status_code} (Error)" if res.status_code else "Down"

            return {
                "status": status,
                "response_time": elapsed,
                "code": res.status_code,
                "error": error_msg
            }

        except requests.exceptions.Timeout:
            if attempt == retries - 1:
                return {"status": "down", "response_time": 0, "code": 0, "error": "Timeout"}
            time.sleep(1)

        except requests.exceptions.SSLError:
            return {"status": "down", "response_time": 0, "code": 0, "error": "SSL Error"}

        except requests.exceptions.TooManyRedirects:
            return {"status": "down", "response_time": 0, "code": 0, "error": "Too Many Redirects"}

        except requests.exceptions.ConnectionError as e:
            if attempt == retries - 1:
                return {"status": "down", "response_time": 0, "code": 0, "error": "Connection Failed / Max Retries Exceeded"}
            time.sleep(1)

        except socket.gaierror:
            return {"status": "down", "response_time": 0, "code": 0, "error": "DNS Resolution Failed"}

        except Exception as e:
            return {"status": "down", "response_time": 0, "code": 0, "error": f"Unknown Error: {str(e)}"}


# ------------------ Uptime Calculation ------------------
def update_stats(site):
    """Calculate uptime % based on total response duration."""
    history = site.get("responseHistory", [])
    if not history:
        site["uptime"] = 100
        return

    total_time = 0
    up_time = 0
    for h in history:
        elapsed = h.get("response_time", 0) or 1
        total_time += elapsed
        if h.get("status") == "up":
            up_time += elapsed

    site["uptime"] = round((up_time / total_time) * 100, 2) if total_time else 100

# ------------------ Perform Single Site Check ------------------
def perform_site_check(site):
    """Check a single site and update history/status."""
    interval = site.get("interval", DEFAULT_INTERVAL)
    result = check_website(site["url"])
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    site["status"] = result["status"]
    site["lastChecked"] = now
    site.setdefault("responseHistory", [])

    site["responseHistory"].append({
        "time": now,
        "status": result["status"],
        "ms": result["response_time"],
        "code": result["code"],
        "error": result["error"]
    })

    # Keep rolling history cap
    if len(site["responseHistory"]) > MAX_HISTORY:
        site["responseHistory"] = site["responseHistory"][-MAX_HISTORY:]

    update_stats(site)

# ------------------ Background Monitor ------------------
def background_monitor():
    """Monitor all sites concurrently and handle per-site intervals."""
    last_checked_times = {}  # Track last check time per site

    while True:
        data = load_data()
        now = time.time()
        changed = False

        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = []

            for site in data:
                if not site.get("auto_monitor", True):
                    continue

                interval = site.get("interval", DEFAULT_INTERVAL)
                last_checked = last_checked_times.get(site["id"], 0)

                # Only check if enough time has passed
                if now - last_checked >= interval:
                    futures.append(executor.submit(perform_site_check, site))
                    last_checked_times[site["id"]] = now

            for future in futures:
                future.result()
                changed = True

        if changed:
            save_data(data)

        # Sleep a short time to avoid busy loop
        time.sleep(5)


# ------------------ API Routes ------------------
@app.route("/websites", methods=["GET"])
def get_websites():
    return jsonify(load_data())

@app.route("/websites", methods=["POST"])
def add_website():
    data = load_data()
    new_site = request.json
    new_site["id"] = int(time.time() * 1000)
    new_site["status"] = "unknown"
    new_site["uptime"] = 100
    new_site["responseHistory"] = []
    new_site["lastChecked"] = None
    new_site["auto_monitor"] = True
    new_site["notifications_enabled"] = False
    new_site.setdefault("interval", DEFAULT_INTERVAL)

    data.append(new_site)
    save_data(data)

    # ----------------- Immediate First Check -----------------
    try:
        perform_site_check(new_site)
        save_data(data)
    except Exception as e:
        print(f"Initial check failed for {new_site['url']}: {e}")
    # ---------------------------------------------------------

    return jsonify(new_site), 201


@app.route("/websites/<int:site_id>", methods=["PUT"])
def update_website(site_id):
    data = load_data()
    for site in data:
        if site["id"] == site_id:
            site.update(request.json)
            save_data(data)
            return jsonify(site)
    return jsonify({"error": "Not found"}), 404

@app.route("/websites/<int:site_id>", methods=["DELETE"])
def delete_website(site_id):
    with open("websites.json", "r") as f:
        sites = json.load(f)

    sites = [s for s in sites if s["id"] != site_id]

    with open("websites.json", "w") as f:
        json.dump(sites, f, indent=2)

    return jsonify({"message": "Deleted", "sites": sites})


@app.route("/check/<int:site_id>", methods=["POST"])
def manual_check(site_id):
    data = load_data()
    for site in data:
        if site["id"] == site_id:
            perform_site_check(site)
            save_data(data)
            return jsonify(site)
    return jsonify({"error": "Not found"}), 404

# ------------------ Start App ------------------
if __name__ == "__main__":
    threading.Thread(target=background_monitor, daemon=True).start()
    app.run(debug=True)
