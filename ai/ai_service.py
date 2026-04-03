"""
SafeguardsIQ — AI PPE Detection Service
Supports: RTSP streams, webcam (webcam:0), test video files
"""
import cv2, base64, asyncio, requests, threading, numpy as np
from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from pydantic import BaseModel
from typing import Optional, List, Dict
import uvicorn, logging, os, time

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("SafeG-AI")

BACKEND_URL    = os.getenv("BACKEND_URL",    "http://localhost:4000")
CONFIDENCE     = float(os.getenv("CONFIDENCE",    "0.35"))
FRAME_INTERVAL = int(os.getenv("FRAME_INTERVAL",  "15"))
ALERT_COOLDOWN = int(os.getenv("ALERT_COOLDOWN",  "30"))
PORT           = int(os.getenv("PORT",            "5001"))

PPE_VIOLATION_MAP = {
    "no-hardhat":      "Helmet",
    "no_hardhat":      "Helmet",
    "no hardhat":      "Helmet",
    "no-safety vest":  "Safety Vest",
    "no-safety-vest":  "Safety Vest",
    "no_safety_vest":  "Safety Vest",
    "no safety vest":  "Safety Vest",
    "no-mask":         "Face Mask",
    "no_mask":         "Face Mask",
    "no mask":         "Face Mask",
}

model = None
model_person = None
active_streams: Dict[str, dict] = {}
alert_cooldowns: Dict[str, float] = {}

def load_model():
    global model, model_person
    try:
        from ultralytics import YOLO
        for mp in ["ppe_full.pt", "best.pt", "yolov8n.pt"]:
            if os.path.exists(mp):
                model = YOLO(mp)
                log.info(f"PPE model loaded: {mp} — {list(model.names.values())}")
                break
        model_person = YOLO('person_yolov8s-seg.pt')
        log.info(f"PPE model classes: {list(model.names.values())}")
        log.info(f"Person model classes: {list(model_person.names.values())}")
    except Exception as e:
        log.error(f"Model load failed: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("SafeguardsIQ AI Service starting...")
    asyncio.get_event_loop().run_in_executor(None, load_model)
    yield

app = FastAPI(title="SafeguardsIQ AI", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

class DetectRequest(BaseModel):
    image_base64: str
    camera_id:    str
    ppe_types:    Optional[List[str]] = ["Helmet","Safety Vest"]
    confidence:   Optional[float]     = CONFIDENCE

class StreamStartRequest(BaseModel):
    camera_id:  str
    rtsp_url:   str
    tenant_id:  str
    plant_id:   Optional[str] = None
    area_id:    Optional[str] = None
    ppe_types:  Optional[List[str]] = ["Helmet","Safety Vest"]
    confidence: Optional[float]     = CONFIDENCE
    token:      Optional[str]       = None

class StreamStopRequest(BaseModel):
    camera_id: str

def detect_ppe(frame, ppe_types, conf_thresh=0.1):
    violations = []
    persons    = 0
    compliant  = set()
    person_boxes = []

    if model is None:
        return [], 0

    # Use PPE model for everything — it has Person class too
    res_ppe = model(frame, conf=0.25, verbose=False)
    for result in res_ppe:
        if result.boxes is None:
            continue
        for box in result.boxes:
            cls_id = int(box.cls[0])
            conf   = float(box.conf[0])
            label  = result.names[cls_id].lower().strip()
            coords = box.xyxy[0].tolist()

            # Count persons — use NMS to avoid double counting
            if label == "person":
                # Check if this box overlaps with existing person box
                overlap = False
                for pb in person_boxes:
                    ix1 = max(coords[0], pb[0])
                    iy1 = max(coords[1], pb[1])
                    ix2 = min(coords[2], pb[2])
                    iy2 = min(coords[3], pb[3])
                    if ix2 > ix1 and iy2 > iy1:
                        inter = (ix2-ix1)*(iy2-iy1)
                        area1 = (coords[2]-coords[0])*(coords[3]-coords[1])
                        area2 = (pb[2]-pb[0])*(pb[3]-pb[1])
                        iou   = inter / (area1 + area2 - inter)
                        if iou > 0.3:
                            overlap = True
                            break
                if not overlap:
                    persons += 1
                    person_boxes.append(coords)
                continue

            # Mark compliant PPE — only if high confidence
            if label in ["hardhat","helmet","safety vest","gloves",
                         "safety shoes","mask"] and conf >= 0.5:
                ppe_map = {
                    "hardhat":      "Helmet",
                    "helmet":       "Helmet",
                    "safety vest":  "Safety Vest",
                    "gloves":       "Gloves",
                    "safety shoes": "Safety Boots",
                    "mask":         "Face Mask",
                }
                ppe_type = ppe_map.get(label)
                if ppe_type:
                    compliant.add(ppe_type)
                continue

            # Check violation
            viol = PPE_VIOLATION_MAP.get(label)
            if viol and viol in ppe_types and conf >= 0.3:
                violations.append({
                    "type":       viol,
                    "confidence": round(conf * 100, 1),
                    "bbox":       [round(c) for c in coords],
                    "label":      label,
                })

    # Remove violations where PPE is confirmed worn
    violations = [v for v in violations if v["type"] not in compliant]

    # Also use person model as backup if no persons detected
    if persons == 0 and model_person is not None:
        res_p = model_person(frame, conf=0.3, verbose=False)
        for result in res_p:
            if result.boxes is None:
                continue
            for box in result.boxes:
                label = result.names[int(box.cls[0])].lower()
                if label in ["person","worker","human"]:
                    persons += 1

    return violations, persons

def encode_frame(frame):
    _, buf = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY,75])
    return base64.b64encode(buf).decode('utf-8')

def send_violation(v, camera_id, tenant_id, plant_id, area_id, frame_b64, token):
    key = f"{camera_id}_{v['type']}"
    now = time.time()
    if key in alert_cooldowns and now - alert_cooldowns[key] < ALERT_COOLDOWN:
        return
    alert_cooldowns[key] = now
    try:
        hdrs = {"Authorization":f"Bearer {token}","Content-Type":"application/json"} if token else {}
        requests.post(f"{BACKEND_URL}/api/v1/violations", json={
            "cameraId":v["type"],"tenantId":tenant_id,"plantId":plant_id,"areaId":area_id,
            "violationType":v["type"],"confidence":v["confidence"],
            "severity":"high" if v["confidence"]>85 else "medium",
            "frameImage":frame_b64,"detectedAt":datetime.utcnow().isoformat(),"bbox":v.get("bbox",[]),
        }, headers=hdrs, timeout=5)
        log.info(f"VIOLATION: {v['type']} {v['confidence']}% on {camera_id}")
    except Exception as e:
        log.warning(f"Backend send failed: {e}")

def get_capture(rtsp_url):
    if rtsp_url.startswith("webcam:"):
        idx = int(rtsp_url.split(":")[1])
        log.info(f"Opening webcam {idx}")
        cap = cv2.VideoCapture(idx, cv2.CAP_DSHOW)
        if not cap.isOpened():
            cap = cv2.VideoCapture(idx)
        return cap
    log.info(f"Opening RTSP: {rtsp_url}")
    cap = cv2.VideoCapture(rtsp_url)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    return cap

def process_stream(camera_id, rtsp_url, tenant_id, plant_id, area_id, ppe_types, confidence, token):
    log.info(f"Stream thread started: {camera_id}")
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
                violations, persons = detect_ppe(frame, ppe_types, confidence)
                active_streams[camera_id].update({
                    "last_detection":datetime.utcnow().isoformat(),
                    "persons_detected":persons,
                    "violations_today":active_streams[camera_id].get("violations_today",0)+len(violations),
                    "last_violation":violations[0]["type"] if violations else active_streams[camera_id].get("last_violation"),
                })
                if violations:
                    fb = encode_frame(frame)
                    for v in violations:
                        send_violation(v, camera_id, tenant_id, plant_id, area_id, fb, token)
            except Exception as e:
                log.error(f"Detection error: {e}")
        cap.release()
    if camera_id in active_streams:
        active_streams[camera_id]["status"] = "stopped"
    log.info(f"Stream stopped: {camera_id}")

@app.get("/health")
def health():
    return {
        "status":"ok","model_loaded":model is not None,
        "model_classes":list(model.names.values()) if model else [],
        "active_streams":len([s for s in active_streams.values() if s.get("running")]),
        "timestamp":datetime.utcnow().isoformat(),
    }

@app.get("/webcams")
def list_webcams():
    cams = []
    for i in range(5):
        cap = cv2.VideoCapture(i, cv2.CAP_DSHOW)
        if cap.isOpened():
            ret, _ = cap.read()
            if ret:
                cams.append({"index":i,"url":f"webcam:{i}",
                    "width":int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)),
                    "height":int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))})
            cap.release()
    return {"success":True,"webcams":cams,"count":len(cams)}

@app.post("/detect")
async def detect_frame(req: DetectRequest):
    if model is None:
        raise HTTPException(503, "Model not loaded yet")
    try:
        frame = cv2.imdecode(np.frombuffer(base64.b64decode(req.image_base64), np.uint8), cv2.IMREAD_COLOR)
        if frame is None:
            raise HTTPException(400, "Invalid image")
        violations, persons = detect_ppe(frame, req.ppe_types, req.confidence)
        return {"success":True,"camera_id":req.camera_id,"persons_detected":persons,
                "violations":violations,"violation_count":len(violations),
                "timestamp":datetime.utcnow().isoformat()}
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/stream/start")
async def start_stream(req: StreamStartRequest):
    if req.camera_id in active_streams and active_streams[req.camera_id].get("running"):
        return {"success":True,"message":"Already running","camera_id":req.camera_id}
    active_streams[req.camera_id] = {
        "running":True,"status":"connecting","rtsp_url":req.rtsp_url,
        "ppe_types":req.ppe_types,"started_at":datetime.utcnow().isoformat(),
        "last_detection":None,"violations_today":0,"persons_detected":0,"last_violation":None,
    }
    threading.Thread(target=process_stream,
        args=(req.camera_id,req.rtsp_url,req.tenant_id,req.plant_id,
              req.area_id,req.ppe_types,req.confidence,req.token),
        daemon=True).start()
    return {"success":True,"message":f"Stream started: {req.camera_id}","camera_id":req.camera_id}

@app.post("/stream/stop")
async def stop_stream(req: StreamStopRequest):
    if req.camera_id not in active_streams:
        raise HTTPException(404,"Stream not found")
    active_streams[req.camera_id]["running"] = False
    return {"success":True,"message":f"Stopping {req.camera_id}"}

@app.get("/stream/status")
async def all_status():
    return {"success":True,"streams":{cid:{k:v for k,v in info.items() if k!="running"} for cid,info in active_streams.items()}}

@app.get("/stream/status/{camera_id}")
async def one_status(camera_id: str):
    if camera_id not in active_streams:
        raise HTTPException(404,"Not found")
    return {"success":True,"camera_id":camera_id,"stream":active_streams[camera_id]}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=5050, reload=False)
