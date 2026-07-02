import time
import requests
import sys

BACKEND_URL = "http://localhost:8000"

def test_gateway_connection():
    print("Testing connection to backend gateway...")
    try:
        res = requests.get(f"{BACKEND_URL}/metrics")
        res.raise_for_status()
        data = res.json()
        print(f"Connection Successful! Metrics response keys: {list(data.keys())}")
        print(f"Worker 1 Load: {data['worker_1_load']}s, Worker 2 Load: {data['worker_2_load']}s")
        return True
    except Exception as e:
        print(f"Connection failed: {e}")
        return False

def test_task_submission():
    print("\nSubmitting a test Computer Vision task...")
    payload = {
        "task_type": "computer_vision",
        "data_size_kb": 2500,
        "batch_size": 4
    }
    
    res = requests.post(f"{BACKEND_URL}/submit-task", json=payload)
    res.raise_for_status()
    data = res.json()
    
    print(f"Task Submitted Successfully! Response: {data}")
    assert data["status"] == "queued"
    assert "task_id" in data
    assert "profile" in data
    assert data["profile"]["tier"] == "HIGH"  # CV: 0.5 + 4*0.3 + 2500/5000 = 0.5 + 1.2 + 0.5 = 2.2s -> >= 2.0s -> HIGH
    print(f"Estimated Cost: {data['profile']['estimated_cost_seconds']}s (Tier: {data['profile']['tier']})")
    return data["task_id"]

def verify_task_completion(task_id):
    print(f"\nWaiting for task {task_id} execution in history...")
    max_retries = 20
    for i in range(max_retries):
        time.sleep(1)
        res = requests.get(f"{BACKEND_URL}/metrics")
        res.raise_for_status()
        history = res.json()["history"]
        
        found = next((t for t in history if t["task_id"] == task_id), None)
        if found:
            print(f"Task found in history! Complete details:")
            print(f" - Assigned Worker: {found['assigned_worker']}")
            print(f" - Metric Result: {found['execution_result']}")
            print(f" - Logs trace:")
            for log in found["routing_logs"]:
                print(f"    >> {log}")
            return True
            
        print(f"Checking... (Attempt {i+1}/{max_retries})")
    
    print("Task did not complete within timeout limit.")
    return False

if __name__ == "__main__":
    if not test_gateway_connection():
        print("FastAPI server must be running on port 8000 for verification.")
        sys.exit(1)
        
    task_id = test_task_submission()
    if verify_task_completion(task_id):
        print("\nAll integration and routing assertions passed successfully!")
    else:
        print("\nVerification failed.")
        sys.exit(1)
