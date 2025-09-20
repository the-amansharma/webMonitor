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
from urllib.parse import urlparse

# ------------------ App Setup ------------------
app = Flask(__name__)
CORS(app)  # Allow all origins

BASE_DIR = "/opt/render"
DATA_FILE = os.path.join(BASE_DIR, "websites.json")

lock = Lock()

MAX_HISTORY = 500        # Rolling history cap
DEFAULT_INTERVAL = 30    # seconds
DEGRADED_MS = 3000       # ms threshold for degraded
MAX_RETRIES = 2          # Retry attempts for failures

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; WebMonitor/1.0)"}  # Avoid blocks

# Ensure JSON file exists
os.makedirs(BASE_DIR, exist_ok=True)
if not os.path.exists(DATA_FILE):
    with open(DATA_FILE, "w") as f:
        json.dump([], f, indent=2)


# ------------------ JSON Helpers ------------------
def load_data():
    """Safely load sites JSON data."""
    try:
        with lock, open(DATA_FILE, "r") as f:
            return json.load(f)
    except (json.JSONDecodeError, FileNotFoundError):
        return []
    except Exception as e:
        raise RuntimeError(f"Failed to load data: {str(e)}")


def save_data(data):
    """Safely save sites JSON data."""
    try:
        with lock, open(DATA_FILE, "w") as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        raise RuntimeError(f"Failed to save data: {str(e)}")


# ------------------ Website Check ------------------
def check_website(url, retries=MAX_RETRIES, timeout=15):
    """Check website with retries and return structured result."""
    for attempt in range(retries):
        try:
            start = time.time()
            res = requests.get(url, timeout=timeout, headers=HEADERS)
            elapsed = int((time.time() - start) * 1000)

            # Status classification
            if res.status_code >= 400:
                status = "down"
            elif elapsed > DEGRADED_MS:
                status = "high_latency"
            else:
                status = "up"

            return {
                "status": status,
                "response_time": elapsed,
                "code": res.status_code,
                "error": responses.get(res.status_code, "OK")
            }

        except requests.exceptions.Timeout:
            if attempt == retries - 1:
                return {"status": "down", "response_time": 0, "code": 0, "error": "Timeout"}

        except requests.exceptions.SSLError:
            return {"status": "down", "response_time": 0, "code": 0, "error": "SSL Error"}

        except requests.exceptions.TooManyRedirects:
            return {"status": "down", "response_time": 0, "code": 0, "error": "Too Many Redirects"}

        except requests.exceptions.ConnectionError:
            if attempt == retries - 1:
                return {"status": "down", "response_time": 0, "code": 0, "error": "Connection Failed"}

        except socket.gaierror:
            return {"status": "down", "response_time": 0, "code": 0, "error": "DNS Resolution Failed"}

        except Exception as e:
            return {"status": "down", "response_time": 0, "code": 0, "error": f"Unknown Error: {str(e)}"}

    return {"status": "down", "response_time": 0, "code": 0, "error": "Unreachable"}


# ------------------ Uptime Calculation ------------------
def update_stats(site):
    history = site.get("responseHistory", [])
    if not history:
        site["uptime"] = 100
        return

    total_time = sum(h.get("response_time", 1) or 1 for h in history)
    up_time = sum(h.get("response_time", 1) or 1 for h in history if h.get("status") == "up")

    site["uptime"] = round((up_time / total_time) * 100, 2) if total_time else 100


# ------------------ Perform Single Site Check ------------------
def perform_site_check(site):
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

    if len(site["responseHistory"]) > MAX_HISTORY:
        site["responseHistory"] = site["responseHistory"][-MAX_HISTORY:]

    update_stats(site)


# ------------------ Background Monitor ------------------
def background_monitor():
    last_checked_times = {}

    while True:
        try:
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

                    if now - last_checked >= interval:
                        futures.append(executor.submit(perform_site_check, site))
                        last_checked_times[site["id"]] = now

                for future in futures:
                    future.result()
                    changed = True

            if changed:
                save_data(data)

        except Exception as e:
            print(f"[Monitor Error] {str(e)}")

        time.sleep(5)


# ------------------ Validators ------------------
def validate_url(url):
    try:
        parsed = urlparse(url)
        return all([parsed.scheme in ("http", "https"), parsed.netloc])
    except Exception:
        return False


# ------------------ API Routes ------------------
@app.route("/websites", methods=["GET"])
def get_websites():
    try:
        return jsonify(load_data())
    except Exception as e:
        return jsonify({"error": "Failed to fetch websites", "details": str(e)}), 500


@app.route("/websites", methods=["POST"])
def add_website():
    try:
        body = request.json
        if not body or "url" not in body:
            return jsonify({"error": "Missing required field 'url'"}), 400

        if not validate_url(body["url"]):
            return jsonify({"error": "Invalid URL format"}), 400

        data = load_data()
        new_site = {
            "id": int(time.time() * 1000),
            "url": body["url"],
            "status": "unknown",
            "uptime": 100,
            "responseHistory": [],
            "lastChecked": None,
            "auto_monitor": True,
            "notifications_enabled": False,
            "interval": body.get("interval", DEFAULT_INTERVAL)
        }

        data.append(new_site)
        save_data(data)

        try:
            perform_site_check(new_site)
            save_data(data)
        except Exception as e:
            print(f"Initial check failed for {new_site['url']}: {e}")

        return jsonify(new_site), 201

    except Exception as e:
        return jsonify({"error": "Failed to add website", "details": str(e)}), 500


@app.route("/websites/<int:site_id>", methods=["PUT"])
def update_website(site_id):
    try:
        updates = request.json or {}
        data = load_data()
        for site in data:
            if site["id"] == site_id:
                site.update(updates)
                save_data(data)
                return jsonify(site)
        return jsonify({"error": "Site not found"}), 404
    except Exception as e:
        return jsonify({"error": "Failed to update site", "details": str(e)}), 500


@app.route("/websites/<site_id>", methods=["DELETE"])
def delete_website(site_id):
    try:
        sites = load_data()
        new_sites = [s for s in sites if str(s.get("id")) != str(site_id)]

        if len(sites) == len(new_sites):
            return jsonify({"error": "Site not found"}), 404

        save_data(new_sites)
        return jsonify({"message": f"Deleted site {site_id}", "sites": new_sites})
    except Exception as e:
        return jsonify({"error": "Failed to delete site", "details": str(e)}), 500


@app.route("/check/<int:site_id>", methods=["POST"])
def manual_check(site_id):
    try:
        data = load_data()
        for site in data:
            if site["id"] == site_id:
                perform_site_check(site)
                save_data(data)
                return jsonify(site)
        return jsonify({"error": "Site not found"}), 404
    except Exception as e:
        return jsonify({"error": "Manual check failed", "details": str(e)}), 500


# ------------------ Global Error Handlers ------------------
@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Route not found"}), 404

@app.errorhandler(405)
def method_not_allowed(e):
    return jsonify({"error": "Method not allowed"}), 405

@app.errorhandler(500)
def internal_error(e):
    return jsonify({"error": "Internal server error", "details": str(e)}), 500


# ------------------ Start App ------------------
if __name__ == "__main__":
    threading.Thread(target=background_monitor, daemon=True).start()
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
