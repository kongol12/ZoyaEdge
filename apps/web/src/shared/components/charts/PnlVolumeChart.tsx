import React from 'react';
import { ResponsiveContainer, ComposedChart, Area, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { cn, formatCurrency } from '@shared/lib/utils';
import { InfoTooltip } from '../atoms/InfoTooltip';

interface PnlVolumeChartProps {
  data: any[];
  totalPnl: number;
  className?: string;
  infoText?: string;
}

export const PnlVolumeChart: React.FC<PnlVolumeChartProps> = ({ data, totalPnl, className, infoText }) => {
  return (
    <div className={cn("zoya-card p-6 flex flex-col h-[280px]", className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-xl">
          <TrendingUp size={20} />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Net P&L</span>
          {infoText && <InfoTooltip text={infoText} />}
        </div>
      </div>
      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data}>
            <defs>
              <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <Area 
              type="monotone" 
              dataKey="pnl" 
              stroke="#10B981" 
              fillOpacity={1} 
              fill="url(#pnlGradient)" 
              strokeWidth={3}
            />
            <Bar dataKey="volume" fill="#cbd5e1" opacity={0.2} radius={[2, 2, 0, 0]} />
            <XAxis dataKey="date" hide />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '12px', color: '#fff' }}
              itemStyle={{ color: '#10B981' }}
              labelStyle={{ color: '#9CA3AF', fontSize: '10px' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 text-2xl font-black text-gray-900 dark:text-white">
        {formatCurrency(totalPnl)}
      </div>
    </div>
  );
};
