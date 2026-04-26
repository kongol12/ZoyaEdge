import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../lib/auth';
import { subscribeToTrades, Trade } from '../../lib/db';
import { BarChart2, Loader2, Filter } from 'lucide-react';
import { formatRR } from '../../lib/utils';
import { 
  computeEquityCurve, 
  computeDrawdown, 
  computeWinrate, 
  computePnLByGroup, 
  computeTradesPerDay, 
  computeRiskReward,
  computePerformanceMetrics
} from '../../lib/stats';
import EquityChart from '../../components/charts/EquityChart';
import DrawdownChart from '../../components/charts/DrawdownChart';
import BarChartCard from '../../components/charts/BarChartCard';
import PerformanceRadarChart from '../../components/charts/PerformanceRadarChart';
import WinrateEvolutionChart from '../../components/charts/WinrateEvolutionChart';
import RRDistributionChart from '../../components/charts/RRDistributionChart';
import { useFilteredTrades } from '../../hooks/useFilteredTrades';
import { useTranslation } from '../../lib/i18n';
import { ProfitFactorGauge } from '../../components/charts/ProfitFactorGauge';
import { WinRateArc } from '../../components/charts/WinRateArc';
import { PnlVolumeChart } from '../../components/charts/PnlVolumeChart';
import { AvgWinLossBar } from '../../components/charts/AvgWinLossBar';
import { InfoTooltip } from '../../components/atoms/InfoTooltip';

export default function Statistics() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToTrades(user.uid, (data) => {
      setTrades(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const { filters, setFilters, filteredTrades, uniqueMonths, uniqueStrategies, uniquePairs, uniquePlatforms } = useFilteredTrades(trades);

  const { summary } = useMemo(() => computePerformanceMetrics(filteredTrades), [filteredTrades]);
  const equityData = useMemo(() => computeEquityCurve(filteredTrades), [filteredTrades]);
  const drawdownData = useMemo(() => computeDrawdown(filteredTrades), [filteredTrades]);
  const strategyData = useMemo(() => computePnLByGroup(filteredTrades, 'strategy'), [filteredTrades]);
  const sessionData = useMemo(() => computePnLByGroup(filteredTrades, 'session'), [filteredTrades]);
  const emotionData = useMemo(() => computePnLByGroup(filteredTrades, 'emotion'), [filteredTrades]);
  const pairData = useMemo(() => computePnLByGroup(filteredTrades, 'pair'), [filteredTrades]);
  const platformData = useMemo(() => computePnLByGroup(filteredTrades, 'platform'), [filteredTrades]);
  const frequencyData = useMemo(() => computeTradesPerDay(filteredTrades), [filteredTrades]);
  const cumulativePnlData = useMemo(() => {
    return filteredTrades
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
  }, [filteredTrades]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-zoya-red" />
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="p-6 bg-zoya-red-accent text-zoya-red rounded-3xl mb-6">
          <BarChart2 size={48} />
        </div>
        <h1 className="text-3xl font-poppins font-black text-gray-900 dark:text-white mb-2">No Data Available</h1>
        <p className="text-gray-500 dark:text-gray-400 max-w-md">Add some trades to see your statistics.</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-2 pb-12">
      <header className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-zoya-red-accent text-zoya-red rounded-xl">
          <BarChart2 size={24} />
        </div>
        <h1 className="text-3xl font-poppins font-black text-gray-900 dark:text-white">Statistics</h1>
      </header>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 p-3 md:p-4 rounded-xl md:rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm md:shadow-lg flex flex-col md:flex-row gap-2 md:gap-4 items-stretch md:items-center">
        <div className="hidden md:flex items-center gap-2 text-gray-500 dark:text-gray-400">
          <Filter size={18} />
          <span className="text-sm font-medium">{t.dashboard.filters}:</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 flex-1">
          <select 
            value={filters.dateRange} 
            onChange={e => setFilters({...filters, dateRange: e.target.value})}
            className="bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 text-gray-900 dark:text-white text-[11px] md:text-sm rounded-lg md:rounded-2xl px-1.5 md:px-3 py-2 outline-none focus:ring-2 focus:ring-zoya-red transition-all duration-300"
          >
            <option value="all">{t.dashboard.allMonths}</option>
            {uniqueMonths.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select 
            value={filters.strategy} 
            onChange={e => setFilters({...filters, strategy: e.target.value})}
            className="bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 text-gray-900 dark:text-white text-[11px] md:text-sm rounded-lg md:rounded-2xl px-1.5 md:px-3 py-2 outline-none focus:ring-2 focus:ring-zoya-red transition-all duration-300"
          >
            <option value="all">{t.dashboard.allStrategies}</option>
            {uniqueStrategies.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select 
            value={filters.pair} 
            onChange={e => setFilters({...filters, pair: e.target.value})}
            className="bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 text-gray-900 dark:text-white text-[11px] md:text-sm rounded-lg md:rounded-2xl px-1.5 md:px-3 py-2 outline-none focus:ring-2 focus:ring-zoya-red transition-all duration-300"
          >
            <option value="all">{t.dashboard.allPairs}</option>
            {uniquePairs.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select 
            value={filters.platform} 
            onChange={e => setFilters({...filters, platform: e.target.value})}
            className="bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 text-gray-900 dark:text-white text-[11px] md:text-sm rounded-lg md:rounded-2xl px-1.5 md:px-3 py-2 outline-none focus:ring-2 focus:ring-zoya-red transition-all duration-300"
          >
            <option value="all">Toutes les plateformes</option>
            {uniquePlatforms.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {/* SECTION 1: Risk Metrics (Unified Visual Models) */}
      <section className="space-y-2">
        <h2 className="text-xl font-poppins font-bold text-gray-900 dark:text-white">Risk Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
          <ProfitFactorGauge 
            value={summary.profitFactor} 
            infoText="Indicateur de rentabilité. Ratio entre vos profits totaux et vos pertes totales (Cible > 1.5)."
          />
          <WinRateArc 
            wins={summary.wins} 
            losses={summary.losses} 
            winRate={summary.winRate} 
            infoText="Pourcentage de trades gagnants par rapport au nombre total de trades."
          />
          <AvgWinLossBar 
            avgWin={summary.avgWin} 
            avgLoss={summary.avgLoss} 
            avgRatio={summary.avgRR} 
            infoText="Ratio entre le gain moyen et la perte moyenne pour évaluer l'espérance de votre stratégie."
          />
          <PnlVolumeChart 
            data={cumulativePnlData}
            totalPnl={summary.totalPnL}
            className="h-full !p-6"
            infoText="Évolution de votre profit net cumulé trade après trade sur la période sélectionnée."
          />
        </div>
      </section>

      {/* SECTION 2: Performance Overview */}
      <section className="space-y-2">
        <h2 className="text-xl font-poppins font-bold text-gray-900 dark:text-white">Performance Overview</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
          <div className="lg:col-span-2">
            <EquityChart 
              data={equityData} 
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          <DrawdownChart 
            data={drawdownData} 
            infoText="Mesure de la baisse de votre capital par rapport à son point le plus haut (Peak)."
          />
          <WinrateEvolutionChart 
            trades={filteredTrades} 
            infoText="Suivi de la progression de votre taux de réussite cumulé sur chaque trade."
          />
        </div>
      </section>

      {/* SECTION 3: Performance Breakdown */}
      <section className="space-y-2">
        <h2 className="text-xl font-poppins font-bold text-gray-900 dark:text-white">Performance Breakdown</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-2">
          <BarChartCard 
            title="PnL by Strategy" 
            data={strategyData} 
            dataKey="name" 
            barKey="pnl" 
            color="#8B5CF6" 
            valuePrefix="$" 
            infoText="Répartition de vos gains et pertes selon les stratégies utilisées."
          />
          <BarChartCard 
            title="PnL by Session" 
            data={sessionData} 
            dataKey="name" 
            barKey="pnl" 
            color="#F59E0B" 
            valuePrefix="$" 
            infoText="Répartition de vos gains et pertes selon les sessions de trading (London, NY, etc.)."
          />
          <BarChartCard 
            title="PnL by Asset" 
            data={pairData} 
            dataKey="name" 
            barKey="pnl" 
            color="#3B82F6" 
            valuePrefix="$" 
            infoText="Performance par actif tradé."
          />
          <BarChartCard 
            title="PnL by Platform" 
            data={platformData} 
            dataKey="name" 
            barKey="pnl" 
            color="#14B8A6" 
            valuePrefix="$" 
            infoText="Performance par plateforme de trading."
          />
        </div>
      </section>

      {/* SECTION 4: Behavior Analysis */}
      <section className="space-y-2">
        <h2 className="text-xl font-poppins font-bold text-gray-900 dark:text-white">Behavior Analysis</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
          <BarChartCard 
            title="PnL by Emotion" 
            data={emotionData} 
            dataKey="name" 
            barKey="pnl" 
            color="#EC4899" 
            valuePrefix="$" 
            infoText="Impact de votre état émotionnel sur vos résultats financiers."
          />
          <BarChartCard 
            title="Trades Frequency" 
            data={frequencyData} 
            dataKey="name" 
            barKey="count" 
            color="#10B981" 
            infoText="Nombre de trades pris chaque jour pour identifier le surtrading."
          />
          <RRDistributionChart 
            trades={filteredTrades} 
            infoText="Visualisation de la fréquence de vos ratios Risk/Reward pour vérifier votre respect du plan."
          />
        </div>
      </section>
    </div>
  );
}
