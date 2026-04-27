import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';

let db: admin.firestore.Firestore | null = null;
let auth: admin.auth.Auth | null = null;

export const initFirebaseAdmin = async () => {
  if (db) return { db, auth };

  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (!fs.existsSync(configPath)) {
      console.warn("firebase-applet-config.json not found.");
      return { db, auth };
    }

    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    
    if (admin.apps.length > 0) {
      await Promise.all(admin.apps.map(app => app?.delete()));
    }

    let credential = admin.credential.applicationDefault();
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        credential = admin.credential.cert(serviceAccount);
      } catch (e) {
        console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:", e);
      }
    }

    const app = admin.initializeApp({
      credential,
      projectId: firebaseConfig.projectId,
    });

    db = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);
    auth = getAuth(app);
    return { db, auth };
  } catch (error) {
    console.error("Failed to initialize Firebase Admin:", error);
    return { db, auth };
  }
};

export const getDb = () => db;
export const getFirebaseAuth = () => auth;
