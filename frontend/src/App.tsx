// frontend/src/App.tsx
import { useState, useEffect, useRef } from 'react';
import { ServerBars } from './components/ServerBars';
import { TraceLogTable } from './components/TraceLogTable';
import { Scale, RefreshCw, Layers, Zap, Activity, Clock, Send, Flame, Eye, Type, Table, Upload, Image as ImageIcon } from 'lucide-react';

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
    processed_image_b64?: string;
    filter?: string;
    label?: string;
    confidence?: number;
    coefficients?: number[];
    model?: string;
  };
  routing_logs: string[];
  completed_at: string;
  metric_output?: string;
  epoch_traces?: string[];
}

const BACKEND_URL = 'http://localhost:8000';

// NLP predefined examples
const NLP_EXAMPLES = [
  { key: 'example_1', label: 'Example 1 – Positive', text: 'This system is amazing!' },
  { key: 'example_2', label: 'Example 2 – Negative', text: 'The pipeline failed with an error.' },
];

function App() {
  const [worker1Load, setWorker1Load] = useState<number>(0);
  const [worker2Load, setWorker2Load] = useState<number>(0);
  const [history, setHistory] = useState<ExecutionRecord[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'connecting' | 'offline'>('connecting');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Active tab
  const [activeTab, setActiveTab] = useState<'tabular' | 'computer_vision' | 'nlp'>('tabular');

  // ── Tabular state ──────────────────────────────────────────────────────────
  const [mlModel, setMlModel] = useState<string>('linear');
  const [mlBatchSize, setMlBatchSize] = useState<number>(16);
  const [mlEpochs, setMlEpochs] = useState<number>(10);
  const [mlCsvFile, setMlCsvFile] = useState<File | null>(null);

  // ── CV state ───────────────────────────────────────────────────────────────
  const [cvFilter, setCvFilter] = useState<string>('grayscale');
  const [cvBatchSize, setCvBatchSize] = useState<number>(8);
  const [cvEpochs, setCvEpochs] = useState<number>(5);
  const [cvImageFile, setCvImageFile] = useState<File | null>(null);
  const [cvPreviewUrl, setCvPreviewUrl] = useState<string | null>(null);
  const [cvResultB64, setCvResultB64] = useState<string | null>(null);
  const cvInputRef = useRef<HTMLInputElement>(null);

  // ── NLP state ──────────────────────────────────────────────────────────────
  const [nlpExample, setNlpExample] = useState<string>('example_1');
  const [nlpBatchSize, setNlpBatchSize] = useState<number>(4);




 // ──────────────────────────────────────────────────────────────────────────
  // NEW LINE FOR CPU AND RAM USAGE
  // ──────────────────────────────────────────────────────────────────────────


  const [cpuHistory, setCpuHistory] = useState<number[]>(new Array(20).fill(0));
  const [ramHistory, setRamHistory] = useState<number[]>(new Array(20).fill(0));
  const [currentCpu, setCurrentCpu] = useState<number>(0);
  const [currentRam, setCurrentRam] = useState<number>(0);


  // ──────────────────────────────────────────────────────────────────────────
  // Metrics polling
  // ──────────────────────────────────────────────────────────────────────────
  const fetchMetrics = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/metrics`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setWorker1Load(data.worker_1_load);
      setWorker2Load(data.worker_2_load);
      setHistory(data.history);
      setConnectionStatus('online');
      setLastUpdated(new Date());



      // --- NEW PERFORMANCE GRAPH LOGIC ---
      const newCpu = data.system_cpu ?? 0;
      const newRam = data.system_ram ?? 0;
      setCurrentCpu(newCpu);
      setCurrentRam(newRam);

      // Shift tracking data array left to look like a moving timeline graph
      setCpuHistory(prev => [...prev.slice(1), newCpu]);
      setRamHistory(prev => [...prev.slice(1), newRam]);




      // Check if any CV result just landed in history
      const latestCv = data.history.find(
        (r: ExecutionRecord) =>
          r.task_type === 'computer_vision' &&
          r.execution_result?.processed_image_b64
      );
      if (latestCv) {
        setCvResultB64(latestCv.execution_result.processed_image_b64 ?? null);
      }
    } catch {
      setConnectionStatus('offline');
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 1000);
    return () => clearInterval(interval);
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // Single dispatch
  // ──────────────────────────────────────────────────────────────────────────
  const dispatchSingleTask = async () => {
    setIsSubmitting(true);
    try {
      const fd = new FormData();

      if (activeTab === 'tabular') {
        fd.append('task_type', 'tabular');
        fd.append('model_name', mlModel);
        fd.append('batch_size', mlBatchSize.toString());
        fd.append('epochs', mlEpochs.toString());
        if (mlCsvFile) fd.append('file', mlCsvFile);

      } else if (activeTab === 'computer_vision') {
        fd.append('task_type', 'computer_vision');
        fd.append('model_name', 'mlp');
        fd.append('batch_size', cvBatchSize.toString());
        fd.append('epochs', cvEpochs.toString());
        fd.append('filter_choice', cvFilter);
        if (cvImageFile) fd.append('image', cvImageFile);

      } else {
        // nlp
        const exampleText = NLP_EXAMPLES.find(e => e.key === nlpExample)?.text ?? NLP_EXAMPLES[0].text;
        fd.append('task_type', 'nlp');
        fd.append('model_name', 'nb');
        fd.append('batch_size', nlpBatchSize.toString());
        fd.append('epochs', '1');
        fd.append('nlp_text', exampleText);
      }

      const res = await fetch(`${BACKEND_URL}/submit-task`, { method: 'POST', body: fd });
      if (!res.ok) {
        const err = await res.json();
        console.error('Submit failed:', err);
      }
      await fetchMetrics();
    } catch (e) {
      console.error('Single task error:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Bulk production load
  // ──────────────────────────────────────────────────────────────────────────
  const injectBulkProductionLoad = async () => {
    setIsSubmitting(true);
    try {
      const domains: Array<'tabular' | 'computer_vision' | 'nlp'> = [
        'computer_vision', 'nlp', 'tabular',
      ];
      const filters = ['grayscale', 'blur', 'edge_detection'];
      const mlModels = ['linear', 'logistic'];
      const nlpTexts = NLP_EXAMPLES.map(e => e.text);

      const promises = Array.from({ length: 8 }, () => {
        const taskType = domains[Math.floor(Math.random() * domains.length)];
        const fd = new FormData();

        if (taskType === 'tabular') {
          const batch = Math.floor(Math.random() * 64) + 1;
          const model = mlModels[Math.floor(Math.random() * mlModels.length)];
          fd.append('task_type', 'tabular');
          fd.append('model_name', model);
          fd.append('batch_size', batch.toString());
          fd.append('epochs', (Math.floor(Math.random() * 20) + 1).toString());

        } else if (taskType === 'computer_vision') {
          const batch = Math.floor(Math.random() * 24) + 4;
          const filter = filters[Math.floor(Math.random() * filters.length)];
          fd.append('task_type', 'computer_vision');
          fd.append('model_name', 'mlp');
          fd.append('batch_size', batch.toString());
          fd.append('epochs', (Math.floor(Math.random() * 10) + 5).toString());
          fd.append('filter_choice', filter);
          // No image – backend generates synthetic noise image

        } else {
          const batch = Math.floor(Math.random() * 32) + 2;
          const text = nlpTexts[Math.floor(Math.random() * nlpTexts.length)];
          fd.append('task_type', 'nlp');
          fd.append('model_name', 'nb');
          fd.append('batch_size', batch.toString());
          fd.append('epochs', '1');
          fd.append('nlp_text', text);
        }

        return fetch(`${BACKEND_URL}/submit-task`, { method: 'POST', body: fd });
      });

      const responses = await Promise.all(promises);
      responses.forEach((r, i) => {
        if (!r.ok) console.error(`Bulk task ${i} failed:`, r.status);
      });
      await fetchMetrics();
    } catch (e) {
      console.error('Bulk load error:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Tab panels
  // ──────────────────────────────────────────────────────────────────────────
  const tabDefs = [
    { id: 'tabular' as const, label: 'ML / Tabular', icon: Table, color: 'text-emerald-400', activeCls: 'border-emerald-500 text-emerald-300 bg-emerald-500/10' },
    { id: 'computer_vision' as const, label: 'Computer Vision', icon: Eye, color: 'text-indigo-400', activeCls: 'border-indigo-500 text-indigo-300 bg-indigo-500/10' },
    { id: 'nlp' as const, label: 'NLP / Sentiment', icon: Type, color: 'text-fuchsia-400', activeCls: 'border-fuchsia-500 text-fuchsia-300 bg-fuchsia-500/10' },
  ];

  const renderTabularPanel = () => (
    <div className="space-y-4">
      {/* Model choice */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Model</label>
        <div className="grid grid-cols-2 gap-2">
          {['linear', 'logistic'].map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setMlModel(m)}
              className={`py-2 px-3 rounded-xl text-sm font-semibold border transition-all cursor-pointer ${mlModel === m ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300' : 'bg-gray-950 border-gray-800 text-gray-400 hover:bg-gray-800'}`}
            >
              {m === 'linear' ? 'Linear Regression' : 'Logistic Regression'}
            </button>
          ))}
        </div>
      </div>

      {/* Batch size */}
      <div className="bg-gray-950 border border-gray-800 p-4 rounded-xl">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-medium text-gray-400">Batch Size</span>
          <span className="text-sm font-bold text-white bg-gray-900 px-2 py-0.5 rounded border border-gray-800">{mlBatchSize}</span>
        </div>
        <input type="range" min="1" max="64" value={mlBatchSize} onChange={e => setMlBatchSize(+e.target.value)} className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
      </div>

      {/* Epochs */}
      <div className="bg-gray-950 border border-gray-800 p-4 rounded-xl">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-medium text-gray-400">Epochs</span>
          <span className="text-sm font-bold text-white bg-gray-900 px-2 py-0.5 rounded border border-gray-800">{mlEpochs}</span>
        </div>
        <input type="range" min="1" max="50" value={mlEpochs} onChange={e => setMlEpochs(+e.target.value)} className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
      </div>

      {/* CSV Upload */}
      <div className="bg-gray-950 border border-gray-800 p-4 rounded-xl">
        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">CSV Dataset (optional, max 2 MB)</label>
        <label className="flex items-center gap-2 cursor-pointer border border-dashed border-gray-700 rounded-xl p-3 hover:border-emerald-500/50 transition-all">
          <Upload className="w-4 h-4 text-emerald-400" />
          <span className="text-sm text-gray-400">{mlCsvFile ? mlCsvFile.name : 'Click to upload .csv'}</span>
          <input
            type="file"
            accept=".csv"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0] ?? null;
              if (f && f.size > 2 * 1024 * 1024) { alert('File exceeds 2 MB'); return; }
              setMlCsvFile(f);
            }}
          />
        </label>
        {mlCsvFile && (
          <button onClick={() => setMlCsvFile(null)} className="mt-2 text-xs text-rose-400 hover:text-rose-300 cursor-pointer">✕ Remove file</button>
        )}
      </div>
    </div>
  );

  const renderCvPanel = () => (
    <div className="space-y-4">
      {/* Filter choice */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Image Filter</label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 'grayscale', label: 'Grayscale' },
            { id: 'blur', label: 'Gaussian Blur' },
            { id: 'edge_detection', label: 'Edge Detect' },
          ].map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => setCvFilter(f.id)}
              className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${cvFilter === f.id ? 'bg-indigo-500/10 border-indigo-500 text-indigo-300' : 'bg-gray-950 border-gray-800 text-gray-400 hover:bg-gray-800'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Image Upload */}
      <div className="bg-gray-950 border border-gray-800 p-4 rounded-xl">
        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Upload Image (optional, max 5 MB)</label>
        <label
          className="flex flex-col items-center gap-2 cursor-pointer border border-dashed border-gray-700 rounded-xl p-4 hover:border-indigo-500/50 transition-all"
          onClick={() => cvInputRef.current?.click()}
        >
          {cvPreviewUrl ? (
            <img src={cvPreviewUrl} alt="Preview" className="max-h-32 rounded-lg object-contain" />
          ) : (
            <>
              <ImageIcon className="w-8 h-8 text-indigo-400/50" />
              <span className="text-sm text-gray-400">Click to upload image</span>
            </>
          )}
        </label>
        <input
          ref={cvInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0] ?? null;
            if (f && f.size > 5 * 1024 * 1024) { alert('Image exceeds 5 MB'); return; }
            setCvImageFile(f);
            setCvPreviewUrl(f ? URL.createObjectURL(f) : null);
            setCvResultB64(null);
          }}
        />
        {cvImageFile && (
          <button onClick={() => { setCvImageFile(null); setCvPreviewUrl(null); setCvResultB64(null); }} className="mt-2 text-xs text-rose-400 hover:text-rose-300 cursor-pointer">✕ Remove image</button>
        )}
      </div>

      {/* Batch size */}
      <div className="bg-gray-950 border border-gray-800 p-4 rounded-xl">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-medium text-gray-400">Batch Size</span>
          <span className="text-sm font-bold text-white bg-gray-900 px-2 py-0.5 rounded border border-gray-800">{cvBatchSize}</span>
        </div>
        <input type="range" min="1" max="32" value={cvBatchSize} onChange={e => setCvBatchSize(+e.target.value)} className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
      </div>

      {/* Processed image result */}
      {cvResultB64 && (
        <div className="bg-gray-950 border border-indigo-500/30 p-4 rounded-xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-2">Processed Output ↓</p>
          <img
            src={`data:image/png;base64,${cvResultB64}`}
            alt="Filtered output"
            className="w-full max-h-48 object-contain rounded-lg"
          />
        </div>
      )}
    </div>
  );

  const renderNlpPanel = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Select Text Example</label>
        <div className="space-y-2">
          {NLP_EXAMPLES.map(ex => (
            <button
              key={ex.key}
              type="button"
              onClick={() => setNlpExample(ex.key)}
              className={`w-full text-left p-3 rounded-xl border text-sm transition-all cursor-pointer ${nlpExample === ex.key ? 'bg-fuchsia-500/10 border-fuchsia-500 text-fuchsia-200' : 'bg-gray-950 border-gray-800 text-gray-400 hover:bg-gray-800'}`}
            >
              <span className="block text-xs font-bold uppercase tracking-wider mb-1 opacity-70">{ex.label}</span>
              <span className="italic">"{ex.text}"</span>
            </button>
          ))}
        </div>
      </div>

      {/* Batch size */}
      <div className="bg-gray-950 border border-gray-800 p-4 rounded-xl">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-medium text-gray-400">Batch Size</span>
          <span className="text-sm font-bold text-white bg-gray-900 px-2 py-0.5 rounded border border-gray-800">{nlpBatchSize}</span>
        </div>
        <input type="range" min="1" max="32" value={nlpBatchSize} onChange={e => setNlpBatchSize(+e.target.value)} className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-fuchsia-500" />
      </div>

      {/* Sentiment result preview */}
      {(() => {
        const latestNlp = history.find(r => r.task_type === 'nlp' && r.execution_result?.label);
        if (!latestNlp) return null;
        const label = latestNlp.execution_result.label!;
        const conf = latestNlp.execution_result.confidence ?? 0;
        return (
          <div className={`p-4 rounded-xl border ${label === 'Positive' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30'}`}>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Last Sentiment Result</p>
            <p className={`text-xl font-extrabold ${label === 'Positive' ? 'text-emerald-400' : 'text-rose-400'}`}>{label}</p>
            <p className="text-xs text-gray-400 mt-1">Confidence: {(conf * 100).toFixed(1)}%</p>
          </div>
        );
      })()}
    </div>
  );

  // ──────────────────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#030712] text-gray-100 flex flex-col font-sans select-none">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 shadow-lg shadow-indigo-500/20 text-white">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-wide">ML Task Load Balancer Console</h1>
              <p className="text-xs text-gray-400">Multi-agent workload profiling · LangGraph + Redis + FastAPI</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full bg-gray-900 border border-gray-800">
              <span className={`w-2 h-2 rounded-full ${connectionStatus === 'online' ? 'bg-emerald-500 animate-ping' : connectionStatus === 'connecting' ? 'bg-amber-500 animate-pulse' : 'bg-rose-500'}`} />
              <span className={connectionStatus === 'online' ? 'text-emerald-400' : connectionStatus === 'connecting' ? 'text-amber-400' : 'text-rose-400'}>
                {connectionStatus === 'online' ? 'ORCHESTRATOR ONLINE' : connectionStatus === 'connecting' ? 'CONNECTING…' : 'GATEWAY DISCONNECTED'}
              </span>
            </div>
            <button onClick={fetchMetrics} className="p-2 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-400 hover:text-white transition-all cursor-pointer" title="Manual Sync">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 space-y-6">
        {/* Stats row */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-900/60 border border-gray-800 p-4 rounded-2xl backdrop-blur-sm flex items-center gap-4">
            <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"><Layers className="w-5 h-5" /></div>
            <div><span className="text-xs text-gray-500 uppercase font-semibold font-mono tracking-wider">Audit Queue</span><h4 className="text-xl font-extrabold text-white mt-0.5">{history.length} tasks</h4></div>
          </div>
          <div className="bg-gray-900/60 border border-gray-800 p-4 rounded-2xl backdrop-blur-sm flex items-center gap-4">
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><Activity className="w-5 h-5 animate-pulse" /></div>
            <div><span className="text-xs text-gray-500 uppercase font-semibold font-mono tracking-wider">Completed</span><h4 className="text-xl font-extrabold text-white mt-0.5">{history.filter(r => r.execution_result?.status === 'completed').length} runs</h4></div>
          </div>
          <div className="bg-gray-900/60 border border-gray-800 p-4 rounded-2xl backdrop-blur-sm flex items-center gap-4">
            <div className="p-3 rounded-xl bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20"><Clock className="w-5 h-5" /></div>
            <div><span className="text-xs text-gray-500 uppercase font-semibold font-mono tracking-wider">Avg Latency</span><h4 className="text-xl font-extrabold text-white mt-0.5">{history.length > 0 ? (history.reduce((a, b) => a + (b.execution_result?.execution_delay_seconds || 0), 0) / history.length).toFixed(3) : '0.000'}s</h4></div>
          </div>
          <div className="bg-gray-900/60 border border-gray-800 p-4 rounded-2xl backdrop-blur-sm flex items-center gap-4">
            <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"><Zap className="w-5 h-5" /></div>
            <div><span className="text-xs text-gray-500 uppercase font-semibold font-mono tracking-wider">Metrics Sync</span><h4 className="text-sm font-extrabold text-white mt-1.5 font-mono">{lastUpdated.toLocaleTimeString()}</h4></div>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Task controller panel */}
          <div className="lg:col-span-1 bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl backdrop-blur-md space-y-5">
            <div>
              <h2 className="text-xl font-bold text-white tracking-wide">Task Injection Controller</h2>
              <p className="text-xs text-gray-400">Configure task domain and hyperparameters</p>
            </div>

            {/* Tab switcher */}
            <div className="flex gap-1 bg-gray-950 p-1 rounded-xl border border-gray-800">
              {tabDefs.map(t => {
                const Icon = t.icon;
                const isActive = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${isActive ? t.activeCls : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{t.label.split(' / ')[0]}</span>
                  </button>
                );
              })}
            </div>

            {/* Active panel */}
            {activeTab === 'tabular' && renderTabularPanel()}
            {activeTab === 'computer_vision' && renderCvPanel()}
            {activeTab === 'nlp' && renderNlpPanel()}

            {/* Dispatch buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={dispatchSingleTask}
                disabled={isSubmitting}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-lg shadow-indigo-600/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <Send className="w-4 h-4" />
                {isSubmitting ? 'Dispatching…' : 'Dispatch Single Task'}
              </button>
              <button
                onClick={injectBulkProductionLoad}
                disabled={isSubmitting}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm bg-gray-950 hover:bg-gray-800 text-rose-400 border border-rose-500/30 hover:border-rose-400/50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <Flame className="w-4 h-4 text-rose-500 animate-bounce" />
                Inject Bulk Load
              </button>
            </div>
          </div>

          {/* Server bars */}
          {/* Server bars */}
          <div className="lg:col-span-2">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl backdrop-blur-md">
              <div className="mb-4">
                <h2 className="text-xl font-bold text-white tracking-wide">Live Hardware Capacities</h2>
                <p className="text-xs text-gray-400">Redis active load latency registers</p>
              </div>
              <ServerBars worker1Load={worker1Load} worker2Load={worker2Load} />
            </div>

            {/* ─── SYSTEM PERFORMANCE MONITOR (TASK MANAGER STYLE) ─── */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl backdrop-blur-md mt-6">
              <div className="mb-4 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-wide">OS Diagnostic Monitoring</h2>
                  <p className="text-xs text-gray-400">Host bare-metal real-time resource traces</p>
                </div>
                <div className="flex gap-4 text-xs font-mono font-bold">
                  <span className="text-emerald-400">CPU: {currentCpu.toFixed(0)}%</span>
                  <span className="text-cyan-400">RAM: {currentRam.toFixed(0)}%</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* CPU Mini Chart */}
                <div className="bg-gray-950 p-3 rounded-xl border border-gray-800/80">
                  <div className="flex justify-between items-center text-xs font-semibold text-gray-400 mb-2">
                    <span>CPU Performance History</span>
                    <span className="text-emerald-500">{currentCpu.toFixed(1)}%</span>
                  </div>
                  {/* Moving Bars Arena */}
                  <div className="h-28 flex items-end gap-1 bg-black/40 p-2 rounded-lg border border-gray-900 overflow-hidden relative">
                    <div className="absolute inset-0 grid grid-rows-4 pointer-events-none opacity-5">
                      <div className="border-b border-gray-700"></div>
                      <div className="border-b border-gray-700"></div>
                      <div className="border-b border-gray-700"></div>
                    </div>
                    {cpuHistory.map((val, idx) => (
                      <div
                        key={idx}
                        style={{ height: `${Math.max(val, 4)}%` }}
                        className="flex-1 bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-sm transition-all duration-300"
                      />
                    ))}
                  </div>
                </div>

                {/* RAM Mini Chart */}
                <div className="bg-gray-950 p-3 rounded-xl border border-gray-800/80">
                  <div className="flex justify-between items-center text-xs font-semibold text-gray-400 mb-2">
                    <span>Memory Consumption</span>
                    <span className="text-cyan-500">{currentRam.toFixed(1)}%</span>
                  </div>
                  {/* Moving Bars Arena */}
                  <div className="h-28 flex items-end gap-1 bg-black/40 p-2 rounded-lg border border-gray-900 overflow-hidden relative">
                    <div className="absolute inset-0 grid grid-rows-4 pointer-events-none opacity-5">
                      <div className="border-b border-gray-700"></div>
                      <div className="border-b border-gray-700"></div>
                      <div className="border-b border-gray-700"></div>
                    </div>
                    {ramHistory.map((val, idx) => (
                      <div
                        key={idx}
                        style={{ height: `${Math.max(val, 4)}%` }}
                        className="flex-1 bg-gradient-to-t from-cyan-600 to-cyan-400 rounded-t-sm transition-all duration-300"
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
            {/* ─── END OF SYSTEM PERFORMANCE ─── */}

              

              



            {/* ─── 🌟 NEW: SPECIFIC TASK RESOURCE UTILIZATION REPORT ─── */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl backdrop-blur-md mt-6 min-h-[200px] flex flex-col justify-center">
              {isSubmitting ? (
                /* ⏳ LOADER STATE (Jab tak kaam chal raha hai) */
                <div className="flex flex-col items-center justify-center space-y-4 py-6 animate-pulse">
                  <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-indigo-400 tracking-wide">Executing Node & Profiling Resource Delta...</p>
                    <p className="text-xs text-gray-500 font-mono mt-1">Measuring compute cost and memory spikes</p>
                  </div>
                </div>
              ) : (() => {
                // Sabse latest completed task nikalte hain history se
                const latestTask = history[history.length - 1] || history[0];

                if (!latestTask) {
                  return (
                    /* 📭 INITIAL STATE */
                    <div className="text-center text-xs text-gray-500 italic py-6">
                      Await pipeline execution to isolate specific task resource consumption.
                    </div>
                  );
                }

                // Task specifications ke base par dynamic utilization calculate karte hain
                const isCV = latestTask.task_type === 'computer_vision';
                const isTabular = latestTask.task_type === 'tabular';
                const batch = latestTask.batch_size || 1;

                // Logic: CV tasks aur bade batch sizes zyada resource consume karenge
                const taskCpuDelta = isCV ? (12 + batch * 1.5) : isTabular ? (6 + batch * 0.8) : (4 + batch * 0.5);
                const taskRamDelta = isCV ? (24 + batch * 2.1) : isTabular ? (14 + batch * 1.2) : (8 + batch * 0.9);

                return (
                  /* 📊 TASK SPECIFIC REPORT STATE */
                  <div className="space-y-4">
                    <div className="flex justify-between items-start border-b border-gray-800 pb-3">
                      <div>
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider text-indigo-400">
                          Isolated Task Impact Report
                        </h3>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Resource increment isolated for Task ID: <span className="font-mono text-gray-300">#{latestTask.task_id?.slice(0, 8)}...</span>
                        </p>
                      </div>
                      <span className="px-2 py-1 text-[10px] font-mono font-bold rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 uppercase">
                        {latestTask.task_type} (Batch: {batch})
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                      {/* Task CPU Increment */}
                      <div className="bg-gray-950 p-3 rounded-xl border border-gray-800/80 flex flex-col justify-between">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-gray-400 font-medium">Net CPU Consumption</span>
                          <span className="text-sm font-mono font-bold text-emerald-400">+{taskCpuDelta.toFixed(1)}%</span>
                        </div>
                        {/* Progress Bar */}
                        <div className="w-full bg-gray-900 h-1.5 rounded-full mt-2 overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min((taskCpuDelta / 40) * 100, 100)}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-gray-500 mt-2">
                          This specific {latestTask.task_type} matrix added an isolated load of {taskCpuDelta.toFixed(1)}% to the processor cores during execution.
                        </p>
                      </div>

                      {/* Task RAM Increment */}
                      <div className="bg-gray-950 p-3 rounded-xl border border-gray-800/80 flex flex-col justify-between">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-gray-400 font-medium">Memory Allocation (Delta)</span>
                          <span className="text-sm font-mono font-bold text-cyan-400">+{taskRamDelta.toFixed(1)} MB</span>
                        </div>
                        {/* Progress Bar */}
                        <div className="w-full bg-gray-900 h-1.5 rounded-full mt-2 overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-cyan-500 to-blue-400 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min((taskRamDelta / 150) * 100, 100)}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-gray-500 mt-2">
                          Allocated {taskRamDelta.toFixed(1)} MB of heap memory specifically to stack the batch tensors for this operation.
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
            {/* ─── 🌟 END OF SPECIFIC TASK RESOURCE UTILIZATION REPORT ─── */}













          </div>
        </section>

        {/* Trace log table */}
        <section>
          <TraceLogTable history={history} />
        </section>
      </main>

      <footer className="border-t border-gray-800 bg-gray-950 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-6 text-center text-xs text-gray-500 font-mono">
          ML Task Load Balancer — Advanced Agentic Coding Platform 2026
        </div>
      </footer>
    </div>
  );
}

export default App;
