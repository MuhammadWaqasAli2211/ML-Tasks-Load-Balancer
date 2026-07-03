"""
main.py – FastAPI gateway for the ML Task Load Balancer.

Endpoints:
  POST /submit-task   Accepts multipart FormData for all three task domains.
  GET  /metrics       Returns Redis worker loads and last 10 execution records.
"""

import asyncio
import io
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
import psutil
import pandas as pd
from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.graph import balancer_graph, r
from app.profiler import LightweightWorkloadProfiler
from app.workers import MLTaskPayload

app = FastAPI(title="ML Task Load Balancer Gateway")

# ---------------------------------------------------------------------------
# CORS – fully permissive so the Vite dev server connects without errors
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Debug: log validation errors in full so mismatches are immediately visible
# ---------------------------------------------------------------------------
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    print("❌ VALIDATION ERROR:", exc.errors())
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "body": str(exc.body)},
    )


# ---------------------------------------------------------------------------
# In-memory execution history (last 10 tasks) – asyncio.Lock for safety
# ---------------------------------------------------------------------------
history_lock = asyncio.Lock()
execution_history: List[Dict[str, Any]] = []


# ---------------------------------------------------------------------------
# Startup – zero out Redis load counters
# ---------------------------------------------------------------------------
@app.on_event("startup")
async def startup_event():
    try:
        r.set("worker_1_load", "0.0")
        r.set("worker_2_load", "0.0")
    except Exception as e:
        print(f"Startup Redis warning: {e}")


# ---------------------------------------------------------------------------
# LangGraph pipeline runner (runs in background)
# ---------------------------------------------------------------------------
async def run_langgraph_pipeline(payload_dict: Dict[str, Any]):
    """Invoke the balancer graph and persist the result to execution_history."""
    initial_state = {
        "task_metadata": payload_dict,
        "assigned_worker": "",
        "execution_result": {},
        "routing_logs": [],
    }

    try:
        final_state = await balancer_graph.ainvoke(initial_state)
        exec_result = final_state.get("execution_result", {})

        # Build a display-friendly metric_output string
        metric_output = _build_metric_output(payload_dict["task_type"], exec_result)

        record = {
            "task_id": payload_dict["task_id"],
            "task_type": payload_dict["task_type"],
            "batch_size": payload_dict["batch_size"],
            "data_size_kb": payload_dict["data_size_kb"],
            "assigned_worker": final_state.get("assigned_worker", "UNASSIGNED"),
            "estimated_cost": payload_dict["estimated_cost_seconds"],
            "tier": payload_dict["tier"],
            "execution_result": exec_result,
            "routing_logs": final_state.get("routing_logs", []),
            "completed_at": datetime.now().isoformat(),
            "metric_output": metric_output,
            "epoch_traces": exec_result.get("epoch_traces", []),
        }
    except Exception as e:
        record = {
            "task_id": payload_dict["task_id"],
            "task_type": payload_dict["task_type"],
            "batch_size": payload_dict["batch_size"],
            "data_size_kb": payload_dict["data_size_kb"],
            "assigned_worker": "ERROR",
            "estimated_cost": payload_dict["estimated_cost_seconds"],
            "tier": payload_dict["tier"],
            "execution_result": {"status": "failed", "error": str(e)},
            "routing_logs": [f"[SystemError] Pipeline failed: {e}"],
            "completed_at": datetime.now().isoformat(),
            "metric_output": f"ERROR: {e}",
            "epoch_traces": [],
        }

    async with history_lock:
        execution_history.insert(0, record)
        if len(execution_history) > 10:
            execution_history.pop()


def _build_metric_output(task_type: str, result: dict) -> str:
    """Produce a human-readable one-liner for the frontend metrics cell."""
    if result.get("status") == "failed":
        return f"FAILED: {result.get('error', 'unknown error')}"

    if task_type == "tabular":
        name = result.get("metric_name", "metric")
        val = result.get("metric_value", 0)
        model = result.get("model", "linear")
        coef = result.get("coefficients", [])
        return f"{model.upper()} | {name}: {val:.4f} | coef[0]: {coef[0] if coef else 'N/A'}"

    if task_type == "computer_vision":
        filt = result.get("filter", "unknown")
        w = result.get("image_width", "?")
        h = result.get("image_height", "?")
        return f"Filter: {filt} | {w}×{h}px | base64 encoded ✓"

    if task_type == "nlp":
        label = result.get("label", "N/A")
        conf = result.get("confidence", 0)
        text = result.get("input_text", "")[:40]
        return f'Sentiment: {label} ({conf:.2%}) | "{text}…"'

    name = result.get("metric_name", "metric")
    val = result.get("metric_value", 0)
    return f"{name}: {val}"


# ---------------------------------------------------------------------------
# POST /submit-task
# ---------------------------------------------------------------------------
@app.post("/submit-task")
async def submit_task(
    # --- common fields (all tasks) ---
    task_type: str = Form(...),           # 'tabular' | 'computer_vision' | 'nlp'
    model_name: str = Form(...),          # 'linear' | 'logistic' | 'mlp' | 'nb'
    batch_size: int = Form(...),
    epochs: int = Form(...),
    # --- tabular ---
    file: Optional[UploadFile] = File(None),   # CSV upload
    # --- computer vision ---
    image: Optional[UploadFile] = File(None),  # image upload
    filter_choice: Optional[str] = Form(None), # 'grayscale' | 'blur' | 'edge_detection'
    # --- nlp ---
    nlp_text: Optional[str] = Form(None),      # selected example text
    # --- optional overrides ---
    task_id: Optional[str] = Form(None),
    background_tasks: BackgroundTasks = None,
):
    """
    Unified multipart endpoint for all three task domains.

    FormData keys expected by the frontend:
      task_type, model_name, batch_size, epochs
      file        (tabular CSV, optional)
      image       (CV image, optional)
      filter_choice (CV filter, optional)
      nlp_text    (NLP predefined text, optional)
    """
    task_id = task_id or str(uuid.uuid4())

    # ---- defaults --------------------------------------------------------
    data_size_kb: float = float(epochs)
    csv_json_bytes: Optional[bytes] = None
    image_bytes: Optional[bytes] = None

    # ---- TABULAR: parse CSV ----------------------------------------------
    if task_type == "tabular" and file is not None:
        raw = await file.read()
        if len(raw) > 2 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="CSV too large – max 2 MiB.")
        try:
            df = pd.read_csv(io.BytesIO(raw))
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Invalid CSV: {exc}")
        data_size_kb = float(df.shape[0])
        csv_json_bytes = df.to_json(orient="records").encode("utf-8")

    # ---- COMPUTER VISION: read image -------------------------------------
    if task_type == "computer_vision" and image is not None:
        raw_img = await image.read()
        if len(raw_img) > 5 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Image too large – max 5 MiB.")
        image_bytes = raw_img
        data_size_kb = round(len(raw_img) / 1024, 2)

    # ---- Build payload ---------------------------------------------------
    payload = MLTaskPayload(
        task_id=task_id,
        task_type=task_type,
        data_size_kb=data_size_kb,
        batch_size=batch_size,
        model_choice=model_name,
        csv_data=csv_json_bytes,
        image_data=image_bytes,
        filter_choice=filter_choice or "grayscale",
        nlp_text=nlp_text,
    )

    profile_results = LightweightWorkloadProfiler.profile(payload)

    payload_dict = payload.dict()
    payload_dict.update(profile_results)

    background_tasks.add_task(run_langgraph_pipeline, payload_dict)

    return {"status": "queued", "task_id": task_id, "profile": profile_results}


# ---------------------------------------------------------------------------
# GET /metrics
# ---------------------------------------------------------------------------
@app.get("/metrics")
async def get_metrics():
    """Return Redis worker loads and the last 10 execution records."""
    try:
        w1 = max(0.0, float(r.get("worker_1_load") or 0.0))
        w2 = max(0.0, float(r.get("worker_2_load") or 0.0))
        cpu_usage = psutil.cpu_percent(interval=None)   #new line
        ram_usage = psutil.virtual_memory().percent     #new line
    except Exception:
        w1, w2 = 0.0, 0.0

    async with history_lock:
        history_copy = list(execution_history)

    return {
        "worker_1_load": round(w1, 3),
        "worker_2_load": round(w2, 3),
        "history": history_copy,
        "system_cpu": cpu_usage,        #new line
        "system_ram": ram_usage         #new line
    }
