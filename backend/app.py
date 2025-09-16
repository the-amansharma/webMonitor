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
from requests.exceptions import Timeout, ConnectionError, HTTPError, RequestException, TooManyRedirects, SSLError

app = Flask(__name__)
CORS(app)  # Allow all origins

DATA_FILE = "websites.json"
lock = Lock()

# Ensure file exists
if not os.path.exists(DATA_FILE):
    with open(DATA_FILE, "w") as f:
        json.dump([], f)


def load_data():
    with lock:
        with open(DATA_FILE, "r") as f:
            return json.load(f)


def save_data(data):
    with lock:
        with open(DATA_FILE, "w") as f:
            json.dump(data, f, indent=2)


from http.client import responses  # built-in dict of status code → reason phrase

def check_website(url):
    """Check website status and return monitoring info with consistent keys."""
    try:
        start = time.time()
        res = requests.get(url, timeout=5)
        elapsed = int((time.time() - start) * 1000)  # ms
        return {
            "status": "up",
            "response_time": elapsed,
            "code": res.status_code,
            "error": responses.get(res.status_code, "Unknown")  # e.g., 200 → OK, 404 → Not Found
        }
    except Timeout:
        return {"status": "down", "response_time": 0, "code": 0, "error": "Timeout"}
    except ConnectionError:
        return {"status": "down", "response_time": 0, "code": 0, "error": "Connection Error"}
    except SSLError:
        return {"status": "down", "response_time": 0, "code": 0, "error": "SSL Error"}
    except TooManyRedirects:
        return {"status": "down", "response_time": 0, "code": 0, "error": "Too Many Redirects"}
    except HTTPError as e:
        code = e.response.status_code if e.response else 0
        return {
            "status": "down",
            "response_time": 0,
            "code": code,
            "error": responses.get(code, str(e))
        }
    except RequestException as e:
        return {"status": "down", "response_time": 0, "code": 0, "error": f"RequestException: {str(e)}"}
    except Exception as e:
        return {"status": "down", "response_time": 0, "code": 0, "error": f"Unknown: {str(e)}"}




def update_stats(site):
    """Recalculate uptime % (based on history)."""
    history = site.get("responseHistory", [])
    if not history:
        site["uptime"] = 100
        return

    ups = sum(1 for h in history if h["ms"] > 0)
    site["uptime"] = round((ups / len(history)) * 100, 2)


def background_monitor():
    """Background thread for auto monitoring."""
    while True:
        data = load_data()
        changed = False
        for site in data:
            if site.get("auto_monitor"):
                result = check_website(site["url"])
                site["status"] = result["status"]
                site["lastChecked"] = time.strftime("%Y-%m-%d %H:%M:%S")

                # Append response time and error, keep only last 10
                site.setdefault("responseHistory", [])
                site["responseHistory"].append({
                    "time": site["lastChecked"],
                    "ms": result["response_time"],
                    "code": result["code"],
                    "error": result["error"]
                })
                site["responseHistory"] = site["responseHistory"][-10:]

                update_stats(site)
                changed = True
        if changed:
            save_data(data)
        time.sleep(60)  # check every 60s


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
    data.append(new_site)
    save_data(data)
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
    data = load_data()
    new_data = [site for site in data if site["id"] != site_id]
    save_data(new_data)
    return jsonify({"success": True})


@app.route("/check/<int:site_id>", methods=["POST"])
def manual_check(site_id):
    data = load_data()
    for site in data:
        if site["id"] == site_id:
            result = check_website(site["url"])
            site["status"] = result["status"]
            site["lastChecked"] = time.strftime("%Y-%m-%d %H:%M:%S")

            site.setdefault("responseHistory", [])
            site["responseHistory"].append({
                "time": site["lastChecked"],
                "ms": result["response_time"],
                "code": result["code"],
                "error": result["error"]
            })
            site["responseHistory"] = site["responseHistory"][-10:]

            update_stats(site)
            save_data(data)
            return jsonify(site)
    return jsonify({"error": "Not found"}), 404


if __name__ == "__main__":
    threading.Thread(target=background_monitor, daemon=True).start()
    app.run(debug=True)
