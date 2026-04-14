import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { computePerformanceMetrics } from '../../lib/stats';
import { Trade } from '../../lib/db';
import { cn } from '../../lib/utils';
import { InfoTooltip } from '../atoms/InfoTooltip';

interface PerformanceRadarChartProps {
  trades: Trade[];
  className?: string;
  infoText?: string;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700 shadow-xl">
        <p className="text-sm font-bold text-gray-900 dark:text-white mb-1">{data.subject}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Valeur: <span className="font-semibold text-gray-900 dark:text-white">{data.value}</span>
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          Score: {data.A}/100
        </p>
      </div>
    );
  }
  return null;
};

export default function PerformanceRadarChart({ trades, className, infoText }: PerformanceRadarChartProps) {
  const { metrics, overallScore, status, color } = computePerformanceMetrics(trades);

  const getComment = () => {
    if (status === 'Excellent') return "Excellente performance globale. Vos métriques de risque et de rentabilité sont optimales.";
    if (status === 'Équilibré') return "Performance moyenne. Optimisez votre ratio risque/récompense ou votre taux de réussite.";
    return "Performance faible. Une révision de votre stratégie et de votre gestion du risque est recommandée.";
  };

  const getColorHex = () => {
    if (status === 'Excellent') return '#10B981';
    if (status === 'Équilibré') return '#F59E0B';
    return '#F43F5E';
  };

  const renderCustomTick = (props: any) => {
    const { payload, x, y, textAnchor } = props;
    const metric = metrics.find(m => m.subject === payload.value);
    
    return (
      <g transform={`translate(${x},${y})`}>
        <text textAnchor={textAnchor} fill="#6b7280" fontSize={11} fontWeight={500} dy={0} className="dark:fill-gray-400">
          {payload.value}
        </text>
        <text textAnchor={textAnchor} fill={getColorHex()} fontSize={12} fontWeight={700} dy={14}>
          {metric?.value}
        </text>
      </g>
    );
  };

  return (
    <div className={cn("bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-lg p-5 flex flex-col h-full relative", className)}>
      <div className="flex items-center justify-center mb-4 text-center">
        <h2 className="text-lg font-poppins font-black text-gray-900 dark:text-white">Performances</h2>
        {infoText && <InfoTooltip text={infoText} />}
      </div>
      <div className="mb-4 text-center">
        <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">
          {getComment()}
        </p>
      </div>

      <div className="flex-1 w-full min-h-[250px] relative flex items-center justify-center">
        {/* Score in the middle */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
          <span className={cn("text-4xl font-black", color)}>{overallScore}</span>
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Score</span>
        </div>

        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="65%" data={metrics}>
            <defs>
              <linearGradient id="radarGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.6}/>
                <stop offset="95%" stopColor="#F43F5E" stopOpacity={0.6}/>
              </linearGradient>
            </defs>
            <PolarGrid gridType="circle" stroke="#e5e7eb" className="dark:stroke-gray-700" />
            <PolarAngleAxis 
              dataKey="subject" 
              tick={renderCustomTick} 
            />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Radar
              name="Performance"
              dataKey="A"
              stroke="url(#radarGradient)"
              strokeWidth={2}
              fill="url(#radarGradient)"
              fillOpacity={0.5}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
