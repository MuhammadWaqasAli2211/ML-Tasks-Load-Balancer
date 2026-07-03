import os
import operator
from typing import Annotated, Any, Dict, List, TypedDict
import redis
from langgraph.graph import StateGraph, END
from app.workers import MLTaskPayload, computer_vision, nlp, tabular
from app.profiler import LightweightWorkloadProfiler

class RedisClientWrapper:
    """
    A robust wrapper around the Redis client that catches connection exceptions.
    If Redis is unreachable (e.g. running in Vercel serverless without cloud database credentials),
    it automatically falls back to local in-memory state tracking to ensure the app stays operational.
    """
    def __init__(self, client):
        self.client = client
        self.local_store = {"worker_1_load": 0.0, "worker_2_load": 0.0}
        self.use_fallback = False

    def get(self, key: str):
        if not self.use_fallback:
            try:
                val = self.client.get(key)
                # Attempt to read to trigger connection check
                if val is not None or self.client.exists(key):
                    return val
            except Exception:
                self.use_fallback = True
        return str(self.local_store.get(key, 0.0))

    def set(self, key: str, value: Any):
        if not self.use_fallback:
            try:
                return self.client.set(key, value)
            except Exception:
                self.use_fallback = True
        self.local_store[key] = float(value)
        return True

    def incrbyfloat(self, key: str, value: float):
        if not self.use_fallback:
            try:
                return self.client.incrbyfloat(key, value)
            except Exception:
                self.use_fallback = True
        current = float(self.local_store.get(key, 0.0))
        new_val = current + float(value)
        self.local_store[key] = new_val
        return new_val

# Initialize raw Redis client
redis_url = os.environ.get("REDIS_URL") or os.environ.get("KV_URL")
if redis_url:
    raw_r = redis.Redis.from_url(redis_url, protocol=2, decode_responses=True)
else:
    raw_r = redis.Redis(host="localhost", port=6379, db=0, protocol=2, decode_responses=True)

# Export the wrapped client instance
r = RedisClientWrapper(raw_r)



class BalancerState(TypedDict):
    task_metadata: Dict[str, Any]
    assigned_worker: str
    execution_result: Dict[str, Any]
    routing_logs: Annotated[List[str], operator.add]

async def evaluate_infrastructure(state: BalancerState) -> Dict[str, Any]:
    """
    Reads active loads (worker_1_load vs worker_2_load) from Redis,
    decides routing to the worker with the lowest active latency, and logs the decision.
    """
    try:
        # Fetch current load estimates from Redis (default to 0.0 if not yet set)
        w1_load = float(r.get("worker_1_load") or 0.0)
        w2_load = float(r.get("worker_2_load") or 0.0)
        # Ensure we don't have negative loads
        w1_load = max(0.0, w1_load)
        w2_load = max(0.0, w2_load)
    except Exception as e:
        # Fallback to local default tracking if Redis is unreachable
        w1_load = 0.0
        w2_load = 0.0
    
    # Assign task to the worker with the absolute lowest pipeline latency
    if w1_load <= w2_load:
        assigned_worker = "worker_1"
    else:
        assigned_worker = "worker_2"
        
    log_entry = (
        f"[EvaluateInfrastructure] Worker 1 load: {w1_load:.3f}s | "
        f"Worker 2 load: {w2_load:.3f}s. "
        f"Selected {assigned_worker.upper()} (lowest active capacity load)."
    )
    
    return {
        "assigned_worker": assigned_worker,
        "routing_logs": [log_entry]
    }

async def execute_workload(state: BalancerState) -> Dict[str, Any]:
    """
    1. Atomically increments the selected worker's load in Redis.
    2. Runs the corresponding simulated ML executor asynchronously.
    3. Decrements the worker's load in Redis (computation closure).
    """
    task_meta = state["task_metadata"]
    assigned_worker = state["assigned_worker"]
    estimated_cost = float(task_meta.get("estimated_cost_seconds", 0.1))
    
    # Reconstruct full MLTaskPayload from state – all optional fields forwarded
    payload = MLTaskPayload(
        task_id=task_meta["task_id"],
        task_type=task_meta["task_type"],
        data_size_kb=float(task_meta["data_size_kb"]),
        batch_size=int(task_meta["batch_size"]),
        model_choice=task_meta.get("model_choice") or "linear",
        csv_data=task_meta.get("csv_data"),
        image_data=task_meta.get("image_data"),
        filter_choice=task_meta.get("filter_choice") or "grayscale",
        nlp_text=task_meta.get("nlp_text"),
    )
    
    # Ingestion step: Increment the selected worker's load in Redis
    try:
        r.incrbyfloat(f"{assigned_worker}_load", estimated_cost)
    except Exception as e:
        pass
        
    ingest_log = f"[ExecuteWorkload] Registered task {payload.task_id} on {assigned_worker.upper()}. Ingestion load incremented by +{estimated_cost:.3f}s."
    execution_result = {}
    
    try:
        # Execute appropriate ML mock worker
        if payload.task_type == "computer_vision":
            execution_result = await computer_vision(payload)
        elif payload.task_type == "nlp":
            execution_result = await nlp(payload)
        elif payload.task_type == "tabular":
            execution_result = await tabular(payload)
        else:
            execution_result = {
                "status": "failed",
                "error": f"Unknown task type: {payload.task_type}"
            }
    except Exception as e:
        execution_result = {
            "status": "failed",
            "error": str(e)
        }
    finally:
        # Computation closure: Free up capacity by decrementing load
        try:
            current_load = float(r.incrbyfloat(f"{assigned_worker}_load", -estimated_cost) or 0.0)
            # Clamp to 0.0 if numerical rounding goes negative
            if current_load < 0.0:
                r.set(f"{assigned_worker}_load", 0.0)
        except Exception as e:
            pass
            
    complete_log = f"[ExecuteWorkload] Task {payload.task_id} completed processing on {assigned_worker.upper()}. Freed load capacity by -{estimated_cost:.3f}s."
    
    return {
        "execution_result": execution_result,
        "routing_logs": [ingest_log, complete_log]
    }

# Build and compile the LangGraph workflow
workflow = StateGraph(BalancerState)
workflow.add_node("evaluate_infrastructure", evaluate_infrastructure)
workflow.add_node("execute_workload", execute_workload)

workflow.set_entry_point("evaluate_infrastructure")
workflow.add_edge("evaluate_infrastructure", "execute_workload")
workflow.add_edge("execute_workload", END)

balancer_graph = workflow.compile()
