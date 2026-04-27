import { Request, Response, NextFunction } from 'express';
import { getFirebaseAuth, getDb } from '../../infrastructure/firebase/firebase.client';
import { logSystemActivity } from '../../infrastructure/logger/logger';

export interface AuthenticatedRequest extends Request {
  user?: any;
}

export const verifyUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }

  const idToken = authHeader.split('Bearer ')[1];
  const auth = getFirebaseAuth();
  if (!auth) {
    return res.status(503).json({ error: "Auth service unavailable" });
  }

  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    req.user = decodedToken;

    if (req.method !== 'GET') {
      logSystemActivity({
        type: 'action',
        severity: 'info',
        message: `API Call: ${req.method} ${req.path}`,
        userId: req.user.uid,
        userEmail: req.user.email,
        metadata: { path: req.path, method: req.method }
      });
    }
    
    next();
  } catch (error) {
    console.error("User verification failed:", error);
    res.status(401).json({ error: "Unauthorized: Invalid token" });
  }
};

export const verifyAdmin = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  await verifyUser(req, res, async () => {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database unavailable' });
    
    try {
      const globalDoc = await db.collection('app_settings').doc('global').get();
      const superAdmins = globalDoc.exists ? (globalDoc.data()?.superAdmins || []) : [];
      let isGlobalAdmin = false;
      if (req.user?.email && superAdmins.includes(req.user.email.toLowerCase())) {
        isGlobalAdmin = true;
      }

      if (isGlobalAdmin) {
        return next();
      }

      const adminDoc = await db.collection('admins').doc(req.user!.uid).get();
      if (!adminDoc.exists) {
        return res.status(403).json({ error: 'Forbidden: Admins only' });
      }
      next();
    } catch (e) {
      res.status(500).json({ error: 'Failed to verify admin status' });
    }
  });
};

export const verifySuperAdmin = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  await verifyUser(req, res, async () => {
    const db = getDb();
    if (!db) return res.status(503).json({ error: 'Database unavailable' });
    
    try {
      const globalDoc = await db.collection('app_settings').doc('global').get();
      if (!globalDoc.exists) {
        return res.status(403).json({ error: 'Forbidden: Super Admins only' });
      }
      
      const email = req.user?.email?.toLowerCase();
      const { primarySuperAdmin, superAdmins } = globalDoc.data() as any;

      if (email === primarySuperAdmin || (superAdmins && superAdmins.includes(email))) {
        return next();
      }
      return res.status(403).json({ error: 'Forbidden: Super Admins only' });
    } catch (e) {
      res.status(500).json({ error: 'Failed to verify super admin status' });
    }
  });
};
