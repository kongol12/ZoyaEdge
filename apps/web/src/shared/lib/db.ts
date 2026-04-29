/// <reference types="vite/client" />
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, Timestamp, writeBatch, doc, deleteDoc, updateDoc, getDoc, setDoc, limit, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth, storage } from './firebase';
import { AICoachResponse } from './ai';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface Trade {
  id?: string;
  userId: string;

  // Identité de l’actif
  pair: string; // symbole normalisé : XAUUSD, NAS100, VOLATILITY_100, CME:6E1!, etc.
  assetType?: 'forex' | 'indices' | 'crypto' | 'commodities' | 'futures' | 'synthetic' | 'unknown';

  // Métadonnées de marché
  platform?: 'deriv' | 'tradingview' | 'mt4' | 'mt5' | 'csv' | 'manual' | string;
  type?: 'trade' | 'deposit' | 'withdrawal' | 'adjustment';

  // Sens et prix
  direction?: 'buy' | 'sell';
  entryPrice?: number;
  exitPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  lotSize?: number;

  // Métriques calculées
  pnl: number;
  pips?: number;
  risk?: number;
  reward?: number;
  rr?: number;
  label?: 'Pips' | 'Points' | 'Ticks';

  // Métadonnées de trade
  strategy?: string;
  emotion?: '😐' | '🔥' | '😰' | '🧠' | '🤩' | '🤑' | '😤';
  session?: 'London' | 'NY' | 'Asia' | 'other';
  date: Date;
  createdAt?: Date;

  // Données import MT5 / CSV
  commission?: number;
  swap?: number;
  positionId?: string;
  openTime?: Date;
  closeTime?: Date;

  // Flags
  isDemo?: boolean;
  hiddenByClient?: boolean;

  // Champ libre pour compatibilité future
  [key: string]: any;
}

export interface Strategy {
  id?: string;
  name: string;
  description: string;
  marketConditions: string[];
  entryRules: string[];
  exitRules: string[];
  indicators: string[];
  createdAt?: Date;
}

export interface NotebookEntry {
  id?: string;
  userId: string;
  date: Date;
  content: string;
  emotion?: '😐' | '🔥' | '😰' | '🧠' | '🤩' | '🤑' | '😤';
  imageUrl?: string;
  createdAt?: Date;
}

export interface Notification {
  id?: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  read: boolean;
  createdAt: Date;
}

export const addTrade = async (userId: string, tradeData: Omit<Trade, 'id' | 'userId' | 'createdAt'>) => {
  const path = `users/${userId}/trades`;
  try {
    const tradesRef = collection(db, 'users', userId, 'trades');
    await addDoc(tradesRef, {
      ...tradeData,
      userId,
      date: Timestamp.fromDate(tradeData.date),
      createdAt: serverTimestamp(),
      isDemo: false, // Explicitly set false for real trades
      type: 'trade', // Ensure uniform type for metrics
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const addStrategy = async (userId: string, strategyData: Omit<Strategy, 'id' | 'createdAt'>) => {
  const path = `users/${userId}/strategies`;
  try {
    const strategiesRef = collection(db, 'users', userId, 'strategies');
    await addDoc(strategiesRef, {
      ...strategyData,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const deleteStrategy = async (userId: string, strategyId: string) => {
  const path = `users/${userId}/strategies/${strategyId}`;
  try {
    const strategyRef = doc(db, 'users', userId, 'strategies', strategyId);
    await deleteDoc(strategyRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const subscribeToStrategies = (userId: string, callback: (strategies: Strategy[]) => void) => {
  const path = `users/${userId}/strategies`;
  const strategiesRef = collection(db, 'users', userId, 'strategies');
  const q = query(strategiesRef, orderBy('createdAt', 'desc'));

  return onSnapshot(q, (snapshot) => {
    const strategies = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
      } as Strategy;
    });
    callback(strategies);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, path);
  });
};

export const importTrades = async (userId: string, trades: Omit<Trade, 'id' | 'userId' | 'createdAt'>[]) => {
  const path = `users/${userId}/trades (batch)`;
  try {
    // Firestore batches are limited to 500 operations. We split the trades into chunks.
    const CHUNK_SIZE = 450;
    for (let i = 0; i < trades.length; i += CHUNK_SIZE) {
      const chunk = trades.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      const tradesRef = collection(db, 'users', userId, 'trades');
      
      chunk.forEach((trade) => {
        const newTradeRef = doc(tradesRef);
        batch.set(newTradeRef, {
          ...trade,
          userId,
          date: Timestamp.fromDate(trade.date),
          createdAt: serverTimestamp(),
          isDemo: false,
          hiddenByClient: false // Ensure they are visible
        });
      });

      await batch.commit();
      console.log(`[Firestore] Batch chunk ${i / CHUNK_SIZE + 1} committed (${chunk.length} trades)`);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
};

export const subscribeToTrades = (userId: string, callback: (trades: Trade[]) => void, includeHidden = false) => {
  const path = `users/${userId}/trades`;
  const tradesRef = collection(db, 'users', userId, 'trades');
  const q = query(tradesRef, orderBy('date', 'desc'));

  return onSnapshot(q, (snapshot) => {
    if (!import.meta.env.PROD) {
      console.log(`[Firestore] Received ${snapshot.docs.length} trades for user ${userId}`);
    }
    const trades = snapshot.docs.map(doc => {
      const data = doc.data();
      const convertDate = (d: any) => {
        if (!d) return new Date();
        if (d.toDate) return d.toDate();
        if (d._seconds) return new Date(d._seconds * 1000);
        if (d instanceof Date) return d;
        return new Date(d);
      };
      return {
        id: doc.id,
        ...data,
        date: convertDate(data.date),
        createdAt: convertDate(data.createdAt),
      } as Trade;
    }).filter(t => (includeHidden || !t.hiddenByClient) && (t.isDemo === false || t.isDemo === undefined));
    
    callback(trades);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, path);
  });
};

export const addNotebookEntry = async (userId: string, entryData: Omit<NotebookEntry, 'id' | 'userId' | 'createdAt'>) => {
  const path = `users/${userId}/notebook`;
  try {
    const notebookRef = collection(db, 'users', userId, 'notebook');
    await addDoc(notebookRef, {
      ...entryData,
      userId,
      date: Timestamp.fromDate(entryData.date),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const subscribeToNotebook = (userId: string, callback: (entries: NotebookEntry[]) => void) => {
  const path = `users/${userId}/notebook`;
  const notebookRef = collection(db, 'users', userId, 'notebook');
  const q = query(notebookRef, orderBy('date', 'desc'));

  return onSnapshot(q, (snapshot) => {
    const entries = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: data.date?.toDate() || new Date(),
        createdAt: data.createdAt?.toDate() || new Date(),
      } as NotebookEntry;
    });
    callback(entries);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, path);
  });
};

export const deleteNotebookEntry = async (userId: string, entryId: string) => {
  const path = `users/${userId}/notebook/${entryId}`;
  try {
    const entryRef = doc(db, 'users', userId, 'notebook', entryId);
    await deleteDoc(entryRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const uploadImage = async (userId: string, file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        const MAX_DIM = 800;
        if (width > height) {
          if (width > MAX_DIM) {
            height = Math.round(height * (MAX_DIM / width));
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width = Math.round(width * (MAX_DIM / height));
            height = MAX_DIM;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
           ctx.drawImage(img, 0, 0, width, height);
           const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
           resolve(dataUrl);
        } else {
           reject(new Error("Could not get canvas context"));
        }
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const saveAIAnalysis = async (userId: string, analysis: AICoachResponse) => {
  const path = `users/${userId}/ai_coach/latest`;
  try {
    const analysisRef = doc(db, 'users', userId, 'ai_coach', 'latest');
    await setDoc(analysisRef, {
      ...analysis,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const getAIAnalysis = async (userId: string): Promise<AICoachResponse | null> => {
  const path = `users/${userId}/ai_coach/latest`;
  try {
    const analysisRef = doc(db, 'users', userId, 'ai_coach', 'latest');
    const docSnap = await getDoc(analysisRef);
    if (docSnap.exists()) {
      return docSnap.data() as AICoachResponse;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
};

export const subscribeToNotifications = (userId: string, callback: (notifications: Notification[]) => void) => {
  const path = `users/${userId}/notifications`;
  const notifRef = collection(db, 'users', userId, 'notifications');
  const q = query(notifRef, orderBy('createdAt', 'desc'), limit(50));

  return onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
      } as Notification;
    });
    callback(notifications);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, path);
  });
};

export const markNotificationAsRead = async (userId: string, notifId: string) => {
  const path = `users/${userId}/notifications/${notifId}`;
  try {
    const notifRef = doc(db, 'users', userId, 'notifications', notifId);
    await updateDoc(notifRef, { read: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

export const sendNotificationToUser = async (userId: string, notif: Omit<Notification, 'id' | 'createdAt' | 'read'>) => {
  const path = `users/${userId}/notifications`;
  try {
    const notifRef = collection(db, 'users', userId, 'notifications');
    await addDoc(notifRef, {
      ...notif,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const subscribeToGlobalNotifications = (callback: (notifications: Notification[]) => void) => {
  const path = `global_notifications`;
  const notifRef = collection(db, 'global_notifications');
  const q = query(notifRef, orderBy('createdAt', 'desc'), limit(10));

  return onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
      } as Notification;
    });
    callback(notifications);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, path);
  });
};

export const sendGlobalNotification = async (notif: Omit<Notification, 'id' | 'createdAt' | 'read'>) => {
  const path = `global_notifications`;
  try {
    const globalNotifRef = collection(db, 'global_notifications');
    await addDoc(globalNotifRef, {
      ...notif,
      read: false,
      createdAt: serverTimestamp(),
    });
    
    // Also add to admin logs
    const adminNotifRef = collection(db, 'admin_notifications');
    await addDoc(adminNotifRef, {
      ...notif,
      title: `[GLOBAL] ${notif.title}`,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const hardDeleteAllTrades = async (userId: string) => {
  const path = `users/${userId}/trades (delete-all)`;
  try {
    const tradesRef = collection(db, 'users', userId, 'trades');
    const snapshot = await getDocs(tradesRef);
    const batch = writeBatch(db);
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
};

export const hardDeleteTrades = async (userId: string, tradeIds: string[]) => {
  const path = `users/${userId}/trades (delete-batch)`;
  try {
    const batch = writeBatch(db);
    tradeIds.forEach((id) => {
      const tradeRef = doc(db, 'users', userId, 'trades', id);
      batch.delete(tradeRef);
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
};
