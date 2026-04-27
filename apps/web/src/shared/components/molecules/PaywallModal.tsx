import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Lock, CreditCard, Zap, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router';
import { useTranslation } from '@shared/lib/i18n';

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  requiredTier?: 'pro' | 'premium';
}

export default function PaywallModal({ isOpen, onClose, title, description, requiredTier = 'pro' }: PaywallModalProps) {
  const { t } = useTranslation();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl shadow-2xl z-[101] overflow-hidden"
          >
            <div className="relative p-6 sm:p-8">
              <button 
                onClick={onClose}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-800 rounded-full transition-colors"
              >
                <X size={18} />
              </button>

              <div className="w-16 h-16 bg-gradient-to-br from-zoya-red to-orange-500 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-zoya-red/20">
                <Lock className="text-white" size={32} />
              </div>

              <h2 className="text-2xl font-poppins font-black text-gray-900 dark:text-white mb-2">
                {title}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {description}
              </p>

              <div className="space-y-3 mb-8">
                <div className="flex items-center gap-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <CheckCircle2 className="text-emerald-500" size={18} />
                  <span>{requiredTier === 'premium' ? 'ZoyaEdge AI Coach Illimité' : 'Analyses Avancées & Exports'}</span>
                </div>
                <div className="flex items-center gap-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <CheckCircle2 className="text-emerald-500" size={18} />
                  <span>{requiredTier === 'premium' ? 'Comptes MT5 Illimités' : 'Synchronisation MT5 (1 compte)'}</span>
                </div>
                <div className="flex items-center gap-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <CheckCircle2 className="text-emerald-500" size={18} />
                  <span>Support Prioritaire</span>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <Link
                  to="/subscription"
                  onClick={onClose}
                  className="w-full flex items-center justify-center gap-2 bg-zoya-red text-white py-3.5 rounded-2xl font-poppins font-bold hover:bg-zoya-red-dark transition-all shadow-lg shadow-zoya-red/20"
                >
                  <Zap size={18} />
                  Voir les Plans {requiredTier === 'premium' ? 'Premium' : 'Pro'}
                </Link>
                <button
                  onClick={onClose}
                  className="w-full py-3.5 text-gray-500 dark:text-gray-400 font-medium hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  Peut-être plus tard
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
