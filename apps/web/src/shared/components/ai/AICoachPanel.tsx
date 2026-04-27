import React from 'react';
import { AIReport } from '@shared/lib/aiEngine';
import { AlertTriangle, Target, BrainCircuit, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@shared/lib/utils';

export default function AICoachPanel({ report }: { report: AIReport }) {
  if (!report) return null;

  const statusColors = {
    Beginner: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    Intermediate: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    Advanced: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    Elite: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-lg p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <BrainCircuit size={24} />
          </div>
          <div>
            <h2 className="text-xl font-poppins font-black text-gray-900 dark:text-white">AI Decision Engine</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Performance Analysis</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-poppins font-black text-gray-900 dark:text-white">
            {report.score}<span className="text-lg text-gray-400">/100</span>
          </div>
          <div className={cn("inline-block px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider mt-1", statusColors[report.status] || statusColors.Beginner)}>
            {report.status}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Alerts */}
        <div className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
            <AlertTriangle size={16} /> Critical Risks
          </h3>
          <ul className="space-y-2">
            {report.alerts.map((alert, i) => (
              <li key={i} className="text-sm text-gray-700 dark:text-gray-300 bg-rose-50 dark:bg-rose-900/10 p-3 rounded-xl border border-rose-100 dark:border-rose-900/30">
                {alert}
              </li>
            ))}
            {report.alerts.length === 0 && <li className="text-sm text-gray-500">No critical risks detected.</li>}
          </ul>
        </div>

        {/* Weaknesses */}
        <div className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider">
            <TrendingDown size={16} /> Weaknesses
          </h3>
          <ul className="space-y-2">
            {report.weaknesses.map((weakness, i) => (
              <li key={i} className="text-sm text-gray-700 dark:text-gray-300 bg-orange-50 dark:bg-orange-900/10 p-3 rounded-xl border border-orange-100 dark:border-orange-900/30">
                {weakness}
              </li>
            ))}
          </ul>
        </div>

        {/* Strengths */}
        <div className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
            <TrendingUp size={16} /> Strengths
          </h3>
          <ul className="space-y-2">
            {report.strengths.map((strength, i) => (
              <li key={i} className="text-sm text-gray-700 dark:text-gray-300 bg-emerald-50 dark:bg-emerald-900/10 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                {strength}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Actions */}
      <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
        <h3 className="flex items-center gap-2 text-sm font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-4">
          <Target size={16} /> Recommended Actions
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {report.actions.map((action, i) => (
            <div key={i} className="flex items-start gap-3 bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
              <div className="w-6 h-6 rounded-full bg-indigo-200 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-xs font-bold shrink-0">
                {i + 1}
              </div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{action}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
