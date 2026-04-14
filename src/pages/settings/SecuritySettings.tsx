import React, { useState } from 'react';
import { useAuth } from '../../lib/auth';
import { useTranslation } from '../../lib/i18n';
import { motion } from 'motion/react';
import { ShieldCheck, LogOut, Loader2 } from 'lucide-react';

export default function SecuritySettings() {
  const { user, logout, changePassword } = useAuth();
  const { t } = useTranslation();
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const PasswordChangeForm = () => {
    const [currentPass, setCurrentPass] = useState('');
    const [newPass, setNewPass] = useState('');
    const [confirmPass, setConfirmPass] = useState('');
    const [localSaving, setLocalSaving] = useState(false);

    const handlePasswordChange = async (e: React.FormEvent) => {
      e.preventDefault();
      if (newPass !== confirmPass) {
        setMessage({ type: 'error', text: 'Passwords do not match' });
        return;
      }
      if (newPass.length < 6) {
        setMessage({ type: 'error', text: 'New password must be at least 6 characters' });
        return;
      }

      setLocalSaving(true);
      setMessage(null);
      try {
        await changePassword(currentPass, newPass);
        setMessage({ type: 'success', text: 'Password updated successfully!' });
        setCurrentPass('');
        setNewPass('');
        setConfirmPass('');
      } catch (error: any) {
        console.error("Error changing password:", error);
        setMessage({ type: 'error', text: error.message || 'Failed to change password. Check your current password.' });
      } finally {
        setLocalSaving(false);
      }
    };

    return (
      <form onSubmit={handlePasswordChange} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Current password</label>
          <input
            type="password"
            required
            value={currentPass}
            onChange={e => setCurrentPass(e.target.value)}
            className="w-full px-4 py-2.5 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-zoya-red outline-none transition-all"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">New password</label>
            <input
              type="password"
              required
              value={newPass}
              onChange={e => setNewPass(e.target.value)}
              className="w-full px-4 py-2.5 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-zoya-red outline-none transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Confirm new password</label>
            <input
              type="password"
              required
              value={confirmPass}
              onChange={e => setConfirmPass(e.target.value)}
              className="w-full px-4 py-2.5 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-zoya-red outline-none transition-all"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={localSaving}
          className="w-full flex items-center justify-center gap-2 bg-zoya-red hover:bg-zoya-red-dark text-white py-3 rounded-2xl font-poppins font-bold transition-all shadow-lg shadow-zoya-red/20 disabled:opacity-50 active:scale-[0.98]"
        >
          {localSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck size={20} />}
          Update Password
        </button>
      </form>
    );
  };

  return (
    <div className="space-y-8">
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-lg border border-gray-100 dark:border-gray-700"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-zoya-red-accent text-zoya-red rounded-2xl">
            <ShieldCheck size={24} />
          </div>
          <h2 className="text-xl font-poppins font-black text-gray-900 dark:text-white">Security Settings</h2>
        </div>

        <div className="space-y-8">
          {/* Password Change Form */}
          <div className="space-y-4">
            <h3 className="text-lg font-poppins font-black text-gray-900 dark:text-white">Change your password</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              You must provide your current password in order to change it.
            </p>

            {user?.providerData.some(p => p.providerId === 'google.com') && (
              <div className="p-4 bg-zoya-red-accent border border-zoya-red/10 rounded-2xl text-sm text-zoya-red">
                You are logged in with Google. Use password recovery to set up email/password authentication.
              </div>
            )}

            {message && (
              <div className={`p-4 rounded-2xl text-sm font-medium ${
                message.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400'
              }`}>
                {message.text}
              </div>
            )}

            <PasswordChangeForm />
          </div>

          <div className="pt-6 border-t border-gray-100 dark:border-gray-700">
            <button
              onClick={() => logout()}
              className="flex items-center gap-2 text-zoya-red font-poppins font-bold hover:text-zoya-red-dark transition-colors"
            >
              <LogOut size={20} />
              {t.common.logout}
            </button>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
