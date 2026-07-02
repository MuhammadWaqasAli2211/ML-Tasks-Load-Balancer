import asyncio
import random
from pydantic import BaseModel, Field

class MLTaskPayload(BaseModel):
    task_id: str = Field(..., description="Unique identifier for the task")
    task_type: str = Field(..., description="Type of ML task: computer_vision, nlp, or tabular")
    data_size_kb: float = Field(..., description="Size of task data in kilobytes")
    batch_size: int = Field(..., description="Batch size for processing")

async def computer_vision(payload: MLTaskPayload) -> dict:
    """
    Simulates Computer Vision inference with heavy processing delays.
    Formula: 0.5 + (batch_size * 0.3) + (data_size_kb / 5000)
    """
    delay = 0.5 + (payload.batch_size * 0.3) + (payload.data_size_kb / 5000.0)
    await asyncio.sleep(delay)
    accuracy_score = random.uniform(0.75, 0.99)
    return {
        "status": "completed",
        "metric_name": "accuracy_score",
        "metric_value": round(accuracy_score, 4),
        "execution_delay_seconds": round(delay, 3)
    }

async def nlp(payload: MLTaskPayload) -> dict:
    """
    Simulates NLP inference (e.g., Transformer model) with moderate processing delays.
    Formula: 0.2 + (batch_size * 0.15) + (data_size_kb / 1000)
    """
    delay = 0.2 + (payload.batch_size * 0.15) + (payload.data_size_kb / 1000.0)
    await asyncio.sleep(delay)
    f1_macro = random.uniform(0.70, 0.98)
    return {
        "status": "completed",
        "metric_name": "f1_macro",
        "metric_value": round(f1_macro, 4),
        "execution_delay_seconds": round(delay, 3)
    }

async def tabular(payload: MLTaskPayload) -> dict:
    """
    Simulates Tabular data model (e.g., XGBoost) with very low processing delays.
    Formula: 0.05 + (batch_size * 0.001)
    """
    delay = 0.05 + (payload.batch_size * 0.001)
    await asyncio.sleep(delay)
    r2_score = random.uniform(0.60, 0.95)
    return {
        "status": "completed",
        "metric_name": "r2_score",
        "metric_value": round(r2_score, 4),
        "execution_delay_seconds": round(delay, 3)
    }
