"""BuildPulse API. Run:  uvicorn main:app --reload --port 8000   (from the backend folder)"""
import io, json, datetime as dt
import numpy as np
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image, ImageOps
import forecast, vision

app = FastAPI(title="BuildPulse API", version="0.1")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
detector = vision.StageDetector()

def blur_score(img):                                     # Laplacian variance; low = blurry (warning only)
    g = np.asarray(img.convert("L"), dtype=float)
    lap = g[1:-1, :-2] + g[1:-1, 2:] + g[:-2, 1:-1] + g[2:, 1:-1] - 4 * g[1:-1, 1:-1]
    return float(lap.var())

@app.get("/api/v1/health")
def health():
    return {"ok": True, "vision_model_loaded": detector.available, "vision_model_version": detector.version,
            "forecast_model_ready": forecast.MODEL_PATH.exists()}

@app.post("/api/v1/analyse")
async def analyse(files: list[UploadFile] = File(...), weights: str = Form("[20,25,25,15,15]"),
                  stages: str = Form(json.dumps(vision.CLASSES)), threshold: float = Form(0.60)):
    if not detector.available:
        raise HTTPException(503, "No trained stage-detection model found at backend/models/stage_seg.pt. Train it with train_vision.py.")
    w, st = json.loads(weights), json.loads(stages)
    if abs(sum(w) - 100) > 0.05: raise HTTPException(422, "Stage weights must add up to 100%.")
    per_photo, warnings = [], []
    for f in files[:20]:
        try:
            img = ImageOps.exif_transpose(Image.open(io.BytesIO(await f.read()))).convert("RGB")   # re-encode drops EXIF/GPS
        except Exception:
            raise HTTPException(422, f"{f.filename}: not a valid image.")
        if img.width < 800 or img.height < 600: raise HTTPException(422, f"{f.filename}: resolution below 800x600.")
        if blur_score(img) < 30: warnings.append(f"{f.filename}: photo looks blurry")
        img.thumbnail((1280, 1280))
        per_photo.append(detector.analyse(img, st, threshold))
    merged = []                                          # confidence-weighted average across photos
    for i, s in enumerate(st):
        rows = [p[i] for p in per_photo if p[i]["detected"]]
        if rows:
            cw = sum(r["confidence"] for r in rows)
            comp = sum(r["completion"] * r["confidence"] for r in rows) / cw
            conf = cw / len(rows)
            merged.append({"stage": s, "completion": round(comp, 1), "confidence": round(conf, 2), "detected": True, "needs_review": conf < threshold})
        else:
            merged.append({"stage": s, "completion": 0.0, "confidence": 0.0, "detected": False, "needs_review": False})
    accepted = [m["completion"] if not m["needs_review"] else 0 for m in merged]
    progress = round(sum(a * wi / 100 for a, wi in zip(accepted, w)), 1)   # pending reviews excluded (REQ-1.5)
    return {"stages": merged, "floor_progress": progress, "pending_review": sum(m["needs_review"] for m in merged),
            "model_version": detector.version, "warnings": warnings}

class Obs(BaseModel):
    day: int
    progress: float
class ForecastIn(BaseModel):
    history: list[Obs]
    plan_days: int
    start_date: str                                      # ISO date of day 0

@app.post("/api/v1/forecast")
def forecast_api(b: ForecastIn):
    if not forecast.MODEL_PATH.exists(): forecast.train()
    r = forecast.predict([o.model_dump() for o in b.history], b.plan_days)
    last = max(o.day for o in b.history); d0 = dt.date.fromisoformat(b.start_date)
    at = lambda days: (d0 + dt.timedelta(days=int(round(last + days)))).isoformat()
    return {**{k: r[k] for k in ("method", "low_confidence")}, "earliest": at(r["p10"]), "expected": at(r["p50"]), "latest": at(r["p90"]),
            "range_days": int(round(r["p90"] - r["p10"])), "baseline_finish": at(r["baseline"]),
            "planned_finish": (d0 + dt.timedelta(days=b.plan_days)).isoformat(), "model_report": forecast._cache["report"] if forecast._cache else None}
