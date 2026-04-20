import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Check, Zap, Crown, Shield, CreditCard, Smartphone, X } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useTranslation } from '../../lib/i18n';
import { cn } from '../../lib/utils';

import { db } from '../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export default function Subscription() {
  const { user, profile, updateProfile } = useAuth();
  const { t } = useTranslation();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showMobileMoneyModal, setShowMobileMoneyModal] = useState(false);
  const [selectedPlanForMM, setSelectedPlanForMM] = useState<any>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [mmProvider, setMmProvider] = useState("MPESA");
  const [mmStatus, setMmStatus] = useState<'idle' | 'initiating' | 'pending' | 'success' | 'error'>('idle');
  const [mmError, setMmError] = useState("");
  const [transactionRef, setTransactionRef] = useState("");
  
  // Nouveaux états multidevises
  const [currency, setCurrency] = useState<'USD' | 'CDF'>('USD');
  const [exchangeRate, setExchangeRate] = useState(2800);

  // Charger le taux de change
  React.useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'app_settings', 'global');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().exchangeRate) {
          setExchangeRate(docSnap.data().exchangeRate);
        }
      } catch (err) {
        console.error("Erreur de chargement du taux de change", err);
      }
    };
    fetchSettings();
  }, []);

  const basePlans = [
    {
      id: 'free',
      name: 'Discovery',
      description: 'Découvrez ZoyaEdge et posez les bases de votre discipline.',
      monthlyPriceUSD: 5,
      yearlyPriceUSD: 50,
      features: [
        { label: '30 trades manuels / mois', included: true },
        { label: 'Dashboard & Statistiques de base', included: true },
        { label: 'Journal de trading basique', included: true },
        { label: '3 analyses AI Coach offertes', included: true },
        { label: 'Support communautaire', included: true },
        { label: 'Synchronisation MT5 (EA)', included: false },
        { label: 'Export / Import CSV', included: false },
        { label: 'Analyses avancées (Streaks, Sessions)', included: false },
      ],
      badge: null,
      badgeColor: null,
      highlighted: false,
    },
    {
      id: 'pro',
      name: 'Pro',
      description: '7 jours d\'essai offerts. Pour les traders actifs qui veulent performer.',
      monthlyPriceUSD: 20,
      yearlyPriceUSD: 200,
      features: [
        { label: 'Trades manuels illimités', included: true },
        { label: 'Synchronisation MT5 (1 compte)', included: true },
        { label: 'Analyses avancées (Streaks, Émotions)', included: true },
        { label: 'Export / Import CSV', included: true },
        { label: 'ZoyaEdge AI Coach (30 analyses / mois)', included: true },
        { label: 'Strategy Builder (3 stratégies)', included: true },
        { label: 'Export PDF performances', included: true },
        { label: 'Support Standard (Email)', included: true },
        { label: 'Comptes MT5 illimités', included: false },
        { label: 'ZoyaEdge AI Coach Illimité', included: false },
      ],
      badge: '⚡ PLUS POPULAIRE',
      badgeColor: 'bg-red-500',
      highlighted: true,
    },
    {
      id: 'premium',
      name: 'Elite',
      description: 'L\'arsenal complet pour les professionnels et prop-firms.',
      monthlyPriceUSD: 50,
      yearlyPriceUSD: 500,
      features: [
        { label: 'Trades manuels illimités', included: true },
        { label: 'Synchronisation MT5 (Comptes illimités)', included: true },
        { label: 'ZoyaEdge AI Coach Illimité', included: true },
        { label: 'Stratégies personnalisées illimitées', included: true },
        { label: 'Radar Chart & Analytics Pro', included: true },
        { label: 'Export PDF & Rapports avancés', included: true },
        { label: 'Alertes en temps réel', included: true },
        { label: 'Support Prioritaire (WhatsApp / VIP)', included: true },
      ],
      badge: '👑 ELITE',
      badgeColor: 'bg-orange-500',
      highlighted: false,
    },
  ];

  const plans = basePlans.map(plan => ({
    ...plan,
    monthlyPrice: currency === 'USD' ? plan.monthlyPriceUSD : plan.monthlyPriceUSD * exchangeRate,
    yearlyPrice: currency === 'USD' ? plan.yearlyPriceUSD : plan.yearlyPriceUSD * exchangeRate,
  }));

  // Fonction d'affichage du prix
  function displayPrice(plan: typeof plans[0]): string {
    const symbol = currency;
    if (billingCycle === 'yearly') return `${plan.yearlyPrice.toLocaleString()} ${symbol}/an`;
    return `${plan.monthlyPrice.toLocaleString()} ${symbol}/mois`;
  }

  function displaySavings(plan: typeof plans[0]): string | null {
    const monthlyCost = plan.monthlyPrice * 12;
    const savings = Math.round(monthlyCost - plan.yearlyPrice);
    return billingCycle === 'yearly' && savings > 0 ? `Économisez ${savings.toLocaleString()} ${currency}/an` : null;
  }

  const handleSubscribe = async (planId: string) => {
    if (planId === profile?.subscription) return;
    
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;

    setSelectedPlanForMM(plan);
    setShowMobileMoneyModal(true);
    setMmStatus('idle');
    setMmError('');
  };

  const handleMobileMoneyPayment = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      setMmError("Veuillez entrer un numéro de téléphone valide.");
      return;
    }

    setMmStatus('initiating');
    setMmError("");

    try {
      const price = billingCycle === 'monthly' ? selectedPlanForMM.monthlyPrice : selectedPlanForMM.yearlyPrice;
      const token = await user?.getIdToken();
      
      const response = await fetch('/api/payments/mobile-money/pay', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          planId: selectedPlanForMM.id,
          amount: price,
          currency: currency,
          phoneNumber,
          provider: mmProvider,
          cycle: billingCycle
        })
      });

      if (!response.ok) {
        const error = await response.json();
        const detailMsg = error.details ? JSON.stringify(error.details) : '';
        throw new Error(error.error ? `${error.error} ${detailMsg}` : "Échec de l'initiation du paiement");
      }

      const result = await response.json();
      
      const pollId = result.transactionId || result.transactionReference || result.customerReference;
      setTransactionRef(pollId);
      setMmStatus('pending');
      
      // Start Polling
      startPollingStatus(pollId);

    } catch (err: any) {
      setMmStatus('error');
      setMmError(err.message);
    }
  };

  const startPollingStatus = (ref: string) => {
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      if (attempts > 30) { // 5 minutes (10s interval)
        setMmStatus('error');
        setMmError("Le délai d'attente est dépassé. Veuillez vérifier votre application Mobile Money.");
        clearInterval(interval);
        return;
      }

      try {
        const token = await user?.getIdToken();
        const response = await fetch(`/api/payments/mobile-money/status/${ref}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();

        // Utiliser le statut normalisé par notre propre backend
        const status = result._statusText || result.status?.toUpperCase() || (result.data && result.data.status?.toUpperCase());
        
        if (status === 'SUCCESSFUL' || status === 'COMPLETED' || status === 'SUCCESS' || status === '00') {
          setMmStatus('success');
          clearInterval(interval);
          // Actualiser le profile
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        } else if (status === 'FAILED' || status === 'CANCELLED' || status === 'REJECTED' || status === 'ERROR') {
          setMmStatus('error');
          const errMsg = result.message || result.statusDescription || "La transaction a échoué ou a été annulée.";
          setMmError(errMsg);
          clearInterval(interval);
        }
      } catch (e) {
        console.error("Polling error", e);
      }
    }, 10000);
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
      className="w-full space-y-12 pb-12"
    >
      {/* Mobile Money Modal */}
      {showMobileMoneyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-gray-900 rounded-3xl p-8 max-w-md w-full shadow-2xl relative overflow-hidden"
          >
            <button 
              onClick={() => setShowMobileMoneyModal(false)}
              className="absolute top-4 right-4 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
            >
              <X size={20} />
            </button>

            <div className="text-center space-y-4 mb-8">
              <div className="w-16 h-16 bg-zoya-red/10 rounded-2xl flex items-center justify-center mx-auto text-zoya-red">
                <Smartphone size={32} />
              </div>
              <h2 className="text-2xl font-black font-poppins">Payer par Mobile Money</h2>
              <p className="text-gray-500 text-sm">
                Abonnement <strong>{selectedPlanForMM?.name}</strong> • {displayPrice(selectedPlanForMM)}
              </p>
            </div>

            {mmStatus === 'idle' || mmStatus === 'error' || mmStatus === 'initiating' ? (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold mb-2 ml-1">Choix de l'opérateur</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['MPESA', 'ORANGE', 'AIRTEL'].map((prov) => (
                      <button
                        key={prov}
                        onClick={() => setMmProvider(prov)}
                        className={cn(
                          "py-3 rounded-xl text-xs font-bold border-2 transition-all",
                          mmProvider === prov 
                            ? "border-zoya-red bg-zoya-red/5 text-zoya-red" 
                            : "border-gray-100 dark:border-gray-800 hover:border-gray-200"
                        )}
                      >
                        {prov}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2 ml-1">Numéro de téléphone</label>
                  <input
                    type="tel"
                    placeholder="Ex: +243812345678"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:border-zoya-red transition-all"
                  />
                </div>

                {mmError && (
                  <p className="text-red-500 text-xs font-medium text-center">{mmError}</p>
                )}

                <button
                  onClick={handleMobileMoneyPayment}
                  disabled={mmStatus === 'initiating'}
                  className="w-full py-4 rounded-2xl bg-zoya-red text-white font-bold shadow-lg shadow-zoya-red/20 flex items-center justify-center gap-2"
                >
                  {mmStatus === 'initiating' ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>Payer Maintenant</>
                  )}
                </button>
              </div>
            ) : mmStatus === 'pending' ? (
              <div className="text-center space-y-6 py-8">
                <div className="w-16 h-16 border-4 border-zoya-red border-t-transparent rounded-full animate-spin mx-auto" />
                <div className="space-y-2">
                  <h3 className="text-xl font-bold">Veuillez patienter...</h3>
                  <p className="text-sm text-gray-500">
                    Confirmez la transaction sur votre téléphone en entrant votre code PIN quand vous recevez le prompt USSD.
                  </p>
                </div>
              </div>
            ) : mmStatus === 'success' ? (
              <div className="text-center space-y-6 py-8">
                <div className="w-16 h-16 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto">
                  <Check size={32} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold">Paiement Réussi !</h3>
                  <p className="text-sm text-gray-500">
                    Votre compte est en cours d'activation. L'application va se recharger automatiquement.
                  </p>
                </div>
              </div>
            ) : null}

            <p className="text-[10px] text-gray-400 text-center mt-8">
              Paiement sécurisé via ARAKA. Vos fonds ne sont prélevés qu'après validation de votre code PIN secret.
            </p>
          </motion.div>
        </div>
      )}

      {/* Payment Gateway Coming Soon Notification */}
      <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900/50 p-4 rounded-3xl flex items-center justify-center gap-3 shadow-inner">
        <Shield className="text-emerald-600 dark:text-emerald-400" size={20} />
        <p className="text-sm font-poppins font-bold text-emerald-900 dark:text-emerald-200 text-center">
          Paiements Mobile Money (Araka) activés ! Payez via M-Pesa, Orange ou Airtel.
        </p>
      </div>

      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl md:text-5xl font-poppins font-black text-gray-900 dark:text-white tracking-tight">
          Investissez dans votre <span className="text-zoya-red">Discipline</span>
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Choisissez le plan qui correspond à votre niveau. Payez facilement par carte bancaire ou Mobile Money (M-Pesa, Orange, Airtel).
        </p>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 mb-4">
          <span className={`text-sm font-medium ${billingCycle === 'monthly' ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>
            Mensuel
          </span>
          <button
            onClick={() => setBillingCycle(prev => prev === 'monthly' ? 'yearly' : 'monthly')}
            className={`relative w-14 h-7 rounded-full transition-colors duration-200 ${billingCycle === 'yearly' ? 'bg-zoya-red' : 'bg-gray-300 dark:bg-gray-600'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-200 ${billingCycle === 'yearly' ? 'translate-x-7' : 'translate-x-0'}`} />
          </button>
          <span className={`text-sm font-medium ${billingCycle === 'yearly' ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>
            Annuel
            <span className="ml-1 text-xs text-emerald-500 font-bold">-20%</span>
          </span>
        </div>

        {/* Currency Toggle */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <button
            onClick={() => setCurrency('USD')}
            className={cn(
              "px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm",
              currency === 'USD' ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900" : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
            )}
          >
            USD ($)
          </button>
          <button
            onClick={() => setCurrency('CDF')}
            className={cn(
              "px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm",
              currency === 'CDF' ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900" : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
            )}
          >
            CDF (FC)
          </button>
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
          const savings = displaySavings(plan);

          return (
            <div 
              key={plan.id}
              className={cn(
                "relative rounded-3xl p-8 transition-transform duration-300 hover:-translate-y-2",
                plan.id === 'pro' && plan.highlighted ? "ring-4 ring-zoya-red/20 shadow-2xl shadow-zoya-red/10 bg-gray-900 dark:bg-white text-white dark:text-gray-900" : "shadow-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white",
                plan.id === 'premium' ? "bg-gradient-to-br from-zoya-red to-orange-500 text-white" : "",
                plan.id === 'free' ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white" : ""
              )}
            >
              {plan.badge && (
                <div className={cn("absolute -top-4 left-1/2 -translate-x-1/2 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1", plan.badgeColor)}>
                  <Zap size={14} /> {plan.badge}
                </div>
              )}

              <div className="mb-8">
                <h3 className="text-2xl font-poppins font-black mb-2">{plan.name}</h3>
                <p className="text-sm opacity-80 h-10">{plan.description}</p>
              </div>

              <div className="mb-8">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black">{displayPrice(plan)}</span>
                </div>
                {savings && (
                  <p className="text-sm font-bold text-green-400 mt-1">{savings}</p>
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
                    <>S'abonner</>
                  )}
                </button>
              )}

              <div className="mt-8 space-y-4">
                {plan.features.map((feature, i) => (
                  <div key={i} className={cn("flex items-start gap-3", !feature.included ? "opacity-40" : "")}>
                    {feature.included ? (
                      <Check size={18} className={plan.id === 'premium' ? "text-white" : "text-emerald-500"} />
                    ) : (
                      <X size={18} />
                    )}
                    <span className="text-sm font-medium text-left">{feature.label}</span>
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
