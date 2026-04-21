import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/auth';
import { useTranslation } from '../../lib/i18n';
import { CreditCard, Calendar, Clock, AlertCircle, CheckCircle2, Zap, Download, Wallet, FileText } from 'lucide-react';
import { Link } from 'react-router';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { generateInvoicePDF } from '../../lib/invoice';

interface Transaction {
  id: string;
  amount: number;
  currency: string;
  status: 'completed' | 'pending' | 'failed' | 'refunded';
  plan: string;
  method: string;
  fee?: number;
  vat?: number;
  vatRate?: number;
  feeRate?: number;
  createdAt: Timestamp;
}

export default function BillingSettings() {
  const { profile, user } = useAuth();
  const { t } = useTranslation();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'payments'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Transaction);
      setTransactions(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const isFree = !profile?.subscription || profile.subscription === 'discovery' || profile.subscription === 'free';
  const isPremium = profile?.subscription === 'premium';
  const isPro = profile?.subscription === 'pro';

  const endDate = profile?.subscriptionEndDate?.toDate ? profile.subscriptionEndDate.toDate() : (profile?.subscriptionEndDate ? new Date(profile.subscriptionEndDate) : null);
  
  const calculateDaysRemaining = () => {
    if (!endDate) return 0;
    const now = new Date();
    const diff = endDate.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const daysRemaining = calculateDaysRemaining();
  const isExpired = profile?.subscriptionStatus === 'expired' || (endDate && daysRemaining === 0);

  const handleDownloadInvoice = (tx: Transaction) => {
    // Calculer le sous-total HT si non enregistré (pour compatibilité ancienne)
    const vatRate = tx.vatRate || 16;
    const feeRate = tx.feeRate || 2;
    
    // Reverse calculation if fields are missing
    const totalAmount = tx.amount;
    const feeAmount = tx.fee || (totalAmount * feeRate) / (100 + feeRate);
    const amountAfterFees = totalAmount - feeAmount;
    const vatAmount = tx.vat || (amountAfterFees * vatRate) / (100 + vatRate);
    const subtotal = amountAfterFees - vatAmount;

    generateInvoicePDF({
      invoiceNumber: `ZE-${new Date().getFullYear()}-${tx.id.slice(0, 8).toUpperCase()}`,
      date: format(tx.createdAt.toDate(), 'dd/MM/yyyy'),
      clientName: profile?.displayName || user?.email?.split('@')[0] || 'Client ZoyaEdge',
      clientEmail: user?.email || '',
      planName: tx.plan,
      subtotal: subtotal,
      vat: vatAmount,
      vatRate: vatRate,
      fee: feeAmount,
      feeRate: feeRate,
      amount: tx.amount,
      currency: tx.currency,
      status: tx.status,
      paymentMethod: tx.method
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-poppins font-black text-gray-900 dark:text-white">Abonnement & Facturation</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">Gérez votre plan actuel et vos informations de paiement.</p>
      </div>

      {/* Current Plan Card */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "p-6 rounded-3xl border shadow-lg relative overflow-hidden",
          isPremium ? "bg-gradient-to-br from-zoya-red to-orange-500 text-white border-transparent" :
          isPro ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-transparent" :
          "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700"
        )}
      >
        {isPremium && (
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        )}

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="text-2xl font-poppins font-black uppercase tracking-wider">
                Plan {profile?.subscription || 'Free'}
              </h3>
              {!isFree && (
                <span className={cn(
                  "text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider",
                  isPremium ? "bg-white/20 text-white" : "bg-white/20 dark:bg-black/10"
                )}>
                  {profile?.subscriptionCycle === 'yearly' ? 'Annuel' : 'Mensuel'}
                </span>
              )}
            </div>
            
            {isFree ? (
              <p className={cn("text-sm", isPremium ? "text-white/80" : "text-gray-500 dark:text-gray-400")}>
                Vous utilisez actuellement la version gratuite de ZoyaEdge.
              </p>
            ) : (
              <div className="flex items-center gap-4 text-sm font-medium">
                <div className="flex items-center gap-1.5">
                  {isExpired ? (
                    <AlertCircle size={16} className={isPremium ? "text-white" : "text-rose-500"} />
                  ) : profile?.subscriptionStatus === 'trialing' ? (
                    <Zap size={16} className={isPremium ? "text-white" : "text-emerald-500"} />
                  ) : (
                    <CheckCircle2 size={16} className={isPremium ? "text-white" : "text-emerald-500"} />
                  )}
                  <span className={cn(
                    isPremium ? "text-white/90" : 
                    isExpired ? "text-rose-500" : 
                    profile?.subscriptionStatus === 'trialing' ? "text-emerald-500 font-bold" : "text-emerald-600 dark:text-emerald-400"
                  )}>
                    {isExpired ? 'Expiré' : profile?.subscriptionStatus === 'trialing' ? 'Essai en cours' : 'Actif'}
                  </span>
                </div>
                {endDate && (
                  <div className="flex items-center gap-1.5 opacity-80">
                    <Clock size={16} />
                    <span>{daysRemaining} jours restants</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="shrink-0">
            {isFree ? (
              <Link 
                to="/subscription"
                className="inline-flex items-center gap-2 bg-zoya-red text-white px-6 py-3 rounded-xl font-bold hover:bg-zoya-red-dark transition-colors shadow-lg shadow-zoya-red/20"
              >
                <Zap size={18} />
                Mettre à niveau
              </Link>
            ) : (
              <Link 
                to="/subscription"
                className={cn(
                  "inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-colors shadow-lg",
                  isPremium ? "bg-white text-zoya-red hover:bg-gray-50" : "bg-zoya-red text-white hover:bg-zoya-red-dark shadow-zoya-red/20"
                )}
              >
                <CreditCard size={18} />
                {isExpired ? 'Réactiver' : 'Gérer l\'abonnement'}
              </Link>
            )}
          </div>
        </div>
      </motion.div>

      {/* Details Section */}
      {!isFree && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-6">
          <h4 className="font-poppins font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Calendar size={18} className="text-gray-400" />
            Détails de facturation
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase mb-1">Date de fin / Renouvellement</p>
              <p className="text-gray-900 dark:text-white font-medium">
                {endDate ? endDate.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase mb-1">Cycle de facturation</p>
              <p className="text-gray-900 dark:text-white font-medium capitalize">
                {profile?.subscriptionCycle === 'yearly' ? 'Annuel' : 'Mensuel'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Transactions History */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-poppins font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Clock size={18} className="text-gray-400" />
            Historique des transactions
          </h4>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-12 text-center">
               <div className="w-8 h-8 border-4 border-zoya-red border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : transactions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900/50 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    <th className="px-6 py-4">Transaction</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Montant</th>
                    <th className="px-6 py-4 text-right">Facture</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="text-sm">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-gray-900 dark:text-white uppercase tracking-tight">Plan {tx.plan}</span>
                            <span className="text-[10px] text-gray-400 font-mono">- {profile?.displayName || 'Client'}</span>
                          </div>
                          <span className="text-[10px] text-gray-400 font-mono">Ref: {tx.id.slice(0, 8)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                        {format(tx.createdAt.toDate(), 'dd MMM yyyy', { locale: fr })}
                      </td>
                      <td className="px-6 py-4 font-black text-gray-900 dark:text-white">
                        {tx.amount.toLocaleString()} {tx.currency}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {tx.status === 'completed' ? (
                          <button 
                            onClick={() => handleDownloadInvoice(tx)}
                            className="p-2 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-all"
                            title="Télécharger la facture"
                          >
                            <FileText size={18} />
                          </button>
                        ) : (
                          <span className="text-[10px] font-black text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-lg">
                            {tx.status}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center text-gray-500">
              <Wallet size={32} className="mx-auto mb-4 opacity-20" />
              <p className="font-bold">Aucune transaction trouvée.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
