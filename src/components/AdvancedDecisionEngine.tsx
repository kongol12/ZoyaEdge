import React, { useState, useEffect } from 'react';
import { AICoachOutput, getAICoachDecision, AICoachInput } from '../lib/aiCoach';
import { ShieldAlert, ShieldCheck, Shield, Activity, Brain, Target, Loader2 } from 'lucide-react';

interface DecisionEngineProps {
  inputMetrics: AICoachInput;
}

export default function AdvancedDecisionEngine({ inputMetrics }: DecisionEngineProps) {
  const [result, setResult] = useState<AICoachOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    
    const fetchDecision = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getAICoachDecision(inputMetrics);
        if (isMounted) setResult(data);
      } catch (err: any) {
        if (isMounted) setError(err.message || "AI temporarily unavailable, retry later");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchDecision();

    return () => { isMounted = false; };
  }, [inputMetrics]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-lg flex flex-col items-center justify-center min-h-[300px]">
        <Loader2 className="animate-spin text-zoya-red mb-4" size={32} />
        <p className="text-gray-500 dark:text-gray-400 font-medium">L'IA analyse vos performances...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-lg flex flex-col items-center justify-center min-h-[300px]">
        <ShieldAlert className="text-rose-500 mb-4" size={32} />
        <p className="text-rose-500 font-medium text-center">{error}</p>
      </div>
    );
  }

  if (!result) return null;

  const getDecisionColor = (decision: string) => {
    switch (decision) {
      case 'GREEN': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
      case 'ORANGE': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800';
      case 'RED': return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200 dark:border-rose-800';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  const getDecisionIcon = (decision: string) => {
    switch (decision) {
      case 'GREEN': return <ShieldCheck size={32} className="text-emerald-600 dark:text-emerald-400" />;
      case 'ORANGE': return <Shield size={32} className="text-orange-600 dark:text-orange-400" />;
      case 'RED': return <ShieldAlert size={32} className="text-rose-600 dark:text-rose-400" />;
      default: return <Shield size={32} />;
    }
  };
  
  const getDecisionText = (decision: string) => {
    switch (decision) {
      case 'GREEN': return 'CONTINUER À TRADER';
      case 'ORANGE': return 'RÉDUIRE LE RISQUE';
      case 'RED': return 'ARRÊTER DE TRADER';
      default: return 'INCONNU';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-lg space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex-1">
          <h3 className="text-xl font-poppins font-black text-gray-900 dark:text-white flex items-center gap-2 mb-2">
            <Brain className="text-zoya-red" />
            Moteur de Décision IA
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Analyse comportementale et gestion des risques en temps réel.
          </p>
        </div>
        
        <div className={`flex items-center gap-3 px-6 py-4 rounded-2xl border-2 ${getDecisionColor(result.decision)}`}>
          {getDecisionIcon(result.decision)}
          <div className="flex flex-col">
            <span className="text-xs font-bold uppercase tracking-wider opacity-80">Statut</span>
            <span className="text-lg font-black font-poppins">{getDecisionText(result.decision)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Score de Risque</span>
            <Activity size={16} className="text-blue-500" />
          </div>
          <div className="text-2xl font-black text-gray-900 dark:text-white">{result.score.risk}/100</div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Discipline</span>
            <Target size={16} className="text-purple-500" />
          </div>
          <div className="text-2xl font-black text-gray-900 dark:text-white">{result.score.discipline}/100</div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Cohérence</span>
            <Shield size={16} className="text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-gray-900 dark:text-white">{result.score.consistency}/100</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3 uppercase tracking-wider">Insights</h4>
          <ul className="space-y-2">
            {result.insights.map((insight, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                <span className="text-zoya-red mt-0.5">•</span>
                {insight}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3 uppercase tracking-wider">Plan d'Action</h4>
          <ul className="space-y-2">
            {result.actions.map((action, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                <span className="text-emerald-500 mt-0.5">→</span>
                {action}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
