"""
SafeG AI Engine Stub
────────────────────
Simulates the Python FastAPI AI service that the Node.js backend calls.
In production this would run actual YOLOv8 PPE detection on RTSP streams.

Install: pip install fastapi uvicorn httpx
Run:     uvicorn main:app --host 0.0.0.0 --port 5001
"""

from fastapi import FastAPI, Header, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List
import asyncio, random, httpx, os, logging
from datetime import datetime

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("safeg-ai")

app = FastAPI(title="SafeG AI Engine", version="1.0.0")

API_KEY     = os.getenv("API_KEY", "internal_ai_key")
BACKEND_URL = os.getenv("BACKEND_URL", "http://api:4000")

# In-memory camera registry
cameras: dict = {}

# ── Auth
def verify_key(x_api_key: str = Header(None)):
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorised")

# ── Models
class CameraRegister(BaseModel):
    cameraId: str
    tenantId: str
    plantId:  str
    rtspUrl:  Optional[str]
    camLabel: str

class CameraTest(BaseModel):
    rtspUrl:  str
    cameraId: str

class FrameRequest(BaseModel):
    cameraId: str

# ── PPE event types
PPE_VIOLATIONS = [
    "no_helmet", "no_vest", "no_boots",
    "no_eye_protection", "no_gloves", "no_ear_protection",
    "danger_zone_breach", "motion_in_restricted_area",
]
PPE_COMPLIANT = ["helmet_ok", "vest_ok", "boots_ok", "all_ppe_compliant"]

# ════════════════════════════════════════════════════
# ENDPOINTS
# ════════════════════════════════════════════════════

@app.get("/health")
def health():
    return {"status": "ok", "cameras_registered": len(cameras), "timestamp": datetime.utcnow().isoformat()}

@app.post("/api/camera/register")
async def register_camera(payload: CameraRegister, x_api_key: str = Header(None)):
    verify_key(x_api_key)
    cameras[payload.cameraId] = {
        "tenantId": payload.tenantId,
        "plantId":  payload.plantId,
        "rtspUrl":  payload.rtspUrl,
        "camLabel": payload.camLabel,
        "status":   "registered",
        "registeredAt": datetime.utcnow().isoformat(),
    }
    log.info(f"Camera registered: {payload.camLabel} ({payload.cameraId})")
    return {"success": True, "cameraId": payload.cameraId}

@app.post("/api/camera/deregister")
async def deregister_camera(payload: dict, x_api_key: str = Header(None)):
    verify_key(x_api_key)
    cam = payload.get("camera", {})
    cameras.pop(cam.get("id", ""), None)
    return {"success": True}

@app.post("/api/camera/update")
async def update_camera(payload: dict, x_api_key: str = Header(None)):
    verify_key(x_api_key)
    cam = payload.get("camera", {})
    if cam.get("id") in cameras:
        cameras[cam["id"]].update(cam)
    return {"success": True}

@app.post("/api/camera/restart")
async def restart_camera(payload: dict, x_api_key: str = Header(None)):
    verify_key(x_api_key)
    cam_id = payload.get("camera", {}).get("id", "")
    if cam_id in cameras:
        cameras[cam_id]["status"] = "restarting"
    return {"success": True, "message": "Restart initiated"}

@app.post("/api/camera/test")
async def test_camera(payload: CameraTest, x_api_key: str = Header(None)):
    verify_key(x_api_key)
    # Simulate connection test
    await asyncio.sleep(0.5)
    success = bool(payload.rtspUrl and "192.168" in payload.rtspUrl or random.random() > 0.2)
    return {
        "success":    success,
        "fps":        round(random.uniform(3.5, 4.2), 1) if success else 0,
        "resolution": "1920x1080" if success else None,
        "latencyMs":  random.randint(80, 250) if success else None,
    }

@app.get("/api/camera/{camera_id}/frame")
async def get_frame(camera_id: str, x_api_key: str = Header(None)):
    """Returns a placeholder JPEG frame (in production: actual decoded frame)"""
    verify_key(x_api_key)
    # Return 1x1 grey JPEG placeholder
    import base64
    placeholder = base64.b64decode(
        "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8U"
        "HRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgN"
        "DRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIy"
        "MjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAA"
        "AAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/"
        "aAAwDAQACEQMRAD8AJQAB/9k="
    )
    from fastapi.responses import Response
    return Response(content=placeholder, media_type="image/jpeg")

# ════════════════════════════════════════════════════
# BACKGROUND: Simulate AI detection events
# ════════════════════════════════════════════════════

async def simulate_detections():
    """
    Simulates the AI engine sending detection events to the Node.js backend.
    In production this would be replaced by actual YOLOv8 inference on RTSP frames.
    """
    await asyncio.sleep(10)  # Wait for startup
    log.info("Starting AI detection simulation loop")

    async with httpx.AsyncClient() as client:
        while True:
            await asyncio.sleep(random.uniform(8, 25))  # Random interval

            for cam_id, cam in list(cameras.items()):
                if random.random() < 0.15:  # 15% chance of event per cycle
                    is_violation = random.random() < 0.25  # 25% of events are violations
                    event_type   = random.choice(PPE_VIOLATIONS if is_violation else PPE_COMPLIANT)
                    confidence   = round(random.uniform(82, 99), 1)

                    payload = {
                        "cameraId":   cam_id,
                        "tenantId":   cam["tenantId"],
                        "plantId":    cam["plantId"],
                        "areaId":     None,
                        "camLabel":   cam["camLabel"],
                        "eventType":  event_type,
                        "isViolation": is_violation,
                        "confidence": confidence,
                        "frameUrl":   f"s3://safeg-ai-evidence/{cam_id}/{datetime.utcnow().isoformat()}.jpg",
                        "workerBbox": {"x": random.randint(100,500), "y": random.randint(50,300), "w": 120, "h": 200},
                        "shift":      "morning",
                    }

                    try:
                        await client.post(
                            f"{BACKEND_URL}/api/v1/webhooks/ai-detection",
                            json=payload,
                            headers={"X-Api-Key": API_KEY},
                            timeout=5,
                        )
                        if is_violation:
                            log.info(f"🚨 Violation sent: {event_type} at {cam['camLabel']} (confidence: {confidence}%)")
                    except Exception as e:
                        log.warning(f"Failed to send event: {e}")

                # Send health heartbeat
                if random.random() < 0.3:
                    try:
                        await client.post(
                            f"{BACKEND_URL}/api/v1/webhooks/camera-health",
                            json={
                                "cameraId": cam_id,
                                "status": "online",
                                "latencyMs": random.randint(10, 50),
                                "fps": round(random.uniform(3.8, 4.2), 1),
                            },
                            headers={"X-Api-Key": API_KEY},
                            timeout=3,
                        )
                    except:
                        pass

@app.on_event("startup")
async def startup():
    asyncio.create_task(simulate_detections())
    log.info("SafeG AI Engine stub started on port 5001")
