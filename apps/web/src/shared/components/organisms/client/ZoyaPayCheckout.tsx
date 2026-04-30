import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Shield, CreditCard, ChevronRight, Check, MapPin, User, Mail, Smartphone, ArrowRight, Lock, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@shared/lib/utils';
import { useAuth } from '@shared/lib/auth';
import { db } from '@shared/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { COUNTRIES } from '@shared/lib/countries';

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
  if (!status) return 'PENDING';
  const s = status.toUpperCase();
  
  if (s.includes('SUCCESS') || s.includes('COMPLET') || s.includes('PAID') || s.includes('APPROV') || s === '200' || s === 'OK') {
    return 'SUCCESS';
  }
  
  if (s.includes('FAIL') || s.includes('ERR') || s.includes('REJECT') || s.includes('DECLIN') || s.includes('STOP') || s.includes('DENY')) {
    return 'FAILED';
  }
  
  if (s.includes('CANCEL') || s.includes('VOID') || s.includes('ABORT')) {
    return 'CANCELLED';
  }
  
  if (s.includes('EXPIRE') || s.includes('TIMEOUT')) {
    return 'EXPIRED';
  }
  
  if (s.includes('PROGRESS') || s.includes('PROCESS') || s.includes('SENDING')) {
    return 'PROCESSING';
  }
  
  if (s.includes('WAIT') || s.includes('AWAIT') || s.includes('USER') || s.includes('PIN') || s.includes('PENDING')) {
    return 'AWAITING_USER';
  }
  
  return 'PENDING';
}

function paymentReducer(state: PaymentState, event: any): PaymentState {
  switch (state) {
    case 'IDLE':
      if (event.type === 'START') return 'PENDING';
      if (event.type === 'STATUS') return event.payload;
      return state;
    case 'PENDING':
    case 'AWAITING_USER':
    case 'PROCESSING':
      if (event.type === 'STATUS') return event.payload;
      return state;
    case 'FAILED':
    case 'CANCELLED':
    case 'TIMEOUT':
      if (event.type === 'RESET') return 'IDLE';
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
  const [prefixes, setPrefixes] = useState({
    MPESA: ['81', '82', '83'],
    ORANGE: ['89', '84', '85'],
    AIRTEL: ['97', '98', '99']
  });
  const [detectedProvider, setDetectedProvider] = useState<'MPESA' | 'ORANGE' | 'AIRTEL' | null>(null);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [pollingAttempt, setPollingAttempt] = useState(0);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const isPolling = useRef(false);
  const paymentStateRef = useRef<PaymentState>('IDLE');

  useEffect(() => {
    paymentStateRef.current = paymentState;
  }, [paymentState]);

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

  // Fetch operator prefixes from Firestore
  useEffect(() => {
    const fetchPrefixes = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'app_settings', 'global'));
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.mpesaPrefixes || data.orangePrefixes || data.airtelPrefixes) {
            setPrefixes({
              MPESA: data.mpesaPrefixes ? data.mpesaPrefixes.split(',').map((s: string) => s.trim()) : ['81', '82', '83'],
              ORANGE: data.orangePrefixes ? data.orangePrefixes.split(',').map((s: string = '') => s.trim()) : ['89', '84', '85'],
              AIRTEL: data.airtelPrefixes ? data.airtelPrefixes.split(',').map((s: string) => s.trim()) : ['97', '98', '99']
            });
          }
        }
      } catch (err) {
        console.error("Failed to load prefixes", err);
      }
    };
    fetchPrefixes();
  }, []);

  const validatePhone = (phone: string) => {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('243')) return cleaned.slice(0, 12);
    if (cleaned.startsWith('0')) return '243' + cleaned.slice(1, 10);
    if (cleaned.length === 9) return '243' + cleaned;
    return cleaned;
  };

  useEffect(() => {
    const cleaned = validatePhone(formData.phone);
    if (cleaned.length === 12 && cleaned.startsWith('243')) {
      const prefix = cleaned.substring(3, 5);
      let provider = null;
      if (prefixes.MPESA.includes(prefix)) provider = 'MPESA';
      else if (prefixes.ORANGE.includes(prefix)) provider = 'ORANGE';
      else if (prefixes.AIRTEL.includes(prefix)) provider = 'AIRTEL';
      setDetectedProvider(provider as any);
    } else {
      setDetectedProvider(null);
    }
  }, [formData.phone, prefixes]);

  const handleNext = () => {
    if (!formData.fullName || !formData.email || !formData.phone || !formData.address) {
      setError("Veuillez remplir tous les champs obligatoires.");
      return;
    }
    
    const cleaned = validatePhone(formData.phone);
    if (cleaned.length !== 12 || !cleaned.startsWith('243')) {
      setError("Format de téléphone invalide pour DR Congo. (Ex: 0812345678 ou 243812345678)");
      return;
    }
    
    if (!detectedProvider) {
      const prefix = cleaned.substring(3, 5);
      setError(`L'opérateur du numéro (${prefix}) n'est pas reconnu. Les réseaux acceptés sont : M-Pesa, Orange, Airtel.`);
      return;
    }

    setError("");
    setSubStep('payment');
  };

  useEffect(() => {
    if (paymentState !== 'IDLE') setSubStep('payment-done');
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

  // Résilience iPhone : Reprendre le polling au retour de la connexion ou au focus
  useEffect(() => {
    const handleReappear = () => {
      console.log("[ZoyaPay] Browser active or online, ensuring status check...");
      if (transactionId && !isPolling.current && !['SUCCESS', 'FAILED', 'CANCELLED', 'EXPIRED'].includes(paymentStateRef.current)) {
         // Déclencher un check immédiat si possible ou forcer le re-mount du poller
         // On peut simplement forcer un re-mount en changeant une petite clé d'état
         setPollingAttempt(prev => prev + 1);
       }
    };
    window.addEventListener('online', handleReappear);
    window.addEventListener('focus', handleReappear);
    return () => {
      window.removeEventListener('online', handleReappear);
      window.removeEventListener('focus', handleReappear);
    };
  }, [transactionId]);

  // Polling Effect - Client side check connected to Server side worker
  useEffect(() => {
    if (!transactionId) return;
    if (isPolling.current) return;

    isPolling.current = true;
    let attempts = 0;

    const interval = setInterval(async () => {
      attempts++;

      const current = paymentStateRef.current;
      if (['SUCCESS', 'FAILED', 'CANCELLED', 'TIMEOUT', 'EXPIRED'].includes(current)) {
        clearInterval(interval);
        isPolling.current = false;
        return;
      }

      try {
        const idToken = await user?.getIdToken();
        const response = await fetch(`/api/user/sync-status/${transactionId}`, {
          headers: { 'Authorization': `Bearer ${idToken}` }
        });
        
        if (!response.ok) {
          console.warn('[Polling] Server unreachable or error:', response.status);
          // Si on a un transactionId, on suppose au moins qu'on attend l'utilisateur
          if (current === 'PENDING') {
            dispatch({ type: 'STATUS', payload: 'AWAITING_USER' });
          }
          return;
        }

        const data = await response.json();
        
        // Priorité : _statusText (normalisé serveur) > status brut
        const rawStatus = data._statusText || data.status;
        const normalized = normalizeStatus(rawStatus);
        const mapped = mapBackendStatus(normalized);
        const msg = data._statusMessage || data.statusDescription || data.message;

        if (msg) setStatusMessage(msg);

        console.log('[ZoyaPay Polling Details]', { 
          attempts, 
          rawStatus, 
          normalized, 
          mapped, 
          current, 
          msg,
          fullResponse: data
        });

        // Dispatch uniquement sur changement ou état terminal
        if (['SUCCESS', 'FAILED', 'CANCELLED', 'EXPIRED'].includes(mapped)) {
          console.log('[ZoyaPay] Terminal Status reached:', mapped);
          clearInterval(interval);
          isPolling.current = false;
          dispatch({ type: 'STATUS', payload: mapped });
          return;
        }
        
        // Si on est encore en PENDING côté client mais qu'on a déjà un ID, 
        // on devrait au moins être en AWAITING_USER ou PROCESSING
        let finalMapped = mapped;
        if (finalMapped === 'PENDING' && transactionId) {
          finalMapped = 'AWAITING_USER';
        }

        if (finalMapped !== current) {
          dispatch({ type: 'STATUS', payload: finalMapped });
        }

      } catch (err) {
        console.error('[Polling] Network error:', err);
      }

      if (attempts >= 120) { // 6 minutes max en production (Araka peut être lent)
        clearInterval(interval);
        isPolling.current = false;
        dispatch({ type: 'STATUS', payload: 'TIMEOUT' });
      }
    }, 3000);

    pollingRef.current = interval;

    return () => {
      if (interval) clearInterval(interval);
      isPolling.current = false;
    };
  }, [transactionId, pollingAttempt]); // transactionId pour démarrer, pollingAttempt pour forcer un restart si besoin

  const handleUserCancel = () => {
    setTransactionId(null);
    isPolling.current = false;
    if (pollingRef.current) clearInterval(pollingRef.current);
    dispatch({ type: 'STATUS', payload: 'CANCELLED' });
    setError("");
    setStatusMessage(null);
  };

  const handleRetryAfterNetworkError = async () => {
    setError("");
    setLoading(true);
    try {
      const idToken = await user?.getIdToken();
      // Check for recent pending payment instead of blindly retrying pay
      const response = await fetch('/api/user/sync-status/latest', {
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.transactionId) {
          setTransactionId(data.transactionId);
          dispatch({ type: 'START', payload: null });
          setLoading(false);
          return;
        }
      }
    } catch (e) {
      console.warn("Recovery failed, falling back to full retry", e);
    }
    handlePay();
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

    if (!detectedProvider) {
      setError("Opérateur non détecté.");
      setLoading(false);
      return;
    }

    try {
      const idToken = await user?.getIdToken();
      if (!idToken) {
        throw new Error("Authentification requise. Veuillez vous reconnecter.");
      }
      
      setError("");
      
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
          provider: detectedProvider,
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
           errMsg = "Format de requête invalide ou URL malformée. Veuillez contacter le support technique.";
        }
        throw new Error(errMsg);
      }

      const result = await response.json();
      setTransactionId(result.transactionId);
      setStatusMessage("Requête envoyée. Surveillez votre téléphone...");
      dispatch({ type: 'STATUS', payload: 'AWAITING_USER' });
    } catch (err: any) {
      console.error("[ZoyaPayCheckout] Fetch Exception detailed:", {
        message: err.message,
        name: err.name,
        stack: err.stack,
        url: '/api/user/sync-settings'
      });
      
      const isNetworkError = err instanceof TypeError && (err.message === 'Failed to fetch' || err.message === 'Load failed' || err.message === 'NetworkError when attempting to fetch resource');
      
      if (isNetworkError) {
         setStatusMessage("Connexion mobile instable détectée... Synchronisation avec le serveur en cours.");
         // Tentative de récupération automatique
         handleRetryAfterNetworkError();
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
            {paymentState === 'IDLE' ? (
              <>
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
                      {totalPrice.toLocaleString()} {currency}
                    </p>
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
                          <option value="">Sélectionner...</option>
                          {COUNTRIES.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
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
                      <div className="flex items-center justify-between ml-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Téléphone Pour Paiement</label>
                        {detectedProvider && (
                          <span className="text-[10px] font-black text-zoya-red uppercase tracking-widest">
                            {detectedProvider === 'MPESA' ? 'M-Pesa' : detectedProvider === 'ORANGE' ? 'Orange Money' : 'Airtel Money'}
                          </span>
                        )}
                      </div>
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
                  <p className="text-sm text-gray-500">Un récapitulatif de votre paiement avant confirmation.</p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {(() => {
                    const providerDetails = {
                      MPESA: { name: 'M-Pesa', desc: 'Vodacom' },
                      ORANGE: { name: 'Orange Money', desc: 'Orange' },
                      AIRTEL: { name: 'Airtel Money', desc: 'Airtel' }
                    }[detectedProvider as 'MPESA' | 'ORANGE' | 'AIRTEL'];
                    
                    if (!providerDetails) return null;

                    return (
                      <div className="p-6 rounded-3xl border-2 border-zoya-red bg-zoya-red/5 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                            <Smartphone className="text-zoya-red" size={24} />
                          </div>
                          <div className="text-left">
                            <p className="font-black text-gray-900 dark:text-white flex items-center gap-2">
                              {providerDetails.name}
                              <span className="px-2 py-0.5 bg-zoya-red/10 text-zoya-red rounded border border-zoya-red/20 text-[10px] tracking-widest uppercase">Détecté</span>
                            </p>
                            <p className="text-xs text-gray-500 text-left w-full block mt-0.5">{providerDetails.desc} - {formData.phone}</p>
                          </div>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-zoya-red flex items-center justify-center text-white">
                          <Check size={16} />
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-3xl space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Abonnement</p>
                      <p className="text-xs text-gray-500 font-bold">Montant global de la transaction</p>
                    </div>
                    <span className="font-black text-zoya-red text-2xl">{totalPrice.toLocaleString()} {currency}</span>
                  </div>
                  
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
                    <div className="flex items-start gap-2">
                      <Shield size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                      <p className="text-[9px] font-bold text-gray-600 dark:text-gray-400 leading-tight">
                        Un prompt de validation apparaîtra sur votre téléphone pour confirmer la transaction.
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-[9px] font-bold text-amber-700 dark:text-amber-400 leading-tight">
                        Des frais de service propres à votre opérateur mobile peuvent s’appliquer lors de cette transaction.
                      </p>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="p-6 bg-red-50 dark:bg-red-900/10 rounded-2xl flex flex-col items-center gap-4 text-center border border-red-100 dark:border-red-900/30">
                    <div className="flex items-center gap-3">
                       <AlertCircle className="text-red-600 shrink-0" size={20} />
                       <p className="text-sm font-bold text-red-600 leading-relaxed max-w-sm">
                         {error}
                       </p>
                    </div>

                    <div className="flex flex-wrap justify-center gap-3">
                      <button
                        onClick={() => {
                          isPolling.current = false;
                          setTransactionId(null);
                          handleRetryAfterNetworkError();
                        }}
                        className="px-6 py-2.5 bg-zoya-red text-white text-xs font-black rounded-full hover:bg-red-600 transition-colors shadow-lg shadow-zoya-red/20 active:scale-95 flex items-center gap-2"
                      >
                        <RefreshCw size={14} className={cn(loading && "animate-spin")} />
                        RÉESSAYER / RÉCUPÉRER
                      </button>
                      <button
                        onClick={() => {
                          isPolling.current = false;
                          setTransactionId(null);
                          handleUserCancel();
                        }}
                        className="px-6 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-500 text-xs font-black rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors active:scale-95"
                      >
                        ANNULER
                      </button>
                    </div>

                    <p className="text-[10px] text-gray-500 font-medium max-w-xs">
                      Si vous avez déjà reçu le prompt Mobile Money sur votre téléphone, cliquez sur <b>RÉESSAYER / RÉCUPÉRER</b>.
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
              <>
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
                <button
                  onClick={handleUserCancel}
                  className="mt-4 text-sm font-bold text-gray-400 hover:text-zoya-red transition-colors flex items-center gap-2 mx-auto"
                >
                  <X size={14} /> Annuler la transaction
                </button>
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
                  {statusMessage && (
                    <p className="mt-2 text-xs font-bold text-zoya-red uppercase tracking-widest animate-pulse">
                      {statusMessage}
                    </p>
                  )}
                </div>
                <button
                  onClick={handleUserCancel}
                  className="mt-4 text-sm font-bold text-gray-400 hover:text-zoya-red transition-colors flex items-center gap-2 mx-auto"
                >
                  <X size={14} /> Annuler la transaction
                </button>
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
                  {statusMessage && (
                    <p className="mt-2 text-xs font-bold text-zoya-red uppercase tracking-widest animate-pulse">
                      {statusMessage}
                    </p>
                  )}
                </div>
                <button
                  onClick={handleUserCancel}
                  className="mt-4 text-sm font-bold text-gray-400 hover:text-zoya-red transition-colors flex items-center gap-2 mx-auto"
                >
                  <X size={14} /> Annuler la transaction
                </button>
              </div>
            )}

            {paymentState === 'SUCCESS' && (
              <div className="p-12 text-center space-y-8">
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 20 }}
                  className="w-28 h-28 mx-auto bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30"
                >
                  <motion.svg 
                    className="w-14 h-14 text-white" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="4" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <motion.path
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 1 }}
                      transition={{ delay: 0.2, duration: 0.6, ease: "easeOut" }}
                      d="M20 6L9 17l-5-5"
                    />
                  </motion.svg>
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
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={() => { 
                      isPolling.current = false;
                      setTransactionId(null); 
                      setSubStep('payment'); 
                      dispatch({ type: 'RESET', payload: null }); 
                    }}
                    className="w-full py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl font-black text-lg transition-transform hover:scale-105"
                  >
                    Réessayer la vérification
                  </button>
                  <button 
                    onClick={onClose}
                    className="w-full py-3 text-gray-500 font-bold text-xs uppercase tracking-widest hover:text-zoya-red transition-colors"
                  >
                    Retour aux abonnements
                  </button>
                </div>
              </div>
            )}

            {(paymentState === 'FAILED' || paymentState === 'CANCELLED') && (
              <div className="p-12 text-center space-y-8">
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 20 }}
                  className="w-28 h-28 mx-auto bg-red-500 rounded-full flex items-center justify-center shadow-lg shadow-red-500/30"
                >
                  <motion.svg 
                    className="w-14 h-14 text-white" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="4" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <motion.path
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 1 }}
                      transition={{ delay: 0.2, duration: 0.4, ease: "easeOut" }}
                      d="M18 6L6 18"
                    />
                    <motion.path
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 1 }}
                      transition={{ delay: 0.4, duration: 0.4, ease: "easeOut" }}
                      d="M6 6l12 12"
                    />
                  </motion.svg>
                </motion.div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-poppins font-black text-gray-900 dark:text-white">
                    {paymentState === 'CANCELLED' ? 'Paiement annulé' : 'Échec du paiement'}
                  </h3>
                  <p className="text-gray-500 font-medium leading-relaxed">
                    {paymentState === 'CANCELLED' 
                      ? 'Vous avez annulé la transaction.' 
                      : 'La transaction a été rejetée ou une erreur est survenue.'}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl flex justify-center text-center">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Vous pouvez réessayer immédiatement.
                  </p>
                </div>
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={() => { 
                      isPolling.current = false;
                      setTransactionId(null); 
                      setSubStep('payment'); 
                      dispatch({ type: 'RESET', payload: null }); 
                    }}
                    className="w-full py-4 bg-zoya-red text-white rounded-2xl font-black text-lg transition-transform hover:scale-105"
                  >
                    Réessayer
                  </button>
                  <button 
                    onClick={onClose}
                    className="w-full py-3 text-gray-500 font-bold text-xs uppercase tracking-widest hover:text-zoya-red transition-colors"
                  >
                    Retour aux abonnements
                  </button>
                </div>
              </div>
            )}

            {paymentState === 'EXPIRED' && (
              <div className="p-12 text-center space-y-8">
                <div className="w-20 h-20 mx-auto bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-500">
                  <RefreshCw size={32} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-poppins font-black text-gray-900 dark:text-white">Session expirée</h3>
                  <p className="text-gray-500 font-medium leading-relaxed">
                    Cette session de paiement a expiré. Veuillez recommencer.
                  </p>
                </div>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => { 
                      isPolling.current = false;
                      setTransactionId(null); 
                      setSubStep('info'); 
                      dispatch({ type: 'RESET', payload: null }); 
                    }}
                    className="w-full py-4 bg-zoya-red text-white rounded-2xl font-black text-lg transition-transform hover:scale-105"
                  >
                    Recommencer
                  </button>
                  <button 
                    onClick={onClose}
                    className="w-full py-3 text-gray-500 font-bold text-xs uppercase tracking-widest hover:text-zoya-red transition-colors"
                  >
                    Retour aux abonnements
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

          {/* Footer Actions */}
          {paymentState === 'IDLE' && (
            <div className="p-6 bg-gray-50 dark:bg-gray-800/30 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <button
                onClick={subStep === 'info' ? onClose : () => setSubStep('info')}
                className="flex items-center gap-2 text-gray-500 hover:text-zoya-red transition-colors active:scale-95"
              >
                <ChevronRight size={16} className="rotate-180" />
                <span className="text-[10px] font-black uppercase tracking-widest">
                  {subStep === 'info' ? 'Abonnements' : 'Précédent'}
                </span>
              </button>
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
                    {subStep === 'info' ? 'Payer' : `Confirmer le Paiement`}
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
