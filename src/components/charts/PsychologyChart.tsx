import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Brain } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Trade } from '../../lib/db';
import { InfoTooltip } from '../atoms/InfoTooltip';

interface PsychologyChartProps {
  trades: Trade[];
  infoText?: string;
}

export const PsychologyChart: React.FC<PsychologyChartProps> = ({ trades, infoText }) => {
  const emotionData = React.useMemo(() => {
    const counts = {
      confidence: 0,
      neutral: 0,
      fear: 0
    };

    trades.forEach(trade => {
      const emotion = trade.emotion?.toLowerCase();
      if (emotion === '🔥' || emotion === 'confidence') {
        counts.confidence++;
      } else if (emotion === '😰' || emotion === 'fear') {
        counts.fear++;
      } else {
        counts.neutral++;
      }
    });

    return [
      { name: 'Confiance', value: counts.confidence, color: '#0B6623', emoji: '🔥' },
      { name: 'Neutre', value: counts.neutral, color: '#6B7280', emoji: '😐' },
      { name: 'Stress/Peur', value: counts.fear, color: '#D30000', emoji: '😰' }
    ].filter(d => d.value > 0);
  }, [trades]);

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-lg h-full flex flex-col relative group transition-all duration-300 hover:shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl">
            <Brain className="text-indigo-600 dark:text-indigo-400" size={20} />
          </div>
          <div>
            <h3 className="text-sm font-poppins font-black text-gray-900 dark:text-white uppercase tracking-tight">Psychologie Globale</h3>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">État émotionnel</p>
          </div>
        </div>
        {infoText && <InfoTooltip text={infoText} />}
      </div>

      <div className="flex-1 min-h-[220px] relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={emotionData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
              animationBegin={0}
              animationDuration={800}
            >
              {emotionData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#111827', 
                border: 'none', 
                borderRadius: '12px',
                fontSize: '10px',
                color: '#fff'
              }}
              itemStyle={{ color: '#fff' }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Center label */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
           <span className="block text-xl font-poppins font-black text-gray-900 dark:text-white">
            {trades.length}
           </span>
           <span className="block text-[8px] font-black text-gray-400 uppercase tracking-tighter">
            Trades
           </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-4">
        {emotionData.map((item, idx) => (
          <div key={idx} className="bg-gray-50 dark:bg-gray-900/50 p-2 rounded-xl border border-transparent hover:border-gray-100 dark:hover:border-gray-700 transition-all">
             <div className="flex items-center gap-1.5 mb-1">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-[8px] font-black text-gray-400 uppercase truncate">{item.name}</span>
             </div>
             <div className="flex items-baseline gap-1">
               <span className="text-xs font-poppins font-black text-gray-900 dark:text-white">
                {Math.round((item.value / (trades.length || 1)) * 100)}%
               </span>
               <span className="text-[10px]">{item.emoji}</span>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
};
