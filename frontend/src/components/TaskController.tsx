import React, { useState } from 'react';
import { Eye, Type, Table, Send, Flame, Info } from 'lucide-react';

interface TaskControllerProps {
  onSubmitSingle: (task: { task_type: string; batch_size: number; data_size_kb: number }) => void;
  onSubmitBulk: (tasks: Array<{ task_type: string; batch_size: number; data_size_kb: number }>) => void;
  isSubmitting: boolean;
}

export const TaskController: React.FC<TaskControllerProps> = ({
  onSubmitSingle,
  onSubmitBulk,
  isSubmitting,
}) => {
  const [taskType, setTaskType] = useState<string>('computer_vision');
  const [batchSize, setBatchSize] = useState<number>(8);
  const [dataSizeKb, setDataSizeKb] = useState<number>(500);

  const taskTypes = [
    {
      id: 'computer_vision',
      label: 'Computer Vision',
      desc: 'CV classification & object detection models',
      icon: Eye,
      color: 'text-indigo-400 border-indigo-500/20 bg-indigo-500/5',
      activeColor: 'border-indigo-500 bg-indigo-500/10 text-indigo-300 ring-2 ring-indigo-500/30',
    },
    {
      id: 'nlp',
      label: 'Natural Language Processing',
      desc: 'LLMs, sentiment analysis & NER models',
      icon: Type,
      color: 'text-fuchsia-400 border-fuchsia-500/20 bg-fuchsia-500/5',
      activeColor: 'border-fuchsia-500 bg-fuchsia-500/10 text-fuchsia-300 ring-2 ring-fuchsia-500/30',
    },
    {
      id: 'tabular',
      label: 'Tabular Processing',
      desc: 'Regression, forecasting & XGBoost systems',
      icon: Table,
      color: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5',
      activeColor: 'border-emerald-500 bg-emerald-500/10 text-emerald-300 ring-2 ring-emerald-500/30',
    },
  ];

  const handleSingleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmitSingle({
      task_type: taskType,
      batch_size: batchSize,
      data_size_kb: dataSizeKb,
    });
  };

  const handleBulkSubmit = () => {
    // Generate 8 parallel randomized tasks matching various domains
    const types = ['computer_vision', 'nlp', 'tabular'];
    const bulkTasks = Array.from({ length: 8 }, () => {
      const randomType = types[Math.floor(Math.random() * types.length)];
      let randomBatch = 1;
      let randomSize = 1;

      if (randomType === 'computer_vision') {
        randomBatch = Math.floor(Math.random() * 24) + 4; // 4 to 28
        randomSize = Math.floor(Math.random() * 4000) + 500; // 500 to 4500 KB
      } else if (randomType === 'nlp') {
        randomBatch = Math.floor(Math.random() * 32) + 2; // 2 to 34
        randomSize = Math.floor(Math.random() * 8000) + 100; // 100 to 8100 KB
      } else {
        randomBatch = Math.floor(Math.random() * 64) + 1; // 1 to 65
        randomSize = Math.floor(Math.random() * 200) + 1; // 1 to 200 KB
      }

      return {
        task_type: randomType,
        batch_size: randomBatch,
        data_size_kb: randomSize,
      };
    });

    onSubmitBulk(bulkTasks);
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl backdrop-blur-md">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">Task Injection Controller</h2>
          <p className="text-xs text-gray-400">Configure parameters or stress test queue routing</p>
        </div>
      </div>

      <form onSubmit={handleSingleSubmit} className="space-y-6">
        {/* Task Type Cards */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
            Analytical Computational Domain
          </label>
          <div className="grid grid-cols-1 gap-3">
            {taskTypes.map((t) => {
              const Icon = t.icon;
              const isActive = taskType === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTaskType(t.id)}
                  className={`flex items-start gap-4 p-4 rounded-xl border text-left transition-all duration-200 cursor-pointer hover:translate-x-1 ${
                    isActive ? t.activeColor : `${t.color} hover:bg-gray-800/40`
                  }`}
                >
                  <div className="p-2.5 rounded-lg bg-gray-950 border border-gray-800 mt-0.5">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-white">{t.label}</h4>
                    <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{t.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sliders Container */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Batch Size Slider */}
          <div className="bg-gray-950 border border-gray-850 p-4 rounded-xl">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-medium text-gray-400">Batch Size Constraint</span>
              <span className="text-sm font-bold text-white bg-gray-900 px-2 py-0.5 rounded border border-gray-800">
                {batchSize} items
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="64"
              value={batchSize}
              onChange={(e) => setBatchSize(parseInt(e.target.value))}
              className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <div className="flex justify-between mt-1 text-[10px] text-gray-500 font-mono">
              <span>1</span>
              <span>32</span>
              <span>64</span>
            </div>
          </div>

          {/* Data Size Slider */}
          <div className="bg-gray-950 border border-gray-850 p-4 rounded-xl">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-medium text-gray-400">Data Size Payload</span>
              <span className="text-sm font-bold text-white bg-gray-900 px-2 py-0.5 rounded border border-gray-800">
                {(dataSizeKb / 1000).toFixed(1)} MB <span className="text-[10px] text-gray-500">({dataSizeKb} KB)</span>
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="10000"
              value={dataSizeKb}
              onChange={(e) => setDataSizeKb(parseInt(e.target.value))}
              className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <div className="flex justify-between mt-1 text-[10px] text-gray-500 font-mono">
              <span>1 KB</span>
              <span>5 MB</span>
              <span>10 MB</span>
            </div>
          </div>
        </div>

        {/* Info panel showing estimated cost before sending */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-950 border border-gray-850 text-xs text-gray-400">
          <Info className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>
            Estimated processing cost:{' '}
            <strong className="text-indigo-300 font-mono">
              {taskType === 'computer_vision'
                ? (0.5 + batchSize * 0.3 + dataSizeKb / 5000).toFixed(3)
                : taskType === 'nlp'
                ? (0.2 + batchSize * 0.15 + dataSizeKb / 1000).toFixed(3)
                : (0.05 + batchSize * 0.001).toFixed(3)}
              s
            </strong>
          </span>
        </div>

        {/* Submission Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          {/* Dispatch Single */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-lg shadow-indigo-600/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            <Send className="w-4 h-4" />
            Dispatch Single Task
          </button>

          {/* Inject Bulk */}
          <button
            type="button"
            onClick={handleBulkSubmit}
            disabled={isSubmitting}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm bg-gray-950 hover:bg-gray-800 text-rose-400 border border-rose-500/30 hover:border-rose-400/50 shadow-lg shadow-rose-500/5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            <Flame className="w-4 h-4 text-rose-500 animate-bounce" />
            Inject Bulk Production Load
          </button>
        </div>
      </form>
    </div>
  );
};
