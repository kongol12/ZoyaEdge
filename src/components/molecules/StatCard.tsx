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
  iconClassName?: string;
  delay?: number;
  infoText?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, icon, trend, className, iconClassName, delay = 0, infoText }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={cn(
        'p-4 lg:p-5 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-md hover:shadow-xl transition-all duration-300 group',
        className
      )}
    >
      <div className="flex justify-between items-start mb-4">
        <div className={cn(
          "w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-sm",
          iconClassName || "bg-gray-50 dark:bg-gray-900 text-gray-400 group-hover:text-zoya-red"
        )}>
          {React.cloneElement(icon as React.ReactElement, { size: 20 })}
        </div>
        {trend && (
          <Badge variant={trend.isPositive ? 'success' : 'danger'} className="text-[10px] px-2 py-0.5">
            {trend.isPositive ? '+' : ''}{trend.value}%
          </Badge>
        )}
      </div>
      <div className="space-y-0.5">
        <div className="flex items-center gap-1.5">
          <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest truncate">{title}</p>
          {infoText && <InfoTooltip text={infoText} />}
        </div>
        <h3 className="text-lg sm:text-xl font-poppins font-black text-gray-900 dark:text-white leading-none truncate" title={String(value)}>
          {value}
        </h3>
      </div>
    </motion.div>
  );
};
