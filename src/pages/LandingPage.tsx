import React from 'react';
import { Link, useNavigate } from 'react-router';
import { TrendingUp, ArrowRight, Shield, Zap, Target } from 'lucide-react';
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
          className="max-w-3xl space-y-8"
        >
          <h1 className="text-5xl md:text-7xl font-poppins font-black text-gray-900 dark:text-white tracking-tighter leading-none">
            VOTRE EDGE <br />
            <span className="text-zoya-red">COMMENCE ICI.</span>
          </h1>
          
          <p className="text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Un journal de trading intelligent conçu pour la performance. Analysez vos biais, trackez vos émotions et optimisez votre stratégie avec l'IA.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link 
              to={user ? "/" : "/auth"} 
              className="zoya-button-primary w-full sm:w-auto px-8 py-4 text-lg flex items-center justify-center gap-2"
            >
              Démarrer Maintenant
              <ArrowRight size={20} />
            </Link>
          </div>
        </motion.div>

        {/* Features Minimal */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl w-full mt-24">
          {[
            { icon: Shield, title: "Sécurisé", desc: "Vos données sont chiffrées et protégées." },
            { icon: Zap, title: "Analyse IA", desc: "Détectez vos erreurs avant qu'elles ne coûtent." },
            { icon: Target, title: "Performance", desc: "Statistiques détaillées et graphiques avancés." }
          ].map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + (i * 0.1) }}
              className="p-8 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm text-left"
            >
              <div className="w-12 h-12 bg-gray-50 dark:bg-gray-900 rounded-2xl flex items-center justify-center text-zoya-red mb-6">
                <f.icon size={24} />
              </div>
              <h3 className="text-xl font-bold mb-2">{f.title}</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </main>

      <footer className="p-8 text-center text-gray-400 dark:text-gray-600 text-sm border-t border-gray-100 dark:border-gray-800 mt-24">
        &copy; {new Date().getFullYear()} ZoyaEdge. Tous droits réservés.
      </footer>
    </div>
  );
}
