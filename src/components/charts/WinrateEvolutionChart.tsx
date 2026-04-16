import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Trade } from '../../lib/db';

export default function WinrateEvolutionChart({ trades }: { trades: Trade[] }) {
  const data = React.useMemo(() => {
    const sorted = [...trades].sort((a, b) => a.date.getTime() - b.date.getTime());
    let wins = 0;
    return sorted.map((t, i) => {
      if (t.pnl > 0) wins++;
      return {
        date: t.date.toISOString().split('T')[0],
        winrate: ((wins / (i + 1)) * 100).toFixed(2)
      };
    });
  }, [trades]);

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-lg">
      <h3 className="text-lg font-poppins font-black text-gray-900 dark:text-white mb-4">Évolution du Winrate</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
            <XAxis dataKey="date" stroke="#6B7280" fontSize={12} tickMargin={10} />
            <YAxis stroke="#6B7280" fontSize={12} tickFormatter={(val) => `${val}%`} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '12px', color: '#fff' }}
              itemStyle={{ color: '#10B981' }}
            />
            <Line type="monotone" dataKey="winrate" stroke="#10B981" strokeWidth={3} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
