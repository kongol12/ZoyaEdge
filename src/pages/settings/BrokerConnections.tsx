import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/auth';
import { db } from '../../lib/firebase';
import { collection, addDoc, query, where, onSnapshot, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { ShieldCheck, Server, User, Plus, Trash2, RefreshCw, CheckCircle2, AlertCircle, Download, Key, Copy, Check, Terminal, Eye, EyeOff, Hash } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import PaywallModal from '../../components/molecules/PaywallModal';
import { OperationType, handleFirestoreError } from '../../lib/db';
import toast from 'react-hot-toast';

interface BrokerConnection {
  id: string;
  platform: 'MT4' | 'MT5' | 'TradeLocker' | 'CTrader' | 'TradingView' | 'Tradovate' | 'NinjaTrader';
  accountName: string;
  brokerServer?: string;
  brokerLogin?: string;
  syncKey?: string;
  status: 'waiting' | 'active' | 'error';
  lastSync?: Date;
  connectionType?: 'ea' | 'cloud';
}

const PLATFORM_LOGOS: Record<string, string> = {
  MT4: 'https://upload.wikimedia.org/wikipedia/commons/e/e4/MetaTrader_4_logo.png',
  MT5: 'https://upload.wikimedia.org/wikipedia/commons/c/c2/MetaTrader_5_logo.png',
  TradeLocker: 'https://tradelocker.com/wp-content/uploads/2023/06/tradelocker-logo.svg',
  CTrader: 'https://upload.wikimedia.org/wikipedia/commons/1/1a/CTrader_logo.png',
  TradingView: 'https://upload.wikimedia.org/wikipedia/commons/3/33/TradingView_logo.svg',
  Tradovate: 'https://logos-world.net/wp-content/uploads/2021/04/Tradovate-Logo.png',
  NinjaTrader: 'https://ninjatrader.com/wp-content/uploads/2023/10/NinjaTrader-Logo.png'
};

export default function BrokerConnections() {
  const { user, profile } = useAuth();
  const [connections, setConnections] = useState<BrokerConnection[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [showPaywall, setShowPaywall] = useState(false);

  // Form State
  const [platform, setPlatform] = useState<'MT4' | 'MT5' | 'TradeLocker' | 'CTrader' | 'TradingView' | 'Tradovate' | 'NinjaTrader'>('MT5');
  const [connectionType, setConnectionType] = useState<'ea' | 'cloud'>('ea');
  const [accountName, setAccountName] = useState('');
  const [brokerServer, setBrokerServer] = useState('');
  const [brokerLogin, setBrokerLogin] = useState('');
  const [investorPassword, setInvestorPassword] = useState('');

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'broker_connections'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        lastSync: doc.data().lastSync?.toDate()
      })) as BrokerConnection[];
      setConnections(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'broker_connections (user)');
    });
    return () => unsubscribe();
  }, [user]);

  const generateSyncKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = 'zoya_';
    for (let i = 0; i < 24; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleOpenAddModal = () => {
    if (profile?.subscription === 'free') {
      setShowPaywall(true);
      return;
    }
    if (profile?.subscription === 'pro' && connections.length >= 1) {
      toast.error("Le plan Pro est limité à 1 connexion. Passez au plan Premium pour des connexions illimitées.");
      return;
    }
    setIsAdding(true);
  };

  const handleAddConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      const syncKey = (platform !== 'TradeLocker' && connectionType === 'ea') ? generateSyncKey() : undefined;

      const dataToSave: any = {
        userId: user.uid,
        platform,
        accountName,
        connectionType,
        status: 'waiting',
        createdAt: serverTimestamp(),
      };

      if (platform !== 'TradeLocker') {
        dataToSave.brokerServer = brokerServer;
        dataToSave.brokerLogin = brokerLogin;
        
        if (connectionType === 'ea') {
          dataToSave.syncKey = syncKey;
        } else {
          dataToSave.investorPassword = investorPassword; // In production, this should be encrypted
        }
      }

      await addDoc(collection(db, 'broker_connections'), dataToSave);

      setIsAdding(false);
      setAccountName('');
      setBrokerServer('');
      setBrokerLogin('');
      setInvestorPassword('');
    } catch (error) {
      console.error("Error adding connection:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Voulez-vous vraiment supprimer cette connexion ? L\'EA ne pourra plus envoyer de données.')) {
      await deleteDoc(doc(db, 'broker_connections', id));
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const toggleKeyVisibility = (id: string) => {
    const newVisibleKeys = new Set(visibleKeys);
    if (newVisibleKeys.has(id)) {
      newVisibleKeys.delete(id);
    } else {
      newVisibleKeys.add(id);
    }
    setVisibleKeys(newVisibleKeys);
  };

  const handleSync = async (connId: string) => {
    if (!user) return;
    
    // Optimistic UI update
    setConnections(prev => prev.map(c => c.id === connId ? { ...c, status: 'waiting' } : c));
    
    try {
      const response = await fetch(`/api/connections/${connId}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        toast.error(data.error || "Erreur lors de la synchronisation");
        // Revert on error
        setConnections(prev => prev.map(c => c.id === connId ? { ...c, status: 'error' } : c));
      } else {
        toast.success("Synchronisation forcée lancée !");
      }
    } catch (error) {
      console.error("Sync error:", error);
      toast.error("Erreur de connexion au serveur");
      setConnections(prev => prev.map(c => c.id === connId ? { ...c, status: 'error' } : c));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-poppins font-black text-gray-900 dark:text-white">Connexions & EA</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Synchronisez vos trades via notre Expert Advisor sécurisé.</p>
        </div>
        <button 
          onClick={handleOpenAddModal}
          className="flex items-center justify-center gap-2 bg-zoya-red text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-zoya-red/20 hover:bg-zoya-red-dark hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <Plus size={18} />
          Nouvelle Connexion
        </button>
      </div>

      {/* Instructions Banner */}
      <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-4 max-w-xl">
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
              <ShieldCheck size={14} /> 100% Sécurisé
            </div>
            <h3 className="text-2xl font-poppins font-black">ZoyaEdge Pro Pack</h3>
            <p className="text-indigo-100 text-sm leading-relaxed">
              Ne donnez plus jamais vos mots de passe. Téléchargez notre Expert Advisor (EA) pour MT4/MT5. Il tourne sur votre graphique et envoie vos trades automatiquement vers votre journal. Inclus : notre indicateur exclusif d'aide à la décision.
            </p>
            <div className="flex items-center gap-4 pt-2">
              <a 
                href="/ZoyaEdgeSync.mq5" 
                download="ZoyaEdgeSync.mq5"
                className="flex items-center gap-2 bg-white text-indigo-600 px-5 py-2.5 rounded-xl font-bold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg"
              >
                <Download size={18} />
                Télécharger l'EA (.mq5)
              </a>
              <a href="#" className="text-sm font-medium text-indigo-200 hover:text-white underline underline-offset-4 transition-colors">
                Voir le tutoriel d'installation
              </a>
            </div>
          </div>
          <div className="hidden md:flex items-center justify-center w-32 h-32 bg-white/10 backdrop-blur-md rounded-full border border-white/20 shrink-0">
            <Terminal size={48} className="text-white opacity-80" />
          </div>
        </div>
      </div>

      {/* Connections List */}
      <div className="grid grid-cols-1 gap-4">
        <AnimatePresence>
          {connections.map((conn) => (
            <motion.div 
              key={conn.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-12 h-12 rounded-2xl shrink-0 flex items-center justify-center overflow-hidden bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700",
                )}>
                  {PLATFORM_LOGOS[conn.platform] ? (
                    <img 
                      src={PLATFORM_LOGOS[conn.platform]} 
                      alt={conn.platform} 
                      className={cn(
                        "w-8 h-8 object-contain",
                        conn.platform === 'TradingView' && "dark:invert"
                      )}
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <Server size={24} className="text-gray-400" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-poppins font-bold text-gray-900 dark:text-white">{conn.accountName}</h3>
                    <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-md font-bold uppercase tracking-wider">
                      {conn.platform}
                    </span>
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider",
                      conn.connectionType === 'cloud' ? "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" : "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                    )}>
                      {conn.connectionType === 'cloud' ? 'Cloud' : 'EA'}
                    </span>
                  </div>
                  {conn.brokerLogin && (
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                      ID: {conn.brokerLogin} • {conn.brokerServer}
                    </p>
                  )}
                  <div className="flex items-center gap-1.5 mt-1">
                    {conn.status === 'active' ? (
                      <><CheckCircle2 size={14} className="text-emerald-500" /><span className="text-xs font-medium text-emerald-500">Connecté</span></>
                    ) : conn.status === 'waiting' ? (
                      <><RefreshCw size={14} className="text-amber-500 animate-spin" /><span className="text-xs font-medium text-amber-500">
                        {conn.connectionType === 'cloud' ? 'Initialisation Cloud...' : 'En attente du premier trade...'}
                      </span></>
                    ) : (
                      <><AlertCircle size={14} className="text-rose-500" /><span className="text-xs font-medium text-rose-500">Erreur</span></>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl border border-gray-100 dark:border-gray-800 w-full md:w-auto">
                <div className="flex-1 md:w-64">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">
                    {conn.connectionType === 'cloud' ? 'Mode Cloud Actif' : 'Clé de synchronisation (EA)'}
                  </p>
                  <div className="font-mono text-xs text-gray-900 dark:text-white truncate flex items-center gap-2">
                    {conn.connectionType === 'cloud' ? (
                      <span className="text-purple-500 font-bold flex items-center gap-1">
                        <ShieldCheck size={12} /> Synchronisation Cloud
                      </span>
                    ) : (
                      <>
                        {conn.syncKey ? (
                          visibleKeys.has(conn.id) ? conn.syncKey : '••••••••••••••••••••••••'
                        ) : 'Configuration API requise'}
                        {conn.syncKey && (
                          <button 
                            onClick={() => toggleKeyVisibility(conn.id)}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            {visibleKeys.has(conn.id) ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {conn.syncKey && conn.connectionType !== 'cloud' && (
                  <button 
                    onClick={() => copyToClipboard(conn.syncKey!)}
                    className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-500 hover:text-zoya-red transition-colors shrink-0 shadow-sm"
                    title="Copier la clé"
                  >
                    {copiedKey === conn.syncKey ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                  </button>
                )}
                <div className="w-px h-8 bg-gray-200 dark:bg-gray-700 mx-1"></div>
                <button 
                  onClick={() => handleSync(conn.id)}
                  disabled={conn.status === 'waiting'}
                  className="p-2 text-gray-400 hover:text-indigo-500 transition-colors shrink-0 disabled:opacity-50"
                  title="Synchroniser maintenant"
                >
                  <RefreshCw size={18} className={conn.status === 'waiting' ? "animate-spin" : ""} />
                </button>
                <button 
                  onClick={() => handleDelete(conn.id)}
                  className="p-2 text-gray-400 hover:text-rose-500 transition-colors shrink-0"
                  title="Supprimer"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {connections.length === 0 && !isAdding && (
          <div className="text-center py-12 bg-gray-50 dark:bg-gray-900/50 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-800">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
              <Key size={32} />
            </div>
            <h3 className="text-lg font-poppins font-bold text-gray-900 dark:text-white">Aucune clé de synchronisation</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto mt-2">
              Créez une connexion pour générer votre clé API. Collez-la ensuite dans l'EA ZoyaEdge sur votre MetaTrader.
            </p>
          </div>
        )}
      </div>

      {/* Add Connection Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                <h3 className="text-xl font-poppins font-black text-gray-900 dark:text-white">Nouvelle Connexion</h3>
                <button onClick={() => setIsAdding(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
              </div>
              
              <form onSubmit={handleAddConnection} className="p-6 space-y-5">
                <div className="space-y-3">
                  <label className="text-xs font-bold text-gray-500 uppercase ml-1">Méthode de synchronisation</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setConnectionType('ea')}
                      className={cn(
                        "py-3 rounded-xl text-xs font-bold transition-all border flex flex-col items-center gap-1",
                        connectionType === 'ea' 
                          ? "bg-zoya-red border-zoya-red text-white shadow-lg shadow-zoya-red/20" 
                          : "bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                      )}
                    >
                      <Terminal size={16} />
                      Expert Advisor (EA)
                    </button>
                    <button
                      type="button"
                      onClick={() => setConnectionType('cloud')}
                      className={cn(
                        "py-3 rounded-xl text-xs font-bold transition-all border flex flex-col items-center gap-1",
                        connectionType === 'cloud' 
                          ? "bg-zoya-red border-zoya-red text-white shadow-lg shadow-zoya-red/20" 
                          : "bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                      )}
                    >
                      <RefreshCw size={16} />
                      Cloud Sync (Sans PC)
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase ml-1">Plateforme</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(['MT4', 'MT5', 'TradeLocker', 'CTrader', 'TradingView', 'Tradovate', 'NinjaTrader'] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPlatform(p)}
                        className={cn(
                          "py-2.5 rounded-xl text-[10px] font-bold transition-all border flex flex-col items-center gap-1.5",
                          platform === p 
                            ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-transparent shadow-md" 
                            : "bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                        )}
                      >
                        {PLATFORM_LOGOS[p] ? (
                          <img 
                            src={PLATFORM_LOGOS[p]} 
                            alt={p} 
                            className={cn(
                              "w-5 h-5 object-contain",
                              p === 'TradingView' && platform !== p && "dark:invert",
                              p === 'TradingView' && platform === p && "invert dark:invert-0"
                            )}
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <Server size={14} />
                        )}
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase ml-1">Nom de la connexion</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                      required
                      type="text"
                      placeholder="Ex: Compte FTMO 100k"
                      value={accountName}
                      onChange={e => setAccountName(e.target.value)}
                      className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl py-3 pl-10 pr-4 outline-none focus:ring-2 focus:ring-zoya-red transition-all text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                {platform !== 'TradeLocker' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-500 uppercase ml-1">ID Compte (Login)</label>
                      <div className="relative">
                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input 
                          required
                          type="text"
                          placeholder="12345678"
                          value={brokerLogin}
                          onChange={e => setBrokerLogin(e.target.value)}
                          className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl py-3 pl-10 pr-4 outline-none focus:ring-2 focus:ring-zoya-red transition-all text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-500 uppercase ml-1">Serveur Broker</label>
                      <div className="relative">
                        <Server className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input 
                          required
                          type="text"
                          placeholder="Ex: IC-Markets-Live"
                          value={brokerServer}
                          onChange={e => setBrokerServer(e.target.value)}
                          className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl py-3 pl-10 pr-4 outline-none focus:ring-2 focus:ring-zoya-red transition-all text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {connectionType === 'cloud' && platform !== 'TradeLocker' && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase ml-1">Mot de passe Investisseur</label>
                    <div className="relative">
                      <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input 
                        required
                        type="password"
                        placeholder="Votre mot de passe (Lecture seule)"
                        value={investorPassword}
                        onChange={e => setInvestorPassword(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl py-3 pl-10 pr-4 outline-none focus:ring-2 focus:ring-zoya-red transition-all text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                )}

                {platform !== 'TradeLocker' ? (
                  <div className={cn(
                    "p-4 rounded-2xl border flex gap-3",
                    connectionType === 'cloud' 
                      ? "bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-900/30"
                      : "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-900/30"
                  )}>
                    <ShieldCheck className={cn(
                      "shrink-0",
                      connectionType === 'cloud' ? "text-purple-600 dark:text-purple-400" : "text-emerald-600 dark:text-emerald-400"
                    )} size={20} />
                    <p className={cn(
                      "text-[11px] leading-relaxed font-medium",
                      connectionType === 'cloud' ? "text-purple-700 dark:text-purple-300" : "text-emerald-700 dark:text-emerald-300"
                    )}>
                      {connectionType === 'cloud' 
                        ? "Le mode Cloud connecte votre compte directement à notre VPS sécurisé. Pas besoin de laisser votre PC allumé."
                        : "Une clé de synchronisation unique sera générée. Vous n'aurez pas besoin de fournir votre mot de passe broker."}
                    </p>
                  </div>
                ) : (
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/30 flex gap-3">
                    <AlertCircle className="text-blue-600 dark:text-blue-400 shrink-0" size={20} />
                    <p className="text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed font-medium">
                      L'intégration TradeLocker via API REST est en cours de développement.
                    </p>
                  </div>
                )}

                <button 
                  disabled={loading || (platform === 'TradeLocker')}
                  className="w-full bg-zoya-red text-white py-3.5 rounded-2xl font-poppins font-black shadow-xl shadow-zoya-red/20 hover:bg-zoya-red-dark transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <RefreshCw className="animate-spin" size={20} /> : 'Générer la clé API'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <PaywallModal
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        title="Automatisez votre Trading"
        description="La synchronisation MT4/MT5 via notre Expert Advisor est réservée aux membres Pro et Premium. Gagnez du temps et évitez les erreurs de saisie manuelle."
        requiredTier="pro"
      />
    </div>
  );
}
