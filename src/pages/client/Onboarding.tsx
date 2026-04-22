import React, { useState, useEffect, useMemo } from 'react';
import { useAuth, OnboardingStep, OnboardingState } from '../../lib/auth';
import { useTranslation } from '../../lib/i18n';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Target, TrendingUp, ShieldCheck, ArrowRight, ArrowLeft, 
  Loader2, BadgeInfo, AlertTriangle, BrainCircuit, Activity,
  LineChart, Sparkles, Plus, Upload, Coins, Zap, BarChart3, Gem, Clock, Bitcoin,
  LogOut, Home
} from 'lucide-react';
import { useNavigate } from 'react-router';
import toast from 'react-hot-toast';
import TradeForm from '../../components/organisms/client/TradeForm';
import CSVUploader from '../../components/organisms/client/CSVUploader';
import { calculateZoyaScores } from '../../lib/scoring';
import { logActivity } from '../../lib/activity';
import { cn } from '../../lib/utils';
import { useUserTrades } from '../../hooks/useUserTrades';

export default function Onboarding() {
  const { user, updateProfile, profile, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  // Real-time trades sync
  const { trades, tradesCount, loading: tradesLoading } = useUserTrades(user?.uid);

  // Local state for internal sub-steps of PROFILE
  const [profileSubStep, setProfileSubStep] = useState(1);
  
  // State Machine logic
  const [onboardingState, setOnboardingState] = useState<OnboardingState>({
    step: 'PROFILE',
    tradesCount: 0,
    skipped: false,
    completed: false
  });

  const [loading, setLoading] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [formData, setFormData] = useState({
    tradingStyle: '',
    experienceLevel: 'beginner' as const,
    capitalSize: '1000',
    currency: 'USD',
    defaultRisk: 1,
    defaultLotSize: 0.1,
    assetTypes: [] as string[]
  });

  // Sync profile values if they exist
  useEffect(() => {
    if (profile) {
      setFormData(prev => ({
        ...prev,
        tradingStyle: profile.tradingStyle || prev.tradingStyle,
        experienceLevel: profile.experienceLevel || prev.experienceLevel,
        capitalSize: profile.capitalSize || prev.capitalSize,
        assetTypes: profile.assetTypes || prev.assetTypes
      }));
      if (profile.onboardingState) {
        setOnboardingState(profile.onboardingState);
      }
    }
  }, [profile]);

  // Sync trades count to state
  useEffect(() => {
    setOnboardingState(prev => ({ ...prev, tradesCount }));
  }, [tradesCount]);

  const updateOnboardingInFirestore = async (newState: Partial<OnboardingState>) => {
    const updated = { ...onboardingState, ...newState };
    setOnboardingState(updated);
    try {
      await updateProfile({ onboardingState: updated });
    } catch (err: any) {
      console.error("Failed to sync onboarding state:", err);
      toast.error(`Erreur de synchro : ${err.message}`);
    }
  };

  const nextStep = async () => {
    if (onboardingState.step === 'PROFILE') {
      if (profileSubStep === 1) {
        setProfileSubStep(2);
      } else {
        await updateOnboardingInFirestore({ step: 'ADD_TRADES' });
        logActivity(user?.uid || '', 'onboarding_step', { from: 'PROFILE', to: 'ADD_TRADES' });
      }
    } else if (onboardingState.step === 'ADD_TRADES') {
      await updateOnboardingInFirestore({ step: 'AI_ANALYSIS' });
      logActivity(user?.uid || '', 'onboarding_step', { from: 'ADD_TRADES', to: 'AI_ANALYSIS' });
    } else if (onboardingState.step === 'AI_ANALYSIS') {
      await updateOnboardingInFirestore({ step: 'COMPLETED' });
      logActivity(user?.uid || '', 'onboarding_step', { from: 'AI_ANALYSIS', to: 'COMPLETED' });
    }
  };

  const prevStep = () => {
    if (onboardingState.step === 'PROFILE' && profileSubStep === 2) {
      setProfileSubStep(1);
    } else if (onboardingState.step === 'ADD_TRADES') {
      setOnboardingState(prev => ({ ...prev, step: 'PROFILE' }));
      setProfileSubStep(2);
    } else if (onboardingState.step === 'AI_ANALYSIS') {
      setOnboardingState(prev => ({ ...prev, step: 'ADD_TRADES' }));
    } else if (onboardingState.step === 'COMPLETED') {
      setOnboardingState(prev => ({ ...prev, step: 'AI_ANALYSIS' }));
    }
  };

  const handleSkip = async () => {
    setLoading(true);
    try {
      await updateOnboardingInFirestore({ 
        skipped: true, 
        step: 'AI_ANALYSIS'
      });
      logActivity(user?.uid || '', 'onboarding_step', { action: 'skip_trades', to: 'AI_ANALYSIS' });
      toast.success("Analyse basée sur vos paramètres de profil uniquement.");
    } catch (error) {
      toast.error("Erreur lors du skip");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/home');
    } catch (err) {
      toast.error("Erreur déconnexion");
    }
  };

  const handleFinish = async () => {
    if (loading) return;
    setLoading(true);
    try {
      console.log("Finalizing onboarding for user:", user?.uid);
      
      // Explicitly set the fields we want to persist
      const profileData = {
        tradingStyle: formData.tradingStyle,
        experienceLevel: formData.experienceLevel,
        capitalSize: formData.capitalSize,
        currency: formData.currency,
        defaultRisk: formData.defaultRisk,
        defaultLotSize: formData.defaultLotSize,
        assetTypes: formData.assetTypes,
        onboarded: true,
        onboardingState: {
          ...onboardingState,
          completed: true
        }
      };

      await updateProfile(profileData);
      
      logActivity(user?.uid || '', 'onboarding_complete');
      toast.success("Configuration terminée ! Bienvenue sur ZoyaEdge.");
      
      // Essential Delay for Firestore propagation
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 1500);
    } catch (error: any) {
      console.error("Onboarding finalization error:", error);
      const detail = error.code ? ` (${error.code})` : "";
      toast.error(`Erreur de permission ou réseau : ${error.message || "Action refusée"}${detail}`, {
        duration: 6000
      });
    } finally {
      // If we are still on the page (error case), allow retrying
      if (window.location.pathname === '/onboarding') {
        setLoading(false);
      }
    }
  };

  const scores = useMemo(() => calculateZoyaScores(trades), [trades]);

  const canContinue = useMemo(() => {
    if (onboardingState.step === 'PROFILE') {
      if (profileSubStep === 1) return formData.tradingStyle && formData.capitalSize;
      if (profileSubStep === 2) return formData.assetTypes.length > 0;
    }
    if (onboardingState.step === 'ADD_TRADES') {
      return tradesCount >= 1 || onboardingState.skipped;
    }
    return true;
  }, [onboardingState, profileSubStep, formData, tradesCount]);

  // Map steps to 1-5 for the progress bar
  const progressValue = useMemo(() => {
    if (onboardingState.step === 'PROFILE') return profileSubStep;
    if (onboardingState.step === 'ADD_TRADES') return 3;
    if (onboardingState.step === 'AI_ANALYSIS') return 4;
    return 5;
  }, [onboardingState.step, profileSubStep]);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 flex flex-col items-center justify-start md:justify-center p-4 md:p-8 overflow-x-hidden">
      {/* Top Navigation for Exit */}
      <div className="flex justify-between items-center w-full max-w-xl mb-6 md:absolute md:top-6 md:left-6 md:right-6 md:max-w-7xl">
         <button 
           onClick={() => navigate('/home')}
           className="flex items-center gap-1.5 text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-gray-900 dark:hover:text-white transition-all bg-gray-50 dark:bg-gray-900 px-3 py-1.5 rounded-full md:bg-transparent md:px-0 md:py-0"
         >
           <Home size={12} />
           <span>Landing</span>
         </button>
         <button 
           onClick={handleLogout}
           className="flex items-center gap-1.5 text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-rose-500 transition-all bg-gray-50 dark:bg-gray-900 px-3 py-1.5 rounded-full md:bg-transparent md:px-0 md:py-0"
         >
           <LogOut size={12} />
           <span>Quitter</span>
         </button>
      </div>

      <div className="max-w-xl w-full">
        {/* Progress Header */}
        <div className="flex flex-col items-center mb-6 md:mb-12 space-y-3 md:space-y-4">
           <div className="flex items-center gap-2 md:gap-3">
              <div className="w-6 h-6 md:w-8 md:h-8 bg-zoya-red rounded-lg flex items-center justify-center text-white font-black text-xs md:text-base">Z</div>
              <span className="font-poppins font-black text-base md:text-xl tracking-tighter uppercase dark:text-white">Setup Control</span>
           </div>
           <div className="flex gap-1.5 w-full max-w-[180px] md:max-w-xs">
              {[1, 2, 3, 4, 5].map((s) => (
                <div
                  key={s}
                  className={`h-0.5 md:h-1 flex-1 rounded-full transition-all duration-700 ${
                    s <= progressValue ? 'bg-zoya-red shadow-[0_0_10px_rgba(239,68,68,0.3)]' : 'bg-gray-100 dark:bg-gray-800'
                  }`}
                />
              ))}
           </div>
        </div>

        <motion.div
          layout
          className={cn(
            "bg-white dark:bg-gray-900 rounded-2xl md:rounded-[2.5rem] shadow-lg md:shadow-2xl p-5 md:p-10 border border-gray-100 dark:border-gray-800 transition-all",
            onboardingState.step === 'ADD_TRADES' && tradesCount === 0 ? "border-amber-500/20" : ""
          )}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={`${onboardingState.step}-${profileSubStep}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* STEP: PROFILE (Sub 1 - Basic Info) */}
              {onboardingState.step === 'PROFILE' && profileSubStep === 1 && (
                <div className="space-y-6">
                  <div className="space-y-1.5">
                    <h1 className="text-lg md:text-3xl font-poppins font-black text-gray-900 dark:text-white uppercase italic leading-tight">VOTRE PROFIL.</h1>
                    <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Environnement de trading actuel.</p>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-gray-400">Capital Initial ($)</label>
                      <input
                        type="number"
                        value={formData.capitalSize}
                        onChange={e => setFormData({ ...formData, capitalSize: e.target.value })}
                        placeholder="Ex: 10000"
                        className="w-full px-4 py-2.5 md:px-6 md:py-4 rounded-xl bg-gray-50 dark:bg-gray-800 border-none text-base md:text-xl font-poppins font-black text-gray-900 dark:text-white focus:ring-1 focus:ring-zoya-red transition-all"
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-gray-400">Expérience</label>
                        <select
                          value={formData.experienceLevel}
                          onChange={e => setFormData({ ...formData, experienceLevel: e.target.value as any })}
                          className="w-full px-4 py-2.5 md:px-6 md:py-4 rounded-xl bg-gray-50 dark:bg-gray-800 border-none font-bold text-xs md:text-base text-gray-900 dark:text-white focus:ring-1 focus:ring-zoya-red transition-all appearance-none"
                        >
                          <option value="beginner">Débutant (0-1 an)</option>
                          <option value="intermediate">Intermédiaire (1-3 ans)</option>
                          <option value="advanced">Avancé (3+ ans)</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-gray-400">Style Dominant</label>
                        <select
                          value={formData.tradingStyle}
                          onChange={e => setFormData({ ...formData, tradingStyle: e.target.value })}
                          className="w-full px-4 py-2.5 md:px-6 md:py-4 rounded-xl bg-gray-50 dark:bg-gray-800 border-none font-bold text-xs md:text-base text-gray-900 dark:text-white focus:ring-1 focus:ring-zoya-red transition-all appearance-none"
                        >
                           <option value="">Sélectionner...</option>
                           <option value="Scalping">Scalping</option>
                           <option value="Day Trading">Day Trading</option>
                           <option value="Swing Trading">Swing Trading</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP: PROFILE (Sub 2 - Assets) */}
              {onboardingState.step === 'PROFILE' && profileSubStep === 2 && (
                <div className="space-y-6">
                  <div className="space-y-1.5 text-center">
                    <h1 className="text-lg md:text-3xl font-poppins font-black text-gray-900 dark:text-white uppercase italic">VOS MARCHÉS.</h1>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Actifs principaux.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    {[
                      { id: 'forex', label: 'Forex', icon: Coins },
                      { id: 'synthetic', label: 'Synthetics', icon: Zap },
                      { id: 'indices', label: 'Indices', icon: BarChart3 },
                      { id: 'commodities', label: 'Commodities', icon: Gem },
                      { id: 'futures', label: 'Futures', icon: Clock },
                      { id: 'crypto', label: 'Crypto', icon: Bitcoin }
                    ].map(asset => {
                      const isActive = formData.assetTypes.includes(asset.id);
                      return (
                        <button
                          key={asset.id}
                          onClick={() => {
                            const newTypes = isActive 
                              ? formData.assetTypes.filter(t => t !== asset.id)
                              : [...formData.assetTypes, asset.id];
                            setFormData({ ...formData, assetTypes: newTypes });
                          }}
                          className={cn(
                            "p-3 md:p-6 rounded-xl md:rounded-3xl border-2 transition-all flex flex-col items-center gap-2",
                            isActive 
                              ? "bg-zoya-red/10 border-zoya-red text-zoya-red shadow-lg shadow-zoya-red/10" 
                              : "bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-400 md:hover:border-gray-200"
                          )}
                        >
                          <asset.icon size={isActive ? 24 : 20} className="transition-all" />
                          <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-center leading-tight">{asset.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STEP: ADD_TRADES */}
              {onboardingState.step === 'ADD_TRADES' && (
                <div className="space-y-6">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 mb-1">
                       <span className="w-1.5 h-1.5 bg-zoya-red rounded-full animate-ping"></span>
                       <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest">Requis</span>
                    </div>
                    <h1 className="text-lg md:text-3xl font-poppins font-black text-gray-900 dark:text-white uppercase italic leading-tight">VOS TRADES.</h1>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                      Minimum <span className="font-black text-gray-900 dark:text-white">1 trade</span> pour calibrer l'IA.
                    </p>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl space-y-3 border border-gray-100 dark:border-gray-700">
                     <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest">
                        <span className="text-gray-500 tracking-tighter">Sync Firestore</span>
                        <span className={cn(tradesCount >= 1 ? "text-emerald-500" : "text-amber-500")}>
                          {tradesCount} / 1
                        </span>
                     </div>
                     <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-900 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, (tradesCount / 1) * 100)}%` }}
                          className={cn(
                            "h-full transition-all duration-500",
                            tradesCount >= 1 ? "bg-emerald-500" : "bg-amber-500"
                          )}
                        />
                     </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                     <button 
                       onClick={() => setShowManualForm(!showManualForm)}
                       className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 font-bold text-xs uppercase tracking-widest"
                     >
                       <Plus size={16} className="text-zoya-red"/>
                       Ajout Manuel
                     </button>
                     <CSVUploader onSuccess={() => {
                        toast.success("Trades importés !");
                        logActivity(user?.uid || '', 'onboarding_trades_imported');
                     }} />
                  </div>

                  {showManualForm && (
                    <motion.div 
                      key="manual-form"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-xl"
                    >
                      <TradeForm onSuccess={() => {
                        setShowManualForm(false);
                        toast.success("Trade ajouté !");
                        logActivity(user?.uid || '', 'onboarding_trade_added');
                      }} />
                    </motion.div>
                  )}

                  <div className="text-center pt-2">
                     <button 
                       onClick={handleSkip}
                       className="text-[9px] font-black text-gray-400 uppercase tracking-widest hover:text-zoya-red"
                     >
                       Skip
                     </button>
                  </div>
                </div>
              )}

              {/* STEP: AI_ANALYSIS */}
              {onboardingState.step === 'AI_ANALYSIS' && (
                <div className="space-y-6">
                  <div className="text-center space-y-2">
                    <div className="inline-flex p-2.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-full text-indigo-600">
                       <BrainCircuit size={24} />
                    </div>
                    <h1 className="text-lg md:text-3xl font-poppins font-black text-gray-900 dark:text-white uppercase italic tracking-tight">SCORE ZOYA.</h1>
                    <p className="text-[10px] md:text-base text-gray-500 dark:text-gray-400 leading-relaxed px-4">
                      {tradesCount === 0 
                        ? "Analyse prédictive."
                        : `Analyse sur ${tradesCount} trades.`
                      }
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                     {[
                       { label: 'RISQUE', value: scores.risk_score, color: 'text-rose-500', icon: ShieldCheck },
                       { label: 'DISC', value: scores.discipline_score, color: 'text-amber-500', icon: Activity },
                       { label: 'COHÉ', value: scores.consistency_score, color: 'text-emerald-500', icon: LineChart }
                     ].map((s, i) => (
                       <div key={i} className="p-3 md:p-6 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 text-center">
                          <div className={cn("inline-flex mb-1", s.color)}><s.icon size={14}/></div>
                          <div className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none truncate">{s.label}</div>
                          <div className={cn("text-xl md:text-3xl font-poppins font-black", s.color)}>{s.value}</div>
                       </div>
                     ))}
                  </div>

                  <div className="p-5 md:p-8 bg-gray-900 rounded-xl md:rounded-[2rem] border border-gray-800">
                     <div className="flex items-center gap-2.5 mb-3">
                        <div className={cn(
                          "w-2 h-2 rounded-full animate-pulse",
                          scores.status === 'red' ? "bg-rose-500" : scores.status === 'orange' ? "bg-amber-500" : "bg-emerald-500"
                        )} />
                        <span className="text-gray-500 text-[9px] font-black uppercase tracking-widest">COACH IA</span>
                     </div>
                     <p className="text-gray-200 font-medium leading-relaxed italic text-sm md:text-lg">
                        {tradesCount === 0 
                          ? "\"Je surveillerai votre capital. Préparez-vous.\""
                          : `\"Patterns analysés à ${scores.total_score}%. ${scores.risk_score < 70 ? 'Réduisez le levier.' : 'Bon potentiel.'}\"`
                        }
                     </p>
                  </div>
                </div>
              )}

              {/* STEP: COMPLETED */}
              {onboardingState.step === 'COMPLETED' && (
                <div className="space-y-6 text-center">
                  <div className="inline-flex p-4 md:p-6 bg-emerald-50 dark:bg-emerald-900/20 rounded-full text-emerald-500">
                     <ShieldCheck size={32} />
                  </div>
                  <div className="space-y-2">
                    <h1 className="text-xl md:text-4xl font-poppins font-black text-gray-900 dark:text-white uppercase leading-tight italic">
                      DÉPÔT.
                    </h1>
                    <p className="text-sm md:text-xl text-gray-500 dark:text-gray-400 leading-relaxed max-w-sm mx-auto">
                      Setup prêt. ZoyaEdge traque désormais chaque déviation.
                    </p>
                  </div>
                  
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                     <p className="text-[10px] md:text-sm font-bold text-gray-500 dark:text-gray-400 italic">
                        {onboardingState.skipped 
                          ? "Ajoutez des trades pour activer l'IA."
                          : "Données prêtes pour l'optimisation."
                        }
                     </p>
                  </div>
                </div>
              )}

              {/* NAVIGATION */}
              <div className="flex flex-col gap-2 pt-6">
                <div className="flex gap-2">
                  {!(onboardingState.step === 'PROFILE' && profileSubStep === 1) && (
                    <button
                      onClick={prevStep}
                      disabled={loading}
                      className="flex-1 px-4 py-3 rounded-xl border border-gray-100 dark:border-gray-800 font-poppins font-black text-gray-400 uppercase tracking-widest text-[9px] md:text-xs flex items-center justify-center gap-1.5"
                    >
                      <ArrowLeft size={12} />
                      Retour
                    </button>
                  )}
                  <button
                    onClick={onboardingState.step === 'COMPLETED' ? handleFinish : nextStep}
                    disabled={loading || tradesLoading || !canContinue}
                    className={cn(
                      "flex-[2] px-4 py-3 rounded-xl font-poppins font-black uppercase tracking-widest text-[9px] md:text-xs transition-all flex items-center justify-center gap-1.5 shadow-lg disabled:opacity-30",
                      onboardingState.step === 'COMPLETED' ? "bg-emerald-600 text-white shadow-emerald-500/20" : "bg-zoya-red text-white shadow-zoya-red/20"
                    )}
                  >
                    {loading ? <Loader2 className="animate-spin" size={14} /> : (
                      <>
                        {onboardingState.step === 'COMPLETED' ? "Prendre le contrôle" : "Suivant"}
                        <ArrowRight size={12} />
                      </>
                    )}
                  </button>
                </div>
                {onboardingState.step === 'ADD_TRADES' && !canContinue && (
                   <p className="text-[8px] text-center text-amber-500 font-bold uppercase tracking-tight animate-pulse">
                     ⚠️ Ajoutez un trade pour continuer ou cliquez sur SKIP.
                   </p>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
