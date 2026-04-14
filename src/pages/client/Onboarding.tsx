import React, { useState } from 'react';
import { useAuth } from '../../lib/auth';
import { useTranslation } from '../../lib/i18n';
import { motion, AnimatePresence } from 'motion/react';
import { Target, TrendingUp, ShieldCheck, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';

export default function Onboarding() {
  const { updateProfile } = useAuth();
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    tradingStyle: '',
    currency: 'USD',
    defaultRisk: 1,
    defaultLotSize: 0.1
  });

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  const handleFinish = async () => {
    setLoading(true);
    try {
      await updateProfile({
        ...formData,
        onboarded: true
      });
    } catch (error) {
      console.error("Onboarding error:", error);
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    {
      title: t.onboarding.step1Title,
      description: t.onboarding.step1Desc,
      icon: <Target className="w-12 h-12 text-zoya-red" />
    },
    {
      title: t.onboarding.step2Title,
      description: t.onboarding.step2Desc,
      icon: <TrendingUp className="w-12 h-12 text-amber-500" />
    },
    {
      title: t.onboarding.step3Title,
      description: t.onboarding.step3Desc,
      icon: <ShieldCheck className="w-12 h-12 text-emerald-500" />
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        {/* Progress Bar */}
        <div className="flex gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                s <= step ? 'bg-zoya-red' : 'bg-gray-200 dark:bg-gray-800'
              }`}
            />
          ))}
        </div>

        <motion.div
          layout
          className="bg-white dark:bg-gray-800 rounded-3xl shadow-lg p-8 border border-gray-100 dark:border-gray-700"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl">
                  {steps[step - 1].icon}
                </div>
                <h1 className="text-2xl font-poppins font-black text-gray-900 dark:text-white">{steps[step - 1].title}</h1>
                <p className="text-gray-500 dark:text-gray-400">{steps[step - 1].description}</p>
              </div>

              {step === 1 && (
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <label className="text-sm font-poppins font-bold text-gray-700 dark:text-gray-300">{t.onboarding.currency}</label>
                    <select
                      value={formData.currency}
                      onChange={e => setFormData({ ...formData, currency: e.target.value })}
                      className="w-full px-4 py-3 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-zoya-red outline-none transition-all"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                    </select>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="grid grid-cols-1 gap-3 pt-4">
                  {['Scalping', 'Day Trading', 'Swing Trading', 'Position Trading'].map((style) => (
                    <button
                      key={style}
                      onClick={() => setFormData({ ...formData, tradingStyle: style })}
                      className={`px-6 py-4 rounded-2xl border-2 text-left transition-all font-poppins font-bold ${
                        formData.tradingStyle === style
                          ? 'border-zoya-red bg-zoya-red/5 text-zoya-red'
                          : 'border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      <div>{style}</div>
                    </button>
                  ))}
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <label className="text-sm font-poppins font-bold text-gray-700 dark:text-gray-300">{t.onboarding.risk}</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.defaultRisk}
                      onChange={e => setFormData({ ...formData, defaultRisk: parseFloat(e.target.value) })}
                      className="w-full px-4 py-3 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-zoya-red outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-poppins font-bold text-gray-700 dark:text-gray-300">{t.onboarding.lotSize}</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.defaultLotSize}
                      onChange={e => setFormData({ ...formData, defaultLotSize: parseFloat(e.target.value) })}
                      className="w-full px-4 py-3 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-zoya-red outline-none transition-all"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-6">
                {step > 1 && (
                  <button
                    onClick={prevStep}
                    className="flex-1 px-6 py-4 rounded-2xl border border-gray-100 dark:border-gray-700 font-poppins font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                  >
                    <ArrowLeft size={20} />
                    {t.common.back}
                  </button>
                )}
                <button
                  onClick={step === 3 ? handleFinish : nextStep}
                  disabled={loading || (step === 2 && !formData.tradingStyle)}
                  className="flex-[2] px-6 py-4 rounded-2xl bg-zoya-red text-white font-poppins font-bold hover:bg-zoya-red-dark transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-zoya-red/20 active:scale-[0.98]"
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : (
                    <>
                      {step === 3 ? t.common.finish : t.common.continue}
                      <ArrowRight size={20} />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
