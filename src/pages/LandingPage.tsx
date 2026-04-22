import React from 'react';
import { Link, useNavigate } from 'react-router';
import { TrendingUp, ArrowRight, Shield, Zap, Target, AlertCircle, ShieldAlert, Activity } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../lib/auth';

export default function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

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
          {user ? (
            <Link to="/" className="zoya-button-primary py-2 px-6 text-sm">
              Dashboard
            </Link>
          ) : (
            <Link to="/auth" className="text-gray-600 dark:text-gray-400 font-bold hover:text-zoya-red transition-colors">
              Connexion
            </Link>
          )}
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl space-y-12"
        >
          <div className="space-y-4">
            <span className="px-4 py-1.5 bg-zoya-red/10 text-zoya-red rounded-full text-sm font-bold uppercase tracking-widest border border-zoya-red/20 shadow-sm animate-pulse">
              Data is your only edge
            </span>
            <h1 className="text-6xl md:text-8xl font-poppins font-black text-gray-900 dark:text-white tracking-tighter leading-none">
              YOUR TRADING IS NOT THE PROBLEM. <br />
              <span className="text-zoya-red">YOUR LACK OF DATA IS.</span>
            </h1>
          </div>
          
          <p className="text-2xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed font-medium">
            ZoyaEdge exposes your real performance, discipline, and risk behavior in real time. Stop trading blind.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-4">
            <Link 
              to={user ? "/" : "/auth"} 
              className="zoya-button-primary w-full sm:w-80 px-8 py-5 text-xl flex items-center justify-center gap-3 shadow-2xl shadow-zoya-red/40 hover:-translate-y-1 transition-transform"
            >
              Analyze my trading now
              <ArrowRight size={24} />
            </Link>
          </div>

          <div className="pt-12 text-gray-400 dark:text-gray-600 font-bold uppercase tracking-[0.2em] text-sm">
            Everything you trade without data is a liability.
          </div>
        </motion.div>

        {/* Pain Blocks */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl w-full mt-32 relative">
          <div className="absolute -top-12 left-0 font-black text-6xl text-gray-100 dark:text-gray-900 select-none -z-10">THE REALITY</div>
          {[
            { 
              title: "“You think you are profitable”", 
              desc: "But you don't track your real expectancy. Your brain filters out failures.",
              icon: AlertCircle
            },
            { 
              title: "“You don't track real risk”", 
              desc: "Hidden exposure is killing your account. Most traders die by 100 small cuts.",
              icon: ShieldAlert
            },
            { 
              title: "“Emotions destroy your edge”", 
              desc: "Revenge trading and fear are invisible killers. We make them visible.",
              icon: Activity
            }
          ].map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + (i * 0.1) }}
              className="p-10 bg-white dark:bg-gray-900 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-xl group hover:border-zoya-red/50 transition-all"
            >
              <div className="w-14 h-14 bg-gray-50 dark:bg-gray-800 rounded-2xl flex items-center justify-center text-zoya-red mb-8 group-hover:scale-110 transition-transform">
                <f.icon size={28} />
              </div>
              <h3 className="text-2xl font-poppins font-black mb-4 dark:text-white leading-tight group-hover:text-zoya-red transition-colors">{f.title}</h3>
              <p className="text-gray-500 dark:text-gray-400 text-base leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Demo Preview Mock */}
        <div className="mt-40 w-full max-w-6xl">
           <div className="relative p-1 bg-gradient-to-br from-zoya-red via-gray-800 to-gray-900 rounded-[3rem] shadow-3xl">
              <div className="bg-white dark:bg-gray-950 p-12 rounded-[2.8rem] flex flex-col md:flex-row gap-12 items-center text-left">
                  <div className="flex-1 space-y-6">
                    <h2 className="text-4xl font-poppins font-black dark:text-white leading-tight">THE AI COACH <br/><span className="text-zoya-red uppercase italic">DECISION ENGINE</span></h2>
                    <p className="text-gray-400 text-lg">Real-time status analysis of your trading behavior. Red, Orange, or Green. No generic advice.</p>
                    <div className="flex gap-4">
                        <div className="px-6 py-3 bg-rose-500 text-white rounded-xl font-black text-sm uppercase tracking-tighter shadow-lg shadow-rose-500/30">STOP TRADING</div>
                        <div className="px-6 py-3 bg-amber-500 text-white rounded-xl font-black text-sm uppercase tracking-tighter opacity-50 shadow-lg shadow-amber-500/30">REDUCE RISK</div>
                        <div className="px-6 py-3 bg-emerald-500 text-white rounded-xl font-black text-sm uppercase tracking-tighter opacity-50 shadow-lg shadow-emerald-500/30">CONTINUE</div>
                    </div>
                  </div>
                  <div className="w-full md:w-96 p-8 bg-gray-900 rounded-3xl border border-gray-800 shadow-2xl">
                    <div className="flex justify-between items-end mb-8">
                        <div>
                           <div className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">Zoya Score</div>
                           <div className="text-4xl font-poppins font-black text-white">42<span className="text-rose-500">/100</span></div>
                        </div>
                        <div className="text-right">
                           <div className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">Winrate</div>
                           <div className="text-xl font-poppins font-black text-white">38%</div>
                        </div>
                    </div>
                    <div className="h-32 w-full bg-gray-800/50 rounded-2xl overflow-hidden relative border border-gray-800">
                        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-gray-700 uppercase tracking-widest z-10">PnL CURVE VISUALIZATION</div>
                        <svg className="w-full h-full" viewBox="0 0 100 40">
                           <path d="M 0 30 Q 10 20 20 35 T 40 25 T 60 10 T 80 35 T 100 20" fill="none" stroke="#ef4444" strokeWidth="2" />
                        </svg>
                    </div>
                  </div>
              </div>
           </div>
        </div>

        <div className="mt-32 max-w-2xl mx-auto space-y-6">
           <h2 className="text-4xl font-poppins font-black text-gray-900 dark:text-white uppercase tracking-tighter">You are trading blind.</h2>
           <p className="text-gray-500 dark:text-gray-400 text-lg">Every trade without data is a liability. It's time to expose your edge.</p>
           <button 
             onClick={() => navigate(user ? "/" : "/auth")}
             className="zoya-button-primary px-12 py-5 text-xl font-black shadow-zoya-red/20"
           >
              Expose my edge
           </button>
        </div>
      </main>

      <footer className="p-8 text-center text-gray-400 dark:text-gray-600 text-sm border-t border-gray-100 dark:border-gray-800 mt-24">
        &copy; {new Date().getFullYear()} ZoyaEdge. Tous droits réservés.
      </footer>
    </div>
  );
}
