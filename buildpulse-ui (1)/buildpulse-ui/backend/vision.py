"""Stage detection (REQ-1.4): YOLO segmentation -> per-stage completion + confidence.
Needs weights fine-tuned on labelled construction photos: models/stage_seg.pt (see train_vision.py).
A generic COCO model cannot see 'slab' or 'walls', so without trained weights the API says so instead of inventing results."""
import pathlib, numpy as np
WEIGHTS = pathlib.Path(__file__).parent / "models" / "stage_seg.pt"
CLASSES = ["columns", "slab", "walls", "windows", "finishing"]          # must match dataset/data.yaml order
# share of the photo a fully finished stage typically covers; calibrate on your labelled data
EXPECTED_AREA = {"columns": 0.12, "slab": 0.30, "walls": 0.45, "windows": 0.15, "finishing": 0.50}

class StageDetector:
    def __init__(self, weights=WEIGHTS):
        self.weights, self.model = pathlib.Path(weights), None
    @property
    def available(self): return self.weights.exists()
    @property
    def version(self): return f"{self.weights.name}@{int(self.weights.stat().st_mtime)}" if self.available else None
    def _load(self):
        if self.model is None:
            from ultralytics import YOLO
            self.model = YOLO(str(self.weights))
        return self.model
    def analyse(self, img, stages=None, conf_threshold=0.60):
        """img: PIL.Image. Returns one dict per project stage."""
        r = self._load().predict(img, conf=0.20, verbose=False)[0]
        names = r.names; out = {}
        if r.masks is not None:
            m = r.masks.data.cpu().numpy() > 0.5
            cls = r.boxes.cls.cpu().numpy().astype(int); conf = r.boxes.conf.cpu().numpy()
            for c in set(cls):
                sel = cls == c; name = names[c]
                cov = float(m[sel].any(axis=0).mean())                      # union of masks / image area
                out[name] = (min(1.0, cov / EXPECTED_AREA.get(name, 0.3)), float(conf[sel].mean()))
        res = []
        for s in (stages or CLASSES):
            comp, conf = out.get(s, (0.0, 0.0))
            seen = s in out
            res.append({"stage": s, "completion": round(100 * comp, 1), "confidence": round(conf, 2), "detected": seen,
                        "needs_review": seen and conf < conf_threshold})
        return res
