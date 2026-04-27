import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Brain } from 'lucide-react';
import { Trade } from '@shared/lib/db';
import { InfoTooltip } from '../atoms/InfoTooltip';
import { cn } from '@shared/lib/utils';

interface PsychologyChartProps {
  trades: Trade[];
  infoText?: string;
}

export const PsychologyChart: React.FC<PsychologyChartProps> = ({ trades, infoText }) => {
  const emotionData = React.useMemo(() => {
    const counts: Record<string, number> = {
      '🤩': 0,
      '😕': 0,
      '🧠': 0,
      '😰': 0,
      '🤑': 0,
      '😤': 0,
      '😊': 0,
      '😐': 0,
      '🔥': 0
    };

    trades.forEach(trade => {
      const emotion = trade.emotion as string;
      if (emotion && counts[emotion] !== undefined) {
        counts[emotion]++;
      } else if (emotion === 'fear') {
        counts['😰']++;
      } else if (emotion === 'confidence') {
        counts['🔥']++;
      }
    });

    const config: Record<string, { name: string, color: string }> = {
      '😐': { name: 'Neutre', color: '#9CA3AF' },
      '🔥': { name: 'Confiance', color: '#0B6623' },
      '😰': { name: 'Peur', color: '#EF4444' },
      '🧠': { name: 'Concentration', color: '#3B82F6' },
      '🤩': { name: 'Excitation', color: '#10B981' },
      '🤑': { name: 'Avidité', color: '#F59E0B' },
      '😤': { name: 'Frustration', color: '#DC2626' },
    };

    const allData = Object.keys(config).map(key => ({
      name: config[key].name,
      value: counts[key],
      color: config[key].color,
      emoji: key
    }));

    return {
      chartData: allData.filter(d => d.value > 0).sort((a, b) => b.value - a.value),
      legendData: allData
    };
  }, [trades]);

  const emotionTradesCount = React.useMemo(() => {
    return trades.filter(t => t.emotion && typeof t.emotion === 'string' && t.emotion.trim() !== '').length;
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
        {emotionData.chartData.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
            <span className="text-3xl mb-2">🤷‍♂️</span>
            <span className="text-sm font-bold text-gray-900 dark:text-white">Aucun calcul psychologique</span>
            <span className="text-[10px] text-gray-500 mt-2 leading-relaxed">
              Vos imports MT5 et EA sont arrivés sans émotion. 
              Ajoutez-les depuis l'<strong>Historique Détaillé</strong> pour activer cette analyse.
            </span>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={emotionData.chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  animationBegin={0}
                  animationDuration={800}
                >
                  {emotionData.chartData.map((entry, index) => (
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
                {emotionTradesCount}
               </span>
               <span className="block text-[8px] font-black text-gray-400 uppercase tracking-tighter">
                Analysés
               </span>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mt-4">
        {emotionData.legendData.map((item, idx) => {
          const percentage = emotionTradesCount > 0 ? Math.round((item.value / emotionTradesCount) * 100) : 0;
          return (
            <div key={idx} className={cn(
              "flex items-center justify-between px-2 py-1.5 rounded-xl border transition-all",
              item.value > 0 
                ? "bg-gray-50 dark:bg-gray-900/50 border-gray-100 dark:border-gray-700" 
                : "opacity-40 grayscale border-transparent"
            )}>
              <div className="flex flex-col">
                <span className="text-[7px] font-black text-gray-400 uppercase leading-none mb-0.5">{item.name}</span>
                <span className="text-[10px] font-poppins font-black text-gray-900 dark:text-white leading-none">
                  {percentage}%
                </span>
              </div>
              <span className="text-sm">{item.emoji}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
