import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Label, Tooltip } from 'recharts';
import { PieChart as PieChartIcon } from 'lucide-react';
import { cn } from '@shared/lib/utils';
import { InfoTooltip } from '../atoms/InfoTooltip';

interface WinRateArcProps {
  wins: number;
  losses: number;
  winRate: number;
  className?: string;
  infoText?: string;
}

export const WinRateArc: React.FC<WinRateArcProps> = ({ wins, losses, winRate, className, infoText }) => {
  const data = [
    { name: 'Wins', value: wins, color: '#10B981' },
    { name: 'Losses', value: losses, color: '#F43F5E' }
  ];

  return (
    <div className={cn("zoya-card p-6 flex flex-col h-[280px]", className)}>
      <div className="flex items-center justify-between mb-2">
        <div className="p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-xl">
          <PieChartIcon size={20} />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Win Rate</span>
          {infoText && <InfoTooltip text={infoText} />}
        </div>
      </div>
      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={70}
              paddingAngle={5}
              dataKey="value"
              stroke="none"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
              <Label 
                value={`${Math.round(winRate || 0)}%`} 
                position="center" 
                className="text-2xl font-black fill-gray-900 dark:fill-white" 
              />
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-center gap-4 text-[10px] font-bold uppercase tracking-widest mt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-emerald-500">{wins} Wins</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-rose-500" />
          <span className="text-rose-500">{losses} Losses</span>
        </div>
      </div>
    </div>
  );
};
