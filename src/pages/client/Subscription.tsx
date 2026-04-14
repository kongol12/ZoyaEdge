import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Check, Zap, Crown, Shield, CreditCard, Smartphone, X } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useTranslation } from '../../lib/i18n';
import { cn } from '../../lib/utils';

export default function Subscription() {
  const { profile, updateProfile } = useAuth();
  const { t } = useTranslation();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [isProcessing, setIsProcessing] = useState(false);

  const plans = [
    {
      id: 'free',
      name: 'Free',
      description: 'Pour découvrir ZoyaEdge et commencer son journal.',
      price: { monthly: 0, yearly: 0 },
      features: [
        'Jusqu\'à 50 trades manuels / mois',
        'Dashboard & Statistiques de base',
        'Journal de trading basique',
        'Support communautaire'
      ],
      notIncluded: [
        'Synchronisation MT5 (EA)',
        'ZoyaEdge AI Coach',
        'Export / Import CSV',
        'Analyses avancées (Streaks, Sessions)'
      ],
      color: 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white',
      buttonText: 'Plan Actuel',
      popular: false
    },
    {
      id: 'pro',
      name: 'Pro',
      description: 'Pour les traders actifs qui veulent gagner du temps.',
      price: { monthly: 15.99, yearly: 153.50 }, // ~$12.79/mo if yearly
      features: [
        'Trades manuels illimités',
        'Synchronisation MT5 (1 compte)',
        'Analyses avancées (Streaks, Émotions)',
        'Export / Import CSV',
        'ZoyaEdge AI Coach (5 analyses / mois)',
        'Support Standard (Email)'
      ],
      notIncluded: [
        'Comptes MT5 illimités',
        'ZoyaEdge AI Coach Illimité',
        'Stratégies personnalisées illimitées'
      ],
      color: 'bg-gray-900 dark:bg-white text-white dark:text-gray-900',
      buttonText: 'Passer Pro',
      popular: true
    },
    {
      id: 'premium',
      name: 'Premium',
      description: 'L\'arsenal complet pour les professionnels et prop-firms.',
      price: { monthly: 22.99, yearly: 220.70 }, // ~$18.39/mo if yearly
      features: [
        'Trades manuels illimités',
        'Synchronisation MT5 (Comptes illimités)',
        'ZoyaEdge AI Coach Illimité',
        'Stratégies personnalisées illimitées',
        'Alertes en temps réel (Bientôt)',
        'Support Prioritaire (WhatsApp / VIP)'
      ],
      notIncluded: [],
      color: 'bg-gradient-to-br from-zoya-red to-orange-500 text-white',
      buttonText: 'Devenir Premium',
      popular: false
    }
  ];

  const handleSubscribe = async (planId: string) => {
    if (planId === 'free' || planId === profile?.subscription) return;
    
    setIsProcessing(true);
    // TODO: Integrate Flutterwave / FlexPay / Paddle here
    // For now, we simulate a successful payment and upgrade the user
    setTimeout(async () => {
      try {
        const endDate = new Date();
        if (billingCycle === 'monthly') {
          endDate.setMonth(endDate.getMonth() + 1);
        } else {
          endDate.setFullYear(endDate.getFullYear() + 1);
        }

        await updateProfile({ 
          subscription: planId as 'free' | 'pro' | 'premium',
          subscriptionCycle: billingCycle,
          subscriptionStatus: 'active',
          subscriptionEndDate: endDate
        });
        alert(`Félicitations ! Vous êtes maintenant sur le plan ${planId.toUpperCase()}. (Simulation)`);
      } catch (error) {
        console.error("Erreur lors de la mise à jour de l'abonnement:", error);
        alert("Une erreur est survenue lors de la mise à jour de votre abonnement.");
      } finally {
        setIsProcessing(false);
      }
    }, 1500);
  };

  const handleStartTrial = async () => {
    setIsProcessing(true);
    setTimeout(async () => {
      try {
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 7); // 7 days trial

        await updateProfile({ 
          subscription: 'pro',
          subscriptionCycle: 'monthly',
          subscriptionStatus: 'trialing',
          subscriptionEndDate: endDate,
          hasUsedTrial: true
        });
        alert(`Félicitations ! Votre essai gratuit de 7 jours a commencé.`);
      } catch (error) {
        console.error("Erreur lors de l'activation de l'essai:", error);
        alert("Une erreur est survenue.");
      } finally {
        setIsProcessing(false);
      }
    }, 1500);
  };

  const canUseTrial = !profile?.hasUsedTrial && (!profile?.subscription || profile?.subscription === 'free');

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto space-y-12 pb-12"
    >
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl md:text-5xl font-poppins font-black text-gray-900 dark:text-white tracking-tight">
          Investissez dans votre <span className="text-zoya-red">Discipline</span>
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Choisissez le plan qui correspond à votre niveau. Payez facilement par carte bancaire ou Mobile Money (M-Pesa, Orange, Airtel).
        </p>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center mt-8">
          <div className="bg-gray-100 dark:bg-gray-800 p-1 rounded-full flex items-center">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={cn(
                "px-6 py-2.5 rounded-full text-sm font-bold transition-all",
                billingCycle === 'monthly' 
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm" 
                  : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
              )}
            >
              Mensuel
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={cn(
                "px-6 py-2.5 rounded-full text-sm font-bold transition-all flex items-center gap-2",
                billingCycle === 'yearly' 
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm" 
                  : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
              )}
            >
              Annuel <span className="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider">-20%</span>
            </button>
          </div>
        </div>
      </div>

      {/* Payment Methods Info */}
      <div className="flex flex-wrap justify-center items-center gap-6 text-gray-400 dark:text-gray-500">
        <div className="flex items-center gap-2">
          <CreditCard size={20} />
          <span className="text-sm font-medium">Visa / Mastercard</span>
        </div>
        <div className="flex items-center gap-2">
          <Smartphone size={20} />
          <span className="text-sm font-medium">Mobile Money (M-Pesa, Orange, Airtel...)</span>
        </div>
        <div className="flex items-center gap-2">
          <Shield size={20} />
          <span className="text-sm font-medium">Paiement Sécurisé</span>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
        {plans.map((plan) => {
          const isCurrentPlan = profile?.subscription === plan.id;
          const price = billingCycle === 'monthly' ? plan.price.monthly : plan.price.yearly;
          const monthlyEquivalent = billingCycle === 'yearly' ? (plan.price.yearly / 12).toFixed(0) : null;

          return (
            <div 
              key={plan.id}
              className={cn(
                "relative rounded-3xl p-8 transition-transform duration-300 hover:-translate-y-2",
                plan.color,
                plan.popular ? "ring-4 ring-zoya-red/20 shadow-2xl shadow-zoya-red/10" : "shadow-xl border border-gray-100 dark:border-gray-800"
              )}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-zoya-red text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                  <Zap size={14} /> Plus Populaire
                </div>
              )}

              <div className="mb-8">
                <h3 className="text-2xl font-poppins font-black mb-2">{plan.name}</h3>
                <p className="text-sm opacity-80 h-10">{plan.description}</p>
              </div>

              <div className="mb-8">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black">${price}</span>
                  <span className="opacity-80">/{billingCycle === 'monthly' ? 'mois' : 'an'}</span>
                </div>
                {monthlyEquivalent && (
                  <p className="text-sm opacity-80 mt-1">Soit ${monthlyEquivalent}/mois</p>
                )}
              </div>

              {canUseTrial && plan.id === 'pro' ? (
                <div className="space-y-3">
                  <button
                    onClick={handleStartTrial}
                    disabled={isProcessing}
                    className="w-full py-4 rounded-2xl font-bold transition-all flex justify-center items-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/30"
                  >
                    {isProcessing ? (
                      <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>Démarrer l'essai gratuit (7 jours)</>
                    )}
                  </button>
                  <button
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={isProcessing}
                    className="w-full py-3 rounded-2xl font-bold transition-all flex justify-center items-center gap-2 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700"
                  >
                    Passer l'essai et payer
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={isCurrentPlan || isProcessing}
                  className={cn(
                    "w-full py-4 rounded-2xl font-bold transition-all flex justify-center items-center gap-2",
                    isCurrentPlan 
                      ? "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                      : plan.id === 'premium'
                        ? "bg-white text-zoya-red hover:bg-gray-50"
                        : plan.id === 'pro'
                          ? "bg-zoya-red text-white hover:bg-zoya-red-dark"
                          : "bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100"
                  )}
                >
                  {isProcessing && plan.id !== 'free' && !isCurrentPlan ? (
                    <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : isCurrentPlan ? (
                    <>Plan Actuel</>
                  ) : (
                    <>{plan.buttonText}</>
                  )}
                </button>
              )}

              <div className="mt-8 space-y-4">
                {plan.features.map((feature, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Check size={18} className={plan.id === 'premium' ? "text-white" : "text-emerald-500"} />
                    <span className="text-sm font-medium text-left">{feature}</span>
                  </div>
                ))}
                {plan.notIncluded.map((feature, i) => (
                  <div key={`not-${i}`} className="flex items-start gap-3 opacity-50">
                    <X size={18} />
                    <span className="text-sm text-left">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
