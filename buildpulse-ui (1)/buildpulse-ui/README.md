# BuildPulse – UI + AI backend

## What is real and what is not
| Part | Status |
|---|---|
| **Forecast** (XGBoost P10/P50/P90 + linear baseline) | **Real, trained.** `backend/forecast.py`. Trained on simulated projects (SRS AS-4). On 400 held-out simulated projects: median error **5.4 days vs 10.6 days baseline**, 80% interval covers **80.5%** of actual finishes. |
| **Stage detection** (YOLO segmentation -> completion + confidence) | **Real code, needs your trained weights.** `backend/vision.py` + `backend/train_vision.py`. No labelled construction-stage dataset exists in this project yet, and a generic YOLO model cannot see "slab" or "walls". Until `backend/models/stage_seg.pt` exists the API returns a clear 503, it never invents numbers. |
| Progress, planned vs actual, alerts, weights | Real calculations (same formula as the SRS) in the UI and API. |
| Floors 1–6 history, projects, users | Demo data (`js/data.js`). Database (PostgreSQL), auth and photo storage are not built yet. |

## Run
1. Backend (terminal in VS Code):
   ```
   cd backend
   pip install -r requirements.txt
   python forecast.py                 # trains + evaluates the forecast model (about 20 s)
   uvicorn main:app --reload --port 8000
   ```
2. Frontend: right-click `index.html` > Open with Live Server (or double-click).
3. Login > Dashboard shows the live forecast from the API. Upload shows real detection results once the vision model is trained.

## Train the vision model (Taha's part)
1. Label photos (CVAT / Label Studio) with polygons: columns, slab, walls, windows, finishing. Export YOLO-seg.
2. Split train/val/test **by building**. Put files in `backend/dataset/{images,labels}/{train,val,test}`.
3. `python train_vision.py` (use Colab/Kaggle GPU). It saves `models/stage_seg.pt` and prints test mAP.
4. Calibrate `EXPECTED_AREA` in `vision.py` on your labelled data (how much of a photo a finished stage covers).

## Endpoints
- `GET  /api/v1/health`
- `POST /api/v1/analyse` (multipart `files`, `weights`, `stages`, `threshold`) -> stages, confidence, floor progress, review flags
- `POST /api/v1/forecast` (history, plan_days, start_date) -> earliest / expected / latest finish

## Next steps toward the SRS
PostgreSQL + auth (REQ-1.1), object storage (IF-D4), job queue, React/TypeScript port.
