import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../lib/auth';
import { subscribeToTrades, Trade } from '../../lib/db';
import { BarChart2, Loader2 } from 'lucide-react';
import {
  computeEquityCurve,
  computeDrawdown,
  computeWinrate,
  computePnLByGroup,
  computeTradesPerDay,
  computeRiskReward
} from '../../lib/stats';
import EquityChart from '../../components/charts/EquityChart';
import DrawdownChart from '../../components/charts/DrawdownChart';
import BarChartCard from '../../components/charts/BarChartCard';
import PerformanceRadarChart from '../../components/charts/PerformanceRadarChart';

export default function Statistics() {
  const { user } = useAuth();
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

  const equityData = useMemo(() => computeEquityCurve(trades), [trades]);
  const drawdownData = useMemo(() => computeDrawdown(trades), [trades]);
  const strategyData = useMemo(() => computePnLByGroup(trades, 'strategy'), [trades]);
  const sessionData = useMemo(() => computePnLByGroup(trades, 'session'), [trades]);
  const emotionData = useMemo(() => computePnLByGroup(trades, 'emotion'), [trades]);
  const frequencyData = useMemo(() => computeTradesPerDay(trades), [trades]);
  const rrData = useMemo(() => computeRiskReward(trades), [trades]);
  const winrate = useMemo(() => computeWinrate(trades), [trades]);

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
    <div className="max-w-6xl mx-auto space-y-12 pb-12">
      <header className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-zoya-red-accent text-zoya-red rounded-xl">
          <BarChart2 size={24} />
        </div>
        <h1 className="text-3xl font-poppins font-black text-gray-900 dark:text-white">Statistics</h1>
      </header>

      {/* SECTION 1: Performance Overview */}
      <section className="space-y-6">
        <h2 className="text-2xl font-poppins font-bold text-gray-900 dark:text-white">Performance Overview</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <EquityChart 
              data={equityData} 
              infoText="Évolution de votre capital (Profit and Loss) au fil du temps."
            />
          </div>
          <div className="lg:col-span-1">
            <PerformanceRadarChart 
              trades={trades} 
              infoText="Synthèse de votre efficacité basée sur le Profit Factor, R/R, Retour Moyen et Drawdown."
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6">
          <DrawdownChart 
            data={drawdownData} 
            infoText="Mesure de la baisse de votre capital par rapport à son point le plus haut (Peak)."
          />
        </div>
      </section>

      {/* SECTION 2: Performance Breakdown */}
      <section className="space-y-6">
        <h2 className="text-2xl font-poppins font-bold text-gray-900 dark:text-white">Performance Breakdown</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
        </div>
      </section>

      {/* SECTION 3: Behavior Analysis */}
      <section className="space-y-6">
        <h2 className="text-2xl font-poppins font-bold text-gray-900 dark:text-white">Behavior Analysis</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
        </div>
      </section>

      {/* SECTION 4: Risk Metrics */}
      <section className="space-y-6">
        <h2 className="text-2xl font-poppins font-bold text-gray-900 dark:text-white">Risk Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-lg text-center">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Winrate</div>
            <div className="text-3xl font-poppins font-black text-emerald-500">{winrate}%</div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-lg text-center">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Risk/Reward Ratio</div>
            <div className="text-3xl font-poppins font-black text-blue-500">1 : {rrData.ratio}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-lg text-center">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Avg Win / Avg Loss</div>
            <div className="text-xl font-poppins font-black text-gray-900 dark:text-white">
              <span className="text-emerald-500">${rrData.avgWin}</span> / <span className="text-rose-500">-${rrData.avgLoss}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
