import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { Trade } from '../../../lib/db';
import { formatCurrency, compactCurrency } from '../../../lib/utils';
import { useTranslation } from '../../../lib/i18n';
import { InfoTooltip } from '../../atoms/InfoTooltip';

interface PnLChartProps {
  trades: Trade[];
  initialBalance?: number;
  infoText?: string;
}

export default function PnLChart({ trades, initialBalance = 0, infoText }: PnLChartProps) {
  const { t } = useTranslation();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const chartData = useMemo(() => {
    // Sort trades by date ascending
    const sortedTrades = [...trades].sort((a, b) => a.date.getTime() - b.date.getTime());

    // Group by day and calculate cumulative PnL
    const dailyPnL: { [key: string]: number } = {};
    
    sortedTrades.forEach(trade => {
      const dateStr = trade.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      dailyPnL[dateStr] = (dailyPnL[dateStr] || 0) + Number(trade.pnl);
    });

    const data: { date: string; pnl: number; cumulative: number }[] = [];
    let cumulative = initialBalance;

    // Add starting point
    data.push({
      date: 'Start',
      pnl: 0,
      cumulative: Number(initialBalance.toFixed(2))
    });

    Object.entries(dailyPnL).forEach(([date, pnl]) => {
      cumulative += pnl;
      data.push({
        date,
        pnl,
        cumulative: Number(cumulative.toFixed(2))
      });
    });

    return data;
  }, [trades, initialBalance]);

  if (!mounted) return null;
  if (trades.length === 0 && initialBalance === 0) return null;

  const isPositive = chartData.length > 0 && chartData[chartData.length - 1].cumulative >= 0;

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-lg transition-colors">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center">
            <h3 className="text-lg font-poppins font-black text-gray-900 dark:text-white uppercase tracking-tight">{t.dashboard.balance} & P&L</h3>
            {infoText && <InfoTooltip text={infoText} />}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Performance evolution over time</p>
        </div>
        <div className={isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
          <span className="text-2xl font-poppins font-black">
            {compactCurrency(chartData[chartData.length - 1]?.cumulative || 0)}
          </span>
        </div>
      </div>

      <div className="h-[300px] min-h-[300px] w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorPnL" x1="0" y1="0" x2="0" y2="1">
                <stop 
                  offset="5%" 
                  stopColor={isPositive ? '#10b981' : '#f43f5e'} 
                  stopOpacity={0.3}
                />
                <stop 
                  offset="95%" 
                  stopColor={isPositive ? '#10b981' : '#f43f5e'} 
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" opacity={0.2} />
            <XAxis 
              dataKey="date" 
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#71717a', fontSize: 12 }}
              dy={10}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#71717a', fontSize: 12 }}
              tickFormatter={(value) => compactCurrency(value)}
            />
            <Tooltip
              contentStyle={{ 
                borderRadius: '16px', 
                border: '1px solid #374151', 
                backgroundColor: '#1f2937',
                color: '#fff',
                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.3)',
                padding: '12px',
                fontFamily: 'Inter, sans-serif'
              }}
              itemStyle={{ color: '#fff', fontWeight: 'bold' }}
              formatter={(value: number) => [formatCurrency(value), t.dashboard.balance]}
            />
            <ReferenceLine y={0} stroke="#3f3f46" strokeWidth={1} />
            <Area
              type="monotone"
              dataKey="cumulative"
              stroke={isPositive ? '#10b981' : '#f43f5e'}
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#colorPnL)"
              animationDuration={1500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
