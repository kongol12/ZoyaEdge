import React from 'react';
import { Navigate, Outlet } from 'react-router';
import { useAuth } from '../../lib/auth';
import { Loader2 } from 'lucide-react';

export default function AdminRoute({ requiredRole = 'agent' }: { requiredRole?: 'agent' | 'admin' }) {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-10 h-10 animate-spin text-zoya-red" />
      </div>
    );
  }

  const isAuthorized = 
    profile?.role === 'admin' || 
    (requiredRole === 'agent' && profile?.role === 'agent') ||
    profile?.email?.toLowerCase() === import.meta.env.VITE_PRIMARY_SUPER_ADMIN_EMAIL?.toLowerCase(); // Emergency fallback for the owner

  if (!isAuthorized) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
