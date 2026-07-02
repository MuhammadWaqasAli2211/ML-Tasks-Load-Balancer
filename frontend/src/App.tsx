import { useState, useEffect } from 'react';
import { ServerBars } from './components/ServerBars';
import { TaskController } from './components/TaskController';
import { TraceLogTable } from './components/TraceLogTable';
import { Scale, RefreshCw, Layers, Zap, Activity, Clock } from 'lucide-react';

interface ExecutionRecord {
  task_id: string;
  task_type: string;
  batch_size: number;
  data_size_kb: number;
  assigned_worker: string;
  estimated_cost: number;
  tier: string;
  execution_result: {
    status?: string;
    metric_name?: string;
    metric_value?: number;
    execution_delay_seconds?: number;
    error?: string;
  };
  routing_logs: string[];
  completed_at: string;
}

const BACKEND_URL = 'http://localhost:8000';

function App() {
  const [worker1Load, setWorker1Load] = useState<number>(0);
  const [worker2Load, setWorker2Load] = useState<number>(0);
  const [history, setHistory] = useState<ExecutionRecord[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'connecting' | 'offline'>('connecting');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Polling loop to fetch live Redis capacities and completed tasks
  const fetchMetrics = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/metrics`);
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }
      const data = await response.json();
      setWorker1Load(data.worker_1_load);
      setWorker2Load(data.worker_2_load);
      setHistory(data.history);
      setConnectionStatus('online');
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to sync metrics:', error);
      setConnectionStatus('offline');
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchMetrics();

    // 1000ms loop polling interval
    const interval = setInterval(() => {
      fetchMetrics();
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleSubmitSingle = async (task: { task_type: string; batch_size: number; data_size_kb: number }) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`${BACKEND_URL}/submit-task`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(task),
      });

      if (!response.ok) {
        throw new Error('Failed to submit task');
      }
      
      // Proactively refresh state
      fetchMetrics();
    } catch (error) {
      console.error('Error submitting single task:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitBulk = async (tasks: Array<{ task_type: string; batch_size: number; data_size_kb: number }>) => {
    setIsSubmitting(true);
    try {
      // Fire 8 parallel requests simultaneously
      await Promise.all(
        tasks.map((task) =>
          fetch(`${BACKEND_URL}/submit-task`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(task),
          })
        )
      );

      // Proactively refresh metrics
      fetchMetrics();
    } catch (error) {
      console.error('Error submitting bulk workloads:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Compute aggregate dashboard stats
  const totalTasks = history.length;
  const completedTasks = history.filter((t) => t.execution_result.status === 'completed').length;
  // failedTasks is deleted as it is not used in the stats cards
  
  const avgProcessingTime =
    history.length > 0
      ? history.reduce((acc, curr) => acc + (curr.execution_result.execution_delay_seconds || curr.estimated_cost), 0) /
        history.length
      : 0;

  return (
    <div className="min-h-screen bg-[#030712] text-gray-100 flex flex-col font-sans select-none selection:bg-indigo-500/30 selection:text-indigo-200">
      
      {/* Glow Top Effect */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[300px] bg-gradient-to-b from-indigo-500/10 via-fuchsia-500/5 to-transparent rounded-full blur-[120px] pointer-events-none" />

      {/* Main Header Row */}
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 shadow-lg shadow-indigo-500/20 text-white">
              <Scale className="w-6 h-6 animate-spin-slow" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
                ML Task Load Balancer Console
              </h1>
              <p className="text-xs text-gray-400">
                Multi-agent workload profiling and dynamic load routing with LangGraph, Redis & FastAPI
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full bg-gray-900 border border-gray-800">
              <span className={`w-2 h-2 rounded-full ${
                connectionStatus === 'online'
                  ? 'bg-emerald-500 animate-ping'
                  : connectionStatus === 'connecting'
                  ? 'bg-amber-500 animate-pulse'
                  : 'bg-rose-500'
              }`} />
              <span className={
                connectionStatus === 'online'
                  ? 'text-emerald-400'
                  : connectionStatus === 'connecting'
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }>
                {connectionStatus === 'online'
                  ? 'ORCHESTRATOR ONLINE'
                  : connectionStatus === 'connecting'
                  ? 'CONNECTING TO BACKEND'
                  : 'GATEWAY DISCONNECTED'}
              </span>
            </div>

            <button
              onClick={fetchMetrics}
              disabled={connectionStatus === 'connecting'}
              className="p-2 rounded-xl bg-gray-900 hover:bg-gray-850 border border-gray-800 text-gray-400 hover:text-white transition-all cursor-pointer disabled:opacity-50"
              title="Manual Sync"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 space-y-6 z-10">

        {/* Dashboard Grid Statistics */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-900/60 border border-gray-850 p-4 rounded-2xl backdrop-blur-sm flex items-center gap-4">
            <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-gray-500 uppercase font-semibold font-mono tracking-wider">Audit Queue Count</span>
              <h4 className="text-xl font-extrabold text-white mt-0.5">{totalTasks} tasks</h4>
            </div>
          </div>

          <div className="bg-gray-900/60 border border-gray-850 p-4 rounded-2xl backdrop-blur-sm flex items-center gap-4">
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <span className="text-xs text-gray-500 uppercase font-semibold font-mono tracking-wider">Completed Inferences</span>
              <h4 className="text-xl font-extrabold text-white mt-0.5">{completedTasks} runs</h4>
            </div>
          </div>

          <div className="bg-gray-900/60 border border-gray-850 p-4 rounded-2xl backdrop-blur-sm flex items-center gap-4">
            <div className="p-3 rounded-xl bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-gray-500 uppercase font-semibold font-mono tracking-wider">Average Latency</span>
              <h4 className="text-xl font-extrabold text-white mt-0.5">{avgProcessingTime.toFixed(3)}s</h4>
            </div>
          </div>

          <div className="bg-gray-900/60 border border-gray-850 p-4 rounded-2xl backdrop-blur-sm flex items-center gap-4">
            <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-gray-500 uppercase font-semibold font-mono tracking-wider">Metrics Syncing</span>
              <h4 className="text-sm font-extrabold text-white mt-1.5 font-mono">{lastUpdated.toLocaleTimeString()}</h4>
            </div>
          </div>
        </section>

        {/* Mid Grid: Controller on left, Server Display on right */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-1">
            <TaskController
              onSubmitSingle={handleSubmitSingle}
              onSubmitBulk={handleSubmitBulk}
              isSubmitting={isSubmitting}
            />
          </div>
          
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl backdrop-blur-md">
              <div className="mb-4">
                <h2 className="text-xl font-bold text-white tracking-wide">Live Hardware Capacities</h2>
                <p className="text-xs text-gray-400">Redis active load latency registers</p>
              </div>
              <ServerBars worker1Load={worker1Load} worker2Load={worker2Load} />
            </div>
            
            {/* Visualizer architecture node maps */}
            <div className="p-5 rounded-2xl border border-indigo-500/10 bg-indigo-500/5 backdrop-blur-sm flex flex-col md:flex-row md:items-center gap-4 justify-between">
              <div className="space-y-1">
                <h4 className="font-semibold text-indigo-300 text-sm">Agent Load Balancer Routing Loop</h4>
                <p className="text-xs text-gray-400">
                  Analytical profiling executes immediately, assigning tasks non-blockingly to workers via a sequential dual-node graph.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400 uppercase tracking-wider font-mono">
                <span>Profile</span>
                <span className="text-gray-500">→</span>
                <span>Evaluate</span>
                <span className="text-gray-500">→</span>
                <span>Execute</span>
              </div>
            </div>
          </div>
        </section>

        {/* Bottom Panel: Log Matrix */}
        <section>
          <TraceLogTable history={history} />
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 bg-gray-950 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-6 text-center text-xs text-gray-500 font-mono">
          <span>ML Task Load Balancer — Advanced Agentic Coding Platform 2026</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
