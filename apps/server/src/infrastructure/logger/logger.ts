import { getDb } from '../firebase/firebase.client';
import admin from 'firebase-admin';

export async function logSystemEvent(level: 'info' | 'warn' | 'error', source: string, message: string, metadata: any = {}) {
  const db = getDb();
  if (!db) {
    console.error(`[SystemLogger][${level.toUpperCase()}] ${source}: ${message}`);
    return;
  }
  
  try {
    await db.collection('system_logs').add({
      level,
      source,
      message,
      metadata,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error("Failed to write to system_logs:", error);
  }
}

export async function logSystemActivity(data: {
  type: 'auth' | 'navigation' | 'action' | 'system' | 'security';
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  userId?: string;
  userEmail?: string;
  metadata?: any;
}) {
  const db = getDb();
  if (!db) return;
  try {
    await db.collection('system_logs').add({
      ...data,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error('[Logger] Failed to log system activity:', error);
  }
}
