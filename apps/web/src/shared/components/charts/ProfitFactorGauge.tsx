import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Label } from 'recharts';
import { Activity } from 'lucide-react';
import { cn } from '@shared/lib/utils';
import { InfoTooltip } from '../atoms/InfoTooltip';

interface ProfitFactorGaugeProps {
  value: number;
  className?: string;
  delay?: number;
  infoText?: string;
}

export const ProfitFactorGauge: React.FC<ProfitFactorGaugeProps> = ({ value, className, infoText }) => {
  const displayValue = Number(value) || 0;
  const data = [
    { value: Math.min(displayValue, 3), color: displayValue >= 1 ? '#10B981' : '#F43F5E' },
    { value: Math.max(0, 3 - displayValue), color: '#f3f4f6' }
  ];

  return (
    <div className={cn("zoya-card p-6 flex flex-col h-[280px]", className)}>
      <div className="flex items-center justify-between mb-2">
        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-xl">
          <Activity size={20} />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Profit Factor</span>
          {infoText && <InfoTooltip text={infoText} />}
        </div>
      </div>
      <div className="flex-1 relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="100%"
              startAngle={180}
              endAngle={0}
              innerRadius={60}
              outerRadius={80}
              paddingAngle={0}
              dataKey="value"
              stroke="none"
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={index === 0 ? (displayValue >= 1 ? '#10B981' : '#F43F5E') : '#f3f4f6'} 
                  className={index === 1 ? "dark:fill-gray-800" : ""}
                />
              ))}
              <Label 
                value={displayValue.toFixed(2)} 
                position="centerBottom" 
                offset={-20}
                className="text-2xl font-black fill-gray-900 dark:fill-white" 
              />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute bottom-0 left-0 right-0 flex justify-between px-4 text-[10px] font-bold text-gray-400">
          <span>0.0</span>
          <span>1.5</span>
          <span>3.0+</span>
        </div>
      </div>
    </div>
  );
};
