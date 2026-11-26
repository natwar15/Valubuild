import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  getFirestore,
  collection,
  addDoc,
  setDoc,
  serverTimestamp,
  doc,
  getDocFromServer,
  Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();
googleAuthProvider.setCustomParameters({ prompt: 'select_account' });

export const db: Firestore = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
}

/**
 * Logs and rethrows a Firestore error. Deliberately carries no email, name or photo
 * URL: error text can end up on screen, in the console or in error reporting.
 */
export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase connection check: offline or awaiting handshake.');
    }
  }
}
testConnection();

export interface CapturePayload {
  email: string;
  source: string;
  tier?: string;
}

export async function submitLead(payload: CapturePayload): Promise<{ success: boolean; id: string }> {
  const cleanEmail = payload.email.trim().toLowerCase();

  try {
    const docData: Record<string, unknown> = {
      email: cleanEmail,
      source: payload.source.slice(0, 100),
      timestamp: serverTimestamp(),
    };
    if (payload.tier) {
      docData.tier = payload.tier.slice(0, 50);
    }

    const docRef = await addDoc(collection(db, 'leads'), docData);
    return { success: true, id: docRef.id };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'leads');
  }
}

export async function syncUserProfileToFirestore(params: {
  uid: string;
  email: string;
  displayName: string;
  monthlyEmailOptIn: boolean;
  anonymisedSharingDefault: boolean;
}) {
  const path = `users/${params.uid}`;
  try {
    await setDoc(
      doc(db, 'users', params.uid),
      {
        uid: params.uid,
        email: params.email.trim().toLowerCase(),
        displayName: params.displayName.slice(0, 120),
        monthlyEmailOptIn: Boolean(params.monthlyEmailOptIn),
        anonymisedSharingDefault: Boolean(params.anonymisedSharingDefault),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    console.warn(`Firestore profile mirror skipped for ${path}:`, error);
  }
}

export async function syncSnapshotToFirestore(params: {
  uid: string;
  snapshotMonth: string;
  practiceLabel: string;
  buyerReadinessScore: number;
  mv1GoodwillGbp: number;
  ypMultiple: number;
}) {
  const safeId = params.snapshotMonth.replace(/[^a-zA-Z0-9_-]/g, '_');
  const path = `users/${params.uid}/snapshots/${safeId}`;
  try {
    await setDoc(
      doc(db, 'users', params.uid, 'snapshots', safeId),
      {
        userId: params.uid,
        snapshotMonth: params.snapshotMonth,
        practiceLabel: params.practiceLabel.slice(0, 120),
        buyerReadinessScore: Math.max(0, Math.min(100, Math.round(params.buyerReadinessScore))),
        mv1GoodwillGbp: Math.max(0, Math.round(params.mv1GoodwillGbp)),
        ypMultiple: Number(params.ypMultiple.toFixed(2)),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    console.warn(`Firestore snapshot mirror skipped for ${path}:`, error);
  }
}
