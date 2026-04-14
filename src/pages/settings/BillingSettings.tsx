import React from 'react';
import { useAuth } from '../../lib/auth';
import { useTranslation } from '../../lib/i18n';
import { CreditCard, Calendar, Clock, AlertCircle, CheckCircle2, Zap } from 'lucide-react';
import { Link } from 'react-router';
import { cn } from '../../lib/utils';
import { motion } from 'motion/react';

export default function BillingSettings() {
  const { profile } = useAuth();
  const { t } = useTranslation();

  const isFree = !profile?.subscription || profile.subscription === 'free';
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
    </div>
  );
}
