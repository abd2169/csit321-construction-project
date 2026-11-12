"""Fine-tune YOLOv8 segmentation on labelled construction-stage images, then install it for the API.
1) Label photos in CVAT/Label Studio with polygons for: columns, slab, walls, windows, finishing. Export as YOLO-seg.
2) Split TRAIN/VAL/TEST BY BUILDING (not by photo) - SRS REQ-1.4.
3) Put them in dataset/{images,labels}/{train,val,test} and run:  python train_vision.py"""
import pathlib, shutil
from ultralytics import YOLO
HERE = pathlib.Path(__file__).parent; DS = HERE / "dataset"
(DS).mkdir(exist_ok=True)
(DS / "data.yaml").write_text(f"path: {DS.resolve()}\ntrain: images/train\nval: images/val\ntest: images/test\nnames:\n" +
    "".join(f"  {i}: {n}\n" for i, n in enumerate(["columns", "slab", "walls", "windows", "finishing"])))
model = YOLO("yolov8n-seg.pt")                       # pretrained start (downloads ~7 MB on first run)
model.train(data=str(DS / "data.yaml"), epochs=80, imgsz=640, batch=16, patience=15, project=str(HERE / "runs"), name="stage_seg",
            hsv_v=0.5, degrees=5, fliplr=0.5)        # lighting / angle augmentation (dust, glare, dusk)
metrics = model.val(split="test")                    # held-out buildings -> report mAP in the final report
print("mask mAP50:", metrics.seg.map50, " mAP50-95:", metrics.seg.map)
shutil.copy(HERE / "runs" / "stage_seg" / "weights" / "best.pt", HERE / "models" / "stage_seg.pt")
print("Installed models/stage_seg.pt")
