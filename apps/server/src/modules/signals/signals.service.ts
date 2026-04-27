import { getDb } from '../../infrastructure/firebase/firebase.client';
import admin from 'firebase-admin';

export interface SignalData {
  pair: string;
  type: 'buy' | 'sell';
  entry: number;
  tp?: number;
  sl?: number;
  time: number;
  source: string;
}

export const processMt5Signal = async (signal: SignalData) => {
  const db = getDb();
  if (!db) throw new Error("DB not initialized");

  const signalRef = await db.collection('signals').add({
    ...signal,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    status: 'pending',
    analyzedByAI: false
  });

  return { success: true, signalId: signalRef.id };
};

export const analyzeSignalWithAI = async (signalId: string) => {
  const db = getDb();
  if (!db) throw new Error("DB not initialized");

  // Placeholder for AI Analysis logic
  await db.collection('signals').doc(signalId).update({
    analyzedByAI: true,
    aiRecommendation: 'High Probability',
    aiConfidence: 0.85,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return { success: true, analyzed: true };
};
