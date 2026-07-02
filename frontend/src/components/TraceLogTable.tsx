import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Terminal, Cpu, HardDrive, CheckCircle2, AlertCircle } from 'lucide-react';

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

interface TraceLogTableProps {
  history: ExecutionRecord[];
}

export const TraceLogTable: React.FC<TraceLogTableProps> = ({ history }) => {
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  const toggleExpand = (taskId: string) => {
    setExpandedTaskId(expandedTaskId === taskId ? null : taskId);
  };

  const getDomainBadge = (type: string) => {
    switch (type) {
      case 'computer_vision':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            Computer Vision
          </span>
        );
      case 'nlp':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20">
            NLP
          </span>
        );
      case 'tabular':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Tabular
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-500/10 text-gray-400 border border-gray-500/20">
            {type}
          </span>
        );
    }
  };

  const getWorkerBadge = (worker: string) => {
    const isW1 = worker.toLowerCase() === 'worker_1';
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold font-mono ${
        isW1
          ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
      }`}>
        {isW1 ? <Cpu className="w-3 h-3" /> : <HardDrive className="w-3 h-3" />}
        {worker.toUpperCase()}
      </span>
    );
  };

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'LOW':
        return (
          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            LOW
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            MED
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            HIGH
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl backdrop-blur-md">
      <div className="flex items-center gap-2 mb-6">
        <Terminal className="w-5 h-5 text-indigo-400" />
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">LangGraph Orchestration Trace Logs</h2>
          <p className="text-xs text-gray-400">Step-by-step state auditing and computational reasoning outputs</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-800">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-950/80 border-b border-gray-800 text-xs text-gray-400 uppercase tracking-wider">
              <th className="py-4 px-4 font-semibold">Task ID</th>
              <th className="py-4 px-4 font-semibold">Computational Domain</th>
              <th className="py-4 px-4 font-semibold text-center">Tier</th>
              <th className="py-4 px-4 font-semibold">Node Allocation</th>
              <th className="py-4 px-4 font-semibold">Processing Cost</th>
              <th className="py-4 px-4 font-semibold">Execution Metrics</th>
              <th className="py-4 px-4 font-semibold text-center">Trace</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-850">
            {history.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-sm text-gray-500">
                  No computational workloads monitored yet. Use the controller above to submit tasks.
                </td>
              </tr>
            ) : (
              history.map((record) => {
                const isExpanded = expandedTaskId === record.task_id;
                const isError = record.execution_result.status === 'failed';
                return (
                  <React.Fragment key={record.task_id}>
                    <tr className="hover:bg-gray-850/30 transition-colors text-sm text-gray-300">
                      {/* Task ID */}
                      <td className="py-3 px-4 font-mono text-xs">
                        <div className="flex items-center gap-2">
                          {isError ? (
                            <AlertCircle className="w-4 h-4 text-rose-500" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          )}
                          <span className="text-gray-400" title={record.task_id}>
                            {record.task_id.substring(0, 8)}...
                          </span>
                        </div>
                      </td>

                      {/* Domain */}
                      <td className="py-3 px-4">{getDomainBadge(record.task_type)}</td>

                      {/* Tier */}
                      <td className="py-3 px-4 text-center">{getTierBadge(record.tier)}</td>

                      {/* Allocation */}
                      <td className="py-3 px-4">{getWorkerBadge(record.assigned_worker)}</td>

                      {/* Processing Cost */}
                      <td className="py-3 px-4">
                        <div className="font-mono text-xs">
                          <span className="text-white font-semibold">
                            {record.execution_result.execution_delay_seconds?.toFixed(3) || record.estimated_cost.toFixed(3)}s
                          </span>
                          <span className="text-gray-500 block text-[10px]">
                            Est: {record.estimated_cost.toFixed(3)}s
                          </span>
                        </div>
                      </td>

                      {/* Execution Metrics */}
                      <td className="py-3 px-4">
                        {isError ? (
                          <span className="text-xs text-rose-400 font-mono italic">
                            {record.execution_result.error || 'Execution failed'}
                          </span>
                        ) : (
                          <div className="text-xs">
                            <span className="text-gray-500 uppercase font-mono mr-1">
                              {record.execution_result.metric_name}:
                            </span>
                            <span className="text-emerald-400 font-bold font-mono">
                              {record.execution_result.metric_value?.toFixed(4)}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => toggleExpand(record.task_id)}
                          className="p-1 rounded bg-gray-950 border border-gray-800 hover:bg-gray-850 hover:text-white transition-all cursor-pointer"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>

                    {/* Collapsible log view */}
                    {isExpanded && (
                      <tr className="bg-gray-950/60">
                        <td colSpan={7} className="py-4 px-6 border-t border-b border-gray-800/80">
                          <div className="space-y-3">
                            <div className="flex justify-between items-center text-xs text-gray-500 border-b border-gray-850 pb-2">
                              <span className="font-semibold uppercase tracking-wider font-mono">
                                LangGraph Routing Reasoner State Audits
                              </span>
                              <span>Timestamp: {new Date(record.completed_at).toLocaleTimeString()}</span>
                            </div>

                            <div className="bg-gray-950/80 rounded-lg p-4 border border-gray-850 font-mono text-xs text-gray-400 space-y-2">
                              {record.routing_logs.map((log, index) => (
                                <div key={index} className="flex items-start gap-2 leading-relaxed">
                                  <span className="text-indigo-400 font-bold select-none shrink-0">&gt;&gt;</span>
                                  <span className={log.includes('selected') || log.includes('Selected') ? 'text-cyan-300' : ''}>
                                    {log}
                                  </span>
                                </div>
                              ))}
                            </div>
                            
                            {/* Metadata breakdown */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs bg-gray-900/40 p-3 rounded-lg border border-gray-850/50">
                              <div>
                                <span className="text-gray-500 block">Batch Size</span>
                                <span className="text-white font-semibold">{record.batch_size}</span>
                              </div>
                              <div>
                                <span className="text-gray-500 block">Data Size</span>
                                <span className="text-white font-semibold">{record.data_size_kb} KB</span>
                              </div>
                              <div>
                                <span className="text-gray-500 block">Payload Target</span>
                                <span className="text-white font-semibold font-mono">{record.task_type}</span>
                              </div>
                              <div>
                                <span className="text-gray-500 block">Inference Status</span>
                                <span className={`font-semibold ${isError ? 'text-rose-400' : 'text-emerald-400'}`}>
                                  {isError ? 'FAILED' : 'COMPLETED'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
