import { db } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export type ActivityType = 'system' | 'auth' | 'payment' | 'admin' | 'error';
export type ActivitySeverity = 'info' | 'warning' | 'error' | 'critical';

export const logActivity = async (
  message: string, 
  type: ActivityType = 'system', 
  severity: ActivitySeverity = 'info', 
  metadata: any = {}, 
  userId?: string
) => {
  try {
    await addDoc(collection(db, 'activities'), {
      message,
      type,
      severity,
      metadata,
      userId: userId || null,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
};

export const logSystemEvent = async (
  event: string, 
  details: any = {}
) => {
  try {
    await addDoc(collection(db, 'system_logs'), {
      event,
      details,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Failed to log system event:", error);
  }
};
