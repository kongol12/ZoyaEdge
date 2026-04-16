import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../lib/auth';
import { useTranslation } from '../../lib/i18n';
import { subscribeToTrades, Trade } from '../../lib/db';
import { formatCurrency, formatPercentage, cn, exportToCSV } from '../../lib/utils';
import { TrendingUp, Target, Activity, Plus, Upload, BarChart3, Flame, Download, Filter, FileText } from 'lucide-react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import TradeList from '../../components/organisms/client/TradeList';
import PnLChart from '../../components/organisms/client/PnLChart';
import PerformanceRadarChart from '../../components/charts/PerformanceRadarChart';
import PaywallModal from '../../components/molecules/PaywallModal';
import { Button } from '../../components/atoms/Button';
import { StatCard } from '../../components/molecules/StatCard';
import { RiskRewardGaugeCard } from '../../components/charts/RiskRewardGaugeCard';
import { computeRiskReward } from '../../lib/stats';
import { useFilteredTrades } from '../../hooks/useFilteredTrades';
import { calculateWinrate, calculateProfitFactor, calculateAvgRR, calculateMaxDrawdown, calculateExpectancy, calculateStreaks } from '../../lib/advancedTradingMetrics';
import AdvancedDecisionEngine from '../../components/AdvancedDecisionEngine';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Dashboard() {
  const { user, profile } = useAuth();
  const { t, language } = useTranslation();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPaywall, setShowPaywall] = useState(false);
  
  const { filters, setFilters, filteredTrades, uniqueMonths, uniqueStrategies, uniquePairs, uniquePlatforms } = useFilteredTrades(trades);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToTrades(user.uid, (data) => {
      setTrades(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  if (loading) {
    return <div className="animate-pulse space-y-4">
      <div className="h-32 bg-zinc-200 dark:bg-zinc-800 rounded-2xl"></div>
      <div className="h-64 bg-zinc-200 dark:bg-zinc-800 rounded-2xl"></div>
    </div>;
  }

  const totalPnL = filteredTrades.reduce((sum, trade) => sum + Number(trade.pnl), 0);
  const winningTrades = filteredTrades.filter(t => Number(t.pnl) > 0).length;
  const winRate = calculateWinrate(filteredTrades);
  const profitFactor = calculateProfitFactor(filteredTrades);
  const avgRR = calculateAvgRR(filteredTrades);
  const maxDrawdown = calculateMaxDrawdown(filteredTrades);
  const expectancy = calculateExpectancy(filteredTrades);
  const streaks = calculateStreaks(filteredTrades);

  // Simple Streak Logic (consecutive days with at least one trade)
  const calculateStreak = () => {
    if (filteredTrades.length === 0) return 0;
    const days = Array.from(new Set(filteredTrades.map(t => t.date.toDateString()))) as string[];
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < days.length; i++) {
      const date = new Date(days[i]);
      date.setHours(0, 0, 0, 0);
      const diff = (today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
      if (diff === streak) streak++;
      else break;
    }
    return streak;
  };

  const streak = calculateStreak();
  const rrData = computeRiskReward(filteredTrades);

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
      t.pair,
      t.direction.toUpperCase(),
      t.lotSize.toString(),
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
      className="space-y-6"
    >
      {/* Header & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center justify-between md:justify-start gap-4">
          <div>
            <h1 className="text-2xl font-poppins font-black text-gray-900 dark:text-white">{t.common.dashboard}</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm hidden md:block">{t.common.welcome} on ZoyaEdge.</p>
          </div>
          {streak > 0 && (
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-1 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-3 py-1 rounded-full text-sm font-bold border border-orange-200 dark:border-orange-800/50"
            >
              <Flame size={16} className="fill-orange-500 dark:fill-orange-400" />
              {streak} {streak > 1 ? (language === 'fr' ? 'JOURS' : 'DAYS') : (language === 'fr' ? 'JOUR' : 'DAY')}
            </motion.div>
          )}
        </div>
        <div className="grid grid-cols-2 md:flex md:w-auto gap-2 items-center">
          <div className="flex gap-2 col-span-2 md:col-span-1">
            <Button
              variant="secondary"
              onClick={handleExportCSV}
              icon={<Download size={18} />}
              className="flex-1 text-[10px] md:text-sm px-2 md:px-4"
              title="Export CSV"
            >
              CSV
            </Button>
            <Button
              variant="secondary"
              onClick={handleExportPDF}
              icon={<FileText size={18} />}
              className="flex-1 text-[10px] md:text-sm px-2 md:px-4"
              title="Export PDF"
            >
              PDF
            </Button>
          </div>
          <Link to="/import" className="col-span-1">
            <Button
              variant="secondary"
              icon={<Upload size={18} />}
              className="w-full text-[10px] md:text-sm px-2 md:px-4"
            >
              {t.common.import}
            </Button>
          </Link>
          <Link to="/add" className="col-span-1">
            <Button
              icon={<Plus size={18} />}
              className="w-full text-[10px] md:text-sm px-2 md:px-4"
            >
              {t.common.addTrade}
            </Button>
          </Link>
          <div className="col-span-2 md:col-span-1 flex items-center">
            <select 
              value={filters.dateRange} 
              onChange={e => setFilters({...filters, dateRange: e.target.value})}
              className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 text-gray-900 dark:text-white text-[11px] md:text-sm rounded-lg md:rounded-2xl px-1.5 md:px-3 py-2 outline-none focus:ring-2 focus:ring-zoya-red transition-all duration-300"
            >
              <option value="all">{t.dashboard.allMonths}</option>
              {uniqueMonths.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          title={t.dashboard.pnl}
          value={formatCurrency(totalPnL)}
          icon={<Activity size={24} />}
          delay={0.1}
          className={totalPnL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}
          infoText="Profit & Loss total généré sur la période sélectionnée."
        />
        <StatCard
          title={t.dashboard.winrate}
          value={formatPercentage(winRate)}
          icon={<Target size={24} />}
          delay={0.2}
          infoText="Pourcentage de trades gagnants par rapport au total."
        />
        <StatCard
          title="Profit Factor"
          value={profitFactor.toFixed(2)}
          icon={<TrendingUp size={24} />}
          delay={0.3}
          infoText="Ratio entre les gains bruts et les pertes brutes."
        />
        <StatCard
          title="Max Drawdown"
          value={formatCurrency(maxDrawdown)}
          icon={<Activity size={24} />}
          delay={0.4}
          className={maxDrawdown > 1000 ? 'text-rose-600 dark:text-rose-400' : ''}
          infoText="Perte maximale depuis le point le plus haut."
        />
        <StatCard
          title={t.dashboard.totalTrades}
          value={filteredTrades.length}
          icon={<BarChart3 size={24} />}
          delay={0.5}
          infoText="Nombre total de positions prises."
        />
        <RiskRewardGaugeCard ratio={rrData.ratio} delay={0.6} />
      </div>

      {/* Charts Section */}
      {filteredTrades.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <PnLChart 
              trades={filteredTrades} 
              infoText="Évolution de votre capital (Profit and Loss) au fil du temps."
            />
          </div>
          <div className="lg:col-span-1">
            <PerformanceRadarChart 
              trades={filteredTrades} 
              infoText="Synthèse de votre efficacité basée sur le Profit Factor, R/R, Retour Moyen et Drawdown."
            />
          </div>
        </div>
      )}

      {/* Recent Trades */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-lg overflow-hidden"
      >
        <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-lg font-poppins font-black text-gray-900 dark:text-white">{t.dashboard.filteredTrades}</h2>
        </div>
        <TradeList trades={filteredTrades} />
      </motion.div>

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

