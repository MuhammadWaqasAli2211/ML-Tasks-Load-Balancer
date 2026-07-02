import React from 'react';
import { Cpu, HardDrive } from 'lucide-react';

interface ServerBarsProps {
  worker1Load: number;
  worker2Load: number;
}

export const ServerBars: React.FC<ServerBarsProps> = ({ worker1Load, worker2Load }) => {
  // Max load scale used for visual mapping (e.g. 10 seconds of pipeline queue)
  const MAX_LOAD_LIMIT = 10.0;

  const getPercentage = (load: number) => {
    return Math.min((load / MAX_LOAD_LIMIT) * 100, 100);
  };

  const getLoadConfig = (load: number) => {
    if (load === 0) {
      return {
        label: 'Idle',
        textColor: 'text-emerald-400',
        borderColor: 'border-emerald-500/20',
        bgColor: 'bg-emerald-500/10',
        gradient: 'from-emerald-500 to-teal-400',
        glow: 'shadow-emerald-500/20',
      };
    } else if (load < 1.0) {
      return {
        label: 'Optimal Load',
        textColor: 'text-cyan-400',
        borderColor: 'border-cyan-500/20',
        bgColor: 'bg-cyan-500/10',
        gradient: 'from-cyan-500 to-blue-400',
        glow: 'shadow-cyan-500/20',
      };
    } else if (load < 3.5) {
      return {
        label: 'Moderate Load',
        textColor: 'text-amber-400',
        borderColor: 'border-amber-500/20',
        bgColor: 'bg-amber-500/10',
        gradient: 'from-amber-500 to-orange-400',
        glow: 'shadow-amber-500/20',
      };
    } else {
      return {
        label: 'High Stress',
        textColor: 'text-rose-400',
        borderColor: 'border-rose-500/20',
        bgColor: 'bg-rose-500/10',
        gradient: 'from-rose-500 to-red-500',
        glow: 'shadow-rose-500/20',
      };
    }
  };

  const w1Config = getLoadConfig(worker1Load);
  const w2Config = getLoadConfig(worker2Load);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Worker 1 Bar */}
      <div className={`p-6 rounded-2xl border ${w1Config.borderColor} ${w1Config.bgColor} backdrop-blur-md transition-all duration-300 shadow-lg`}>
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl bg-gray-900 border border-gray-800 ${w1Config.textColor}`}>
              <Cpu className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-white">Inference Engine Worker 1</h3>
              <p className="text-xs text-gray-400">Computational Core #01</p>
            </div>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-950 border border-gray-800/80 ${w1Config.textColor}`}>
            {w1Config.label}
          </span>
        </div>

        <div className="mb-2 flex justify-between items-end">
          <span className="text-sm text-gray-400">Pipeline Latency Queue</span>
          <span className="text-2xl font-bold tracking-tight text-white">
            {worker1Load.toFixed(3)}<span className="text-sm font-normal text-gray-400 ml-1">seconds</span>
          </span>
        </div>

        {/* Progress Bar Track */}
        <div className="w-full h-4 bg-gray-950/80 rounded-full border border-gray-800 overflow-hidden p-0.5">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${w1Config.gradient} shadow-lg ${w1Config.glow} transition-all duration-500 ease-out`}
            style={{ width: `${getPercentage(worker1Load)}%` }}
          />
        </div>
        
        <div className="flex justify-between mt-2 text-[10px] text-gray-500 font-mono">
          <span>0.0s (Min)</span>
          <span>5.0s (Target)</span>
          <span>10.0s (Limit)</span>
        </div>
      </div>

      {/* Worker 2 Bar */}
      <div className={`p-6 rounded-2xl border ${w2Config.borderColor} ${w2Config.bgColor} backdrop-blur-md transition-all duration-300 shadow-lg`}>
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl bg-gray-900 border border-gray-800 ${w2Config.textColor}`}>
              <HardDrive className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-white">Inference Engine Worker 2</h3>
              <p className="text-xs text-gray-400">Computational Core #02</p>
            </div>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-950 border border-gray-800/80 ${w2Config.textColor}`}>
            {w2Config.label}
          </span>
        </div>

        <div className="mb-2 flex justify-between items-end">
          <span className="text-sm text-gray-400">Pipeline Latency Queue</span>
          <span className="text-2xl font-bold tracking-tight text-white">
            {worker2Load.toFixed(3)}<span className="text-sm font-normal text-gray-400 ml-1">seconds</span>
          </span>
        </div>

        {/* Progress Bar Track */}
        <div className="w-full h-4 bg-gray-950/80 rounded-full border border-gray-800 overflow-hidden p-0.5">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${w2Config.gradient} shadow-lg ${w2Config.glow} transition-all duration-500 ease-out`}
            style={{ width: `${getPercentage(worker2Load)}%` }}
          />
        </div>
        
        <div className="flex justify-between mt-2 text-[10px] text-gray-500 font-mono">
          <span>0.0s (Min)</span>
          <span>5.0s (Target)</span>
          <span>10.0s (Limit)</span>
        </div>
      </div>
    </div>
  );
};
