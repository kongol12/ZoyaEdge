import React, { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, query, where, setDoc } from 'firebase/firestore';
import { Users, User as UserIcon, Trash2, CheckCircle, XCircle, Settings, UserPlus, Power, Key } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { UserProfile, useAuth } from '../../lib/auth';
import UserDetailModal from '../../components/admin/UserDetailModal';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { FileDown, FileSpreadsheet, FileText } from 'lucide-react';
import { OperationType, handleFirestoreError } from '../../lib/db';
import toast from 'react-hot-toast';

export default function ClientManagement() {
  const [users, setUsers] = useState<(UserProfile & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<(UserProfile & { id: string }) | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const { profile, isSuperAdmin, user } = useAuth();
  const [isSuper, setIsSuper] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  useEffect(() => {
    const checkSuper = async () => {
      const res = await isSuperAdmin(user?.email);
      setIsSuper(res);
    };
    checkSuper();
  }, [user, isSuperAdmin]);

  const fetchClients = () => {
    setLoading(true);
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      setDebugInfo({
        totalInDb: snapshot.size,
        roles: snapshot.docs.map(d => d.data().role || 'none')
      });
      const data = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }) as (UserProfile & { id: string }))
        .filter(u => !u.role || u.role === 'user' || u.email === 'kongolmandf@gmail.com');
        
      setUsers(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
      setLoading(false);
    });
    return unsubscribe;
  };

  useEffect(() => {
    if (!profile || (profile.role !== 'admin' && profile.role !== 'agent' && !isSuper)) {
      return;
    }

    const unsubscribe = fetchClients();
    return () => unsubscribe();
  }, [profile, isSuper]);

  const handleUpdateUser = async (userId: string, updates: Partial<UserProfile>) => {
    try {
      await updateDoc(doc(db, 'users', userId), updates);
    } catch (error) {
      console.error("Error updating user:", error);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await deleteDoc(doc(db, 'users', userId));
    } catch (error) {
      console.error("Error deleting user:", error);
    }
  };

  const handleToggleStatus = async (user: UserProfile & { id: string }) => {
    const isSuspended = user.subscriptionStatus === 'suspended';
    await handleUpdateUser(user.id, { 
      subscriptionStatus: isSuspended ? 'active' : 'suspended' 
    });
  };

  const handleResetPassword = async (email: string) => {
    if (confirm(`Envoyer un lien de réinitialisation de mot de passe à ${email} ?`)) {
      try {
        // We can't directly call sendPasswordResetEmail from admin without the user's context easily,
        // but we can trigger a cloud function or just use the client SDK if auth is initialized.
        const { sendPasswordResetEmail } = await import('firebase/auth');
        const { auth } = await import('../../lib/firebase');
        await sendPasswordResetEmail(auth, email);
        toast.success('Email de réinitialisation envoyé avec succès.');
      } catch (error: any) {
        toast.error('Erreur: ' + error.message);
      }
    }
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text('ZoyaEdge - Liste des Clients', 14, 15);
    
    const tableData = users.map(u => [
      u.displayName || 'N/A',
      u.email,
      u.subscription || 'free',
      u.aiCredits || 0,
      u.subscriptionStatus || 'inactive'
    ]);

    (doc as any).autoTable({
      head: [['Nom', 'Email', 'Plan', 'Crédits', 'Statut']],
      body: tableData,
      startY: 20,
      theme: 'grid',
      headStyles: { fillStyle: [220, 38, 38] }
    });

    doc.save(`zoyaedge_clients_${new Date().toISOString().split('T')[0]}.pdf`);
    setShowExportMenu(false);
  };

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(users.map(u => ({
      Nom: u.displayName || 'N/A',
      Email: u.email,
      Abonnement: u.subscription || 'free',
      Credits_AI: u.aiCredits || 0,
      Statut: u.subscriptionStatus || 'inactive',
      Cree_le: u.createdAt?.toDate?.()?.toLocaleString() || 'N/A'
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Clients");
    XLSX.writeFile(workbook, `zoyaedge_clients_${new Date().toISOString().split('T')[0]}.xlsx`);
    setShowExportMenu(false);
  };

  const createTestClient = async () => {
    try {
      const testId = `test_${Math.random().toString(36).substring(7)}`;
      await setDoc(doc(db, 'users', testId), {
        email: `${testId}@example.com`,
        displayName: `Test Client ${testId}`,
        role: 'user',
        subscription: 'free',
        subscriptionStatus: 'active',
        createdAt: new Date(),
        onboarded: true
      });
      toast.success('Client de test créé !');
    } catch (error: any) {
      toast.error('Erreur: ' + error.message);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-poppins font-black text-gray-900 dark:text-white">Gestion des Clients</h1>
          <p className="text-gray-500 dark:text-gray-400">Gérez les comptes clients, leurs abonnements et accès.</p>
        </div>
        
        <div className="flex items-center gap-3">
          {isSuper && debugInfo && (
            <div className="flex items-center gap-2">
              <div className="text-[10px] bg-gray-100 dark:bg-gray-800 p-2 rounded-xl font-mono">
                DB: {debugInfo.totalInDb} | Clients: {users.length}
              </div>
              <button 
                onClick={createTestClient}
                className="text-[10px] bg-indigo-100 text-indigo-600 p-2 rounded-xl font-bold hover:bg-indigo-200 transition-colors"
              >
                + Test Client
              </button>
            </div>
          )}
          <div className="relative">
            <button 
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-2 bg-white dark:bg-gray-800 px-6 py-3 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-lg font-bold text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
            >
              <FileDown size={18} className="text-zoya-red" />
              Exporter la Liste
            </button>

            <AnimatePresence>
              {showExportMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 z-50 overflow-hidden"
                >
                  <button 
                    onClick={exportToPDF}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <FileText size={18} className="text-rose-500" />
                    Format PDF (.pdf)
                  </button>
                  <button 
                    onClick={exportToExcel}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <FileSpreadsheet size={18} className="text-emerald-500" />
                    Format Excel (.xlsx)
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-lg overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center space-y-4">
            <div className="w-12 h-12 border-4 border-zoya-red border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-500 font-bold">Chargement des clients...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-20 h-20 bg-gray-50 dark:bg-gray-900 rounded-full flex items-center justify-center text-gray-300">
              <Users size={40} />
            </div>
            <div>
              <p className="text-xl font-poppins font-black text-gray-900 dark:text-white">Aucun client trouvé</p>
              <p className="text-gray-500 dark:text-gray-400 max-w-xs mx-auto mt-2">
                Il n'y a actuellement aucun compte utilisateur avec le rôle "Client" dans la base de données.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  <th className="px-6 py-4">Client</th>
                  <th className="px-6 py-4">Abonnement</th>
                  <th className="px-6 py-4">Statut</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center text-gray-400">
                          <UserIcon size={20} />
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 dark:text-white">{user.displayName || 'Sans nom'}</p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "text-xs font-bold px-3 py-1.5 rounded-xl",
                        user.subscription === 'premium' ? "bg-orange-100 text-orange-600" :
                        user.subscription === 'pro' ? "bg-emerald-100 text-emerald-600" :
                        "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                      )}>
                        {user.subscription || 'Free'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        {user.subscriptionStatus === 'suspended' ? (
                          <XCircle size={14} className="text-rose-500" />
                        ) : user.subscriptionStatus === 'active' ? (
                          <CheckCircle size={14} className="text-emerald-500" />
                        ) : (
                          <XCircle size={14} className="text-gray-300" />
                        )}
                        <span className={cn(
                          "text-xs font-medium capitalize",
                          user.subscriptionStatus === 'suspended' ? "text-rose-500" : ""
                        )}>
                          {user.subscriptionStatus || 'Inactif'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => handleResetPassword(user.email)}
                          title="Réinitialiser Mot de passe"
                          className="p-2 text-gray-400 hover:text-amber-500 transition-colors"
                        >
                          <Key size={18} />
                        </button>
                        <button 
                          onClick={() => handleToggleStatus(user)}
                          title={user.subscriptionStatus === 'suspended' ? "Activer" : "Suspendre"}
                          className={cn(
                            "p-2 transition-colors",
                            user.subscriptionStatus === 'suspended' 
                              ? "text-emerald-500 hover:text-emerald-600" 
                              : "text-gray-400 hover:text-rose-500"
                          )}
                        >
                          <Power size={18} />
                        </button>
                        <button 
                          onClick={() => setSelectedUser(user)}
                          title="Gérer Profil"
                          className="p-2 text-gray-400 hover:text-indigo-500 transition-colors"
                        >
                          <Settings size={18} />
                        </button>
                        <button 
                          onClick={() => {
                            if (confirm("Supprimer ce client ?")) {
                              handleDeleteUser(user.id);
                            }
                          }}
                          title="Supprimer"
                          className="p-2 text-gray-400 hover:text-rose-500 transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedUser && (
        <UserDetailModal
          user={selectedUser}
          isOpen={!!selectedUser}
          onClose={() => setSelectedUser(null)}
          onUpdate={handleUpdateUser}
          onDelete={handleDeleteUser}
        />
      )}
    </div>
  );
}
