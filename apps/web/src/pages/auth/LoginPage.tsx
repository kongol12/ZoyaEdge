import { Link } from 'react-router';
import React, { useState } from 'react';
import { useAuth, auth } from '@shared/lib/auth';
import { useTranslation } from '@shared/lib/i18n';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, User, ArrowRight, Loader2, AlertCircle } from 'lucide-react';

export default function Auth() {
  const { signInWithGoogle, signUpWithEmail, signInWithEmail, isSuperAdmin, logout } = useAuth();
  const { t } = useTranslation();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationSent, setVerificationSent] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isLogin) {
        await signInWithEmail(formData.email, formData.password);
      } else {
        await signUpWithEmail(formData.email, formData.password, formData.name);
        setVerificationSent(true);
      }
    } catch (err: any) {
      console.error("Auth Error:", err);
      if (err.code === 'auth/operation-not-allowed') {
        setError("Cette méthode de connexion n'est pas activée dans la console Firebase. Veuillez activer 'Email/Password' dans les paramètres d'Authentication.");
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError("Identifiants incorrects. Veuillez vérifier votre email et mot de passe.");
      } else if (err.code === 'auth/internal-error') {
        setError("Erreur interne Firebase (auth/internal-error). Cela est souvent dû à une restriction de domaine ou une configuration manquante. Essayez de rafraîchir.");
      } else {
        setError(err.message || "Une erreur est survenue");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error("Google Auth Error:", err);
      if (err.code === 'auth/operation-not-allowed') {
        setError("La connexion Google n'est pas activée dans la console Firebase. Veuillez l'activer dans les paramètres d'Authentication.");
      } else if (err.code === 'auth/internal-error' || err.code === 'auth/popup-closed-by-user') {
        setError("La fenêtre de connexion a été fermée ou une erreur interne est survenue. Veuillez réessayer.");
      } else {
        setError(err.message || "Erreur de connexion Google");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <Link to="/home" className="inline-flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-zoya-red transition-colors mb-6 uppercase tracking-widest">
            <ArrowRight className="rotate-180" size={14} />
            Retour à l'accueil
          </Link>
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="inline-block p-3 bg-zoya-red rounded-2xl mb-4 shadow-lg shadow-zoya-red/20"
          >
            <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
          </motion.div>
          <h1 className="text-3xl font-poppins font-black text-gray-900 dark:text-white">{t.auth.title}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">{t.auth.subtitle}</p>
        </div>

        <motion.div
          layout
          className="bg-white dark:bg-gray-800 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden"
        >
          <div className="flex border-b border-gray-100 dark:border-gray-700">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-4 text-sm font-poppins font-bold transition-colors ${
                isLogin ? 'text-zoya-red border-b-2 border-zoya-red' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
            >
              {t.auth.login}
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-4 text-sm font-poppins font-bold transition-colors ${
                !isLogin ? 'text-zoya-red border-b-2 border-zoya-red' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
            >
              {t.auth.signup}
            </button>
          </div>

          <div className="p-8">
            <AnimatePresence mode="wait">
              {verificationSent ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-8 text-center space-y-4"
                >
                  <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Mail size={32} />
                  </div>
                  <h2 className="text-xl font-poppins font-black text-gray-900 dark:text-white uppercase italic">Activez votre compte.</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed font-medium">
                    Un lien de validation a été envoyé à <strong>{formData.email}</strong>.<br /><br />
                    Veuillez cliquer sur le lien dans l'email pour activer votre accès et commencer l'onboarding.
                  </p>
                  <button
                    onClick={() => setIsLogin(true)}
                    className="w-full bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300 py-3 rounded-2xl font-bold hover:bg-gray-100 transition-all border border-gray-100 dark:border-gray-700"
                  >
                    Retour à la connexion
                  </button>
                </motion.div>
              ) : (
                <motion.form
                  key={isLogin ? 'login' : 'signup'}
                initial={{ opacity: 0, x: isLogin ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: isLogin ? 20 : -20 }}
                onSubmit={handleSubmit}
                className="space-y-4"
              >
                {!isLogin && (
                  <div className="space-y-1">
                    <label className="text-xs font-poppins font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">{t.auth.name}</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={18} />
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        placeholder="John Doe"
                        className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-zoya-red outline-none transition-all text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-poppins font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">{t.auth.email}</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={18} />
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      placeholder="votre@email.com"
                      className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-zoya-red outline-none transition-all text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-poppins font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">{t.auth.password}</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={18} />
                    <input
                      type="password"
                      required
                      value={formData.password}
                      onChange={e => setFormData({ ...formData, password: e.target.value })}
                      placeholder="••••••••"
                      className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-zoya-red outline-none transition-all text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-2xl text-sm font-medium"
                  >
                    <AlertCircle size={16} />
                    {error}
                  </motion.div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-zoya-red text-white py-4 rounded-2xl font-poppins font-bold flex items-center justify-center gap-2 hover:bg-zoya-red-dark transition-all shadow-lg shadow-zoya-red/20 disabled:opacity-50 active:scale-[0.98]"
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : (
                    <>
                      {isLogin ? t.auth.login : t.auth.signup}
                      <ArrowRight size={20} />
                    </>
                  )}
                </button>
              </motion.form>
            )}
          </AnimatePresence>

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-100 dark:border-gray-700"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white dark:bg-gray-800 px-4 text-gray-400 dark:text-gray-500 font-poppins font-black tracking-widest">{t.auth.or}</span>
              </div>
            </div>

            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-4 border border-gray-100 dark:border-gray-700 rounded-2xl font-poppins font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 transition-all disabled:opacity-50 active:scale-[0.98]"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
              {t.auth.google}
            </button>
          </div>
        </motion.div>

        <p className="text-center mt-8 text-sm text-gray-400 dark:text-gray-500">
          {t.auth.terms}
        </p>
      </div>
    </div>
  );
}
