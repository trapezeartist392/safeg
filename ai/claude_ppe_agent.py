# -*- coding: utf-8 -*-
"""
SafeguardsIQ -- Claude Vision Safety Agent
Detects: PPE violations, pathway violations, unsafe acts, accidents, near misses
Production agent for Indian manufacturing plants
"""

import cv2
import base64
import asyncio
import threading
import time
import logging
import os
import json
from datetime import datetime
from typing import Optional, List, Dict
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from pydantic import BaseModel
import anthropic
import requests as req_lib
import uvicorn
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("SafeG-Agent")

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
BACKEND_URL       = os.getenv("BACKEND_URL",        "http://localhost:4000")
FRAME_INTERVAL    = int(os.getenv("FRAME_INTERVAL", "30"))
ALERT_COOLDOWN    = int(os.getenv("ALERT_COOLDOWN", "45"))
PORT              = int(os.getenv("PORT",            "5050"))

active_streams:  Dict[str, dict] = {}
alert_cooldowns: Dict[str, float] = {}

VIOLATION_CATEGORIES = {
    "ppe":      "PPE Violation",
    "pathway":  "Pathway Violation",
    "unsafe":   "Unsafe Act",
    "accident": "Accident",
    "nearmiss": "Near Miss",
}

CATEGORY_ICONS = {
    "ppe":      "⛑️",
    "pathway":  "🚧",
    "unsafe":   "⚠️",
    "accident": "🚨",
    "nearmiss": "❗",
}

SEVERITY_COLORS = {
    "critical": "#FF0000",
    "high":     "#FF3D3D",
    "medium":   "#FFB400",
    "low":      "#22D468",
}

def build_prompt(ppe_types: List[str]) -> str:
    ppe_list = ", ".join(ppe_types)
    ppe_checks = "\n".join([f"- {p}: check if this specific item is worn" for p in ppe_types])
    return f"""You are an expert factory safety AI for Indian manufacturing plants (Factories Act 1948 compliance).

Analyze this camera frame for safety violations across 5 categories:

---
CATEGORY 1 - PPE VIOLATIONS
IMPORTANT: ONLY check for these SPECIFIC PPE items and NO others: {ppe_list}
Do NOT report violations for any PPE not in this list.
For every visible person check ONLY:
{ppe_checks}

---
CATEGORY 2 - PATHWAY & FLOOR SAFETY
- Person standing or walking in yellow restricted zone
- Person crossing red safety line
- Walkway/pathway blocked by equipment, boxes, pallets
- Person in forklift/vehicle operating zone
- Emergency exit blocked or obstructed
- Safety markings faded, damaged, or missing
- Spill or wet floor without warning sign

---
CATEGORY 3 - UNSAFE ACTS
- Working at height without harness
- Two people operating same machine simultaneously
- Bypassing machine guard or safety interlock
- Using phone/distracted near moving machinery
- Running in factory floor
- Improper manual lifting (back bent, overload)
- Worker fatigue signs (slouching, leaning on machine)
- Unsecured load or material stacking too high
- Operating equipment without proper authorization
- Smoking in non-designated area
- Horseplay or non-work behaviour near hazard

---
CATEGORY 4 - ACCIDENTS (active incident)
- Person fallen on floor
- Worker caught in machinery
- Fire or smoke visible
- Chemical spill or leak visible
- Electrical arc or spark visible
- Collapse of material or structure
- Person trapped or pinned
- Blood or injury visible

---
CATEGORY 5 - NEAR MISSES (hazard about to cause harm)
- Person stepping into pinch point
- Unsecured object about to fall on person below
- Vehicle approaching person from behind
- Person reaching into moving machinery
- Overloaded electrical socket or exposed wire near person
- Person slipping or losing balance
- Stack of materials leaning and about to topple

---
Respond ONLY in this exact JSON format — no other text before or after:
{{
  "persons_detected": <number>,
  "compliant": <true or false>,
  "risk_level": "<safe or low or medium or high or critical>",
  "violations": [
    {{
      "ppe_type": "<specific violation name>",
      "category": "<ppe or pathway or unsafe or accident or nearmiss>",
      "description": "<specific clear description of what was seen>",
      "confidence": <0 to 100>,
      "severity": "<critical or high or medium or low>",
      "location": "<left or right or center or background or foreground>",
      "immediate_action": "<what supervisor should do right now>"
    }}
  ],
  "pathway_safe": <true or false>,
  "summary": "<one clear sentence describing the overall safety status>"
}}

Rules:
- Be strict — flag anything suspicious
- If a person is visible and PPE cannot be clearly confirmed, flag it
- Accidents and near misses are CRITICAL severity always
- If nothing unsafe is detected, return empty violations array"""


def analyse_frame(frame, ppe_types: List[str], camera_id: str) -> dict:
    if not ANTHROPIC_API_KEY:
        return {"persons_detected":0,"compliant":True,"violations":[],"summary":"API key not set","risk_level":"safe"}
    try:
        client   = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        _, buf   = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
        b64      = base64.b64encode(buf).decode("utf-8")

        response = client.messages.create(
            model      = "claude-sonnet-4-20250514",
            max_tokens = 1000,
            messages   = [{
                "role": "user",
                "content": [
                    {"type":"image","source":{"type":"base64","media_type":"image/jpeg","data":b64}},
                    {"type":"text","text":build_prompt(ppe_types)},
                ]
            }]
        )

        raw   = response.content[0].text.strip()
        start = raw.find("{")
        end   = raw.rfind("}") + 1
        if start >= 0 and end > start:
            raw = raw[start:end]
        result = json.loads(raw)
        log.info(f"{camera_id}: {result.get('persons_detected',0)} persons | "
                 f"{len(result.get('violations',[]))} violations | "
                 f"risk={result.get('risk_level','?')}")
        return result
    except Exception as e:
        log.error(f"Claude API error: {e}")
        return {"persons_detected":0,"compliant":True,"violations":[],"summary":f"Error: {e}","risk_level":"safe"}


def send_violation(violation: dict, camera_id: str, tenant_id: str,
                   plant_id: str, area_id: str, frame_b64: str, token: str):
    key = f"{camera_id}_{violation['ppe_type']}_{violation.get('category','ppe')}"
    now = time.time()
    if key in alert_cooldowns and now - alert_cooldowns[key] < ALERT_COOLDOWN:
        return
    # Critical violations bypass cooldown
    if violation.get("severity") in ["critical","accident"]:
        alert_cooldowns[key] = now
    else:
        alert_cooldowns[key] = now
    try:
        hdrs = {"Authorization":f"Bearer {token}","Content-Type":"application/json"} if token else {}
        req_lib.post(f"{BACKEND_URL}/api/v1/violations", json={
            "cameraId":       camera_id,
            "tenantId":       tenant_id,
            "plantId":        plant_id,
            "areaId":         area_id,
            "violationType":  violation["ppe_type"],
            "category":       violation.get("category","ppe"),
            "confidence":     violation["confidence"],
            "severity":       violation.get("severity","high"),
            "description":    violation.get("description",""),
            "immediateAction":violation.get("immediate_action",""),
            "location":       violation.get("location",""),
            "frameImage":     frame_b64,
            "detectedAt":     datetime.utcnow().isoformat(),
            "source":         "claude-vision-agent",
        }, headers=hdrs, timeout=5)
        log.info(f"[{violation.get('category','ppe').upper()}] {violation['ppe_type']} "
                 f"({violation['confidence']}%) on {camera_id}")
    except Exception as e:
        log.warning(f"Backend send failed: {e}")


def get_capture(rtsp_url: str):
    if rtsp_url.startswith("webcam:"):
        idx = int(rtsp_url.split(":")[1])
        cap = cv2.VideoCapture(idx, cv2.CAP_DSHOW)
        if not cap.isOpened():
            cap = cv2.VideoCapture(idx)
        return cap
    cap = cv2.VideoCapture(rtsp_url)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    return cap


def process_stream(camera_id, rtsp_url, tenant_id, plant_id, area_id,
                   ppe_types, token):
    log.info(f"Stream started: {camera_id}")
    frame_count = 0
    retry_count = 0

    while active_streams.get(camera_id, {}).get("running"):
        cap = get_capture(rtsp_url)
        if not cap or not cap.isOpened():
            retry_count += 1
            active_streams[camera_id]["status"] = f"retrying {retry_count}/5"
            if retry_count >= 5:
                active_streams[camera_id].update({"status":"error","running":False})
                break
            time.sleep(5)
            continue

        retry_count = 0
        active_streams[camera_id]["status"] = "running"

        while active_streams.get(camera_id, {}).get("running"):
            ret, frame = cap.read()
            if not ret:
                break

            frame_count += 1
            if frame_count % FRAME_INTERVAL != 0:
                continue

            try:
                active_streams[camera_id]["status"] = "analysing"
                result     = analyse_frame(frame, ppe_types, camera_id)
                violations = result.get("violations", [])
                persons    = result.get("persons_detected", 0)

                # Categorise violations
                ppe_viols      = [v for v in violations if v.get("category") == "ppe"]
                pathway_viols  = [v for v in violations if v.get("category") == "pathway"]
                unsafe_viols   = [v for v in violations if v.get("category") == "unsafe"]
                accident_viols = [v for v in violations if v.get("category") == "accident"]
                nearmiss_viols = [v for v in violations if v.get("category") == "nearmiss"]

                # Only show violations from current frame
                # Filter PPE violations to only selected ppe_types
                # Keep all non-PPE violations (pathway, unsafe, accident, nearmiss)
                PPE_KEYWORDS = {
                    "Helmet":       ["helmet","hardhat","hard hat","head protection","chin strap"],
                    "Safety Vest":  ["vest","hi-vis","high vis","hiviz","high visibility"],
                    "Gloves":       ["glove","gloves","hand protection","hand"],
                    "Safety Boots": ["boot","boots","footwear","shoe","shoes","feet","foot"],
                    "Goggles":      ["goggle","goggles","eye protection","spectacle","face shield"],
                    "Face Mask":    ["mask","face mask","respirator","mouth","face covering"],
                }
                filtered_violations = []
                for v in violations:
                    cat = v.get("category", "ppe")
                    if cat == "ppe":
                        vtype   = v["ppe_type"].lower().replace("_"," ").replace("-"," ")
                        matched = False
                        for selected_ppe in ppe_types:
                            keywords = PPE_KEYWORDS.get(selected_ppe, [selected_ppe.lower()])
                            if any(kw in vtype for kw in keywords):
                                v["ppe_type"] = selected_ppe  # normalize to exact name
                                matched = True
                                break
                        if matched:
                            filtered_violations.append(v)
                    else:
                        filtered_violations.append(v)

                violations    = filtered_violations
                ppe_viols     = [v for v in violations if v.get("category") == "ppe"]
                pathway_viols = [v for v in violations if v.get("category") == "pathway"]
                unsafe_viols  = [v for v in violations if v.get("category") == "unsafe"]
                accident_viols= [v for v in violations if v.get("category") == "accident"]
                nearmiss_viols= [v for v in violations if v.get("category") == "nearmiss"]

                new_viols    = [v["ppe_type"] for v in violations]
                new_cats     = [v.get("category","ppe") for v in violations]
                merged_viols = new_viols
                merged_cats  = new_cats

                active_streams[camera_id].update({
                    "status":              "running",
                    "last_detection":      datetime.utcnow().isoformat(),
                    "persons_detected":    persons,
                    "risk_level":          result.get("risk_level","safe"),
                    "violations_today":    active_streams[camera_id].get("violations_today",0) + len(violations),
                    "ppe_violations":      len(ppe_viols),
                    "pathway_violations":  len(pathway_viols),
                    "unsafe_violations":   len(unsafe_viols),
                    "accident_violations": len(accident_viols),
                    "nearmiss_violations": len(nearmiss_viols),
                    "current_violations":  [v["ppe_type"] for v in violations],
                    "current_categories":  [v.get("category","ppe") for v in violations],
                    "last_violation":      violations[0]["ppe_type"] if violations else active_streams[camera_id].get("last_violation"),
                    "last_category":       violations[0].get("category","ppe") if violations else active_streams[camera_id].get("last_category"),
                    "last_violations_list": [{"type":v["ppe_type"],"category":v.get("category","ppe"),"confidence":v.get("confidence",0),"description":v.get("description","")} for v in violations] if violations else active_streams[camera_id].get("last_violations_list",[]),
                    "last_summary":        result.get("summary",""),
                    "compliant":           result.get("compliant", True),
                    "pathway_safe":        result.get("pathway_safe", True),
                })

                if violations:
                    _, buf    = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
                    frame_b64 = base64.b64encode(buf).decode("utf-8")
                    for v in violations:
                        send_violation(v, camera_id, tenant_id, plant_id, area_id, frame_b64, token)

            except Exception as e:
                log.error(f"Frame error: {e}")
                active_streams[camera_id]["status"] = "running"

        cap.release()

    if camera_id in active_streams:
        active_streams[camera_id]["status"] = "stopped"
    log.info(f"Stream stopped: {camera_id}")


# ── FASTAPI ──
@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("SafeguardsIQ Claude Safety Agent starting...")
    log.info(f"API Key: {'Set' if ANTHROPIC_API_KEY else 'NOT SET'}")
    log.info("Detects: PPE | Pathway | Unsafe Acts | Accidents | Near Misses")
    yield

app = FastAPI(title="SafeguardsIQ Claude Safety Agent", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


class DetectRequest(BaseModel):
    image_base64: str
    camera_id:    str
    ppe_types:    Optional[List[str]] = ["Helmet","Safety Vest","Gloves","Goggles","Face Mask","Safety Boots"]

class StreamStartRequest(BaseModel):
    camera_id:  str
    rtsp_url:   str
    tenant_id:  str
    plant_id:   Optional[str] = None
    area_id:    Optional[str] = None
    ppe_types:  Optional[List[str]] = ["Helmet","Safety Vest","Gloves","Goggles","Face Mask","Safety Boots"]
    token:      Optional[str] = None

class StreamStopRequest(BaseModel):
    camera_id: str


@app.get("/health")
def health():
    return {
        "status":          "ok",
        "agent":           "claude-vision",
        "model":           "claude-sonnet-4-20250514",
        "api_key_set":     bool(ANTHROPIC_API_KEY),
        "detects":         ["PPE","Pathway","Unsafe Acts","Accidents","Near Misses"],
        "active_streams":  len([s for s in active_streams.values() if s.get("running")]),
        "timestamp":       datetime.utcnow().isoformat(),
    }


@app.post("/detect")
async def detect_frame(req: DetectRequest):
    if not ANTHROPIC_API_KEY:
        raise HTTPException(503, "ANTHROPIC_API_KEY not configured")
    try:
        import numpy as np
        frame = cv2.imdecode(np.frombuffer(base64.b64decode(req.image_base64), np.uint8), cv2.IMREAD_COLOR)
        if frame is None:
            raise HTTPException(400, "Invalid image")

        result     = analyse_frame(frame, req.ppe_types, req.camera_id)
        PPE_KEYWORDS = {
            "Helmet":       ["helmet","hardhat","hard hat","chin strap","head"],
            "Safety Vest":  ["vest","hi-vis","high vis","hiviz","high visibility"],
            "Gloves":       ["glove","gloves","hand protection","hand"],
            "Safety Boots": ["boot","boots","footwear","shoe","shoes","feet","foot"],
            "Goggles":      ["goggle","goggles","eye protection","spectacle","face shield"],
            "Face Mask":    ["mask","face mask","respirator","mouth","face covering"],
        }
        all_viols  = result.get("violations", [])
        violations = []
        for v in all_viols:
            cat = v.get("category", "ppe")
            if cat != "ppe":
                violations.append(v)
                continue
            vtype = v["ppe_type"].lower().replace("_"," ").replace("-"," ").strip()
            for sel in req.ppe_types:
                kws = PPE_KEYWORDS.get(sel, [sel.lower()])
                if any(kw in vtype for kw in kws):
                    v["ppe_type"] = sel
                    violations.append(v)
                    break

        return {
            "success":             True,
            "camera_id":           req.camera_id,
            "persons_detected":    result.get("persons_detected", 0),
            "risk_level":          result.get("risk_level", "safe"),
            "compliant":           result.get("compliant", True),
            "pathway_safe":        result.get("pathway_safe", True),
            "summary":             result.get("summary", ""),
            "violation_count":     len(violations),
            "ppe_violations":      len([v for v in violations if v.get("category")=="ppe"]),
            "pathway_violations":  len([v for v in violations if v.get("category")=="pathway"]),
            "unsafe_violations":   len([v for v in violations if v.get("category")=="unsafe"]),
            "accident_violations": len([v for v in violations if v.get("category")=="accident"]),
            "nearmiss_violations": len([v for v in violations if v.get("category")=="nearmiss"]),
            "violations": [{
                "type":             v["ppe_type"],
                "category":         v.get("category","ppe"),
                "confidence":       v["confidence"],
                "description":      v.get("description",""),
                "severity":         v.get("severity","high"),
                "location":         v.get("location",""),
                "immediate_action": v.get("immediate_action",""),
            } for v in violations],
            "timestamp": datetime.utcnow().isoformat(),
        }
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/stream/start")
async def start_stream(req: StreamStartRequest):
    if not ANTHROPIC_API_KEY:
        raise HTTPException(503, "ANTHROPIC_API_KEY not configured")
    if req.camera_id in active_streams and active_streams[req.camera_id].get("running"):
        return {"success":True,"message":"Already running","camera_id":req.camera_id}

    active_streams[req.camera_id] = {
        "running":             True,
        "status":              "connecting",
        "rtsp_url":            req.rtsp_url,
        "ppe_types":           req.ppe_types,
        "started_at":          datetime.utcnow().isoformat(),
        "last_detection":      None,
        "violations_today":    0,
        "persons_detected":    0,
        "risk_level":          "safe",
        "ppe_violations":      0,
        "pathway_violations":  0,
        "unsafe_violations":   0,
        "accident_violations": 0,
        "nearmiss_violations": 0,
        "current_violations":  [],
        "current_categories":  [],
        "last_violation":      None,
        "last_category":       None,
        "last_summary":        "",
        "compliant":           True,
        "pathway_safe":        True,
        "agent":               "claude-vision",
    }

    threading.Thread(
        target=process_stream,
        args=(req.camera_id, req.rtsp_url, req.tenant_id,
              req.plant_id, req.area_id, req.ppe_types, req.token),
        daemon=True
    ).start()

    return {"success":True,"message":f"Claude Safety Agent started: {req.camera_id}","camera_id":req.camera_id}


@app.post("/stream/stop")
async def stop_stream(req: StreamStopRequest):
    if req.camera_id in active_streams:
        active_streams[req.camera_id]["running"] = False
        # Clear all cached violation data on stop
        active_streams.pop(req.camera_id, None)
    return {"success":True,"message":f"Stopping {req.camera_id}"}


@app.post("/stream/clear")
async def clear_all():
    for cid in list(active_streams.keys()):
        active_streams[cid]["running"] = False
    active_streams.clear()
    alert_cooldowns.clear()
    return {"success":True,"message":"All streams cleared"}

@app.get("/stream/status")
async def all_status():
    return {"success":True,"streams":{
        cid:{k:v for k,v in info.items() if k != "running"}
        for cid,info in active_streams.items()
    }}

@app.get("/stream/status/{camera_id}")
async def one_status(camera_id: str):
    if camera_id not in active_streams:
        raise HTTPException(404, "Not found")
    return {"success":True,"camera_id":camera_id,"stream":active_streams[camera_id]}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=PORT, reload=False)
