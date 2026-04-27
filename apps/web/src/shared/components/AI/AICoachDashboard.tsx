import React, { useState, useEffect } from 'react';
import { useAuth } from '@shared/lib/auth';
import { runZoyaAICoach, ZoyaAICoachOutput, AnalysisMode } from '@shared/lib/zoyaAICoachEngine';
import { ZoyaMetrics } from '@shared/lib/zoyaMetrics';
import { Loader2, Brain, Activity, Target, Clock, DollarSign, AlertTriangle, ShieldCheck, ShieldAlert, Shield } from 'lucide-react';
import { formatCurrency, formatPercentage } from '@shared/lib/utils';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { collection, addDoc, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@shared/lib/firebase';
import { subscribeToTrades, Trade } from '@shared/lib/db';
import { InfoTooltip } from '../atoms/InfoTooltip';

export default function AICoachDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'ANALYSE' | 'GRAPHS' | 'RECOMMENDATIONS'>('ANALYSE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<ZoyaMetrics | null>(null);
  const [aiResponse, setAiResponse] = useState<ZoyaAICoachOutput | null>(null);
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('STANDARD');
  const [trades, setTrades] = useState<Trade[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToTrades(user.uid, (data) => {
      setTrades(data);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    async function loadLatestAnalysis() {
      if (!user) return;
      try {
        const q = query(collection(db, 'users', user.uid, 'ai_reports'), orderBy('date', 'desc'), limit(1));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const data = snapshot.docs[0].data();
          setMetrics(data.metrics);
          setAiResponse(data.response);
          setAnalysisMode(data.mode || 'STANDARD');
        }
      } catch (err) {
        console.error("Failed to load latest analysis", err);
      }
    }
    loadLatestAnalysis();
  }, [user]);

  const handleRunAnalysis = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const result = await runZoyaAICoach(user.uid, analysisMode);
      setMetrics(result.metrics);
      setAiResponse(result.aiResponse);
      
      setActiveTab('RECOMMENDATIONS');
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Une erreur est survenue lors de l'analyse.");
    } finally {
      setLoading(false);
    }
  };

  const renderAnalyseTab = () => {
    if (!metrics) return <div className="text-center py-12 text-gray-500">Exécutez l'analyse pour voir les données.</div>;

    return (
      <div className="space-y-2">
        {/* Bloc 1: Global Analysis */}
        <div>
          <h3 className="text-lg font-bold mb-2 flex items-center gap-2"><Activity className="text-zoya-red" /> Analyse Globale</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <MetricCard title="Total PnL" value={formatCurrency(metrics.totalPnL)} isPositive={metrics.totalPnL >= 0} infoText="Somme totale des profits et pertes." />
            <MetricCard title="Winrate" value={formatPercentage(metrics.winrate)} infoText="Pourcentage de trades gagnants." />
            <MetricCard title="Profit Factor" value={metrics.profitFactor.toFixed(2)} infoText="Ratio profits totaux / pertes totales." />
            <MetricCard title="Total Trades" value={metrics.stats.totalTrades} infoText="Nombre de trades clôturés." />
          </div>
        </div>

        {/* Bloc 2: Financial Performance */}
        <div>
          <h3 className="text-lg font-bold mb-2 flex items-center gap-2"><DollarSign className="text-emerald-500" /> Performance Financière</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <MetricCard title="Avg Daily PnL" value={formatCurrency(metrics.daily.avgDayPnL)} isPositive={metrics.daily.avgDayPnL >= 0} />
            <MetricCard title="Best Day" value={formatCurrency(metrics.daily.bestDay)} isPositive={true} />
            <MetricCard title="Worst Day" value={formatCurrency(metrics.daily.worstDay)} isPositive={false} />
            <MetricCard title="Max Drawdown" value={formatCurrency(metrics.maxDrawdown)} isPositive={false} />
            <MetricCard title="Avg Win" value={metrics.stats.wins > 0 ? formatCurrency(metrics.totalPnL / metrics.stats.wins) : '$0'} isPositive={true} />
            <MetricCard title="Avg Loss" value={metrics.stats.losses > 0 ? formatCurrency(metrics.totalPnL / metrics.stats.losses) : '$0'} isPositive={false} />
          </div>
        </div>

        {/* Bloc 3: Trade Statistics */}
        <div>
          <h3 className="text-lg font-bold mb-2 flex items-center gap-2"><Target className="text-blue-500" /> Statistiques de Trades</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <MetricCard title="Wins" value={metrics.stats.wins} className="text-emerald-500" />
            <MetricCard title="Losses" value={metrics.stats.losses} className="text-rose-500" />
            <MetricCard title="Breakeven" value={metrics.stats.breakeven} />
            <MetricCard title="Max Win Streak" value={metrics.stats.maxWinStreak} className="text-emerald-500" />
            <MetricCard title="Max Loss Streak" value={metrics.stats.maxLossStreak} className="text-rose-500" />
            <MetricCard title="Open Trades" value={metrics.stats.openTrades} />
          </div>
        </div>

        {/* Bloc 4: Time & Fees */}
        <div>
          <h3 className="text-lg font-bold mb-2 flex items-center gap-2"><Clock className="text-purple-500" /> Temps & Frais</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <MetricCard title="Avg Duration" value={`${metrics.time.avgDurationHours.toFixed(1)}h`} />
            <MetricCard title="Avg Win Duration" value={`${metrics.time.avgWinDurationHours.toFixed(1)}h`} />
            <MetricCard title="Avg Loss Duration" value={`${metrics.time.avgLossDurationHours.toFixed(1)}h`} />
            <MetricCard title="Total Commission" value={formatCurrency(metrics.fees.totalCommission)} isPositive={false} />
            <MetricCard title="Total Swaps" value={formatCurrency(metrics.fees.totalSwaps)} isPositive={false} />
          </div>
        </div>
      </div>
    );
  };

  const { equityData, pairData, sessionData } = React.useMemo(() => {
    if (trades.length === 0) return { equityData: [], pairData: [], sessionData: [] };
    let equity = 0;
    let peak = -Infinity;
    const eqData = [...trades].sort((a, b) => a.date.getTime() - b.date.getTime()).map(t => {
      equity += Number(t.pnl);
      if (equity > peak) peak = equity;
      return {
        date: t.date.toLocaleDateString(),
        equity,
        drawdown: peak - equity
      };
    });

    const pData = Object.entries(trades.reduce((acc, t) => {
      acc[t.pair] = (acc[t.pair] || 0) + Number(t.pnl);
      return acc;
    }, {} as Record<string, number>)).map(([name, pnl]) => ({ name, pnl }));

    const sData = Object.entries(trades.reduce((acc, t) => {
      acc[t.session] = (acc[t.session] || 0) + Number(t.pnl);
      return acc;
    }, {} as Record<string, number>)).map(([name, pnl]) => ({ name, pnl }));

    return { equityData: eqData, pairData: pData, sessionData: sData };
  }, [trades]);

  const renderGraphsTab = () => {
    if (trades.length === 0) return <div className="text-center py-12 text-gray-500">Pas assez de données pour les graphiques.</div>;

    return (
      <div className="space-y-2">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <h4 className="text-sm font-bold mb-4">Equity Curve</h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={equityData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Line type="monotone" dataKey="equity" stroke="#10B981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <h4 className="text-sm font-bold mb-4">Drawdown Curve</h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={equityData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Line type="monotone" dataKey="drawdown" stroke="#EF4444" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <h4 className="text-sm font-bold mb-4">Performance by Pair</h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pairData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="pnl" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <h4 className="text-sm font-bold mb-4">Performance by Session</h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sessionData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="pnl" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderRecommendationsTab = () => {
    if (!aiResponse || !metrics) return <div className="text-center py-12 text-gray-500">Exécutez l'analyse pour voir les recommandations.</div>;

    const radarData = [
      { subject: 'Profit Factor', A: Math.min(metrics.profitFactor * 20, 100), fullMark: 100 },
      { subject: 'Winrate', A: metrics.winrate, fullMark: 100 },
      { subject: 'Avg RR', A: Math.min(metrics.avgRR * 25, 100), fullMark: 100 },
      { subject: 'Discipline', A: aiResponse.score.discipline, fullMark: 100 },
      { subject: 'Psychologie', A: aiResponse.score.consistency, fullMark: 100 }, // Consistency can be a proxy if AI doesn't have a psych score
      { subject: 'Risk Control', A: Math.max(100 - (metrics.maxDrawdown / 100), 0), fullMark: 100 },
    ];

    const getDecisionColor = (decision: string) => {
      switch (decision) {
        case 'GREEN': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200';
        case 'ORANGE': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200';
        case 'RED': return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200';
        default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
      }
    };

    return (
      <div className="space-y-2">
        <div className={`p-4 rounded-2xl border-2 flex flex-col md:flex-row items-center gap-6 ${getDecisionColor(aiResponse.decision)}`}>
          <div className="p-4 bg-white/50 dark:bg-black/20 rounded-full">
            {aiResponse.decision === 'GREEN' && <ShieldCheck size={48} />}
            {aiResponse.decision === 'ORANGE' && <Shield size={48} />}
            {aiResponse.decision === 'RED' && <ShieldAlert size={48} />}
          </div>
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-2xl font-black mb-2">Décision: {aiResponse.decision}</h2>
            <p className="font-medium opacity-90">{aiResponse.summary}</p>
          </div>
          <div className="text-center">
            <div className="text-sm font-bold uppercase tracking-wider opacity-80 mb-1">Niveau de Risque</div>
            <div className="text-xl font-black">{aiResponse.risk_level}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
          <div className="lg:col-span-1 space-y-2">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
              <h3 className="text-lg font-bold mb-2 text-center">Radar de Performance</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                    <PolarGrid stroke="#374151" opacity={0.2} />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#6B7280', fontSize: 10 }} />
                    <Radar name="Performance" dataKey="A" stroke="#E11D48" fill="#E11D48" fillOpacity={0.4} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-2">
              <h3 className="text-lg font-bold mb-1">Niveaux d'Évaluation</h3>
              {[
                { label: 'Risk Score', value: aiResponse.score.risk },
                { label: 'Discipline Score', value: aiResponse.score.discipline },
                { label: 'Consistency Score', value: aiResponse.score.consistency },
              ].map((score, i) => (
                <div key={i}>
                  <div className="flex justify-between items-end mb-1">
                    <span className="text-sm font-bold text-gray-500 dark:text-gray-400">{score.label}</span>
                    <span className="text-base font-poppins font-black text-gray-900 dark:text-white">{score.value}</span>
                  </div>
                  <div className="h-2 w-full bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${
                        score.value > 75 ? 'bg-emerald-500' :
                        score.value >= 50 ? 'bg-orange-500' :
                        'bg-zoya-red'
                      }`}
                      style={{ width: `${Math.max(0, Math.min(100, score.value))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 space-y-2">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2"><Brain className="text-blue-500" /> Insights</h3>
              <ul className="space-y-2">
                {aiResponse.insights.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <span className="text-blue-500 mt-0.5">•</span> {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2"><AlertTriangle className="text-orange-500" /> Erreurs Détectées</h3>
              <ul className="space-y-2">
                {aiResponse.mistakes.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <span className="text-orange-500 mt-0.5">!</span> {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2"><Target className="text-emerald-500" /> Recommandations</h3>
              <ul className="space-y-2">
                {aiResponse.recommendations.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <span className="text-emerald-500 mt-0.5">→</span> {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 bg-white dark:bg-gray-800 p-2 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
        <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-xl">
          {(['ANALYSE', 'GRAPHS', 'RECOMMENDATIONS'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                activeTab === tab 
                  ? 'bg-white dark:bg-gray-800 text-zoya-red shadow-sm' 
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        
        <div className="flex items-center gap-4">
          <select 
            value={analysisMode} 
            onChange={(e) => setAnalysisMode(e.target.value as AnalysisMode)}
            className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm outline-none"
          >
            <option value="CONCISE">Concise</option>
            <option value="STANDARD">Standard</option>
            <option value="DETAILED">Detailed</option>
          </select>
          
          <button
            onClick={handleRunAnalysis}
            disabled={loading || trades.length === 0}
            className="flex items-center gap-2 bg-zoya-red text-white px-6 py-2 rounded-xl font-bold hover:bg-zoya-red-dark transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Brain size={18} />}
            Run AI Analysis
          </button>
        </div>
      </div>

      <div className="min-h-[500px]">
        {error && (
          <div className="bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 p-4 rounded-xl border border-rose-200 dark:border-rose-800 mb-6 flex items-center gap-3">
            <AlertTriangle size={20} />
            <p className="font-medium">{error}</p>
          </div>
        )}
        {activeTab === 'ANALYSE' && renderAnalyseTab()}
        {activeTab === 'GRAPHS' && renderGraphsTab()}
        {activeTab === 'RECOMMENDATIONS' && renderRecommendationsTab()}
      </div>
    </div>
  );
}

function MetricCard({ title, value, isPositive, className, infoText }: { title: string, value: string | number, isPositive?: boolean, className?: string, infoText?: string }) {
  return (
    <div className={`bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm relative ${className || ''}`}>
      <div className="flex justify-between items-start mb-1">
        <div className="text-xs text-gray-500 dark:text-gray-400">{title}</div>
        {infoText && <InfoTooltip text={infoText} />}
      </div>
      <div className={`text-xl font-black ${isPositive === true ? 'text-emerald-500' : isPositive === false ? 'text-rose-500' : 'text-gray-900 dark:text-white'}`}>
        {value}
      </div>
    </div>
  );
}
