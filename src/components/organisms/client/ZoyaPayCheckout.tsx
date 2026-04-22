import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Shield, CreditCard, ChevronRight, Check, MapPin, User, Mail, Smartphone, ArrowRight, Lock, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useAuth } from '../../../lib/auth';

interface ZoyaPayCheckoutProps {
  isOpen: boolean;
  onClose: () => void;
  plan: {
    name: string;
    price: number;
    id: string;
  };
  billingCycle: 'monthly' | 'yearly';
  currency: 'USD' | 'CDF';
  exchangeRate: number;
  transactionFeeRate: number;
  vatRate: number;
  userProfile: any;
  onPaymentSuccess: (transactionData: any) => void;
}

type PaymentState =
  | 'IDLE'
  | 'INITIATED'
  | 'PENDING'
  | 'AWAITING_USER'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'TIMEOUT';

function normalizeStatus(raw: string): string {
  return (raw || "").toUpperCase().trim();
}

function mapBackendStatus(status: string): PaymentState {
  switch (status) {
    case 'SUCCESS':
    case 'COMPLETED':
    case 'PAID':
      return 'SUCCESS';
    case 'FAILED':
    case 'ERROR':
      return 'FAILED';
    case 'REJECT':
    case 'REJECTED':
      return 'FAILED';
    case 'CANCEL':
    case 'CANCELLED':
      return 'CANCELLED';
    case 'EXPIRED':
      return 'EXPIRED';
    case 'PENDING':
      return 'AWAITING_USER';
    case 'PROCESSING':
      return 'PROCESSING';
    default:
      return 'PENDING';
  }
}

function paymentReducer(state: PaymentState, event: any): PaymentState {
  switch (state) {
    case 'IDLE':
      if (event.type === 'START') return 'INITIATED';
      return state;
    case 'INITIATED':
      return 'PENDING';
    case 'PENDING':
    case 'AWAITING_USER':
    case 'PROCESSING':
      if (event.type === 'STATUS') return event.payload;
      return state;
    default:
      return state;
  }
}

export default function ZoyaPayCheckout({
  isOpen,
  onClose,
  plan,
  billingCycle,
  currency,
  exchangeRate,
  transactionFeeRate,
  vatRate,
  userProfile,
  onPaymentSuccess
}: ZoyaPayCheckoutProps) {
  const { user } = useAuth();
  
  // UI Steps
  const [subStep, setSubStep] = useState<'info' | 'payment'>('info');
  // Payment Machine
  const [paymentState, dispatch] = React.useReducer(paymentReducer, 'IDLE');

  const [formData, setFormData] = useState({
    fullName: userProfile?.displayName || '',
    email: userProfile?.email || '',
    phone: '',
    address: '',
    country: 'DR Congo'
  });
  const [selectedProvider, setSelectedProvider] = useState<'MPESA' | 'ORANGE' | 'AIRTEL'>('MPESA');
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [pollingAttempt, setPollingAttempt] = useState(0);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Calculations with strict number coercion to prevent NaN
  const safePrice = Number(plan.price) || 0;
  const safeVatRate = Number(vatRate) || 0;
  const safeFeeRate = Number(transactionFeeRate) || 0;

  // We preserve up to 2 decimal places properly for USD, 
  // while large numbers (CDF) generally naturally render without sub-cents.
  const roundAmount = (val: number) => {
    return currency === 'USD' ? Math.round(val * 100) / 100 : Math.round(val);
  };

  const vatAmount = roundAmount((safePrice * safeVatRate) / 100);
  const subtotalWithVat = safePrice + vatAmount;
  const transactionFeeAmount = roundAmount((subtotalWithVat * safeFeeRate) / 100);
  const totalPrice = roundAmount(subtotalWithVat + transactionFeeAmount);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const handleNext = () => {
    if (!formData.fullName || !formData.email || !formData.phone || !formData.address) {
      setError("Veuillez remplir tous les champs obligatoires.");
      return;
    }
    setError("");
    setSubStep('payment');
  };

  useEffect(() => {
    if (paymentState === 'SUCCESS') {
      onPaymentSuccess({
        amount: totalPrice,
        currency,
        planId: plan.id,
        fee: transactionFeeAmount,
        vat: vatAmount,
        vatRate,
        feeRate: transactionFeeRate,
        ...formData
      });
    }
  }, [paymentState]);

  // Polling Effect
  useEffect(() => {
    if (paymentState !== 'PENDING' && paymentState !== 'AWAITING_USER' && paymentState !== 'PROCESSING') return;
    if (!transactionId) return;

    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      try {
        const idToken = await user?.getIdToken();
        const response = await fetch(`/api/user/sync-status/${transactionId}`, {
          headers: { 'Authorization': `Bearer ${idToken}` }
        });
        
        if (!response.ok) return;
        
        const data = await response.json();
        const rawStatus = data.status || data._statusText;
        const normalized = normalizeStatus(rawStatus);
        const mapped = mapBackendStatus(normalized);

        dispatch({ type: 'STATUS', payload: mapped });
        console.log("ZoyaPay Status:", normalized);

      } catch (err) {
        console.error("Polling error:", err);
      }

      if (attempts >= 40) {
        clearInterval(interval);
        dispatch({ type: 'STATUS', payload: 'TIMEOUT' });
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [paymentState, transactionId]);

  const validatePhone = (phone: string) => {
    // Remove all non-digits
    let cleaned = phone.replace(/\D/g, '');
    
    // Handle +243... or 243...
    if (cleaned.startsWith('243')) {
      return cleaned.slice(0, 12);
    }
    
    // Handle 081... 082... 084... 085... 089... 090... 097... 099...
    if (cleaned.startsWith('0')) {
      return '243' + cleaned.slice(1, 10);
    }
    
    // Handle 81... 82... (no 0)
    if (cleaned.length === 9) {
      return '243' + cleaned;
    }
    
    return cleaned;
  };

  const handlePay = async () => {
    setLoading(true);
    setError("");
    
    // Strict Araka Phone Normalization (Must be 243 + 9 digits)
    const normalizedPhone = validatePhone(formData.phone);
    
    if (normalizedPhone.length !== 12 || !normalizedPhone.startsWith('243')) {
      setError("Format de téléphone invalide pour DR Congo. (Ex: 0812345678 ou 243812345678)");
      setLoading(false);
      return;
    }

    try {
      const idToken = await user?.getIdToken();
      if (!idToken) {
        throw new Error("Authentification requise. Veuillez vous reconnecter.");
      }
      
      const response = await fetch('/api/user/sync-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          amount: totalPrice,
          currency,
          phoneNumber: normalizedPhone,
          provider: selectedProvider,
          planId: plan.id,
          userName: formData.fullName,
          billingCycle,
          fee: transactionFeeAmount,
          vat: vatAmount,
          vatRate,
          feeRate: transactionFeeRate
        })
      });

      if (!response.ok) {
        let errData;
        try {
          errData = await response.json();
        } catch {
          throw new Error("Connexion momentanément interrompue, veuillez réessayer.");
        }
        let errMsg = errData.details || errData.error || "Erreur de paiement";
        if (typeof errMsg === 'string' && errMsg.includes('did not match the expected pattern')) {
           errMsg = "Le numéro de téléphone n'est pas reconnu par l'opérateur local (ex: format invalide).";
        }
        throw new Error(errMsg);
      }

      const result = await response.json();
      setTransactionId(result.transactionId);
      dispatch({ type: 'START', payload: null });
    } catch (err: any) {
      console.error("[ZoyaPayCheckout] Fetch Exception detailed:", {
        message: err.message,
        name: err.name,
        stack: err.stack,
        url: '/api/user/sync-settings'
      });
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
         setError("Erreur réseau: Impossible de joindre le serveur. Il se peut qu'un bloqueur de publicité ou un proxy interfère. Veuillez essayer de désactiver temporairement votre bloqueur de pub.");
      } else {
         setError(`Erreur lors du paiement: ${err?.message || "Erreur inconnue."}`);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <AnimatePresence mode="wait">
        <motion.div
          key={paymentState}
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 1.05, y: -20 }}
          className="bg-white dark:bg-gray-900 rounded-[32px] w-full max-w-lg shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-zoya-red rounded-lg flex items-center justify-center text-white">
                <Shield size={18} />
              </div>
              <span className="font-poppins font-black text-xl tracking-tighter text-gray-900 dark:text-white">
                Zoya<span className="text-zoya-red">Pay</span>
              </span>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>

          <div className="overflow-y-auto flex-1">
            {subStep === 'info' && (
              <div className="p-8 space-y-6">
                <div className="space-y-1">
                  <h2 className="text-2xl font-poppins font-black text-gray-900 dark:text-white">Détails de facturation</h2>
                  <p className="text-sm text-gray-500">Choisissez votre plan et entrez vos informations.</p>
                </div>

                {/* Plan Recap */}
                <div className="p-5 bg-zoya-red/5 rounded-2xl border border-zoya-red/10 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black text-zoya-red uppercase tracking-widest">Plan Sélectionné</p>
                    <p className="text-lg font-black text-gray-900 dark:text-white">{plan.name}</p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase">{billingCycle === 'yearly' ? 'Cycle Annuel' : 'Cycle Mensuel'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-gray-900 dark:text-white">
                      {plan.price.toLocaleString()} {currency}
                    </p>
                    <div className="space-y-0.5">
                      {safeVatRate > 0 && (
                        <p className="text-[10px] text-gray-500 font-bold uppercase">
                          + {vatAmount.toLocaleString()} {currency} (TVA {safeVatRate}%)
                        </p>
                      )}
                      {safeFeeRate > 0 && (
                        <p className="text-[10px] text-gray-500 font-bold uppercase">
                          + {transactionFeeAmount.toLocaleString()} {currency} (Frais de transaction {safeFeeRate}%)
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Form */}
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nom Complet</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                          type="text"
                          value={formData.fullName}
                          onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                          className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-zoya-red"
                          placeholder="Ex: Jean Dupont"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Pays</label>
                      <div className="relative">
                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <select
                          value={formData.country}
                          onChange={(e) => setFormData({...formData, country: e.target.value})}
                          className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-zoya-red appearance-none"
                        >
                          <option>DR Congo</option>
                          <option>Congo Brazzaville</option>
                          <option>France</option>
                          <option>Belgique</option>
                          <option>USA</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Adresse de livraison / Facturation</label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input
                        type="text"
                        value={formData.address}
                        onChange={(e) => setFormData({...formData, address: e.target.value})}
                        className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-zoya-red"
                        placeholder="Ex: 123 Rue de la Paix, Kinshasa"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Email</label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({...formData, email: e.target.value})}
                          className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-zoya-red"
                          placeholder="jean@example.com"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Téléphone Pour Paiement</label>
                      <div className="relative">
                        <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => setFormData({...formData, phone: e.target.value})}
                          className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-zoya-red"
                          placeholder="Ex: 0812345678"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/10 rounded-xl flex items-center gap-2 text-red-600 text-xs font-bold">
                    <AlertCircle size={14} /> {error}
                  </div>
                )}
              </div>
            )}

            {subStep === 'payment' && (
              <div className="p-8 space-y-8">
                <div className="text-center space-y-2">
                  <h2 className="text-2xl font-poppins font-black text-gray-900 dark:text-white">Validation du Paiement</h2>
                  <p className="text-sm text-gray-500">Sélectionnez votre opérateur Mobile Money.</p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {[
                    { id: 'MPESA', name: 'M-Pesa', desc: 'Vodacom' },
                    { id: 'ORANGE', name: 'Orange Money', desc: 'Orange' },
                    { id: 'AIRTEL', name: 'Airtel Money', desc: 'Airtel' }
                  ].map((provider) => (
                    <button
                      key={provider.id}
                      onClick={() => setSelectedProvider(provider.id as any)}
                      className={cn(
                        "p-6 rounded-3xl border-2 transition-all flex items-center justify-between group",
                        selectedProvider === provider.id 
                          ? "border-zoya-red bg-zoya-red/5" 
                          : "border-gray-100 dark:border-gray-800 hover:border-gray-200"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-12 h-12 bg-white dark:bg-gray-800 rounded-2xl flex items-center justify-center shadow-sm transition-colors",
                          selectedProvider === provider.id ? "bg-white" : ""
                        )}>
                          <Smartphone className={selectedProvider === provider.id ? "text-zoya-red" : "text-gray-400"} size={24} />
                        </div>
                        <div className="text-left">
                          <p className="font-black text-gray-900 dark:text-white">{provider.name}</p>
                          <p className="text-xs text-gray-500">{provider.desc}</p>
                        </div>
                      </div>
                      <div className={cn(
                        "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                        selectedProvider === provider.id ? "border-zoya-red" : "border-gray-200"
                      )}>
                        {selectedProvider === provider.id && <div className="w-3 h-3 bg-zoya-red rounded-full" />}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-3xl space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 font-bold">Prix de l'abonnement</span>
                    <span className="font-black text-gray-900 dark:text-white">{safePrice.toLocaleString()} {currency}</span>
                  </div>
                  {safeVatRate > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 font-bold text-xs">Taxes Applicables (TVA {safeVatRate}%)</span>
                      <span className="font-black text-gray-900 dark:text-white">{vatAmount.toLocaleString()} {currency}</span>
                    </div>
                  )}
                  {safeFeeRate > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 font-bold text-xs">Frais de transaction ZoyaPay ({safeFeeRate}%)</span>
                      <span className="font-black text-gray-900 dark:text-white">{transactionFeeAmount.toLocaleString()} {currency}</span>
                    </div>
                  )}
                  <div className="pt-3 border-t border-gray-200 dark:border-gray-700 flex justify-between">
                    <span className="font-black text-gray-900 dark:text-white uppercase tracking-tighter text-lg">Montant à Payer</span>
                    <span className="font-black text-zoya-red text-2xl">{totalPrice.toLocaleString()} {currency}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-900/30">
                    <AlertCircle size={14} className="text-amber-500 shrink-0" />
                    <p className="text-[9px] font-bold text-amber-700 dark:text-amber-400 leading-tight">
                      Note : Un prompt apparaîtra sur votre téléphone pour confirmer le paiement.
                    </p>
                  </div>
                </div>

                {error && (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-2xl text-xs font-bold flex items-center gap-2">
                    <AlertCircle size={18} /> {error}
                  </div>
                )}
              </div>
            )}

            {paymentState === 'PENDING' && (
              <div className="p-12 text-center space-y-8">
                <div className="relative w-24 h-24 mx-auto mb-2">
                   <div className="absolute inset-0 border-4 border-zoya-red/10 rounded-full" />
                   <div className="absolute inset-0 border-4 border-zoya-red border-t-transparent rounded-full animate-spin" />
                   <div className="absolute inset-0 flex items-center justify-center text-zoya-red">
                      <Lock size={32} />
                   </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-poppins font-black text-gray-900 dark:text-white">Initialisation...</h3>
                  <p className="text-gray-500 font-medium">Connexion au serveur...</p>
                </div>
              </div>
            )}
            {paymentState === 'AWAITING_USER' && (
              <div className="p-12 text-center space-y-8">
                <div className="relative w-24 h-24 mx-auto mb-2">
                   <div className="absolute inset-0 border-4 border-zoya-red/10 rounded-full" />
                   <div className="absolute inset-0 border-4 border-zoya-red border-t-transparent rounded-full animate-spin" />
                   <div className="absolute inset-0 flex items-center justify-center text-zoya-red">
                      <Smartphone size={32} />
                   </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-poppins font-black text-gray-900 dark:text-white">Validez sur votre téléphone</h3>
                  <p className="text-gray-500 font-medium">Entrez votre code secret.</p>
                </div>
              </div>
            )}
            {paymentState === 'PROCESSING' && (
              <div className="p-12 text-center space-y-8">
                <div className="relative w-24 h-24 mx-auto mb-2">
                   <div className="absolute inset-0 border-4 border-zoya-red/10 rounded-full" />
                   <div className="absolute inset-0 border-4 border-zoya-red border-t-transparent rounded-full animate-spin" />
                   <div className="absolute inset-0 flex items-center justify-center text-zoya-red">
                      <Lock size={32} />
                   </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-poppins font-black text-gray-900 dark:text-white">Traitement en cours...</h3>
                  <p className="text-gray-500 font-medium">Synchronisation avec l'opérateur.</p>
                </div>
              </div>
            )}

            {paymentState === 'SUCCESS' && (
              <div className="p-12 text-center space-y-8">
                <motion.div 
                  initial={{ scale: 0.5, rotate: -45 }}
                  animate={{ scale: 1, rotate: 0 }}
                  className="w-40 h-24 mx-auto bg-gradient-to-br from-zoya-red to-rose-700 rounded-3xl shadow-2xl flex flex-col justify-between p-5 text-white relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-12 -mt-12" />
                  <div className="flex justify-between items-start">
                    <Check size={28} className="bg-white text-zoya-red rounded-full p-1" />
                    <Shield size={20} className="text-white/30" />
                  </div>
                  <div className="space-y-1 text-left">
                    <p className="text-[10px] font-bold tracking-widest italic uppercase">ZOYA<span className="text-white/50">PAY</span></p>
                    <p className="text-lg font-black tracking-widest uppercase">APPROUVÉ</p>
                  </div>
                </motion.div>
                
                <div className="space-y-2">
                  <h3 className="text-3xl font-poppins font-black text-gray-900 dark:text-white">Paiement confirmé</h3>
                  <p className="text-gray-500 font-medium">Votre abonnement ZoyaEdge est actif.</p>
                </div>

                <div className="flex flex-col gap-3">
                  <button 
                    onClick={() => window.location.reload()}
                    className="w-full py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl font-black text-lg transition-transform hover:scale-105"
                  >
                    Accéder à ZoyaEdge
                  </button>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">ID: {transactionId || "ZYP-XXXX-XXXX"}</p>
                </div>
              </div>
            )}
            {paymentState === 'TIMEOUT' && (
              <div className="p-12 text-center space-y-8">
                <div className="w-20 h-20 mx-auto bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center text-amber-500">
                  <RefreshCw size={32} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-poppins font-black text-gray-900 dark:text-white">Délai de confirmation prolongé</h3>
                  <p className="text-gray-500 font-medium leading-relaxed">Votre opérateur met plus de temps que prévu.</p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl flex justify-center text-center">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 leading-relaxed">
                    Si vous avez été débité, votre accès sera activé automatiquement.
                  </p>
                </div>
                <button 
                  onClick={() => dispatch({ type: 'STATUS', payload: 'PENDING' })}
                  className="w-full py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl font-black text-lg transition-transform hover:scale-105"
                >
                  Fermer ou réessayer
                </button>
              </div>
            )}

            {paymentState === 'FAILED' && (
              <div className="p-12 text-center space-y-8">
                <div className="w-20 h-20 mx-auto bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-500">
                  <X size={32} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-poppins font-black text-gray-900 dark:text-white">Paiement non confirmé</h3>
                  <p className="text-gray-500 font-medium leading-relaxed">La demande a été annulée ou expirée.</p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl flex justify-center text-center">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Vous pouvez réessayer immédiatement.
                  </p>
                </div>
                <button 
                  onClick={() => { setSubStep('payment'); dispatch({ type: 'STATUS', payload: 'PENDING' }); }}
                  className="w-full py-4 bg-zoya-red text-white rounded-2xl font-black text-lg transition-transform hover:scale-105"
                >
                  Réessayer
                </button>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          {!['SUCCESS', 'FAILED', 'TIMEOUT', 'CANCELLED', 'EXPIRED'].includes(paymentState) && (
            <div className="p-6 bg-gray-50 dark:bg-gray-800/30 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-500">
                <Shield size={14} />
                <span className="text-[10px] font-bold uppercase tracking-widest">ZoyaPay | Sécurisé</span>
              </div>
              <button
                onClick={subStep === 'info' ? handleNext : handlePay}
                disabled={loading}
                className={cn(
                  "px-8 py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl font-black flex items-center gap-2 transition-all",
                  loading ? "opacity-50 cursor-not-allowed" : "hover:scale-105 active:scale-95"
                )}
              >
                {loading ? (
                  <RefreshCw className="animate-spin" size={20} />
                ) : (
                  <>
                    {subStep === 'info' ? 'Étape Suivante' : `Payer ${totalPrice.toLocaleString()} ${currency}`}
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
