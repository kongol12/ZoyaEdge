import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../../lib/auth';
import { subscribeToTrades, Trade } from '../../lib/db';
import { useTranslation } from '../../lib/i18n';
import { formatCurrency, formatRR, cn } from '../../lib/utils';
import { computePerformanceMetrics, calculateTradeZoyaScore } from '../../lib/stats';
import { ProfitFactorGauge } from '../../components/charts/ProfitFactorGauge';
import { WinRateArc } from '../../components/charts/WinRateArc';
import { PnlVolumeChart } from '../../components/charts/PnlVolumeChart';
import { AvgWinLossBar } from '../../components/charts/AvgWinLossBar';

import { RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { auth } from '../../lib/firebase';

export default function TradeView() {
  const { user } = useAuth();
  const { t, language } = useTranslation();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    return subscribeToTrades(user.uid, (data) => {
      setTrades(data);
      setLoading(false);
    });
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-zoya-red border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const realTrades = trades.filter(t => !t.type || t.type === 'trade');
  const sortedTrades = [...realTrades].sort((a, b) => b.date.getTime() - a.date.getTime());
  
  // 1. Net Cumulative P&L Data
  const cumulativePnlData = [...realTrades]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .reduce((acc: any[], trade, index) => {
      const prev = acc.length > 0 ? acc[acc.length - 1].pnl : 0;
      acc.push({
        date: trade.date.toLocaleDateString(),
        pnl: Number((prev + trade.pnl).toFixed(2)),
        volume: Math.abs(trade.pnl)
      });
      return acc;
    }, []);

  // 2. Metrics logic
  const { metrics, overallScore, summary } = computePerformanceMetrics(realTrades);
  const pfValue = summary.profitFactor;
  
  // 3. Win Rate Arc Data
  const wins = summary.wins;
  const losses = summary.losses;
  const totalCount = summary.totalTrades;
  const winRate = summary.winRate;
  
  const winrateArcData = [
    { name: 'Wins', value: wins, color: '#10B981' },
    { name: 'Losses', value: losses, color: '#F43F5E' }
  ];

  // 4. Avg Win/Loss Logic
  const avgWin = summary.avgWin;
  const avgLoss = summary.avgLoss;
  const avgRatio = summary.avgRR;

  return (
    <div className="w-full space-y-8 pb-12">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-poppins font-black text-gray-900 dark:text-white">
            {language === 'fr' ? 'Vue des Trades' : 'Trade View'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            {language === 'fr' ? 'Analyse visuelle et détaillée de vos performances.' : 'Visual and detailed analysis of your performance.'}
          </p>
        </div>
        
        <button 
          onClick={async () => {
            if (!user) return;
            toast.loading(language === 'fr' ? "Synchro..." : "Syncing...", { id: 'ea-sync-view' });
            try {
              const idToken = await (auth as any).currentUser?.getIdToken();
              await fetch('/api/connections/user-sync', {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${idToken}`
                }
              });
              toast.success(language === 'fr' ? "Synchronisé" : "Synced", { id: 'ea-sync-view' });
            } catch (e) {
              toast.error("Erreur de synchro", { id: 'ea-sync-view' });
            }
          }}
          className="flex items-center gap-2 bg-white dark:bg-gray-800 text-gray-500 hover:text-indigo-600 px-4 py-2 rounded-xl text-xs font-bold border border-gray-200 dark:border-gray-700 shadow-sm transition-all"
        >
          <RefreshCw size={14} />
          {language === 'fr' ? 'Rafraîchir EA' : 'Refresh EA'}
        </button>
      </header>

      {/* Top Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Net Cumulative P&L */}
        <PnlVolumeChart 
          data={cumulativePnlData} 
          totalPnl={cumulativePnlData[cumulativePnlData.length - 1]?.pnl || 0} 
          infoText="Profit ou perte nette cumulée sur l'ensemble de vos positions."
        />

        {/* Profit Factor Gauge */}
        <ProfitFactorGauge 
          value={pfValue} 
          infoText="Ratio entre vos gains et vos pertes. Un score > 1.5 indique une stratégie robuste."
        />

        {/* Win Rate Arc */}
        <WinRateArc 
          wins={wins} 
          losses={losses} 
          winRate={winRate} 
          infoText="Votre taux de réussite sur l'ensemble des trades analysés."
        />

        {/* Avg Win/Loss Table */}
        <AvgWinLossBar 
          avgWin={avgWin} 
          avgLoss={avgLoss} 
          avgRatio={avgRatio} 
          infoText="Comparaison entre votre gain moyen et votre perte moyenne."
        />
      </div>

      {/* Trade History Table */}
      <div className="zoya-card overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-xl font-poppins font-black text-gray-900 dark:text-white">Historique détaillé</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 dark:bg-gray-900/50">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Open Date</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Symbol</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Status</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Close Date</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Entry</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Exit</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Net P&L</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">ROI</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Zoya Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {sortedTrades.map((trade) => {
                const zoyaScore = calculateTradeZoyaScore(trade);
                const isWin = trade.pnl > 0;
                
                return (
                  <tr key={trade.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 font-medium">
                      {trade.date.toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 font-black text-gray-900 dark:text-white">
                      {trade.pair}
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                        isWin ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30" : "bg-rose-100 text-rose-600 dark:bg-rose-900/30"
                      )}>
                        {isWin ? 'Win' : 'Loss'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {trade.closedAt ? trade.closedAt.toLocaleDateString() : trade.date.toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-gray-600 dark:text-gray-400">
                      {trade.entryPrice}
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-gray-600 dark:text-gray-400">
                      {trade.exitPrice}
                    </td>
                    <td className={cn(
                      "px-6 py-4 text-sm font-black",
                      isWin ? "text-emerald-500" : "text-rose-500"
                    )}>
                      {formatCurrency(trade.pnl)}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-600 dark:text-gray-300">
                      {trade.lotSize ? `${((trade.pnl / (trade.lotSize * 1000)) * 100).toFixed(2)}%` : '0%'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                          <div 
                            className={cn(
                              "h-full rounded-full transition-all duration-1000",
                              zoyaScore >= 70 ? "bg-emerald-500" : zoyaScore >= 40 ? "bg-amber-500" : "bg-rose-500"
                            )} 
                            style={{ width: `${zoyaScore}%` }} 
                          />
                        </div>
                        <span className={cn(
                          "text-xs font-black",
                          zoyaScore >= 70 ? "text-emerald-500" : zoyaScore >= 40 ? "text-amber-500" : "text-rose-500"
                        )}>
                          {zoyaScore}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {sortedTrades.length === 0 && (
            <div className="p-12 text-center text-gray-500">
              Aucun trade trouvé.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
