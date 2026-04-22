import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/auth';
import { useTranslation } from '../../lib/i18n';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Target, TrendingUp, ShieldCheck, ArrowRight, ArrowLeft, 
  Loader2, BadgeInfo, AlertTriangle, BrainCircuit, Activity,
  LineChart, Sparkles, Plus, Upload
} from 'lucide-react';
import { useNavigate } from 'react-router';
import TradeForm from '../../components/organisms/client/TradeForm';
import CSVUploader from '../../components/organisms/client/CSVUploader';
import { db } from '../../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { calculateZoyaScores, Trade } from '../../lib/scoring';
import { logActivity } from '../../lib/activity';
import { cn } from '../../lib/utils';

export default function Onboarding() {
  const { user, updateProfile, profile } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [showManualForm, setShowManualForm] = useState(false);
  const [formData, setFormData] = useState({
    tradingStyle: '',
    experienceLevel: 'beginner' as const,
    capitalSize: '1000',
    currency: 'USD',
    defaultRisk: 1,
    defaultLotSize: 0.1
  });

  // Track trades in real-time during onboarding
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'trades'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Trade[];
      setTrades(data);
    });
    return () => unsubscribe();
  }, [user]);

  const nextStep = () => {
    logActivity(user?.uid || '', 'onboarding_step', { from: step, to: step + 1 });
    setStep(s => s + 1);
  };
  const prevStep = () => setStep(s => s - 1);

  const handleFinish = async () => {
    setLoading(true);
    try {
      await updateProfile({
        ...formData,
        onboarded: true
      });
      logActivity(user?.uid || '', 'onboarding_complete');
      navigate('/', { replace: true });
    } catch (error) {
      console.error("Onboarding error:", error);
    } finally {
      setLoading(false);
    }
  };

  const scores = calculateZoyaScores(trades);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 flex flex-col items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Progress Header */}
        <div className="flex flex-col items-center mb-12 space-y-4">
           <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-zoya-red rounded-lg flex items-center justify-center text-white font-black">Z</div>
              <span className="font-poppins font-black text-xl tracking-tighter uppercase dark:text-white">Setup Control</span>
           </div>
           <div className="flex gap-2 w-full max-w-xs">
              {[1, 2, 3, 4].map((s) => (
                <div
                  key={s}
                  className={`h-1 flex-1 rounded-full transition-all duration-700 ${
                    s <= step ? 'bg-zoya-red shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-gray-100 dark:bg-gray-800'
                  }`}
                />
              ))}
           </div>
        </div>

        <motion.div
          layout
          className={cn(
            "bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl p-10 border border-gray-100 dark:border-gray-800 transition-all",
            step === 2 && trades.length < 3 ? "border-amber-500/20" : ""
          )}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              {/* STEP 1: PROFILE & CAPITAL */}
              {step === 1 && (
                <div className="space-y-8">
                  <div className="space-y-2">
                    <h1 className="text-3xl font-poppins font-black text-gray-900 dark:text-white">VOTRE PROFIL DE CONTRÔLE.</h1>
                    <p className="text-gray-500 dark:text-gray-400">Pour analyser votre comportement, nous devons connaître votre environnement.</p>
                  </div>
                  
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <label className="text-xs font-black uppercase tracking-widest text-gray-400">Capital Actuel ($)</label>
                      <input
                        type="number"
                        value={formData.capitalSize}
                        onChange={e => setFormData({ ...formData, capitalSize: e.target.value })}
                        placeholder="Ex: 10000"
                        className="w-full px-6 py-4 rounded-2xl bg-gray-50 dark:bg-gray-800 border-none text-xl font-poppins font-black text-gray-900 dark:text-white focus:ring-2 focus:ring-zoya-red transition-all"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <label className="text-xs font-black uppercase tracking-widest text-gray-400">Niveau d'expérience</label>
                        <select
                          value={formData.experienceLevel}
                          onChange={e => setFormData({ ...formData, experienceLevel: e.target.value as any })}
                          className="w-full px-6 py-4 rounded-2xl bg-gray-50 dark:bg-gray-800 border-none font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-zoya-red transition-all appearance-none"
                        >
                          <option value="beginner">Débutant (0-1 an)</option>
                          <option value="intermediate">Intermédiaire (1-3 ans)</option>
                          <option value="advanced">Avancé (3+ ans)</option>
                        </select>
                      </div>
                      <div className="space-y-3">
                        <label className="text-xs font-black uppercase tracking-widest text-gray-400">Style Dominant</label>
                        <select
                          value={formData.tradingStyle}
                          onChange={e => setFormData({ ...formData, tradingStyle: e.target.value })}
                          className="w-full px-6 py-4 rounded-2xl bg-gray-50 dark:bg-gray-800 border-none font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-zoya-red transition-all appearance-none"
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

              {/* STEP 2: TRADE INGESTION (FORCE) */}
              {step === 2 && (
                <div className="space-y-8">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 mb-2">
                       <span className="w-2 h-2 bg-zoya-red rounded-full animate-ping"></span>
                       <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Action Requise</span>
                    </div>
                    <h1 className="text-3xl font-poppins font-black text-gray-900 dark:text-white uppercase italic">Exposez vos data.</h1>
                    <p className="text-gray-500 dark:text-gray-400 leading-relaxed text-sm">
                      ZoyaEdge ne peut pas vous coacher sans voir comment vous tradez réellement. <br/>
                      <span className="font-black text-gray-900 dark:text-white">Importez un dossier MT5 ou ajoutez au moins 3 trades manuellement.</span>
                    </p>
                  </div>

                  {/* Progress Indicator for 3 trades */}
                  <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-3xl space-y-4 border border-gray-100 dark:border-gray-700">
                     <div className="flex justify-between items-center text-xs font-black uppercase tracking-widest">
                        <span className="text-gray-500">Exposition Data</span>
                        <span className={cn(trades.length >= 3 ? "text-emerald-500" : "text-amber-500")}>
                          {trades.length} / 3 TRADES
                        </span>
                     </div>
                     <div className="h-2 w-full bg-gray-200 dark:bg-gray-900 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, (trades.length / 3) * 100)}%` }}
                          className={cn(
                            "h-full transition-all duration-500",
                            trades.length >= 3 ? "bg-emerald-500" : "bg-amber-500"
                          )}
                        />
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <button 
                       onClick={() => setShowManualForm(!showManualForm)}
                       className="flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 font-bold hover:border-zoya-red transition-all"
                     >
                       <Plus size={20} className="text-zoya-red"/>
                       Ajouter Manuellement
                     </button>
                     <div className="relative group">
                       <CSVUploader />
                     </div>
                  </div>

                  {showManualForm && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      className="p-6 bg-gray-50 dark:bg-gray-800 rounded-3xl"
                    >
                      <TradeForm onSuccess={() => setShowManualForm(false)} />
                    </motion.div>
                  )}
                </div>
              )}

              {/* STEP 3: FIRST AI ANALYSIS */}
              {step === 3 && (
                <div className="space-y-8">
                  <div className="text-center space-y-4">
                    <div className="inline-flex p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-full text-indigo-600 mb-2">
                       <BrainCircuit size={32} />
                    </div>
                    <h1 className="text-3xl font-poppins font-black text-gray-900 dark:text-white uppercase tracking-tight">PREMIÈRE ANALYSE COMPORTEMENTALE.</h1>
                    <p className="text-gray-500 dark:text-gray-400">L'IA a détecté vos premiers patterns à travers vos {trades.length} trades.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     {[
                       { label: 'RISQUE', value: scores.risk_score, color: 'text-rose-500', icon: ShieldCheck },
                       { label: 'DISCIPLINE', value: scores.discipline_score, color: 'text-amber-500', icon: Activity },
                       { label: 'COHÉRENCE', value: scores.consistency_score, color: 'text-emerald-500', icon: LineChart }
                     ].map((s, i) => (
                       <div key={i} className="p-6 bg-gray-50 dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 text-center space-y-2">
                          <div className={cn("inline-flex mb-2", s.color)}><s.icon size={20}/></div>
                          <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">{s.label}</div>
                          <div className={cn("text-3xl font-poppins font-black", s.color)}>{s.value}</div>
                       </div>
                     ))}
                  </div>

                  <div className="p-8 bg-gray-900 rounded-[2rem] border border-gray-800">
                     <div className="flex items-center gap-4 mb-4">
                        <div className={cn(
                          "w-3 h-3 rounded-full animate-pulse",
                          scores.status === 'red' ? "bg-rose-500" : scores.status === 'orange' ? "bg-amber-500" : "bg-emerald-500"
                        )} />
                        <span className="text-gray-400 text-xs font-black uppercase tracking-widest">STATUT COCH IA</span>
                     </div>
                     <p className="text-gray-200 font-medium leading-relaxed italic text-lg">
                        "Votre trading présente des signes d{scores.risk_score < 70 ? 'instabilité' : 'e potentiel'}. {scores.discipline_score < 70 ? 'La discipline est votre faille majeure.' : 'Continuez à collecter de la data.'}"
                     </p>
                  </div>
                </div>
              )}

              {/* STEP 4: IMPACT SCREEN */}
              {step === 4 && (
                <div className="space-y-8 text-center">
                  <div className="inline-flex p-6 bg-rose-50 dark:bg-rose-900/20 rounded-full text-rose-500 animate-bounce">
                     <AlertTriangle size={48} />
                  </div>
                  <div className="space-y-4">
                    <h1 className="text-4xl font-poppins font-black text-gray-900 dark:text-white uppercase leading-tight italic">
                      DANGER : <br/>LE TRADING SANS CONTRÔLE.
                    </h1>
                    <p className="text-xl text-gray-500 dark:text-gray-400 leading-relaxed max-w-md mx-auto font-medium">
                      Votre trading est actuellement incohérent. Sans structure et sans data, vous finirez par perdre.
                    </p>
                  </div>
                  
                  <div className="pt-8 space-y-4">
                     <div className="px-6 py-4 bg-orange-50 dark:bg-amber-900/20 text-orange-700 dark:text-amber-500 rounded-2xl text-sm font-bold border border-orange-100 dark:border-amber-900/30">
                        Votre data est incomplète. Votre performance est instable.
                     </div>
                  </div>
                  
                  <p className="text-gray-400 text-sm italic">
                    En cliquant sur "Prendre le contrôle", vous vous engagez à logger chaque trade.
                  </p>
                </div>
              )}

              {/* NAVIGATION */}
              <div className="flex gap-4 pt-10">
                {step > 1 && (
                  <button
                    onClick={prevStep}
                    disabled={loading}
                    className="flex-1 px-8 py-5 rounded-2xl border-2 border-gray-100 dark:border-gray-800 font-poppins font-black text-gray-400 uppercase tracking-widest text-xs hover:border-gray-200 dark:hover:border-gray-700 transition-all flex items-center justify-center gap-2"
                  >
                    <ArrowLeft size={16} />
                    Retour
                  </button>
                )}
                <button
                  onClick={step === 4 ? handleFinish : nextStep}
                  disabled={loading || (step === 2 && trades.length < 3) || (step === 1 && (!formData.tradingStyle || !formData.capitalSize))}
                  className={cn(
                    "flex-[2] px-8 py-5 rounded-2xl font-poppins font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-3 disabled:opacity-30 shadow-2xl",
                    step === 4 ? "bg-emerald-600 text-white shadow-emerald-500/30" : "bg-zoya-red text-white shadow-zoya-red/30"
                  )}
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : (
                    <>
                      {step === 4 ? "Prendre le contrôle" : "Continuer l'exposition"}
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>

              {step === 2 && trades.length < 3 && (
                <div className="text-center">
                  <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest animate-pulse">
                    Accès bloqué : Ajoutez encore {3 - trades.length} trades
                  </p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
