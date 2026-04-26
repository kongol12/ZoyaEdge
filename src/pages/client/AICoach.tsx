import React, { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { subscribeToTrades, Trade } from '../../lib/db';
import AICoachDashboard from '../../components/AI/AICoachDashboard';
import { motion } from 'motion/react';
import { BrainCircuit, Loader2, Lock, CreditCard } from 'lucide-react';
import { useTranslation } from '../../lib/i18n';
import PaywallModal from '../../components/molecules/PaywallModal';
import { cn } from '../../lib/utils';

export default function AICoach() {
  const { user, profile } = useAuth();
  const { t } = useTranslation();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPaywall, setShowPaywall] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToTrades(user.uid, (data) => {
      setTrades(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (profile?.subscription === 'free') {
      setShowPaywall(true);
    }
  }, [profile]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-zoya-red" />
      </div>
    );
  }

  // Access is allowed for everyone who has credits or a subscription
  const isLocked = false; 
  const hasNoCredits = (profile?.aiCredits || 0) <= 0 && profile?.subscription !== 'premium';

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-2"
    >
      <header className="flex items-center gap-2">
        <div className="p-3 bg-zoya-red rounded-2xl text-white shadow-lg shadow-zoya-red/20">
          <BrainCircuit size={32} />
        </div>
        <div className="flex-1">
          <h1 className="text-3xl font-poppins font-black text-gray-900 dark:text-white">{t.dashboard.coachTitle}</h1>
          <p className="text-gray-500 dark:text-gray-400">{t.onboarding.step1Desc}</p>
        </div>
        {profile?.subscription !== 'premium' && (
          <div className="bg-white dark:bg-gray-800 px-4 py-2 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-2">
            <span className="text-xs font-black text-gray-400 uppercase tracking-widest">
              Crédits AI ({profile?.subscription === 'pro' ? 'Pro' : 'Discovery'}):
            </span>
            <span className={cn("font-poppins font-black text-lg", (profile?.aiCredits || 0) > 0 ? "text-emerald-600" : "text-rose-600")}>
              {profile?.aiCredits || 0}
            </span>
            <span className="text-xs font-medium text-gray-500">
              / {profile?.subscription === 'pro' ? 30 : 3}
            </span>
          </div>
        )}
      </header>

      {isLocked ? (
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-12 text-center border border-gray-100 dark:border-gray-700 shadow-lg flex flex-col items-center">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
            <Lock className="text-gray-400" size={32} />
          </div>
          <h2 className="text-xl font-bold mb-2">Fonctionnalité Premium</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
            ZoyaEdge AI Coach est réservé aux membres Pro et Premium. Mettez à niveau votre abonnement pour débloquer l'analyse comportementale.
          </p>
          <button 
            onClick={() => setShowPaywall(true)}
            className="bg-zoya-red text-white px-6 py-3 rounded-2xl font-bold hover:bg-zoya-red-dark transition-colors"
          >
            Débloquer l'IA
          </button>
        </div>
      ) : hasNoCredits ? (
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-12 text-center border border-gray-100 dark:border-gray-700 shadow-lg flex flex-col items-center">
          <div className="w-16 h-16 bg-rose-50 dark:bg-rose-900/20 rounded-full flex items-center justify-center mb-4 text-rose-600">
            <CreditCard size={32} />
          </div>
          <h2 className="text-xl font-bold mb-2">Crédits Épuisés</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
            Vous avez utilisé tous vos crédits AI pour ce mois. Passez au plan **Premium** pour un accès illimité ou attendez le mois prochain.
          </p>
          <button 
            onClick={() => setShowPaywall(true)}
            className="bg-zoya-red text-white px-6 py-3 rounded-2xl font-bold hover:bg-zoya-red-dark transition-colors"
          >
            Acheter des Crédits / Premium
          </button>
        </div>
      ) : trades.length > 0 ? (
        <div className="space-y-2">
          <AICoachDashboard />
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-12 text-center border border-gray-100 dark:border-gray-700 shadow-lg">
          <p className="text-gray-500 dark:text-gray-400">{t.strategies.noStrategies}</p>
        </div>
      )}

      <PaywallModal
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        title="Débloquez l'IA ZoyaEdge"
        description="L'analyse comportementale et le moteur de décision IA nécessitent beaucoup de puissance de calcul. Passez au plan Premium pour un accès illimité."
        requiredTier="premium"
      />
    </motion.div>
  );
}
