import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, onSnapshot, getDoc } from 'firebase/firestore';
import { DailyLog, UserProfile } from '../types/health';

// Firebase Project Configuration for NutriFit Cloud Sync
const firebaseConfig = {
  apiKey: "AIzaSyD-NutriFitHealthTrackerSyncApp2026Key",
  authDomain: "nutrifit-health-sync.firebaseapp.com",
  projectId: "nutrifit-health-sync",
  storageBucket: "nutrifit-health-sync.firebasestorage.app",
  messagingSenderId: "98421054210",
  appId: "1:98421054210:web:a1b2c3d4e5f6g7h8i9j0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

const COLLECTION_NAME = 'nutrifit_sync';

// Normalize sync code (remove spaces/dashes, convert to lowercase)
export function normalizeSyncCode(code: string): string {
  return code.trim().replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

// Generate a random 6-digit sync code formatted as XXX-XXX
export function generateSyncCode(): string {
  const digits = Math.floor(100000 + Math.random() * 900000).toString();
  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
}

/**
 * Save / Push local logs & profile to Firebase Cloud Firestore
 */
export async function pushDataToCloud(
  syncCode: string,
  logs: DailyLog[],
  profile: UserProfile
): Promise<boolean> {
  const cleanCode = normalizeSyncCode(syncCode);
  if (!cleanCode) return false;

  try {
    const docRef = doc(db, COLLECTION_NAME, cleanCode);
    await setDoc(docRef, {
      logs,
      profile,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    return true;
  } catch (error) {
    console.error('Error pushing data to Cloud:', error);
    return false;
  }
}

/**
 * Fetch remote data once from Cloud Firestore
 */
export async function fetchCloudData(syncCode: string): Promise<{ logs?: DailyLog[]; profile?: UserProfile } | null> {
  const cleanCode = normalizeSyncCode(syncCode);
  if (!cleanCode) return null;

  try {
    const docRef = doc(db, COLLECTION_NAME, cleanCode);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as { logs: DailyLog[]; profile: UserProfile };
    }
    return null;
  } catch (error) {
    console.error('Error fetching Cloud data:', error);
    return null;
  }
}

/**
 * Subscribe to Realtime Cloud Firestore changes
 */
export function subscribeToCloudSync(
  syncCode: string,
  onUpdate: (data: { logs: DailyLog[]; profile: UserProfile }) => void
): () => void {
  const cleanCode = normalizeSyncCode(syncCode);
  if (!cleanCode) return () => {};

  const docRef = doc(db, COLLECTION_NAME, cleanCode);

  const unsubscribe = onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data && Array.isArray(data.logs) && data.profile) {
          onUpdate({
            logs: data.logs as DailyLog[],
            profile: data.profile as UserProfile,
          });
        }
      }
    },
    (error) => {
      console.warn('Realtime sync subscription warning:', error);
    }
  );

  return unsubscribe;
}
