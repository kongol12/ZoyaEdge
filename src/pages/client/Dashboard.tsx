import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../lib/auth';
import { useTranslation } from '../../lib/i18n';
import { subscribeToTrades, subscribeToNotebook, Trade, NotebookEntry } from '../../lib/db';
import { formatCurrency, formatPercentage, cn, exportToCSV } from '../../lib/utils';
import { TrendingUp, Target, Activity, Plus, Upload, BarChart3, Flame, Download, Filter, FileText, History, Wallet, Zap, BrainCircuit, AlertTriangle, ArrowRight } from 'lucide-react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import TradeExplorer from '../../components/organisms/client/TradeExplorer';
import PnLChart from '../../components/organisms/client/PnLChart';
import PerformanceRadarChart from '../../components/charts/PerformanceRadarChart';
import { PsychologyChart } from '../../components/charts/PsychologyChart';
import PaywallModal from '../../components/molecules/PaywallModal';
import { Button } from '../../components/atoms/Button';
import { StatCard } from '../../components/molecules/StatCard';
import { RiskRewardGaugeCard } from '../../components/charts/RiskRewardGaugeCard';
import { computePerformanceMetrics } from '../../lib/stats';
import { useFilteredTrades } from '../../hooks/useFilteredTrades';
import AdvancedDecisionEngine from '../../components/AdvancedDecisionEngine';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { ProfitFactorGauge } from '../../components/charts/ProfitFactorGauge';
import { WinRateArc } from '../../components/charts/WinRateArc';
import { PnlVolumeChart } from '../../components/charts/PnlVolumeChart';
import { AvgWinLossBar } from '../../components/charts/AvgWinLossBar';

import { calculateZoyaScores } from '../../lib/scoring';
import { logActivity } from '../../lib/activity';

export default function Dashboard() {
  const { user, profile } = useAuth();
  const { t, language } = useTranslation();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [notebookEntries, setNotebookEntries] = useState<NotebookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPaywall, setShowPaywall] = useState(false);
  
  const { filters, setFilters, filteredTrades, uniqueMonths, uniqueStrategies, uniquePairs, uniquePlatforms } = useFilteredTrades(trades);

  const zoyaScores = useMemo(() => calculateZoyaScores(trades), [trades]);

  useEffect(() => {
    if (!user) return;
    
    logActivity(user.uid, 'settings_updated', { view: 'dashboard' });

    const unsubscribeTrades = subscribeToTrades(user.uid, (data) => {
      setTrades(data);
      setLoading(false);
    });

    const unsubscribeNotebook = subscribeToNotebook(user.uid, (data) => {
      setNotebookEntries(data);
    });

    return () => {
      unsubscribeTrades();
      unsubscribeNotebook();
    };
  }, [user]);

  const {
    totalPnL,
    winRate,
    profitFactor,
    avgRR,
    maxDrawdown,
    streak,
    currentBalance,
    consistency,
    summary,
    cumulativePnlData
  } = useMemo(() => {
    const { summary } = computePerformanceMetrics(filteredTrades);
    
    const totalBalanceChange = filteredTrades.reduce((sum, trade) => sum + Number(trade.pnl || 0), 0);
    const balance = (profile?.initialBalance || 0) + totalBalanceChange;
    
    // Streak Logic (only trades)
    let s = 0;
    const tradesOnly = filteredTrades.filter(t => !t.type || t.type === 'trade');
    if (tradesOnly.length > 0) {
      const days = Array.from(new Set(tradesOnly.map(t => t.date.toDateString()))) as string[];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      for (let i = 0; i < days.length; i++) {
        const date = new Date(days[i]);
        date.setHours(0, 0, 0, 0);
        const diff = (today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
        if (diff === s) s++;
        else break;
      }
    }

    // Cumulative P&L logic for consistency
    const cumulative = [...filteredTrades]
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

    return {
      totalPnL: summary.totalPnL,
      winRate: summary.winRate,
      profitFactor: summary.profitFactor,
      avgRR: summary.avgRR,
      maxDrawdown: summary.maxDrawdown,
      streak: s,
      currentBalance: balance,
      consistency: summary.consistency,
      summary,
      cumulativePnlData: cumulative
    };
  }, [filteredTrades, profile?.initialBalance]);

  if (loading) {
    return <div className="animate-pulse space-y-4">
      <div className="h-32 bg-zinc-200 dark:bg-zinc-800 rounded-2xl"></div>
      <div className="h-64 bg-zinc-200 dark:bg-zinc-800 rounded-2xl"></div>
    </div>;
  }

  const handleExportCSV = () => {
    if (profile?.subscription === 'free') {
      setShowPaywall(true);
      return;
    }
    const exportData = filteredTrades.map(t => ({
      Date: t.date.toISOString(),
      Pair: t.pair,
      Direction: t.direction,
      EntryPrice: t.entryPrice,
      ExitPrice: t.exitPrice,
      LotSize: t.lotSize,
      PnL: t.pnl,
      Strategy: t.strategy,
      Session: t.session,
      Emotion: t.emotion
    }));
    exportToCSV(`zoya_trades_${new Date().toISOString().split('T')[0]}.csv`, exportData);
  };

  const handleExportPDF = () => {
    if (profile?.subscription === 'free') {
      setShowPaywall(true);
      return;
    }
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text('ZoyaEdge Performance Report', 14, 22);
    
    doc.setFontSize(12);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 32);
    doc.text(`Total PnL: ${formatCurrency(totalPnL)}`, 14, 40);
    doc.text(`Winrate: ${winRate.toFixed(2)}%`, 14, 48);
    doc.text(`Profit Factor: ${profitFactor.toFixed(2)}`, 14, 56);
    doc.text(`Max Drawdown: ${formatCurrency(maxDrawdown)}`, 14, 64);

    const tableData = filteredTrades.map(t => [
      t.date.toLocaleDateString(),
      t.pair || t.type?.toUpperCase() || 'OTHER',
      t.direction ? t.direction.toUpperCase() : (t.type?.toUpperCase() || '-'),
      t.lotSize ? t.lotSize.toString() : '-',
      formatCurrency(t.pnl)
    ]);

    autoTable(doc, {
      startY: 75,
      head: [['Date', 'Asset', 'Dir', 'Lot', 'PnL']],
      body: tableData,
    });

    doc.save(`zoya_report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full space-y-6 pb-12"
    >
      {/* Header & Quick Actions */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-2">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-poppins font-black text-gray-900 dark:text-white tracking-tight">
              {t.common.welcome}, <span className="text-zoya-red">{profile?.displayName || user?.displayName || 'Trader'}</span>
            </h1>
            {streak > 0 && (
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex items-center gap-1.5 bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-orange-100 dark:border-orange-900/50 shadow-sm"
              >
                <Flame size={12} className="fill-orange-500" />
                {streak} {streak > 1 ? (language === 'fr' ? 'JOURS' : 'DAYS') : (language === 'fr' ? 'JOUR' : 'DAY')}
              </motion.div>
            )}
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">
            {trades.length > 0 ? (
              <>
                {t.dashboard.lastUpdated}: <span className="font-bold text-gray-700 dark:text-gray-200">
                  {new Date(Math.max(...trades.map(t => t.date.getTime()))).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </>
            ) : (
              t.dashboard.noTrades
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-white dark:bg-gray-800 p-1 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <Button
              variant="ghost"
              onClick={handleExportCSV}
              icon={<Download size={16} />}
              className="h-9 px-3 text-xs font-bold rounded-xl"
            >
              CSV
            </Button>
            <div className="w-px h-4 bg-gray-100 dark:bg-gray-700 self-center mx-1" />
            <Button
              variant="ghost"
              onClick={handleExportPDF}
              icon={<FileText size={16} />}
              className="h-9 px-3 text-xs font-bold rounded-xl"
            >
              PDF
            </Button>
          </div>

          <div className="h-10 w-px bg-gray-100 dark:bg-gray-700 hidden lg:block mx-1" />

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Link to="/import" className="flex-1 sm:flex-none">
              <Button
                variant="secondary"
                icon={<Upload size={18} />}
                className="w-full text-xs font-bold h-10 px-4 rounded-xl"
              >
                {t.common.import}
              </Button>
            </Link>
            <Link to="/add" className="hidden md:flex flex-1 sm:flex-none">
              <Button
                icon={<Plus size={18} />}
                className="w-full text-xs font-bold h-10 px-4 rounded-xl shadow-lg shadow-zoya-red/20"
              >
                {t.common.addTrade}
              </Button>
            </Link>
          </div>

          <div className="relative w-full sm:w-48">
             <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
             <select 
              value={filters.dateRange} 
              onChange={e => setFilters({...filters, dateRange: e.target.value})}
              className="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-900 dark:text-white text-xs font-bold rounded-xl outline-none focus:ring-2 focus:ring-zoya-red/20 transition-all appearance-none cursor-pointer shadow-sm"
            >
              <option value="all">{t.dashboard.allMonths}</option>
              {uniqueMonths.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Zoya Behavior Score Overlay */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          <div className="lg:col-span-2 bg-gray-900 rounded-3xl md:rounded-[2.5rem] p-6 md:p-8 border border-gray-800 shadow-2xl overflow-hidden relative group">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                  <BrainCircuit size={120} />
              </div>
              <div className="relative z-10 space-y-6">
                  <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-3 h-3 rounded-full animate-pulse",
                        zoyaScores.status === 'red' ? "bg-rose-500" : zoyaScores.status === 'orange' ? "bg-amber-500" : "bg-emerald-500"
                      )} />
                      <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Zoya Core Score</span>
                  </div>
                  <div className="flex flex-col md:flex-row md:items-end gap-12">
                      <div>
                          <div className={cn(
                            "text-7xl font-poppins font-black transition-colors",
                            zoyaScores.status === 'red' ? "text-rose-500" : zoyaScores.status === 'orange' ? "text-amber-500" : "text-emerald-500"
                          )}>
                            {zoyaScores.total_score}<span className="text-2xl text-gray-700">/100</span>
                          </div>
                          <div className="text-gray-400 font-bold uppercase tracking-widest text-xs mt-2">
                             Status: <span className={cn(
                               zoyaScores.status === 'red' ? "text-rose-500" : zoyaScores.status === 'orange' ? "text-amber-500" : "text-emerald-500"
                             )}>
                               {zoyaScores.status === 'red' ? "Dangerous Trader" : zoyaScores.status === 'orange' ? "Unstable" : "Controlled"}
                             </span>
                          </div>
                      </div>
                      <div className="grid grid-cols-3 gap-8 flex-1">
                          {[
                            { label: 'Risk', val: zoyaScores.risk_score, color: 'text-rose-500' },
                            { label: 'Discipline', val: zoyaScores.discipline_score, color: 'text-amber-500' },
                            { label: 'Consistency', val: zoyaScores.consistency_score, color: 'text-emerald-500' }
                          ].map((s, i) => (
                            <div key={i} className="space-y-1">
                               <div className="text-[10px] font-black text-gray-600 uppercase tracking-widest">{s.label}</div>
                               <div className={cn("text-2xl font-poppins font-black", s.color)}>{s.val}</div>
                               <div className="h-1 w-full bg-gray-800 rounded-full overflow-hidden">
                                  <div className={cn("h-full", s.color.replace('text', 'bg'))} style={{ width: `${s.val}%` }} />
                               </div>
                            </div>
                          ))}
                      </div>
                  </div>
              </div>
          </div>
          
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-3xl md:rounded-[2.5rem] p-6 md:p-8 flex flex-col justify-between pt-8 md:pt-8 min-h-[300px] md:min-h-0">
              <div className="space-y-4">
                  <div className="flex items-center gap-3 text-rose-500">
                      <AlertTriangle size={24} />
                      <span className="font-poppins font-black uppercase tracking-tight">System Pressure</span>
                  </div>
                  <h3 className="text-xl font-poppins font-black dark:text-white leading-tight">
                    {trades.length < 10 ? "YOUR DATA IS INCOMPLETE." : zoyaScores.status === 'red' ? "YOUR DISCIPLINE IS COLLAPSING." : "KEEP EXPOSING THE EDGE."}
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">
                    {trades.length < 10 
                      ? "Your performance is unreliable with current data volume. Add 10 trades to unlock deeper analysis." 
                      : "The AI Coach has detected significant behavioral vulnerabilities in your latest trades."}
                  </p>
              </div>
              <Link to="/ai-coach" className="mt-6 flex items-center justify-between p-4 bg-gray-900 rounded-2xl group hover:bg-rose-500 transition-all text-white">
                  <span className="font-bold text-xs uppercase tracking-widest">Get AI FEEDBACK</span>
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </Link>
          </div>
      </div>

      {/* Balance Setup Notification */}
      {(!profile?.initialBalance || profile.initialBalance === 0) && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 p-4 bg-zoya-red-accent/10 border border-zoya-red/20 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4 backdrop-blur-sm"
        >
          <div className="flex items-center gap-4 text-center sm:text-left">
            <div className="p-3 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-zoya-red/10">
              <Wallet className="text-zoya-red" size={24} />
            </div>
            <div>
              <p className="text-sm font-poppins font-black text-gray-900 dark:text-white uppercase tracking-tight">
                {t.dashboard.balance}
              </p>
              <p className="text-xs text-gray-500 font-medium">
                {t.dashboard.balanceWarning}
              </p>
            </div>
          </div>
          <Link
            to="/settings"
            className="w-full sm:w-auto px-6 py-3 bg-zoya-red text-white text-xs font-poppins font-black rounded-2xl hover:bg-zoya-red-dark transition-all shadow-lg shadow-zoya-red/20 active:scale-95 text-center flex items-center justify-center gap-2 group"
          >
            {t.common.settings}
            <Plus size={14} className="group-hover:rotate-90 transition-transform" />
          </Link>
        </motion.div>
      )}

      {/* Primary Analytics Section (Trade View Models for Harmony) */}
      <section className="mb-8 md:mb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <PnlVolumeChart 
            data={cumulativePnlData} 
            totalPnl={totalPnL} 
            infoText="Profit ou perte nette cumulée sur la période sélectionnée."
          />
          <ProfitFactorGauge 
            value={profitFactor} 
            infoText="Indicateur de rentabilité. Ratio entre vos profits totaux et vos pertes totales (Cible > 1.5)."
          />
          <WinRateArc 
            wins={summary.wins} 
            losses={summary.losses} 
            winRate={winRate} 
            infoText="Pourcentage de trades gagnants par rapport au nombre total de trades."
          />
          <AvgWinLossBar 
            avgWin={summary.avgWin} 
            avgLoss={summary.avgLoss} 
            avgRatio={summary.avgRR} 
            infoText="Ratio entre le gain moyen et la perte moyenne pour évaluer l'espérance de votre stratégie."
          />
        </div>
      </section>

      {/* Secondary Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8 md:mb-12">
        <StatCard
          title={t.dashboard.balance}
          value={formatCurrency(currentBalance)}
          icon={<Wallet className="text-indigo-600 dark:text-indigo-400" size={20} />}
          iconClassName="bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50"
          delay={0.05}
          infoText="Votre capital actuel incluant les profits/pertes."
        />
        <StatCard
          title="Consistency"
          value={`${Math.round(consistency)}%`}
          icon={<Zap />}
          iconClassName="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50"
          delay={0.35}
          infoText="Indice de régularité basé sur votre discipline et gestion du risque."
        />
        <StatCard
          title="Positions"
          value={filteredTrades.length}
          icon={<BarChart3 />}
          iconClassName="bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border border-orange-100 dark:border-orange-900/50"
          delay={0.5}
          infoText="Nombre total de positions de trading exécutées et enregistrées."
        />
        <StatCard
          title="Max DD"
          value={formatCurrency(maxDrawdown)}
          icon={<Activity />}
          iconClassName="bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/50"
          delay={0.4}
          infoText="Pire baisse de capital (Drawdown Maximum) enregistrée sur la période."
        />
      </div>

      {/* Charts Section */}
      {filteredTrades.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <PerformanceRadarChart 
              trades={filteredTrades} 
              infoText="Synthèse de votre efficacité basée sur le Profit Factor, R/R, Retour Moyen et Drawdown."
            />
          </div>
          <div className="lg:col-span-1">
            <PsychologyChart 
              trades={filteredTrades}
              infoText="Analyse de votre mindset de trading basée sur les émotions enregistrées (Confiance, Stress, Neutre)."
            />
          </div>
          <div className="lg:col-span-2">
            <PnLChart 
              trades={filteredTrades} 
              initialBalance={profile?.initialBalance}
              infoText="Évolution de votre capital (Solde + Profit/Perte) au fil du temps."
            />
          </div>
        </div>
      )}

      {/* Trade Explorer Section */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-zoya-red/10 rounded-2xl">
            <History className="text-zoya-red" size={20} />
          </div>
          <div>
            <h2 className="text-xl font-poppins font-black text-gray-900 dark:text-white">Explorateur de Trades</h2>
            <p className="text-xs text-gray-400 font-medium">Visualisation dynamique par liste, table ou calendrier.</p>
          </div>
        </div>
        <TradeExplorer trades={filteredTrades} notebookEntries={notebookEntries} />
      </div>

      <PaywallModal
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        title="Passez au niveau supérieur"
        description="L'exportation CSV est réservée aux membres Pro et Premium. Analysez vos données en profondeur avec Excel ou Google Sheets."
        requiredTier="pro"
      />
    </motion.div>
  );
}

