import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { motion } from 'motion/react';
import { InfoTooltip } from '../atoms/InfoTooltip';
import { formatRR } from '@shared/lib/utils';

interface RiskRewardGaugeCardProps {
  ratio: number;
  delay?: number;
}

export function RiskRewardGaugeCard({ ratio, delay = 0 }: RiskRewardGaugeCardProps) {
  const data = ratio > 0 
    ? [
        { name: 'Reward', value: ratio, color: '#10B981' },
        { name: 'Risk', value: 1, color: '#F43F5E' }
      ]
    : [
        { name: 'Empty', value: 1, color: '#e5e7eb' }
      ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="p-6 bg-white dark:bg-gray-800 rounded-[32px] border border-gray-100 dark:border-gray-700 shadow-lg hover:shadow-xl transition-all duration-300 flex flex-col"
    >
      <div className="flex items-center mb-4">
        <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Ratio R/R moyen</p>
        <InfoTooltip text="Le Ratio Risque/Récompense (Risk/Reward). Un ratio de 3.1 signifie que vous gagnez en moyenne 3.1 fois ce que vous risquez de perdre." />
      </div>
      
      <div className="flex-1 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-3xl font-poppins font-black text-gray-900 dark:text-white">
            {formatRR(ratio)}
          </span>
          <div className="flex flex-col gap-1 mt-3">
            <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div> Reward
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-500"></div> Risk
            </div>
          </div>
        </div>

        <div className="w-24 h-24 relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius="65%"
                outerRadius="100%"
                startAngle={90}
                endAngle={-270}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-sm font-black text-gray-900 dark:text-white">R/R</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
