# ⚡ Machine Learning Task Balancer & Live Telemetry Engine

An asynchronous, application-level distributed load balancer engineered to prevent host resource starvation and thread choking during concurrent, heavy AI/Computer Vision model executions. 

---

## 🚀 The Core Problem & Solution

**Problem:** When serving resource-heavy ML workloads (like YOLO, MediaPipe, or LLM inferences), local servers easily experience hardware starvation, thread blocking, and immediate system crashes under peak loads.  
**Solution:** This system intercepts incoming workloads, parses metadata to classify them into distinct cost tiers, routes them through a Redis-backed queue to parallel worker nodes, and tracks bare-metal hardware delta changes in real time.

---

## 🛠️ System Architecture Flow

The architecture operates on a decoupled, linear pipeline to guarantee zero drop rates under peak computing loads:

* **[ React/TS Dashboard ]** ──( 1. Inject Workload )──> **[ FastAPI + Redis Gateway ]**
* **[ FastAPI + Redis Gateway ]** ──( 2. Balance & Distribute )──> **[ Parallel Worker Nodes ]**
* **[ Parallel Worker Nodes ]** ──( 3. Stream Telemetry )──> **[ WebSockets Protocol ]**
* **[ WebSockets Protocol ]** ──( 4. Live Updates )──> **[ React Diagnostics UI ]**

### 📋 Step-by-Step Execution:
1. **Inject Workload:** Client submits single or bulk inference tasks through the React Dashboard.
2. **Metadata Parsing:** FastAPI catches the payload, parses metrics (batch size, domain configurations), and pushes tasks securely onto a micro-second **Redis Queue**.
3. **Compute Execution:** Decoupled operational worker nodes pull from the queue, preventing thread blocking on the core API.
4. **Live Telemetry Stream:** The worker layers run `psutil` diagnostics to monitor immediate compute delta triggers (+15% CPU / +45MB RAM spikes) and stream them back to the frontend dashboard over low-latency **WebSockets**.

---

## 🧰 Tech Stack & Tools

* **Backend Orchestration:** FastAPI, Uvicorn (Asynchronous Gateway)
* **Message Queue & Cache:** Redis (Distributed Task Queuing)
* **Frontend Dashboard:** React.js, TypeScript, Tailwind CSS
* **System Monitoring:** Python `psutil` (Bare-metal telemetry tracking)
* **Communication Protocol:** WebSockets (Real-time duplex streaming)

---

## 💻 Quick Start & Setup

### Prerequisites
Ensure you have **Python 3.10+**, **Node.js**, and **Redis Server** installed.

### 1. Clone the Repository
```bash
git clone [https://github.com/YOUR_USERNAME/ml-task-balancer.git](https://github.com/YOUR_USERNAME/ml-task-balancer.git)
cd ml-task-balancer
2. Backend Installation (FastAPI & Redis)
Bash
# Navigate to backend directory
cd backend

# Install dependencies
pip install -r requirements.txt

# Start Redis Server
redis-server

# Run the FastAPI server
uvicorn main:app --reload
3. Frontend Installation (React + Vite/TS)
Bash
# Open a new terminal and navigate to frontend directory
cd frontend

# Install packages
npm install

# Start development server
npm run dev
📈 Key Engineering Highlights
Zero Drop-Rate Execution: Isolated queue workers ensure the central user dashboard never lags or freezes, regardless of the workload complexity.

Granular Resource Tracking: Live compute tracing profiles exactly how much system memory and processing bandwidth a single machine learning model utilizes during its active state loop.
