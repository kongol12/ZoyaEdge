import React, { useState, useEffect } from 'react';
import { Trade, getAIAnalysis, saveAIAnalysis } from '@shared/lib/db';
import { askAICoach, AICoachResponse } from '@shared/lib/ai';
import { AlertTriangle, Target, BrainCircuit, RefreshCw } from 'lucide-react';
import { InfoTooltip } from '../../atoms/InfoTooltip';
import { useAuth } from '@shared/lib/auth';
import { useTranslation } from '@shared/lib/i18n';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '@shared/lib/firebase';

export default function DecisionEngine({ trades }: { trades: Trade[] }) {
  const { user, profile } = useAuth();
  const { t, language } = useTranslation();
  const [data, setData] = useState<AICoachResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'analysis' | 'recommendations' | 'premium'>('analysis');

  useEffect(() => {
    async function loadStoredAnalysis() {
      if (!user) return;
      setLoading(true);
      try {
        const stored = await getAIAnalysis(user.uid);
        if (stored) {
          setData(stored);
          if (stored.premiumReport) {
            // Option to default to premium if exists? No, keep analysis as primary
          }
        }
      } catch (err) {
        console.error("Failed to load stored analysis", err);
      } finally {
        setLoading(false);
      }
    }
    loadStoredAnalysis();
  }, [user]);

  const handleAskCoach = async () => {
    if (!user || trades.length === 0) return;
    
    // Check credits if not premium
    if (profile?.subscription !== 'premium' && (profile?.aiCredits || 0) <= 0) {
      setError("Vous n'avez plus de crédits AI.");
      return;
    }

    setFetching(true);
    setError(null);
    try {
      const response = await askAICoach(trades, language);
      setData(response);
      await saveAIAnalysis(user.uid, response);

      // Decrement credits if not premium
      if (profile?.subscription !== 'premium') {
        await updateDoc(doc(db, 'users', user.uid), {
          aiCredits: increment(-1)
        });
      }
    } catch (err: any) {
      setError(err.message || "AI Engine unavailable");
    } finally {
      setFetching(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full animate-pulse space-y-4 mb-8">
        <div className="h-32 bg-gray-200 dark:bg-gray-800 rounded-2xl w-full"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-24 bg-gray-200 dark:bg-gray-800 rounded-2xl"></div>
          <div className="h-24 bg-gray-200 dark:bg-gray-800 rounded-2xl"></div>
          <div className="h-24 bg-gray-200 dark:bg-gray-800 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 mb-8">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-zoya-red-accent text-zoya-red rounded-xl sm:rounded-2xl">
            <BrainCircuit size={20} className="sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-poppins font-black text-gray-900 dark:text-white truncate">ZoyaEdge AI Coach</h2>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">
              {data ? `${t.dashboard.lastUpdated}: ${(() => {
                try {
                  const dateVal = (data as any).updatedAt;
                  const date = dateVal?.toDate ? dateVal.toDate() : (dateVal ? new Date(dateVal) : new Date());
                  return date.toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US');
                } catch (e) {
                  return new Date().toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US');
                }
              })()}` : t.dashboard.noAnalysis}
            </p>
          </div>
        </div>
        <button
          onClick={handleAskCoach}
          disabled={fetching}
          className="flex items-center justify-center gap-2 bg-zoya-red hover:bg-zoya-red-dark disabled:bg-gray-400 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-2xl font-poppins font-bold transition-all shadow-lg shadow-zoya-red/20 active:scale-[0.98] text-sm sm:text-base"
        >
          {fetching ? (
            <RefreshCw size={16} className="animate-spin sm:w-[18px] sm:h-[18px]" />
          ) : (
            <BrainCircuit size={16} className="sm:w-[18px] sm:h-[18px]" />
          )}
          <span>{data ? "Mettre à jour l'analyse" : "Lancer l'Analyse IA"}</span>
        </button>
      </div>

      {error && (
        <div className="w-full p-6 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/50 text-rose-600 dark:text-rose-400 rounded-2xl flex flex-col items-center text-center gap-4">
          <div className="p-3 bg-rose-100 dark:bg-rose-900/30 rounded-full">
            <AlertTriangle size={32} />
          </div>
          <div>
            <h3 className="text-lg font-bold mb-1">
              {error.includes('QUOTA_EXCEEDED') ? t.dashboard.quotaExceeded : t.dashboard.engineUnavailable}
            </h3>
            <p className="text-sm opacity-80 max-w-md">
              {error.includes('QUOTA_EXCEEDED') 
                ? t.dashboard.quotaExceededDesc 
                : t.dashboard.engineUnavailableDesc}
            </p>
          </div>
        </div>
      )}

      {data && (
        <>
          {/* TABS HEADER */}
          <div className="flex border-b border-gray-100 dark:border-gray-700 mb-6 overflow-x-auto scroller-hidden">
            <button
              onClick={() => setActiveTab('analysis')}
              className={`pb-4 px-6 text-sm font-poppins font-bold transition-all border-b-2 whitespace-nowrap ${
                activeTab === 'analysis' 
                ? 'border-zoya-red text-zoya-red' 
                : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Analyse Performance
            </button>
            <button
              onClick={() => setActiveTab('recommendations')}
              className={`pb-4 px-6 text-sm font-poppins font-bold transition-all border-b-2 whitespace-nowrap ${
                activeTab === 'recommendations' 
                ? 'border-zoya-red text-zoya-red' 
                : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Plan d'Action
            </button>
            {data.premiumReport && (
              <button
                onClick={() => setActiveTab('premium')}
                className={`pb-4 px-6 text-sm font-poppins font-bold transition-all border-b-2 whitespace-nowrap ${
                  activeTab === 'premium' 
                  ? 'border-zoya-red text-zoya-red' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Rapport Premium
              </button>
            )}
          </div>

          {activeTab === 'analysis' ? (
            <div className="space-y-6">
              {/* TOP CARD */}
              <div className={`p-6 rounded-2xl shadow-lg transition-all duration-300 ${
                data.coach_decision.status === 'green' ? 'bg-emerald-500 text-white shadow-emerald-500/20' :
                data.coach_decision.status === 'orange' ? 'bg-orange-500 text-white shadow-orange-500/20' :
                'bg-zoya-red text-white shadow-zoya-red/20'
              }`}>
                <h2 className="text-sm font-poppins font-bold uppercase tracking-wider opacity-90 mb-1">
                  {data.coach_decision.status === 'green' ? t.dashboard.systemStable :
                   data.coach_decision.status === 'orange' ? t.dashboard.riskIncreasing :
                   t.dashboard.criticalRisk}
                </h2>
                <div className="text-3xl font-poppins font-black uppercase tracking-tight">
                  {data.coach_decision.action.replace('_', ' ')}
                </div>
              </div>

              {/* SCORES UI WITH COMMENTARY */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { 
                    label: t.dashboard.riskScore, 
                    value: data.scores.risk_score, 
                    infoText: "Évaluation de votre gestion du risque.",
                    analysis: data.metric_analysis?.risk
                  },
                  { 
                    label: t.dashboard.disciplineScore, 
                    value: data.scores.discipline_score, 
                    infoText: "Mesure de votre respect du plan.",
                    analysis: data.metric_analysis?.discipline
                  },
                  { 
                    label: t.dashboard.consistencyScore, 
                    value: data.scores.consistency_score, 
                    infoText: "Régularité de vos gains.",
                    analysis: data.metric_analysis?.consistency
                  },
                ].map((score, i) => (
                  <div key={i} className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-lg flex flex-col">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs font-black text-gray-400 uppercase tracking-widest">{score.label}</span>
                      <span className={`text-xl font-poppins font-black ${
                        score.value > 75 ? 'text-emerald-500' :
                        score.value >= 50 ? 'text-orange-500' :
                        'text-zoya-red'
                      }`}>{score.value}</span>
                    </div>
                    
                    <div className="h-2 w-full bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden mb-4">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ${
                          score.value > 75 ? 'bg-emerald-500' :
                          score.value >= 50 ? 'bg-orange-500' :
                          'bg-zoya-red'
                        }`}
                        style={{ width: `${Math.max(0, Math.min(100, score.value))}%` }}
                      />
                    </div>

                    {score.analysis && (
                      <div className="mt-2 space-y-3 flex-grow">
                        <div className="text-[13px] leading-relaxed text-gray-600 dark:text-gray-300 italic">
                          "{score.analysis.comment}"
                        </div>
                        <div className="pt-3 border-t border-gray-50 dark:border-gray-700/50">
                          <p className="text-[11px] font-bold text-indigo-500 uppercase tracking-wider mb-1">Conseil Pro</p>
                          <p className="text-[12px] font-medium text-gray-900 dark:text-white">
                            {score.analysis.recommendation}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* ALERTS UI */}
                <div className="space-y-3">
                  <h3 className="text-sm font-poppins font-black text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <AlertTriangle size={16} /> {t.dashboard.alerts}
                  </h3>
                  <div className="space-y-2">
                    {data.alerts.map((alert, i) => (
                      <div key={i} className={`bg-white dark:bg-gray-800 p-3 rounded-r-2xl border border-l-4 border-y-gray-100 border-r-gray-100 dark:border-y-gray-700 dark:border-r-gray-700 shadow-lg ${
                        alert.type.toLowerCase() === 'risk' ? 'border-l-zoya-red' :
                        alert.type.toLowerCase() === 'behavior' ? 'border-l-orange-500' :
                        alert.type.toLowerCase() === 'strategy' ? 'border-l-blue-500' :
                        alert.type.toLowerCase() === 'discipline' ? 'border-l-purple-500' :
                        'border-l-gray-500'
                      }`}>
                        <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">{alert.type}</div>
                        <div className="text-sm text-gray-900 dark:text-gray-100">{alert.message}</div>
                      </div>
                    ))}
                    {data.alerts.length === 0 && (
                      <div className="text-sm text-gray-500 dark:text-gray-400 italic">{t.dashboard.noAlerts}</div>
                    )}
                  </div>
                </div>

                {/* ACTIONS UI */}
                <div className="space-y-3">
                  <h3 className="text-sm font-poppins font-black text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <Target size={16} /> {t.dashboard.actionPlan}
                  </h3>
                  <div className="space-y-2">
                    {data.actions.sort((a, b) => a.priority - b.priority).map((action, i) => (
                      <div key={i} className="flex gap-3 bg-white dark:bg-gray-800 p-3 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-lg">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white flex items-center justify-center text-xs font-poppins font-black">
                          {action.priority}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-gray-900 dark:text-white">{action.action}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{action.reason}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === 'recommendations' ? (
            <div className="space-y-6">
              {/* GLOBAL RECOMMENDATION TAB */}
              <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                  <BrainCircuit size={120} />
                </div>
                
                <h3 className="text-2xl font-poppins font-black text-gray-900 dark:text-white mb-6">
                  Recommandation Globale du Coach
                </h3>
                
                <div className="prose prose-indigo dark:prose-invert max-w-none">
                  <div className="text-lg leading-relaxed text-gray-700 dark:text-gray-300">
                    {data.global_recommendation || "Le Coach ZoyaEdge finalise son analyse globale de votre profil. Revenez dans un instant pour une stratégie personnalisée à 360°."}
                  </div>
                </div>

                <div className="mt-12 p-6 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800/50">
                  <h4 className="text-sm font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-widest mb-3">Priorité Stratégique</h4>
                  <p className="text-gray-900 dark:text-white font-medium">
                    {data.actions[0]?.action || "Concentrez-vous sur la régularité de vos entrées."} — 
                    <span className="text-gray-500 dark:text-gray-400 ml-1">{data.actions[0]?.reason}</span>
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* PREMIUM REPORT TAB */}
              <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-xl min-h-[400px]">
                <div className="flex items-center gap-3 mb-8 pb-4 border-b border-gray-100 dark:border-gray-700">
                  <div className="p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg">
                    <Target size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-poppins font-black text-gray-900 dark:text-white uppercase tracking-tight">Rapport Premium Zoya V4</h3>
                    <p className="text-xs text-gray-500 uppercase font-bold tracking-widest">Analyse Narrative & Stratégique</p>
                  </div>
                </div>

                <div className="prose prose-indigo dark:prose-invert max-w-none">
                  <div className="whitespace-pre-wrap text-base leading-relaxed text-gray-700 dark:text-gray-300 font-medium">
                    {data.premiumReport}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

