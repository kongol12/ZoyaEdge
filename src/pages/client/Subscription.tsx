import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Check, Zap, Crown, Shield, CreditCard, Smartphone, X } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useTranslation } from '../../lib/i18n';
import { cn } from '../../lib/utils';

import { db } from '../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

import ZoyaPayCheckout from '../../components/organisms/client/ZoyaPayCheckout';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

import toast from 'react-hot-toast';

export default function Subscription() {
  const { user, profile, updateProfile, refreshProfile } = useAuth();
  const { t } = useTranslation();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showZoyaPayCheckout, setShowZoyaPayCheckout] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [success, setSuccess] = useState(false);
  
  // Nouveaux états multidevises et tarification dynamic
  const [currency, setCurrency] = useState<'USD' | 'CDF'>('USD');
  const [exchangeRate, setExchangeRate] = useState(2800);
  const [dynamicPricing, setDynamicPricing] = useState({
    discoveryMonthlyUSD: 0,
    discoveryYearlyUSD: 0,
    discoveryMonthlyCDF: 0,
    discoveryYearlyCDF: 0,
    proMonthlyUSD: 20,
    proYearlyUSD: 200,
    proMonthlyCDF: 56000,
    proYearlyCDF: 560000,
    premiumMonthlyUSD: 50,
    premiumYearlyUSD: 500,
    premiumMonthlyCDF: 140000,
    premiumYearlyCDF: 1400000,
    globalDiscount: 0,
    transactionFee: 2,
    vatRate: 16,
    useAutomaticConversion: true
  });

  // Charger le taux de change et les prix
  React.useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'app_settings', 'global');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.exchangeRate) setExchangeRate(data.exchangeRate);
          setDynamicPricing({
            discoveryMonthlyUSD: data.discoveryMonthlyUSD ?? 0,
            discoveryYearlyUSD: data.discoveryYearlyUSD ?? 0,
            discoveryMonthlyCDF: data.discoveryMonthlyCDF ?? 0,
            discoveryYearlyCDF: data.discoveryYearlyCDF ?? 0,
            proMonthlyUSD: data.proMonthlyUSD ?? 20,
            proYearlyUSD: data.proYearlyUSD ?? 200,
            proMonthlyCDF: data.proMonthlyCDF ?? (data.proMonthlyUSD * (data.exchangeRate || 2800)),
            proYearlyCDF: data.proYearlyCDF ?? (data.proYearlyUSD * (data.exchangeRate || 2800)),
            premiumMonthlyUSD: data.premiumMonthlyUSD ?? 50,
            premiumYearlyUSD: data.premiumYearlyUSD ?? 500,
            premiumMonthlyCDF: data.premiumMonthlyCDF ?? (data.premiumMonthlyUSD * (data.exchangeRate || 2800)),
            premiumYearlyCDF: data.premiumYearlyCDF ?? (data.premiumYearlyUSD * (data.exchangeRate || 2800)),
            globalDiscount: data.globalDiscount ?? 0,
            transactionFee: data.transactionFee ?? 2,
            vatRate: data.vatRate ?? 16,
            useAutomaticConversion: data.useAutomaticConversion ?? true
          });
        }
      } catch (err) {
        console.error("Erreur de chargement des paramètres financiers", err);
      }
    };
    fetchSettings();
  }, []);

  const basePlans = [
    {
      id: 'discovery',
      name: 'Discovery',
      description: 'Découvrez ZoyaEdge et posez les bases de votre discipline.',
      monthlyPriceUSD: dynamicPricing.discoveryMonthlyUSD,
      yearlyPriceUSD: dynamicPricing.discoveryYearlyUSD,
      monthlyPriceCDF: dynamicPricing.discoveryMonthlyCDF,
      yearlyPriceCDF: dynamicPricing.discoveryYearlyCDF,
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
      monthlyPriceUSD: dynamicPricing.proMonthlyUSD,
      yearlyPriceUSD: dynamicPricing.proYearlyUSD,
      monthlyPriceCDF: dynamicPricing.proMonthlyCDF,
      yearlyPriceCDF: dynamicPricing.proYearlyCDF,
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
      monthlyPriceUSD: dynamicPricing.premiumMonthlyUSD,
      yearlyPriceUSD: dynamicPricing.premiumYearlyUSD,
      monthlyPriceCDF: dynamicPricing.premiumMonthlyCDF,
      yearlyPriceCDF: dynamicPricing.premiumYearlyCDF,
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

  const plans = basePlans.map(plan => {
    const discountMultiplier = 1 - (dynamicPricing.globalDiscount / 100);
    
    // Logic: If CDF + Automatic Conversion is disabled, use fixed CDF price. Otherwise convert from USD.
    let mPrice: number;
    let yPrice: number;

    if (currency === 'CDF') {
      if (!dynamicPricing.useAutomaticConversion) {
        mPrice = plan.monthlyPriceCDF * discountMultiplier;
        yPrice = plan.yearlyPriceCDF * discountMultiplier;
      } else {
        mPrice = (plan.monthlyPriceUSD * discountMultiplier) * exchangeRate;
        yPrice = (plan.yearlyPriceUSD * discountMultiplier) * exchangeRate;
      }
    } else {
      mPrice = plan.monthlyPriceUSD * discountMultiplier;
      yPrice = plan.yearlyPriceUSD * discountMultiplier;
    }

    return {
      ...plan,
      monthlyPrice: mPrice,
      yearlyPrice: yPrice,
    };
  });

  // Fonction d'affichage du prix
  function displayPrice(plan: typeof plans[0]): string {
    const symbol = currency;
    const price = billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
    
    if (price === 0) return "Gratuit";
    
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

    if (plan.id === 'discovery' && plan.monthlyPrice === 0) {
       await updateProfile({ 
          subscription: 'discovery',
          subscriptionStatus: 'active',
          subscriptionEndDate: null
       });
       toast.success("Votre plan Discovery gratuit est maintenant actif !");
       return;
    }

    setSelectedPlan({
      id: plan.id,
      name: plan.name,
      price: billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice
    });
    setShowZoyaPayCheckout(true);
  };

  const handlePaymentSuccess = async (paymentData: any) => {
    setShowZoyaPayCheckout(false);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 5000);
    // Subscription status is updated server-side, 
    // AuthProvider will pick up changes automatically via onSnapshot or next reload.
    console.log("Payment completed and verified:", paymentData);
  };

  const handleStartTrial = async () => {
    setIsProcessing(true);
    try {
      const idToken = await user?.getIdToken();
      const response = await fetch('/api/auth/start-trial', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erreur activation essai");
      await refreshProfile();
      toast.success(`Félicitations ! Votre essai gratuit de 7 jours est activé.`);
    } catch (error: any) {
      toast.error(error.message || "Une erreur est survenue.");
    } finally {
      setIsProcessing(false);
    }
  };

  const canUseTrial = !profile?.hasUsedTrial && (!profile?.subscription || profile?.subscription === 'discovery' || profile?.subscription === 'free');

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full space-y-12 pb-12"
    >
      {/* ZoyaPay Checkout */}
      {selectedPlan && (
        <ZoyaPayCheckout 
          isOpen={showZoyaPayCheckout}
          onClose={() => setShowZoyaPayCheckout(false)}
          plan={selectedPlan}
          billingCycle={billingCycle}
          currency={currency}
          exchangeRate={exchangeRate}
          transactionFeeRate={dynamicPricing.transactionFee}
          vatRate={dynamicPricing.vatRate}
          userProfile={profile}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}

      {/* Payment Gateway Notification */}
      <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900/50 p-4 rounded-3xl flex items-center justify-center gap-3 shadow-inner">
        <Shield className="text-emerald-600 dark:text-emerald-400" size={20} />
        <p className="text-sm font-poppins font-bold text-emerald-900 dark:text-emerald-200 text-center">
          Système de paiement ZoyaPay sécurisé actif ! Payez en quelques clics via Mobile Money.
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
