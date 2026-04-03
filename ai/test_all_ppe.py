# -*- coding: utf-8 -*-
"""
SafeguardsIQ - Claude Vision PPE Detection Test
Tests each PPE type one by one - with and without PPE
"""
import cv2
import base64
import requests
import time

AI_URL = "http://localhost:5050"

PPE_LIST = [
    "Helmet",
    "Safety Vest",
    "Gloves",
    "Goggles",
    "Face Mask",
    "Safety Boots",
]

def capture_frame():
    cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
    time.sleep(0.5)
    ret, frame = cap.read()
    cap.release()
    if not ret:
        print("ERROR: Cannot read webcam")
        return None
    _, buf = cv2.imencode(".jpg", frame)
    return base64.b64encode(buf).decode()

def detect(b64, ppe_types):
    try:
        res = requests.post(
            f"{AI_URL}/detect",
            json={
                "image_base64": b64,
                "camera_id":    "test",
                "ppe_types":    ppe_types,
            },
            timeout=30,
        )
        return res.json()
    except Exception as e:
        return {"error": str(e), "persons_detected": 0, "compliant": True, "violations": [], "summary": ""}

def print_result(data):
    print(f"  Persons  : {data.get('persons_detected', 0)}")
    print(f"  Compliant: {data.get('compliant', True)}")
    print(f"  Summary  : {data.get('summary', '')}")
    viols = data.get("violations", [])
    if viols:
        for v in viols:
            print(f"  VIOLATION: {v.get('type')} ({v.get('confidence')}%) -- {v.get('description','')}")
    else:
        print("  No violation detected")
    return viols

def sep(c="-", n=60):
    print(c * n)

def main():
    sep("=")
    print("SafeguardsIQ -- Claude Vision PPE Detection Test")
    print("Tests each PPE type WITH and WITHOUT PPE")
    sep("=")
    print()

    # Check agent is running
    try:
        r = requests.get(f"{AI_URL}/health", timeout=5)
        h = r.json()
        print(f"Agent  : {h.get('agent','unknown')}")
        print(f"Model  : {h.get('model','unknown')}")
        print(f"API Key: {'Set' if h.get('api_key_set') else 'NOT SET'}")
        if not h.get("api_key_set"):
            print("ERROR: Set ANTHROPIC_API_KEY first")
            return
    except Exception as e:
        print(f"ERROR: Agent not running -- {e}")
        print("Run: python claude_ppe_agent.py in another terminal")
        return

    print()

    # ── PHASE 1: WITHOUT PPE ──
    sep("=")
    print("PHASE 1 -- WITHOUT PPE (violation should be detected)")
    sep("=")
    input("Remove all PPE and press ENTER when ready...")
    print()

    without_results = {}
    for ppe in PPE_LIST:
        print(f"Testing: {ppe} -- WITHOUT PPE")
        sep()
        b64  = capture_frame()
        if not b64:
            continue
        data  = detect(b64, [ppe])
        viols = print_result(data)
        without_results[ppe] = len(viols) > 0
        print()
        time.sleep(1)

    sep("=")
    print("PHASE 1 SUMMARY")
    sep("=")
    for ppe, detected in without_results.items():
        mark   = "OK  " if detected else "FAIL"
        status = "Violation detected (correct)" if detected else "Not detected (needs work)"
        print(f"  [{mark}] {ppe}: {status}")

    print()

    # ── PHASE 2: WITH PPE ──
    sep("=")
    print("PHASE 2 -- WITH PPE (no violation should be detected)")
    sep("=")
    print()

    with_results = {}
    for ppe in PPE_LIST:
        print(f"PUT ON: {ppe}")
        input(f"Press ENTER when {ppe} is on...")
        sep()
        b64  = capture_frame()
        if not b64:
            continue
        data  = detect(b64, [ppe])
        viols = print_result(data)
        with_results[ppe] = len(viols) == 0
        print()
        time.sleep(1)

    sep("=")
    print("PHASE 2 SUMMARY")
    sep("=")
    for ppe, cleared in with_results.items():
        mark   = "OK  " if cleared else "WARN"
        status = "Cleared correctly" if cleared else "Still flagged (false positive)"
        print(f"  [{mark}] {ppe}: {status}")

    print()

    # ── PHASE 3: ALL TOGETHER ──
    sep("=")
    print("PHASE 3 -- ALL PPE TOGETHER")
    sep("=")

    print()
    print("Test A: Without any PPE")
    input("Remove all PPE and press ENTER...")
    b64  = capture_frame()
    data = detect(b64, PPE_LIST)
    print_result(data)

    print()
    print("Test B: With all PPE on")
    input("Put on ALL PPE and press ENTER...")
    b64  = capture_frame()
    data = detect(b64, PPE_LIST)
    print_result(data)

    print()

    # ── FINAL REPORT ──
    sep("=")
    print("FINAL REPORT")
    sep("=")
    print(f"  {'PPE Type':<16} {'No PPE Test':<28} {'With PPE Test'}")
    sep()
    for ppe in PPE_LIST:
        no_ppe = "OK - Detected"    if without_results.get(ppe) else "FAIL - Not Detected"
        with_p = "OK - Cleared"     if with_results.get(ppe)    else "WARN - False Positive"
        print(f"  {ppe:<16} {no_ppe:<28} {with_p}")

    print()
    working = sum(1 for v in without_results.values() if v)
    total   = len(PPE_LIST)
    print(f"  Detection rate: {working}/{total} PPE types working correctly")
    sep("=")

if __name__ == "__main__":
    main()
