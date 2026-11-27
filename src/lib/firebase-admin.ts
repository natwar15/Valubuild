import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import firebaseConfig from '../../firebase-applet-config.json';

/**
 * Checking sign-in tokens needs only the project id. Deleting a user's
 * Firestore data and sign-in account (account erasure) needs server
 * credentials: automatic on Google Cloud, but elsewhere (Netlify) set
 * FIREBASE_SERVICE_ACCOUNT to the service account key JSON, base64-encoded.
 */
function credential() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (!raw) return undefined;
  try {
    const json = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
    return cert(JSON.parse(json));
  } catch (e) {
    console.error('FIREBASE_SERVICE_ACCOUNT is set but could not be read:', (e as Error).message);
    return undefined;
  }
}

if (!getApps().length) {
  const cred = credential();
  initializeApp({
    projectId: firebaseConfig.projectId,
    ...(cred ? { credential: cred } : {}),
  });
}

export const adminAuth = getAuth();
