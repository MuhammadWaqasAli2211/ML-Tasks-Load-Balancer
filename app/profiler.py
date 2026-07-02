from app.workers import MLTaskPayload

class LightweightWorkloadProfiler:
    """
    Computes deterministic execution cost estimates for ML workloads
    without invoking external heavy binaries like Scikit-Learn.
    Maps outcomes to qualitative cost tiers:
      - LOW: < 0.3s
      - MEDIUM: 0.3s <= cost < 2.0s
      - HIGH: >= 2.0s
    """
    @staticmethod
    def estimate_cost(task_type: str, batch_size: int, data_size_kb: float) -> float:
        if task_type == "computer_vision":
            return 0.5 + (batch_size * 0.3) + (data_size_kb / 5000.0)
        elif task_type == "nlp":
            return 0.2 + (batch_size * 0.15) + (data_size_kb / 1000.0)
        elif task_type == "tabular":
            return 0.05 + (batch_size * 0.001)
        else:
            # Fallback estimation
            return 0.1

    @classmethod
    def profile(cls, payload: MLTaskPayload) -> dict:
        cost = cls.estimate_cost(payload.task_type, payload.batch_size, payload.data_size_kb)
        if cost < 0.3:
            tier = "LOW"
        elif cost < 2.0:
            tier = "MEDIUM"
        else:
            tier = "HIGH"
            
        return {
            "estimated_cost_seconds": round(cost, 4),
            "tier": tier
        }
