"""Completion forecast (REQ-1.9): XGBoost quantile models (P10/P50/P90) vs a linear-extrapolation baseline.
Trained on SIMULATED projects (SRS AS-4). Replace/extend with real project history when available."""
import numpy as np, joblib, pathlib
from xgboost import XGBRegressor

MODEL_PATH = pathlib.Path(__file__).parent / "models" / "forecast.joblib"
QUANTILES = (0.1, 0.5, 0.9)

def simulate_project(rng):
    """One floor: weekly progress observations of a delayed/early/on-time build."""
    plan_days = int(rng.integers(35, 120))
    speed = rng.lognormal(0, 0.28)                      # <1 slow, >1 fast vs plan
    shape = rng.uniform(0.8, 1.4)                       # non-linear S-curve
    start_slow = rng.uniform(0, 0.15)                   # mobilisation lag
    true_days = plan_days / speed
    def prog(t): 
        x = np.clip((t / true_days) - start_slow, 0, 1)
        return 100 * (x ** shape)
    days = np.arange(0, true_days + 1)
    finish = int(np.argmax(np.array([prog(t) for t in days]) >= 99.9)) or int(true_days)
    return plan_days, prog, finish

def features(t, prog_hist, days_hist, plan_days):
    """Features at observation time t from the history so far (all lists)."""
    p = prog_hist[-1]
    def rate(k):
        if len(prog_hist) <= k: k = len(prog_hist) - 1
        if k <= 0: return p / max(t, 1)
        return (prog_hist[-1] - prog_hist[-1 - k]) / max(days_hist[-1] - days_hist[-1 - k], 1)
    planned = 100 * min(t / plan_days, 1)
    r2, r4, rall = rate(2), rate(4), p / max(t, 1)
    return [p, 100 - p, t, plan_days, planned, p - planned, r2, r4, rall, len(prog_hist),
            (100 - p) / max(r4, 1e-3) if r4 > 0 else 365.0]

def baseline_days_left(prog_hist, days_hist):
    """Linear extrapolation from the recent rate (the SRS baseline)."""
    k = min(3, len(prog_hist) - 1)
    r = (prog_hist[-1] - prog_hist[-1 - k]) / max(days_hist[-1] - days_hist[-1 - k], 1) if k > 0 else 0
    return (100 - prog_hist[-1]) / r if r > 1e-3 else 365.0

def build_dataset(n_projects, seed):
    rng = np.random.default_rng(seed); X, y, base, meta = [], [], [], []
    for pi in range(n_projects):
        plan_days, prog, finish = simulate_project(rng)
        obs = sorted(set(int(t) for t in np.arange(7, max(finish - 3, 8), rng.integers(5, 10))))
        ph, dh = [], []
        for t in obs:
            ph.append(float(np.clip(prog(t) + rng.normal(0, 2.0), 0, 100))); dh.append(t)   # detection noise ~2 pts
            if len(ph) >= 3:
                X.append(features(t, ph, dh, plan_days)); y.append(finish - t)
                base.append(baseline_days_left(ph, dh)); meta.append(pi)
    return np.array(X), np.array(y, float), np.array(base), np.array(meta)

def train(n_train=1500, n_test=400, seed=7):
    Xtr, ytr, _, _ = build_dataset(n_train, seed)
    Xte, yte, bte, _ = build_dataset(n_test, seed + 1000)       # separate simulated projects, never trained on
    models = {q: XGBRegressor(objective="reg:quantileerror", quantile_alpha=q, n_estimators=250,
                              max_depth=4, learning_rate=0.06, subsample=0.9).fit(Xtr, ytr) for q in QUANTILES}
    pred = {q: models[q].predict(Xte) for q in QUANTILES}
    mae_ml = float(np.median(np.abs(pred[0.5] - yte))); mae_base = float(np.median(np.abs(bte - yte)))
    cover = float(np.mean((yte >= pred[0.1]) & (yte <= pred[0.9])))
    report = {"median_abs_error_days_xgboost": round(mae_ml, 2), "median_abs_error_days_baseline": round(mae_base, 2),
              "coverage_80pct_interval": round(cover, 3), "train_samples": int(len(ytr)), "test_samples": int(len(yte))}
    MODEL_PATH.parent.mkdir(exist_ok=True); joblib.dump({"models": models, "report": report}, MODEL_PATH)
    return report

_cache = None
def predict(history, plan_days):
    """history: [{day:int, progress:float}, ...]. Returns days-left P10/P50/P90 + baseline. <4 records -> baseline, Low Confidence."""
    global _cache
    if _cache is None: _cache = joblib.load(MODEL_PATH)
    h = sorted(history, key=lambda r: r["day"]); dh = [r["day"] for r in h]; ph = [float(r["progress"]) for r in h]
    base = baseline_days_left(ph, dh) if len(ph) > 1 else 365.0
    if len(ph) < 4:
        return {"method": "baseline", "low_confidence": True, "p10": base, "p50": base, "p90": base * 1.3, "baseline": base}
    x = np.array([features(dh[-1], ph, dh, plan_days)])
    lo, mid, hi = (float(_cache["models"][q].predict(x)[0]) for q in QUANTILES)
    lo, mid, hi = max(lo, 0), max(mid, lo), max(hi, mid)
    return {"method": "xgboost", "low_confidence": False, "p10": lo, "p50": mid, "p90": hi, "baseline": base}

if __name__ == "__main__":
    print(train())
