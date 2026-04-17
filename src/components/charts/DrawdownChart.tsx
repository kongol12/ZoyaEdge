import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { InfoTooltip } from '../atoms/InfoTooltip';
import { compactCurrency } from '../../lib/utils';

export default function DrawdownChart({ data, infoText }: { data: any[], infoText?: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-lg h-[350px] min-h-[350px] w-full relative">
      <div className="flex items-center mb-4">
        <h3 className="text-lg font-poppins font-black text-gray-900 dark:text-white">Drawdown</h3>
        {infoText && <InfoTooltip text={infoText} />}
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
          <XAxis dataKey="date" stroke="#6B7280" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis stroke="#6B7280" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => compactCurrency(val)} />
          <Tooltip
            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            formatter={(value: number) => [compactCurrency(value), 'Drawdown']}
          />
          <Area type="monotone" dataKey="drawdown" stroke="#EF4444" fill="#FEE2E2" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
