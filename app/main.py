import asyncio
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.workers import MLTaskPayload
from app.profiler import LightweightWorkloadProfiler
from app.graph import balancer_graph, r

app = FastAPI(title="ML Task Load Balancer Gateway")

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for dev/sandbox ease
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory history cache to track the 10 most recent executions
# Thread-safe operations managed via asyncio Lock
history_lock = asyncio.Lock()
execution_history: List[Dict[str, Any]] = []

# Input schemas for POST endpoints
class SubmitTaskRequest(BaseModel):
    task_id: Optional[str] = Field(None, description="Optional custom task UUID. Auto-generated if omitted.")
    task_type: str = Field(..., description="Type of ML task (computer_vision, nlp, tabular)")
    data_size_kb: float = Field(..., description="Data size in KB")
    batch_size: int = Field(..., description="Batch size for inference")

@app.on_event("startup")
async def startup_event():
    """
    On server startup, reset the worker capacity weights in Redis to clean states (0.0).
    """
    try:
        r.set("worker_1_load", "0.0")
        r.set("worker_2_load", "0.0")
    except Exception as e:
        print(f"Startup Redis initialization warning: {e}")

async def run_langgraph_pipeline(payload_dict: Dict[str, Any]):
    """
    Invokes the LangGraph orchestrator state machine asynchronously and appends
    the completed execution trace to the history buffer.
    """
    initial_state = {
        "task_metadata": payload_dict,
        "assigned_worker": "",
        "execution_result": {},
        "routing_logs": []
    }
    
    try:
        final_state = await balancer_graph.ainvoke(initial_state)
        
        record = {
            "task_id": payload_dict["task_id"],
            "task_type": payload_dict["task_type"],
            "batch_size": payload_dict["batch_size"],
            "data_size_kb": payload_dict["data_size_kb"],
            "assigned_worker": final_state.get("assigned_worker", "UNASSIGNED"),
            "estimated_cost": payload_dict["estimated_cost_seconds"],
            "tier": payload_dict["tier"],
            "execution_result": final_state.get("execution_result", {}),
            "routing_logs": final_state.get("routing_logs", []),
            "completed_at": datetime.now().isoformat()
        }
        
        async with history_lock:
            execution_history.insert(0, record)
            # Cap at the 10 most recent execution records
            if len(execution_history) > 10:
                execution_history.pop()
    except Exception as e:
        error_record = {
            "task_id": payload_dict["task_id"],
            "task_type": payload_dict["task_type"],
            "batch_size": payload_dict["batch_size"],
            "data_size_kb": payload_dict["data_size_kb"],
            "assigned_worker": "ERROR",
            "estimated_cost": payload_dict["estimated_cost_seconds"],
            "tier": payload_dict["tier"],
            "execution_result": {"status": "failed", "error": str(e)},
            "routing_logs": [f"[SystemError] Pipeline failed to run: {e}"],
            "completed_at": datetime.now().isoformat()
        }
        async with history_lock:
            execution_history.insert(0, error_record)
            if len(execution_history) > 10:
                execution_history.pop()

@app.post("/submit-task")
async def submit_task(request: SubmitTaskRequest, background_tasks: BackgroundTasks):
    """
    Submit a task:
    1. Generates task ID if missing.
    2. Runs analytical workload profiler to evaluate cost and tier.
    3. Triggers LangGraph pipeline inside an asynchronous FastAPI background task.
    4. Immediately returns task registration status and profile metadata.
    """
    task_id = request.task_id or str(uuid.uuid4())
    
    # Initialize Pydantic payload model
    payload = MLTaskPayload(
        task_id=task_id,
        task_type=request.task_type,
        data_size_kb=request.data_size_kb,
        batch_size=request.batch_size
    )
    
    # Run the profiler
    profile_results = LightweightWorkloadProfiler.profile(payload)
    
    # Compile metadata dict
    payload_dict = payload.dict()
    payload_dict.update(profile_results)
    
    # Launch LangGraph worker asynchronously
    background_tasks.add_task(run_langgraph_pipeline, payload_dict)
    
    return {
        "status": "queued",
        "task_id": task_id,
        "profile": profile_results
    }

@app.get("/metrics")
async def get_metrics():
    """
    Reads active workload latency capacities from Redis and retrieves 
    the list of last 10 completed pipeline history records.
    """
    try:
        w1_load = float(r.get("worker_1_load") or 0.0)
        w2_load = float(r.get("worker_2_load") or 0.0)
        w1_load = max(0.0, w1_load)
        w2_load = max(0.0, w2_load)
    except Exception as e:
        w1_load = 0.0
        w2_load = 0.0
        
    async with history_lock:
        history_copy = list(execution_history)
        
    return {
        "worker_1_load": round(w1_load, 3),
        "worker_2_load": round(w2_load, 3),
        "history": history_copy
    }
