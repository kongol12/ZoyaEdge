import React, { useState, useEffect } from 'react';
import { Trade, subscribeToStrategies, Strategy } from '@shared/lib/db';
import { useTranslation } from '@shared/lib/i18n';
import { Lightbulb, BrainCircuit, Loader2, AlertTriangle, CheckCircle2, Target } from 'lucide-react';
import { askAICoach, AICoachResponse } from '@shared/lib/ai';
import { cn, formatCurrency, formatPercentage } from '@shared/lib/utils';
import { useAuth } from '@shared/lib/auth';

export default function Insights({ trades }: { trades: Trade[] }) {
  const { user } = useAuth();
  const { t, language } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<AICoachResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [strategies, setStrategies] = useState<Strategy[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToStrategies(user.uid, (data) => {
      setStrategies(data);
    });
    return () => unsubscribe();
  }, [user]);

  const handleAskCoach = async () => {
    if (trades.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const response = await askAICoach(trades, language, strategies);
      setAiResponse(response);
    } catch (err: any) {
      setError(err.message || "Failed to get AI insights");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl p-5 space-y-6 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-indigo-800 dark:text-indigo-300">
          <BrainCircuit size={24} className="text-indigo-600 dark:text-indigo-400" />
          <h2 className="font-bold text-lg">{t.dashboard.coachTitle}</h2>
        </div>
        <button
          onClick={handleAskCoach}
          disabled={loading || trades.length === 0}
          className="flex items-center gap-2 bg-indigo-600 dark:bg-indigo-500 text-white px-4 py-2 rounded-xl font-medium hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Lightbulb size={16} />}
          {loading ? t.dashboard.analyzing : t.dashboard.askCoach}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 rounded-xl text-sm font-medium">
          {error}
        </div>
      )}

      {trades.length === 0 && !loading && !aiResponse && (
        <p className="text-indigo-900/70 dark:text-indigo-300/70 text-sm">
          {t.dashboard.noTrades}
        </p>
      )}

      {aiResponse && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-indigo-100/50 dark:border-indigo-900/50">
              <div className="text-xs text-indigo-500 dark:text-indigo-400 font-medium mb-1">{t.dashboard.pnl}</div>
              <div className={cn("font-bold text-lg", aiResponse.summary.total_pnl >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                {formatCurrency(aiResponse.summary.total_pnl)}
              </div>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-indigo-100/50 dark:border-indigo-900/50">
              <div className="text-xs text-indigo-500 dark:text-indigo-400 font-medium mb-1">{t.dashboard.winrate}</div>
              <div className="font-bold text-lg text-indigo-900 dark:text-indigo-100">
                {formatPercentage(aiResponse.summary.winrate * 100)}
              </div>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-indigo-100/50 dark:border-indigo-900/50">
              <div className="text-xs text-indigo-500 dark:text-indigo-400 font-medium mb-1">Risk Score</div>
              <div className="font-bold text-lg text-indigo-900 dark:text-indigo-100">
                {aiResponse.scores.risk_score}/100
              </div>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-indigo-100/50 dark:border-indigo-900/50">
              <div className="text-xs text-indigo-500 dark:text-indigo-400 font-medium mb-1">Discipline</div>
              <div className="font-bold text-lg text-indigo-900 dark:text-indigo-100">
                {aiResponse.scores.discipline_score}/100
              </div>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-indigo-100/50 dark:border-indigo-900/50">
              <div className="text-xs text-indigo-500 dark:text-indigo-400 font-medium mb-1">Consistency</div>
              <div className="font-bold text-lg text-indigo-900 dark:text-indigo-100">
                {aiResponse.scores.consistency_score}/100
              </div>
            </div>
          </div>

          {/* Coach Decision */}
          <div className={cn(
            "p-4 rounded-xl border flex items-start gap-3",
            aiResponse.coach_decision.status === 'green' ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50 text-emerald-900 dark:text-emerald-300" :
            aiResponse.coach_decision.status === 'orange' ? "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800/50 text-orange-900 dark:text-orange-300" :
            "bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800/50 text-rose-900 dark:text-rose-300"
          )}>
            <Target className="shrink-0 mt-0.5" size={20} />
            <div>
              <div className="font-bold mb-1">Decision</div>
              <div className="text-sm opacity-90 uppercase tracking-wider font-medium">{aiResponse.coach_decision.action.replace('_', ' ')}</div>
            </div>
          </div>

          {/* Alerts */}
          {aiResponse.alerts.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-bold text-indigo-900 dark:text-indigo-300 text-sm uppercase tracking-wider">{t.dashboard.alerts}</h3>
              <div className="space-y-2">
                {aiResponse.alerts.map((alert, idx) => (
                  <div key={idx} className="flex items-start gap-3 bg-white dark:bg-zinc-900 p-3 rounded-xl border border-indigo-100/50 dark:border-indigo-900/50">
                    <AlertTriangle size={16} className={cn(
                      "shrink-0 mt-0.5",
                      alert.severity === 'high' ? "text-rose-500 dark:text-rose-400" :
                      alert.severity === 'medium' ? "text-orange-500 dark:text-orange-400" : "text-amber-500 dark:text-amber-400"
                    )} />
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-indigo-400 dark:text-indigo-500 mb-0.5">{alert.type}</div>
                      <div className="text-sm text-indigo-900 dark:text-indigo-100">{alert.message}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          {aiResponse.actions.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-bold text-indigo-900 dark:text-indigo-300 text-sm uppercase tracking-wider">{t.dashboard.actionPlan}</h3>
              <div className="space-y-2">
                {aiResponse.actions.map((action, idx) => (
                  <div key={idx} className="flex items-start gap-3 bg-white dark:bg-zinc-900 p-3 rounded-xl border border-indigo-100/50 dark:border-indigo-900/50">
                    <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                      {action.priority}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-indigo-900 dark:text-indigo-100">{action.action}</div>
                      <div className="text-xs text-indigo-500 dark:text-indigo-400 mt-0.5">{action.reason}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

