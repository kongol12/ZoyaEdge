import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile as updateFirebaseProfile,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  sendEmailVerification
} from 'firebase/auth';
import { auth, db } from './firebase';
export { auth };
import { doc, setDoc, getDoc, serverTimestamp, onSnapshot, collection, addDoc } from 'firebase/firestore';

// Set persistence was moved inside AuthProvider
interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signUpWithEmail: (email: string, pass: string, name: string) => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
  changePassword: (currentPass: string, newPass: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  isSuperAdmin: (email: string | null | undefined) => Promise<boolean>;
}

export type OnboardingStep = "PROFILE" | "ADD_TRADES" | "AI_ANALYSIS" | "COMPLETED";

export interface OnboardingState {
  step: OnboardingStep;
  tradesCount: number;
  skipped: boolean;
  completed: boolean;
}

export interface UserProfile {
  email: string;
  displayName: string;
  phone?: string;
  country?: string;
  tradingStyle?: string;
  experienceLevel?: 'beginner' | 'intermediate' | 'advanced' | 'expert' | string;
  capitalSize?: string;
  defaultRisk?: number;
  defaultLotSize?: number;
  currency?: string;
  onboarded?: boolean;
  onboardingState?: OnboardingState;
  subscription?: 'free' | 'pro' | 'premium' | 'discovery' | 'elite';
  subscriptionCycle?: 'monthly' | 'yearly';
  subscriptionStatus?: 'active' | 'expired' | 'canceled' | 'trialing' | 'suspended' | string;
  subscriptionEndDate?: any;
  hasUsedTrial?: boolean;
  initialBalance?: number;
  aiCredits?: number;
  role?: 'user' | 'agent' | 'admin' | 'super_admin';
  createdBy?: string;
  isEmergencyAdmin?: boolean;
  bypassMaintenance?: boolean;
  createdAt: any;
  updatedAt?: any;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signInWithGoogle: async () => {},
  signUpWithEmail: async () => {},
  signInWithEmail: async () => {},
  logout: async () => {},
  updateProfile: async () => {},
  refreshProfile: async () => {},
  changePassword: async () => {},
  sendPasswordReset: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (uid: string) => {
    try {
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        setProfile(userSnap.data() as UserProfile);
        return userSnap.data() as UserProfile;
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    }
    return null;
  };

  useEffect(() => {
    // Set persistence to local storage safely
    setPersistence(auth, browserLocalPersistence).catch(err => {
      console.error("Auth persistence error:", err);
    });

    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      try {
        if (currentUser) {
          // Set user immediately
          setUser(currentUser);

          // Force fresh fetch or just wait for onSnapshot
          // If the profile doesn't exist yet, it's likely a new signup
          const userRef = doc(db, 'users', currentUser.uid);
          
          let initialLoad = true;
          unsubscribeProfile = onSnapshot(userRef, async (userSnap) => {
            if (userSnap.exists()) {
              setProfile(userSnap.data() as UserProfile);
            } else {
              // Only create if it definitely doesn't exist
              try {
                const trialEndDate = new Date();
                trialEndDate.setDate(trialEndDate.getDate() + 7);

                const newProfile = {
                  email: currentUser.email || '',
                  displayName: currentUser.displayName || (auth.currentUser?.displayName) ||  'Utilisateur',
                  createdAt: serverTimestamp(),
                  onboarded: false,
                  subscription: 'pro',
                  subscriptionStatus: 'trialing',
                  subscriptionEndDate: trialEndDate,
                  hasUsedTrial: true,
                  aiCredits: 10,
                  initialBalance: 0,
                  role: 'user',
                };
                await setDoc(doc(db, 'users', currentUser.uid), newProfile);
              } catch (createError) {
                console.error("Error creating profile:", createError);
              }
            }
            if (initialLoad) {
              initialLoad = false;
              setLoading(false);
            }
          });
        } else {
          setUser(null);
          setProfile(null);
          if (unsubscribeProfile) unsubscribeProfile();
          setLoading(false);
        }
      } catch (err) {
        console.error("Auth state change error:", err);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const logAuthEvent = async (message: string, type: 'auth' | 'security' = 'auth', severity: 'info' | 'warning' = 'info') => {
    if (!auth.currentUser) return;
    try {
      await addDoc(collection(db, 'system_logs'), {
        type,
        severity,
        message,
        userId: auth.currentUser.uid,
        userEmail: auth.currentUser.email,
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      console.error("Failed to log auth event:", e);
    }
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
    await logAuthEvent("Connexion via Google réussie");
  };

  const signUpWithEmail = async (email: string, pass: string, name: string) => {
    const res = await createUserWithEmailAndPassword(auth, email, pass);
    await updateFirebaseProfile(res.user, { displayName: name });
    
    // Send verification email
    await sendEmailVerification(res.user);
    
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 7);

    const newProfile = {
      email,
      displayName: name,
      createdAt: serverTimestamp(),
      onboarded: false,
      subscription: 'pro',
      subscriptionStatus: 'trialing',
      subscriptionEndDate: trialEndDate,
      hasUsedTrial: true,
      aiCredits: 10,
      initialBalance: 0,
      role: 'user',
    };
    await setDoc(doc(db, 'users', res.user.uid), newProfile);
    setProfile(newProfile as UserProfile);
    await logAuthEvent("Nouvelle inscription par email réussie");
  };

  const signInWithEmail = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
    await logAuthEvent("Connexion par email réussie");
  };

  const logout = async () => {
    await logAuthEvent("Déconnexion de l'utilisateur", 'auth', 'info');
    await signOut(auth);
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;
    // Filter out restricted fields that should not be updated by the user directly
    const { 
      createdAt, 
      role, 
      email, 
      subscription, 
      subscriptionStatus, 
      subscriptionEndDate, 
      aiCredits, 
      hasUsedTrial,
      bypassMaintenance,
      isAdmin,
      ...updatableData 
    } = data as any;
    
    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, { 
      ...updatableData, 
      updatedAt: serverTimestamp() 
    }, { merge: true });
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.uid);
  };

  const changePassword = async (currentPass: string, newPass: string) => {
    if (!user || !user.email) throw new Error("User not authenticated");
    
    // Reauthenticate
    const credential = EmailAuthProvider.credential(user.email, currentPass);
    await reauthenticateWithCredential(user, credential);
    
    // Update password
    await updatePassword(user, newPass);
  };

  const sendPasswordReset = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const isSuperAdmin = async (email: string | null | undefined) => {
    if (!email) return false;
    const PRIMARY_EMAIL = import.meta.env.VITE_PRIMARY_SUPER_ADMIN_EMAIL?.toLowerCase();
    
    if (email.toLowerCase() === PRIMARY_EMAIL) return true;

    try {
      const settingsSnap = await getDoc(doc(db, 'app_settings', 'global'));
      if (settingsSnap.exists()) {
        const superAdmins = settingsSnap.data().superAdmins || [];
        return superAdmins.includes(email.toLowerCase());
      }
      return false;
    } catch (error) {
      console.error("Error checking super admin status:", error);
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      loading, 
      signInWithGoogle, 
      signUpWithEmail, 
      signInWithEmail, 
      logout, 
      updateProfile,
      refreshProfile,
      changePassword,
      sendPasswordReset,
      isSuperAdmin
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
