import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import { Badge } from '../atoms/Badge';
import { InfoTooltip } from '../atoms/InfoTooltip';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
  delay?: number;
  infoText?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, icon, trend, className, delay = 0, infoText }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={cn(
        'p-6 bg-white dark:bg-gray-800 rounded-[32px] border border-gray-100 dark:border-gray-700 shadow-lg hover:shadow-xl transition-all duration-300 group',
        className
      )}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="w-12 h-12 bg-gray-50 dark:bg-gray-900 rounded-2xl flex items-center justify-center text-gray-400 group-hover:text-zoya-red group-hover:bg-zoya-red/10 transition-all duration-300">
          {icon}
        </div>
        {trend && (
          <Badge variant={trend.isPositive ? 'success' : 'danger'}>
            {trend.isPositive ? '+' : ''}{trend.value}%
          </Badge>
        )}
      </div>
      <div>
        <div className="flex items-center mb-1">
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest">{title}</p>
          {infoText && <InfoTooltip text={infoText} />}
        </div>
        <h3 className="text-2xl font-poppins font-black text-gray-900 dark:text-white">
          {value}
        </h3>
      </div>
    </motion.div>
  );
};
