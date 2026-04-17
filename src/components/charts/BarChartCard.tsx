import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { InfoTooltip } from '../atoms/InfoTooltip';
import { compactCurrency } from '../../lib/utils';

interface BarChartCardProps {
  title: string;
  data: any[];
  dataKey: string;
  barKey: string;
  color?: string;
  valuePrefix?: string;
  infoText?: string;
}

export default function BarChartCard({ title, data, dataKey, barKey, color = '#3B82F6', valuePrefix = '', infoText }: BarChartCardProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-lg h-[350px] min-h-[350px] w-full relative">
      <div className="flex items-center mb-4">
        <h3 className="text-lg font-poppins font-black text-gray-900 dark:text-white">{title}</h3>
        {infoText && <InfoTooltip text={infoText} />}
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} vertical={false} />
          <XAxis dataKey={dataKey} stroke="#6B7280" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis stroke="#6B7280" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => compactCurrency(val)} />
          <Tooltip
            cursor={{ fill: 'transparent' }}
            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            formatter={(value: number) => [compactCurrency(value), barKey]}
          />
          <Bar dataKey={barKey} radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry[barKey] >= 0 ? color : '#EF4444'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
