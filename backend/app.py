from flask import Flask, request, jsonify, make_response
import requests
import json
import os
import time
import threading
from threading import Lock, Thread
from flask_cors import CORS
from datetime import datetime
from zoneinfo import ZoneInfo  # For Indian time
from http.client import responses
from concurrent.futures import ThreadPoolExecutor
import socket
from urllib.parse import urlparse
import logging

# ------------------ App Setup -----------------------
app = Flask(__name__)
CORS(app, supports_credentials=True)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, "websites.json")
lock = Lock()
manual_locks = {}  # Per-site lock for manual checks
monitor_thread_started = False # global flag to ensure single monitor thread start

MAX_HISTORY = 500
DEFAULT_INTERVAL = 30
DEGRADED_MS = 3000
MAX_RETRIES = 2
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; WebMonitor/1.0)"}

# WhatsApp API environment variables
WHATSAPP_API_URL = os.environ.get("WHATSAPP_API_URL")  
WHATSAPP_USER_ID = os.environ.get("WHATSAPP_USER_ID")  

# ------------------ Logging ------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)

# ------------------ Helper: Indian Time ------------------
IST = ZoneInfo("Asia/Kolkata")
def now_india():
    return datetime.now(IST).strftime("%Y-%m-%d %H:%M:%S")

# ------------------ User Login ------------------
def load_users():
    with open(os.path.join(BASE_DIR, "users.json"), "r") as f:
        return json.load(f)["users"]

@app.route("/api/login", methods=["POST"])
def login():
    global monitor_thread_started

    body = request.json or {}
    username = body.get("username")
    password = body.get("password")

    users = load_users()
    for u in users:
        if u["username"] == username and u["password"] == password:
            resp = make_response(jsonify({"success": True, "message": "Login successful"}))

            # Start background monitor only once
            if not monitor_thread_started:
                Thread(target=background_monitor, daemon=True).start()
                monitor_thread_started = True
                logging.info("Background monitor started !!!!!!!!!.")

            return resp

    return jsonify({"success": False, "message": "Invalid credentials"}), 401

# ------------------ JSON Helpers ------------------
os.makedirs(BASE_DIR, exist_ok=True)
if not os.path.exists(DATA_FILE):
    with open(DATA_FILE, "w") as f:
        json.dump([], f, indent=2)

def load_data():
    with lock:
        try:
            with open(DATA_FILE, "r") as f:
                return json.load(f)
        except json.JSONDecodeError:
            backup_file = DATA_FILE + ".corrupt"
            os.rename(DATA_FILE, backup_file)
            logging.warning(f"⚠️ Corrupted JSON detected, moved to {backup_file}")
            with open(DATA_FILE, "w") as f:
                json.dump([], f, indent=2)
            return []

def save_data(data):
    with lock, open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=2)

# ------------------ Website Check ------------------
def check_website(url, retries=MAX_RETRIES, timeout=15):
    last_error = None
    last_response_time = 0
    last_code = 0

    for attempt in range(retries):
        start = time.time()
        try:
            res = requests.get(url, timeout=timeout, headers=HEADERS)
            elapsed = int((time.time() - start) * 1000)
            last_response_time = elapsed
            last_code = res.status_code

            if res.status_code >= 400:
                return {"status": "down", "response_time": elapsed, "code": res.status_code,
                        "error": f"HTTP {res.status_code} ({responses.get(res.status_code, 'Unknown')})"}

            if elapsed > DEGRADED_MS:
                return {"status": "high_latency", "response_time": elapsed, "code": res.status_code,
                        "error": f"High latency (> {DEGRADED_MS} ms)"}

            return {"status": "up", "response_time": elapsed, "code": res.status_code, "error": "OK"}

        except requests.exceptions.Timeout:
            last_error = "Timeout"
        except requests.exceptions.SSLError as e:
            last_error = f"SSL Error: {e}"
        except requests.exceptions.TooManyRedirects:
            last_error = "Too many redirects"
        except requests.exceptions.InvalidURL as e:
            last_error = f"Invalid URL: {e}"
        except requests.exceptions.MissingSchema:
            last_error = "Missing URL schema (http/https)"
        except requests.exceptions.ConnectionError as e:
            msg = str(e).lower()
            if "name resolution" in msg or "nodename" in msg or "getaddrinfo" in msg:
                last_error = "DNS resolution failed"
            elif "connection refused" in msg:
                last_error = "Connection refused"
            elif "network is unreachable" in msg:
                last_error = "Network unreachable"
            elif "connection reset" in msg:
                last_error = "Connection reset by peer"
            else:
                last_error = "Connection error"
        except socket.gaierror:
            last_error = "DNS resolution failed"
        except Exception as e:
            last_error = f"Unknown error: {str(e)}"

        if attempt < retries - 1:
            time.sleep(0.5)

    return {"status": "down", "response_time": last_response_time, "code": last_code, "error": last_error or "Unreachable"}

# ------------------ Uptime Calculation ------------------
def update_stats(site):
    history = site.get("responseHistory", [])
    if not history:
        site["uptime"] = 100
        return
    total_time = sum(h.get("response_time", 1) or 1 for h in history)
    up_time = sum(h.get("response_time", 1) or 1 for h in history if h.get("status") == "up")
    site["uptime"] = round((up_time / total_time) * 100, 2) if total_time else 100

# ------------------ WhatsApp Notification ------------------
def send_whatsapp(phone_number: str, site_name: str, status: str, error: str):
    if not phone_number:
        logging.info("No phone number provided for WhatsApp notification.")
        return
    msg = f"⚠️ Site Alert!\nSite: {site_name}\nStatus: {status}\nError: {error}"
    payload = {"user_id": WHATSAPP_USER_ID, "phone": phone_number, "message": msg}
    try:
        logging.info(f"[WhatsApp] Sending message for site {site_name}.")
        response = requests.post(WHATSAPP_API_URL, json=payload, timeout=10)
        response.raise_for_status()
        logging.info(f"[WhatsApp] Message sent for site {site_name}.")
    except Exception as e:
        logging.error(f"[WhatsApp] Failed to send message {e}")

# ------------------ Trigger Notifications ------------------
def trigger_notifications(site, notifications_enabled: bool, phone_number: str):
    if notifications_enabled != True:
        logging.info(f"Notifications are disabled. {site.get('name')} ")
        return

    last_status = site.get("lastNotifiedStatus")
    current_status = site["status"]

    if current_status == "down" and last_status != current_status:
        logging.info(f"[Notification] Site {site.get('name')} is DOWN.")
        send_whatsapp(
            phone_number,
            site.get("name") or site.get("url"),
            current_status,
            site["responseHistory"][-1]["error"] if site.get("responseHistory") else "Unknown Error"
        )
        site["lastNotifiedStatus"] = current_status

    elif current_status in ("up", "high_latency") and last_status == "down":
        msg = (
            f"✅ Site Recovery Alert!\n\n"
            f"Site: {site.get('name') or site.get('url')}\n"
            f"Status: ONLINE\n"
            f"Previous Issue: {last_status.upper()}\n"
            f"Last Checked: {site['lastChecked']}\n\n"
            f"The site is back to normal and reachable."
        )
        payload = {"user_id": WHATSAPP_USER_ID, "phone": phone_number, "message": msg}
        try:
            response = requests.post(WHATSAPP_API_URL, json=payload, timeout=10)
            response.raise_for_status()
            logging.info(f"[WhatsApp] Recovery message sent for site {site.get('name')}")
            site["lastNotifiedStatus"] = "up"
        except Exception as e:
            logging.error(f"[WhatsApp] Failed to send recovery message for site {site.get('name')}: {e}")

# ------------------ Perform Single Site Check ------------------
def perform_site_check(site, notifications_enabled: bool, phone_number: str):
    result = check_website(site["url"])
    now = now_india()  # ✅ Indian time

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
    trigger_notifications(site, notifications_enabled, phone_number)

# ------------------ Background Monitor ------------------
def background_monitor():
    last_checked_times = {}
    while True:
        try:
            data = load_data()
            now_ts = time.time()
            due_sites = []

            for site in data:
                if not site.get("auto_monitor", True):
                    continue
                interval = site.get("interval", DEFAULT_INTERVAL)
                last_checked = last_checked_times.get(site["id"], 0)
                if now_ts - last_checked >= interval:
                    due_sites.append(site)

            if due_sites:
                with ThreadPoolExecutor(max_workers=10) as executor:
                    futures = {executor.submit(check_website, s["url"]): s for s in due_sites}
                    for future, site in futures.items():
                        result = future.result()
                        now_str = now_india()  # ✅ Indian time
                        site["status"] = result["status"]
                        site["lastChecked"] = now_str
                        site.setdefault("responseHistory", []).append({
                            "time": now_str,
                            "status": result["status"],
                            "ms": result["response_time"],
                            "code": result["code"],
                            "error": result["error"]
                        })
                        if len(site["responseHistory"]) > MAX_HISTORY:
                            site["responseHistory"] = site["responseHistory"][-MAX_HISTORY:]
                        update_stats(site)
                        last_checked_times[site["id"]] = now_ts
                        if site["status"] == "down":
                            try:
                                requests.post(f"http://127.0.0.1:5000/api/check/{site['id']}", timeout=5)
                            except:
                                pass

                save_data(data)

            next_due_times = [last_checked_times.get(s["id"], 0) + s.get("interval", DEFAULT_INTERVAL)
                              for s in data if s.get("auto_monitor", True)]
            sleep_time = max(1, min(next_due_times) - time.time()) if next_due_times else DEFAULT_INTERVAL
            time.sleep(sleep_time)

        except Exception as e:
            logging.error(f"[Monitor Error] {e}")
            time.sleep(5)

# ------------------ Validators ------------------
def validate_url(url):
    try:
        parsed = urlparse(url)
        return all([parsed.scheme in ("http", "https"), parsed.netloc])
    except Exception:
        return False

# ------------------ API Routes ------------------
@app.route("/api/websites", methods=["GET"])
def get_websites():
    return jsonify(load_data())

@app.route("/api/websites", methods=["POST"])
def add_website():
    body = request.get_json(silent=True) or {}
    if not body or "url" not in body:
        return jsonify({"error": "Missing required field 'url'"}), 400
    if not validate_url(body["url"]):
        return jsonify({"error": "Invalid URL format"}), 400

    data = load_data()
    new_site = {
        "id": int(time.time() * 1000),
        "url": body["url"],
        "name": body.get("name", ""),
        "status": "unknown",
        "uptime": 100,
        "responseHistory": [],
        "lastChecked": None,
        "auto_monitor": True,
        "interval": body.get("interval", DEFAULT_INTERVAL)
    }
    data.append(new_site)
    save_data(data)

    perform_site_check(new_site, body.get("notificationsEnabled", False), body.get("notificationPhone", ""))
    save_data(data)
    return jsonify(new_site), 201

@app.route("/api/websites/<int:site_id>", methods=["PUT"])
def update_website(site_id):
    updates = request.json or {}
    data = load_data()
    for site in data:
        if site["id"] == site_id:
            site.update(updates)
            save_data(data)
            return jsonify(site)
    return jsonify({"error": "Site not found"}), 404

@app.route("/api/websites/<site_id>", methods=["DELETE"])
def delete_website(site_id):
    sites = load_data()
    new_sites = [s for s in sites if str(s.get("id")) != str(site_id)]
    if len(new_sites) == len(sites):
        return jsonify({"error": "Site not found"}), 404
    save_data(new_sites)
    return jsonify({"message": f"Deleted site {site_id}", "sites": new_sites})

@app.route("/api/check/<int:site_id>", methods=["POST"])
def manual_check(site_id):
    try:
        data = load_data()
        site = next((s for s in data if s["id"] == site_id), None)
        if not site:
            return jsonify({"error": "Site not found"}), 404

        notifications_enabled = request.cookies.get("notificationsEnabled", "false").lower() == "true"
        phone_number = request.cookies.get("notificationPhone", "")

        if site_id not in manual_locks:
            manual_locks[site_id] = Lock()
        lock_obj = manual_locks[site_id]

        if not lock_obj.acquire(blocking=False):
            return jsonify({"error": f"A manual check for {site['url']} is already running."}), 429

        try:
            perform_site_check(site, notifications_enabled, phone_number)
            save_data(data)
            return jsonify(site)
        finally:
            lock_obj.release()

    except Exception as e:
        logging.error(f"[Manual Check Error] {e}")
        return jsonify({"error": "Manual check failed", "details": str(e)}), 500

# ------------------ Start App ------------------
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
