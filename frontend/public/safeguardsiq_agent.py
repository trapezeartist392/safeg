"""
SafeguardsIQ Camera Relay Agent v2
====================================
Run this on any Windows/Linux PC inside the factory network.
It logs in with your SafeguardsIQ credentials, connects to your
RTSP cameras, and sends frames to the AI for PPE detection.

Requirements:
  pip install opencv-python requests

Usage:
  python safeguardsiq_agent.py
"""

import cv2
import base64
import requests
import time
import os
import threading
import sys
from datetime import datetime

# ── CONFIG ──────────────────────────────────────────────────────
API_BASE       = "https://safeguardsiq.com/api/v1"
FRAME_INTERVAL = int(os.getenv("FRAME_INTERVAL", "15"))   # seconds between AI checks
JPEG_QUALITY   = int(os.getenv("JPEG_QUALITY",   "75"))   # JPEG compression 1-100

# ── GLOBAL STATE ────────────────────────────────────────────────
TOKEN   = ""
CAMERAS = {}   # { "CAM-01": "rtsp://admin:pass@192.168.1.101:554/stream1" }

# ── LOGIN ────────────────────────────────────────────────────────
def login(email, password):
    """Login to SafeguardsIQ and return access token."""
    try:
        r = requests.post(f"{API_BASE}/auth/login", json={
            "email":    email,
            "password": password,
        }, timeout=15)
        data = r.json()
        if data.get("success"):
            token = data["data"]["accessToken"]
            print(f"✅ Logged in as {email}")
            return token
        else:
            print(f"❌ Login failed: {data.get('message','Invalid credentials')}")
            return None
    except Exception as e:
        print(f"❌ Cannot reach SafeguardsIQ: {e}")
        return None

# ── GET PPE TYPES FOR CAMERA FROM DB ────────────────────────────
def get_ppe_types(cam_label, headers):
    try:
        r = requests.get(f"{API_BASE}/cameras", headers=headers, timeout=10)
        for c in r.json().get("data", []):
            if c.get("cam_label") == cam_label:
                return c.get("ppe_types") or ["Helmet", "Safety Vest", "Gloves"]
    except:
        pass
    return ["Helmet", "Safety Vest", "Gloves"]

# ── PROCESS ONE CAMERA ──────────────────────────────────────────
def process_camera(cam_label, rtsp_url, headers):
    print(f"\n[{cam_label}] Connecting to RTSP stream...")
    ppe_types   = get_ppe_types(cam_label, headers)
    retry_count = 0
    last_sent   = 0

    while True:
        cap = cv2.VideoCapture(rtsp_url)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

        if not cap.isOpened():
            retry_count += 1
            wait = min(retry_count * 5, 60)
            print(f"[{cam_label}] ❌ Cannot connect — retry {retry_count} in {wait}s")
            print(f"[{cam_label}]    Check: Is the camera IP reachable from this PC?")
            print(f"[{cam_label}]    Test in VLC: Media → Open Network Stream → paste RTSP URL")
            if retry_count >= 20:
                print(f"[{cam_label}] ❌ Stopped after 20 retries.")
                return
            time.sleep(wait)
            continue

        retry_count = 0
        print(f"[{cam_label}] ✅ Connected — AI checking every {FRAME_INTERVAL}s")
        print(f"[{cam_label}]    PPE types: {', '.join(ppe_types)}")

        while True:
            ret, frame = cap.read()
            if not ret:
                print(f"[{cam_label}] ⚠  Lost connection — reconnecting in 5s")
                break

            now = time.time()
            if now - last_sent < FRAME_INTERVAL:
                time.sleep(0.1)
                continue
            last_sent = now

            try:
                _, buf = cv2.imencode(
                    ".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY]
                )
                b64 = base64.b64encode(buf).decode("utf-8")

                r = requests.post(f"{API_BASE}/ai/detect", json={
                    "imageBase64": b64,
                    "cameraId":    cam_label,
                    "ppeTypes":    ppe_types,
                }, headers=headers, timeout=30)

                data       = r.json().get("data", {})
                persons    = data.get("persons_detected", 0)
                violations = data.get("violations", [])
                risk       = data.get("risk_level", "safe")
                ts         = datetime.now().strftime("%H:%M:%S")

                if violations:
                    types = ", ".join(v.get("type","?") for v in violations)
                    print(f"[{ts}] [{cam_label}] 🚨 VIOLATION — {types} | persons={persons} | risk={risk}")
                else:
                    print(f"[{ts}] [{cam_label}] ✅ Clear | persons={persons} | risk={risk}")

            except requests.exceptions.Timeout:
                print(f"[{cam_label}] ⚠  API timeout — next check in {FRAME_INTERVAL}s")
            except Exception as e:
                print(f"[{cam_label}] ⚠  Error: {e}")

        cap.release()
        time.sleep(5)


# ── MAIN ────────────────────────────────────────────────────────
def main():
    global TOKEN, CAMERAS

    print("\n" + "="*55)
    print("   SafeguardsIQ Camera Relay Agent")
    print("   Connects your factory cameras to AI safety monitoring")
    print("="*55 + "\n")

    # ── Step 1: Login ──
    print("Step 1 — Login to SafeguardsIQ")
    print("─"*40)
    email    = os.getenv("SAFEGUARDSIQ_EMAIL",    "").strip()
    password = os.getenv("SAFEGUARDSIQ_PASSWORD",  "").strip()

    if not email:
        email = input("  Email address: ").strip()
    if not password:
        import getpass
        password = getpass.getpass("  Password: ")

    TOKEN = login(email, password)
    if not TOKEN:
        sys.exit(1)

    headers = {
        "Authorization": f"Bearer {TOKEN}",
        "Content-Type":  "application/json",
    }

    # ── Step 2: Camera setup ──
    print("\nStep 2 — Add your cameras")
    print("─"*40)
    print("Enter RTSP URL for each camera.")
    print("Format: rtsp://USERNAME:PASSWORD@CAMERA_IP:554/stream1")
    print("(Press Enter with no label to finish)\n")

    # Check env vars first
    for i in range(1, 9):
        url = os.getenv(f"CAMERA_{i}", "").strip()
        lbl = os.getenv(f"CAMERA_{i}_LABEL", f"CAM-0{i}").strip()
        if url:
            CAMERAS[lbl] = url

    # If no env vars — interactive
    if not CAMERAS:
        while True:
            lbl = input(f"  Camera label (e.g. CAM-01, or Enter to finish): ").strip()
            if not lbl:
                break
            url = input(f"  RTSP URL for {lbl}: ").strip()
            if url:
                CAMERAS[lbl] = url
                print(f"  ✓ Added {lbl}\n")

    if not CAMERAS:
        print("❌ No cameras added. Exiting.")
        sys.exit(1)

    # ── Step 3: Start monitoring ──
    print(f"\n{'='*55}")
    print(f"  Starting AI monitoring on {len(CAMERAS)} camera(s)")
    print(f"  Frame check interval: every {FRAME_INTERVAL} seconds")
    print(f"  Violations will appear in your SafeguardsIQ dashboard")
    print(f"  WhatsApp alerts will be sent automatically")
    print(f"{'='*55}\n")
    print("  Press Ctrl+C to stop\n")

    threads = []
    for label, url in CAMERAS.items():
        # Show URL with password hidden
        display = url
        if "@" in url and "://" in url:
            proto, rest = url.split("://", 1)
            if "@" in rest:
                creds, host = rest.split("@", 1)
                display = f"{proto}://***@{host}"
        print(f"  Starting {label} → {display}")
        t = threading.Thread(
            target=process_camera,
            args=(label, url, headers),
            daemon=True
        )
        t.start()
        threads.append(t)
        time.sleep(1)

    print()
    try:
        while True:
            time.sleep(30)
            # Refresh token every 30 min to prevent expiry
    except KeyboardInterrupt:
        print("\n\nAgent stopped. Goodbye.")


if __name__ == "__main__":
    main()
