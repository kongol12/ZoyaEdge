import React from 'react';
import { Trade } from '../../../lib/db';
import { formatCurrency, cn, formatRR } from '../../../lib/utils';
import { format } from 'date-fns';
import { 
  ArrowLeft, 
  Clock, 
  Target, 
  Zap, 
  Layers, 
  TrendingUp, 
  AlertCircle,
  BarChart2,
  Calendar,
  DollarSign
} from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from '../../../lib/i18n';
import { Link } from 'react-router';

interface TradeDetailProps {
  trade: Trade;
  allTrades?: Trade[];
  onBack: () => void;
}

export default function TradeDetail({ trade, allTrades = [], onBack }: TradeDetailProps) {
  const { t, language } = useTranslation();
  const isWin = trade.pnl >= 0;

  // Real strategy analysis
  const strategyTrades = allTrades.filter(t => t.strategy === trade.strategy);
  const strategyWins = strategyTrades.filter(t => t.pnl >= 0).length;
  const strategyWinrate = strategyTrades.length > 0 
    ? Math.round((strategyWins / strategyTrades.length) * 100) 
    : 0;

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-gray-500 hover:text-zoya-red transition-colors group w-fit"
        >
          <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-xl group-hover:bg-zoya-red/10 transition-colors">
            <ArrowLeft size={20} />
          </div>
          <span className="font-bold text-sm uppercase tracking-widest">Retour au journal</span>
        </button>

        <div className="flex items-center gap-3">
          <div className={cn(
            "px-4 py-2 rounded-2xl font-black font-poppins text-lg shadow-sm border",
            isWin 
              ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 border-emerald-100 dark:border-emerald-900/50" 
              : "bg-rose-50 dark:bg-rose-950/30 text-rose-600 border-rose-100 dark:border-rose-900/50"
          )}>
            {isWin ? '+' : ''}{formatCurrency(trade.pnl)}
          </div>
          <div className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl font-poppins font-black text-gray-900 dark:text-white shadow-sm">
            {trade.pair}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Info Card */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white dark:bg-gray-800 rounded-[32px] border border-gray-100 dark:border-gray-700 shadow-xl overflow-hidden">
            <div className="p-8 border-b border-gray-50 dark:border-gray-700/50 flex flex-wrap items-center justify-between gap-6">
              <div className="flex items-center gap-6">
                <div className={cn(
                  "w-16 h-16 rounded-[24px] flex items-center justify-center text-3xl shadow-inner",
                  trade.direction === 'buy' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                )}>
                  {trade.direction === 'buy' ? <TrendingUp size={32} /> : <div className="rotate-180"><TrendingUp size={32} /></div>}
                </div>
                <div>
                  <h1 className="text-3xl font-poppins font-black text-gray-900 dark:text-white leading-none">{trade.pair}</h1>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={cn(
                      "px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest",
                      trade.direction === 'buy' ? "bg-emerald-500 text-white" : "bg-zoya-red text-white"
                    )}>
                      {trade.direction}
                    </span>
                    <span className="text-sm font-bold text-gray-400">ID: #{trade.id?.substring(0, 6)}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-8">
                <div className="text-center">
                  <div className="text-4xl">{trade.emotion}</div>
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Emotion</div>
                </div>
                <div className="h-10 w-px bg-gray-100 dark:bg-gray-700" />
                <div className="text-center">
                  <div className="text-xl font-poppins font-black text-gray-900 dark:text-white">{trade.lotSize}</div>
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Lots</div>
                </div>
              </div>
            </div>

            <div className="p-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-12">
                <div className="space-y-6">
                  <div className="flex items-center gap-3 text-gray-900 dark:text-white">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-xl">
                      <Target size={18} />
                    </div>
                    <span className="font-poppins font-black text-lg">Exécution</span>
                  </div>
                  <div className="grid grid-cols-2 gap-6 bg-gray-50 dark:bg-gray-900/50 p-6 rounded-3xl border border-gray-100 dark:border-gray-800">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Entrée</p>
                      <p className="text-xl font-poppins font-black text-gray-900 dark:text-white">{trade.entryPrice}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Sortie</p>
                      <p className="text-xl font-poppins font-black text-gray-900 dark:text-white">{trade.exitPrice}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center gap-3 text-gray-900 dark:text-white">
                    <div className="p-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 rounded-xl">
                      <DollarSign size={18} />
                    </div>
                    <span className="font-poppins font-black text-lg">Gestion Risque</span>
                  </div>
                  <div className="grid grid-cols-2 gap-6 bg-gray-50 dark:bg-gray-900/50 p-6 rounded-3xl border border-gray-100 dark:border-gray-800">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Rapport R/R</p>
                      <p className="text-xl font-poppins font-black text-gray-900 dark:text-white">{formatRR(trade.rr)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Commission</p>
                      <p className="text-xl font-poppins font-black text-rose-600">{trade.commission || '0.00'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* RR Visualization */}
              <div className="mt-12 space-y-4">
                 <div className="flex justify-between items-center px-1">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Visualisation RR</span>
                    <span className="text-[10px] font-bold text-gray-500">
                      {trade.direction === 'buy' ? 'LONG Position' : 'SHORT Position'}
                    </span>
                 </div>
                 <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded-full w-full overflow-hidden flex shadow-inner">
                    <div 
                      className={cn(
                        "h-full transition-all duration-1000",
                        isWin ? "bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]" : "bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.3)]"
                      )}
                      style={{ width: isWin ? '70%' : '30%' }}
                    />
                 </div>
                 <div className="flex justify-between text-[8px] font-black text-gray-400 uppercase tracking-widest px-1">
                    <span>Stop Loss</span>
                    <span>Entrée ({trade.entryPrice})</span>
                    <span>Target</span>
                 </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Context */}
        <div className="space-y-8">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-[32px] border border-gray-100 dark:border-gray-700 shadow-xl space-y-6">
             <div className="flex items-center gap-3 text-gray-900 dark:text-white">
                <div className="p-2 bg-orange-50 dark:bg-orange-900/20 text-orange-600 rounded-xl">
                  <Clock size={18} />
                </div>
                <h3 className="font-poppins font-black text-lg">Contexte</h3>
             </div>
             
             <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b border-gray-50 dark:border-gray-700/50">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Date</span>
                  <span className="text-sm font-black text-gray-900 dark:text-white capitalize">{format(trade.date, 'EEEE d MMMM yyyy', { locale: undefined })}</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-gray-50 dark:border-gray-700/50">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Session</span>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-sm font-black text-gray-900 dark:text-white">{trade.session}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-gray-50 dark:border-gray-700/50">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Stratégie</span>
                  <span className="px-3 py-1 bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-300 rounded-lg text-xs font-black uppercase tracking-widest">{trade.strategy}</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-gray-50 dark:border-gray-700/50">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Plateforme</span>
                  <span className="text-sm font-black text-gray-900 dark:text-white">{trade.platform || 'N/A'}</span>
                </div>
                {trade.swap !== undefined && (
                  <div className="flex justify-between items-center py-3 border-b border-gray-50 dark:border-gray-700/50">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Swap</span>
                    <span className={cn("text-sm font-black", trade.swap < 0 ? "text-rose-500" : "text-emerald-500")}>{trade.swap}</span>
                  </div>
                )}
             </div>
          </div>

          <div className="bg-zoya-red p-8 rounded-[32px] text-white shadow-xl shadow-zoya-red/20 relative overflow-hidden group">
            <BarChart2 className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10 group-hover:scale-110 transition-transform duration-500" />
            <div className="relative z-10">
              <h3 className="font-poppins font-black text-xl mb-2">Performance du Setup</h3>
              <p className="text-white/70 text-sm mb-6 font-medium">Cette stratégie ({trade.strategy}) affiche un winrate de {strategyWinrate}% sur l'ensemble de vos données.</p>
              <Link to="/app/statistics" className="block">
                <button className="w-full py-3 bg-white text-zoya-red rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-opacity-90 transition-all">
                   Voir Statistiques Globales
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
