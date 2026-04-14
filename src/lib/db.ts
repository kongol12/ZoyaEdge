import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, Timestamp, writeBatch, doc, deleteDoc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
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
}

export interface Trade {
  id?: string;
  userId: string;
  pair: string;
  direction: 'buy' | 'sell';
  entryPrice: number;
  exitPrice: number;
  lotSize: number;
  pnl: number;
  strategy: string;
  emotion: '😐' | '😰' | '🔥';
  session: 'London' | 'NY' | 'Asia';
  date: Date;
  createdAt?: Date;
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
  imageUrl?: string;
  createdAt?: Date;
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
    const batch = writeBatch(db);
    const tradesRef = collection(db, 'users', userId, 'trades');
    
    trades.forEach((trade) => {
      const newTradeRef = doc(tradesRef);
      batch.set(newTradeRef, {
        ...trade,
        userId,
        date: Timestamp.fromDate(trade.date),
        createdAt: serverTimestamp(),
      });
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const subscribeToTrades = (userId: string, callback: (trades: Trade[]) => void) => {
  const path = `users/${userId}/trades`;
  const tradesRef = collection(db, 'users', userId, 'trades');
  const q = query(tradesRef, orderBy('date', 'desc'));

  return onSnapshot(q, (snapshot) => {
    const trades = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: data.date?.toDate() || new Date(),
        createdAt: data.createdAt?.toDate() || new Date(),
      } as Trade;
    });
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
  const storageRef = ref(storage, `users/${userId}/notebook/${Date.now()}_${file.name}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
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
