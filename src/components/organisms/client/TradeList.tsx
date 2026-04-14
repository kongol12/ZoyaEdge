import { Trade } from '../../../lib/db';
import { formatCurrency } from '../../../lib/utils';
import { format } from 'date-fns';
import { ArrowUpRight, ArrowDownRight, Clock, Layers, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from '../../../lib/i18n';

export default function TradeList({ trades }: { trades: Trade[] }) {
  const { t, language } = useTranslation();

  if (trades.length === 0) {
    return (
      <div className="p-12 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-3xl border border-dashed border-gray-100 dark:border-gray-700 shadow-lg">
        {t.dashboard.noTrades}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xs:grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4 sm:p-5">
      {trades.map((trade, idx) => (
        <motion.div 
          key={trade.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.05 }}
          className="bg-white dark:bg-gray-800 p-4 sm:p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-lg hover:shadow-xl hover:border-zoya-red/20 transition-all cursor-pointer group relative overflow-hidden"
        >
          {/* Background Accent */}
          <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-5 transition-transform group-hover:scale-110 ${trade.direction === 'buy' ? 'bg-emerald-500' : 'bg-zoya-red'}`} />

          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-transform group-hover:rotate-12 ${trade.direction === 'buy' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-900/30 text-zoya-red'}`}>
                {trade.direction === 'buy' ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
              </div>
              <div>
                <h3 className="font-poppins font-black text-gray-900 dark:text-white text-lg leading-none">{trade.pair}</h3>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${trade.direction === 'buy' ? 'text-emerald-600 dark:text-emerald-400' : 'text-zoya-red'}`}>
                  {trade.direction === 'buy' ? t.dashboard.buy : t.dashboard.sell}
                </span>
              </div>
            </div>
            <span className="text-2xl" title="Emotion">{trade.emotion}</span>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-end">
              <div className="space-y-1">
                <div className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest">{t.dashboard.netPnl}</div>
                <div className={`text-xl font-poppins font-black ${trade.pnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-zoya-red'}`}>
                  {trade.pnl > 0 ? '+' : ''}{formatCurrency(trade.pnl)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest">{t.dashboard.size}</div>
                <div className="text-sm font-bold text-gray-700 dark:text-gray-300">{trade.lotSize} {t.dashboard.lots}</div>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-50 dark:border-gray-700/50 grid grid-cols-2 gap-2">
              <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                <Clock size={12} className="text-gray-400 dark:text-gray-500" />
                <span className="text-[11px] font-medium">{format(trade.date, language === 'fr' ? 'd MMM, HH:mm' : 'MMM d, HH:mm')}</span>
              </div>
              <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 justify-end">
                <Zap size={12} className="text-gray-400 dark:text-gray-500" />
                <span className="text-[11px] font-medium truncate max-w-[80px]">{trade.strategy}</span>
              </div>
              <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                <Layers size={12} className="text-gray-400 dark:text-gray-500" />
                <span className="text-[11px] font-medium">{trade.session}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500">{trade.entryPrice} → {trade.exitPrice}</span>
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
