import operator
from typing import Annotated, Any, Dict, List, TypedDict
import redis
from langgraph.graph import StateGraph, END
from app.workers import MLTaskPayload, computer_vision, nlp, tabular
from app.profiler import LightweightWorkloadProfiler

# Initialize Redis client explicitly forcing RESP2 protocol
# Decodes responses to return Python strings instead of bytes
r = redis.Redis(host="localhost", port=6379, db=0, protocol=2, decode_responses=True)

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
    
    # Convert state task_metadata back to MLTaskPayload
    payload = MLTaskPayload(
        task_id=task_meta["task_id"],
        task_type=task_meta["task_type"],
        data_size_kb=float(task_meta["data_size_kb"]),
        batch_size=int(task_meta["batch_size"])
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
