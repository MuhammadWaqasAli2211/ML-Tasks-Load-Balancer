# ⚡ Machine Learning Task Balancer & Live Telemetry Engine

An asynchronous, application-level distributed load balancer engineered to prevent host resource starvation and thread choking during concurrent, heavy AI/Computer Vision model executions. 

---

## 🚀 The Core Problem & Solution

**Problem:** When serving resource-heavy ML workloads (like YOLO, MediaPipe, or LLM inferences), local servers easily experience hardware starvation, thread blocking, and immediate system crashes under peak loads.
**Solution:** This system intercepts incoming workloads, parses metadata to classify them into distinct cost tiers, routes them through a Redis-backed queue to parallel worker nodes, and tracks bare-metal hardware delta changes in real time.

---

## 🛠️ Architecture & Workflow

The architecture uses a strict, linear pipeline ensuring decoupled orchestration and zero drop rates on peak loads:

```mermaid
graph LR
    %% Styling
    classDef UI fill:#1e1e2e,stroke:#cba6f7,stroke-width:2px,color:#cdd6f4;
    classDef API fill:#313244,stroke:#89b4fa,stroke-width:2px,color:#cdd6f4;
    classDef Worker fill:#11111b,stroke:#a6e3a1,stroke-width:2px,color:#cdd6f4;

    %% Components
    Frontend[React/TS Dashboard]:::UI
    Gateway[FastAPI + Redis Orchestrator]:::API
    Workers[Parallel Worker Nodes]:::Worker
    Diagnostics[Isolated Resource Report]:::UI

    %% Linear Flow
    Frontend -->|1. Inject Workload| Gateway
    Gateway  -->|2. Balance & Distribute| Workers
    Workers  -->|3. Stream Telemetry Metrics| Gateway
    Gateway  -->|4. Render Live Diagnostics| Diagnostics
📋 Step-by-Step System Flow:
Inject Workload: Client submits single or bulk inference tasks through the React Dashboard.

Metadata Parsing: FastAPI catches the payload, parses metrics (batch size, domain configurations), and pushes tasks securely onto a micro-second Redis Queue.

Compute Execution: Decoupled operational worker nodes pull from the queue, preventing thread blocking on the core API.

Live Telemetry Stream: The worker layers run psutil diagnostics to monitor immediate compute delta triggers (+15% CPU / +45MB RAM spikes) and stream them back to the frontend dashboard over low-latency WebSockets.

🧰 Tech Stack & Tools
Backend Orchestration: FastAPI, Uvicorn (Asynchronous Gateway)

Message Queue & Cache: Redis (Distributed Task Queuing)

Frontend Dashboard: React.js, TypeScript, Tailwind CSS

System Monitoring: Python psutil (Bare-metal telemetry tracking)

Communication Protocol: WebSockets (Real-time duplex streaming)

💻 Quick Start & Setup
Prerequisites
Ensure you have Python 3.10+, Node.js, and Redis Server installed.

1. Clone the Repository
Bash
git clone [https://github.com/YOUR_USERNAME/ml-task-balancer.git](https://github.com/YOUR_USERNAME/ml-task-balancer.git)
cd ml-task-balancer
2. Backend Installation (FastAPI & Redis)
Bash
# Navigate to backend directory
cd backend

# Install dependencies
pip install -r requirements.txt

# Start Redis Server (Make sure Redis is running on local port 6379)
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
