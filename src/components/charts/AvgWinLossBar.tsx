import React from 'react';
import { BarChart3 } from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';
import { InfoTooltip } from '../atoms/InfoTooltip';

interface AvgWinLossBarProps {
  avgWin: number;
  avgLoss: number;
  avgRatio: number;
  className?: string;
  infoText?: string;
}

export const AvgWinLossBar: React.FC<AvgWinLossBarProps> = ({ avgWin, avgLoss, avgRatio, className, infoText }) => {
  const winPercent = (avgWin / (avgWin + avgLoss)) * 100 || 50;
  const lossPercent = (avgLoss / (avgWin + avgLoss)) * 100 || 50;

  return (
    <div className={cn("zoya-card p-6 flex flex-col h-[280px]", className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 bg-rose-100 dark:bg-rose-900/30 text-rose-600 rounded-xl">
          <BarChart3 size={20} />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Avg Win/Loss</span>
          {infoText && <InfoTooltip text={infoText} />}
        </div>
      </div>
      
      <div className="flex-1 flex flex-col justify-center">
        <div className="text-3xl font-black text-gray-900 dark:text-white mb-6 text-center">
          {avgRatio.toFixed(2)}
        </div>
        
        <div className="relative h-4 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden flex">
          {avgWin > 0 && (
            <div 
              className="h-full bg-emerald-500 transition-all duration-500" 
              style={{ width: `${winPercent}%` }} 
            />
          )}
          {avgLoss > 0 && (
            <div 
              className="h-full bg-rose-500 transition-all duration-500" 
              style={{ width: `${lossPercent}%` }} 
            />
          )}
          <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-white dark:bg-gray-900 z-10" />
        </div>
        
        <div className="flex justify-between mt-4">
          <div className="text-center">
            <span className="block text-[10px] font-black uppercase text-gray-400 mb-1">Avg Win</span>
            <span className="text-sm font-bold text-emerald-500">{formatCurrency(avgWin)}</span>
          </div>
          <div className="text-center">
            <span className="block text-[10px] font-black uppercase text-gray-400 mb-1">Avg Loss</span>
            <span className="text-sm font-bold text-rose-500">{formatCurrency(avgLoss)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
