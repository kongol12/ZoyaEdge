import React from 'react';
import { Navigate } from 'react-router';
import { useAuth, auth } from '../lib/auth';
import Auth from '../pages/Auth';

export default function SecretAdminPortal() {
  const [isSuper, setIsSuper] = React.useState(false);
  const { user, profile, loading, isSuperAdmin } = useAuth();

  React.useEffect(() => {
    const checkSuper = async () => {
      if (user?.email) {
        const res = await isSuperAdmin(user.email);
        setIsSuper(res);
      } else {
        setIsSuper(false);
      }
    };
    checkSuper();
  }, [user, isSuperAdmin]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-zinc-950">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-zoya-red"></div>
      </div>
    );
  }

  // If already logged in and is admin/agent/super, go to dashboard
  if (user && (profile?.role === 'admin' || profile?.role === 'agent' || isSuper)) {
    return <Navigate to="/admin" replace />;
  }

  // If logged in but NOT admin/agent, it means they might have used Google but are not super admin
  if (user && profile?.role === 'user') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-8 text-center">
        <div className="w-20 h-20 bg-rose-100 dark:bg-rose-900/30 rounded-3xl flex items-center justify-center text-rose-600 mb-6">
          <Shield size={40} />
        </div>
        <h1 className="text-2xl font-poppins font-black text-gray-900 dark:text-white mb-2">Accès Refusé</h1>
        <p className="text-gray-500 dark:text-gray-400 max-w-md">
          Ce portail est réservé exclusivement au personnel autorisé. La connexion Google est limitée aux Super Administrateurs.
        </p>
        <button 
          onClick={() => auth.signOut()}
          className="mt-8 px-6 py-3 bg-zoya-red text-white rounded-2xl font-bold"
        >
          Retour à la connexion standard
        </button>
      </div>
    );
  }

  // Otherwise show the login page
  return <Auth />;
}

function Shield({ size, className }: { size: number, className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
    </svg>
  );
}
