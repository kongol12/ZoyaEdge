import React from 'react';
import { Link, useNavigate } from 'react-router';
import { TrendingUp, ArrowRight, Shield, Zap, Target, AlertCircle, ShieldAlert, Activity, Globe } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../lib/auth';
import { useTranslation } from '../lib/i18n';
import { cn } from '../lib/utils';

export default function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t, language, setLanguage } = useTranslation();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      {/* Basic Nav */}
      <nav className="p-6 flex items-center justify-between max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-zoya-red rounded-xl flex items-center justify-center">
            <TrendingUp size={24} className="text-white" />
          </div>
          <span className="text-xl font-poppins font-black text-gray-900 dark:text-white uppercase tracking-tight">
            Zoya<span className="text-zoya-red">Edge</span>
          </span>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-gray-100 dark:bg-gray-900 rounded-full p-1 mr-2">
            <button
              onClick={() => setLanguage('fr')}
              className={cn(
                "px-3 py-1 text-[10px] font-black rounded-full transition-all",
                language === 'fr' ? "bg-white dark:bg-gray-800 text-zoya-red shadow-sm" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              )}
            >
              FR
            </button>
            <button
              onClick={() => setLanguage('en')}
              className={cn(
                "px-3 py-1 text-[10px] font-black rounded-full transition-all",
                language === 'en' ? "bg-white dark:bg-gray-800 text-zoya-red shadow-sm" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              )}
            >
              EN
            </button>
          </div>
          
          {user ? (
            <Link to="/" className="zoya-button-primary py-2 px-6 text-sm">
              Dashboard
            </Link>
          ) : (
            <Link to="/auth" className="text-gray-600 dark:text-gray-400 font-bold hover:text-zoya-red transition-colors text-sm">
              {t.landing.login}
            </Link>
          )}
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl space-y-8 md:space-y-12"
        >
          <div className="space-y-4">
            <span className="px-3 py-1 md:px-4 md:py-1.5 bg-zoya-red/10 text-zoya-red rounded-full text-[10px] md:text-sm font-bold uppercase tracking-widest border border-zoya-red/20 shadow-sm animate-pulse">
              {t.landing.dataIsEdge}
            </span>
            <h1 className="text-2xl md:text-6xl lg:text-7xl font-poppins font-black text-gray-900 dark:text-white tracking-tighter leading-tight md:leading-none">
              {t.landing.heroTitle} <br className="hidden md:block" />
              <span className="text-zoya-red">{t.landing.heroTitleSub}</span>
            </h1>
          </div>
          
          <p className="text-base md:text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed font-medium">
            {t.landing.heroSubtitle}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link 
              to={user ? "/" : "/auth"} 
              className="zoya-button-primary w-full sm:w-72 px-6 py-4 md:px-8 md:py-5 text-base md:text-lg flex items-center justify-center gap-3 shadow-2xl shadow-zoya-red/40 hover:-translate-y-1 transition-transform"
            >
              {t.landing.ctaAnalyze}
              <ArrowRight size={20} className="md:w-6 md:h-6" />
            </Link>
          </div>

          <div className="pt-8 md:pt-12 text-gray-400 dark:text-gray-600 font-bold uppercase tracking-[0.2em] text-[10px] md:text-xs">
            {t.landing.liability}
          </div>
        </motion.div>

        {/* Pain Blocks */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 max-w-6xl w-full mt-20 md:mt-32 relative text-left">
          <div className="absolute -top-8 md:-top-12 left-0 font-black text-4xl md:text-6xl text-gray-100 dark:text-gray-900 select-none -z-10">{t.landing.reality}</div>
          {[
            { 
              title: t.landing.painTitle1, 
              desc: t.landing.painDesc1,
              icon: AlertCircle
            },
            { 
              title: t.landing.painTitle2, 
              desc: t.landing.painDesc2,
              icon: ShieldAlert
            },
            { 
              title: t.landing.painTitle3, 
              desc: t.landing.painDesc3,
              icon: Activity
            }
          ].map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + (i * 0.1) }}
              className="p-6 md:p-10 bg-white dark:bg-gray-900 rounded-3xl md:rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-xl group hover:border-zoya-red/50 transition-all"
            >
              <div className="w-12 h-12 md:w-14 md:h-14 bg-gray-50 dark:bg-gray-800 rounded-2xl flex items-center justify-center text-zoya-red mb-6 md:mb-8 group-hover:scale-110 transition-transform">
                <f.icon size={24} className="md:w-7 md:h-7" />
              </div>
              <h3 className="text-lg md:text-xl lg:text-2xl font-poppins font-black mb-3 md:mb-4 dark:text-white leading-tight group-hover:text-zoya-red transition-colors">{f.title}</h3>
              <p className="text-sm md:text-base text-gray-500 dark:text-gray-400 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Demo Preview Mock */}
        <div className="mt-24 md:mt-40 w-full max-w-6xl">
           <div className="relative p-0.5 md:p-1 bg-gradient-to-br from-zoya-red via-gray-800 to-gray-900 rounded-[2rem] md:rounded-[3rem] shadow-3xl">
              <div className="bg-white dark:bg-gray-950 p-6 md:p-12 rounded-[1.8rem] md:rounded-[2.8rem] flex flex-col md:flex-row gap-8 md:gap-12 items-center text-left">
                  <div className="flex-1 space-y-4 md:space-y-6">
                    <h2 className="text-2xl md:text-4xl font-poppins font-black dark:text-white leading-tight">{t.landing.aiCoachTitle} <br/><span className="text-zoya-red uppercase italic">{t.landing.aiCoachSub}</span></h2>
                    <p className="text-gray-400 text-sm md:text-lg">{t.landing.aiCoachDesc}</p>
                    <div className="flex flex-wrap gap-2 md:gap-4 font-poppins">
                        <div className="px-4 py-2 md:px-6 md:py-3 bg-rose-500 text-white rounded-lg md:rounded-xl font-black text-[10px] md:text-sm uppercase tracking-tighter shadow-lg shadow-rose-500/30">{t.landing.stopTrading}</div>
                        <div className="px-4 py-2 md:px-6 md:py-3 bg-amber-500 text-white rounded-lg md:rounded-xl font-black text-[10px] md:text-sm uppercase tracking-tighter opacity-50 shadow-lg shadow-amber-500/30">{t.landing.reduceRisk}</div>
                        <div className="px-4 py-2 md:px-6 md:py-3 bg-emerald-500 text-white rounded-lg md:rounded-xl font-black text-[10px] md:text-sm uppercase tracking-tighter opacity-50 shadow-lg shadow-emerald-500/30">{t.landing.continue}</div>
                    </div>
                  </div>
                  <div className="w-full md:w-96 p-6 md:p-8 bg-gray-900 rounded-3xl border border-gray-800 shadow-2xl">
                    <div className="flex justify-between items-end mb-6 md:mb-8">
                        <div>
                           <div className="text-gray-500 text-[8px] md:text-[10px] font-black uppercase tracking-widest mb-1">{t.landing.scoreLabel}</div>
                           <div className="text-2xl md:text-4xl font-poppins font-black text-white">42<span className="text-rose-500">/100</span></div>
                        </div>
                        <div className="text-right">
                           <div className="text-gray-500 text-[8px] md:text-[10px] font-black uppercase tracking-widest mb-1">{t.landing.winrateLabel}</div>
                           <div className="text-lg md:text-xl font-poppins font-black text-white">38%</div>
                        </div>
                    </div>
                    <div className="h-24 md:h-32 w-full bg-gray-800/50 rounded-2xl overflow-hidden relative border border-gray-800">
                        <div className="absolute inset-0 flex items-center justify-center text-[8px] md:text-[10px] font-black text-gray-700 uppercase tracking-widest z-10">{t.landing.pnlCurve}</div>
                        <svg className="w-full h-full" viewBox="0 0 100 40">
                           <path d="M 0 30 Q 10 20 20 35 T 40 25 T 60 10 T 80 35 T 100 20" fill="none" stroke="#ef4444" strokeWidth="2" />
                        </svg>
                    </div>
                  </div>
              </div>
           </div>
        </div>

        <div className="mt-20 md:mt-32 max-w-2xl mx-auto space-y-4 md:space-y-6">
           <h2 className="text-2xl md:text-4xl font-poppins font-black text-gray-900 dark:text-white uppercase tracking-tighter">{t.landing.blindTitle}</h2>
           <p className="text-gray-500 dark:text-gray-400 text-sm md:text-lg">{t.landing.blindSubtitle}</p>
           <button 
             onClick={() => navigate(user ? "/" : "/auth")}
             className="zoya-button-primary px-8 py-4 md:px-12 md:py-5 text-base md:text-lg font-black shadow-zoya-red/20"
           >
              {t.landing.ctaExpose}
           </button>
        </div>
      </main>

      <footer className="p-8 text-center text-gray-400 dark:text-gray-600 text-sm border-t border-gray-100 dark:border-gray-800 mt-24">
        &copy; {new Date().getFullYear()} ZoyaEdge. {language === 'fr' ? 'Tous droits réservés.' : 'All rights reserved.'}
      </footer>
    </div>
  );
}
