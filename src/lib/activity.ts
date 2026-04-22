import { db } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export type ActivityType = 
  | 'trade_added' 
  | 'trade_deleted'
  | 'ai_coach_trigger' 
  | 'ai_coach_complete'
  | 'payment_attempt' 
  | 'subscription_upgrade'
  | 'onboarding_step' 
  | 'onboarding_complete'
  | 'settings_updated';

export async function logActivity(userId: string, type: ActivityType, metadata: any = {}) {
  try {
    await addDoc(collection(db, 'user_activity'), {
      userId,
      type,
      metadata,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Error logging activity:", error);
  }
}
