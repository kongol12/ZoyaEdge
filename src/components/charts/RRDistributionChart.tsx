import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Trade } from '../../lib/db';
import { calculateRR } from '../../lib/advancedTradingMetrics';
import { InfoTooltip } from '../atoms/InfoTooltip';

export default function RRDistributionChart({ trades, infoText }: { trades: Trade[], infoText?: string }) {
  const data = React.useMemo(() => {
    const bins = { '<1': 0, '1-2': 0, '2-3': 0, '3-4': 0, '>4': 0 };
    trades.forEach(t => {
      const rr = calculateRR(t);
      if (rr < 1) bins['<1']++;
      else if (rr < 2) bins['1-2']++;
      else if (rr < 3) bins['2-3']++;
      else if (rr < 4) bins['3-4']++;
      else bins['>4']++;
    });
    return Object.entries(bins).map(([range, count]) => ({ range, count }));
  }, [trades]);

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-lg">
      <div className="flex items-center gap-1.5 mb-4">
        <h3 className="text-lg font-poppins font-black text-gray-900 dark:text-white uppercase tracking-tight">Distribution Risk/Reward</h3>
        {infoText && <InfoTooltip text={infoText} />}
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
            <XAxis dataKey="range" stroke="#6B7280" fontSize={12} tickMargin={10} />
            <YAxis stroke="#6B7280" fontSize={12} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '12px', color: '#fff' }}
              itemStyle={{ color: '#3B82F6' }}
              cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
            />
            <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
