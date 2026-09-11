import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  Firestore,
} from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

let dbInstance: Firestore | null = null;

export function getServerFirestore(): Firestore {
  if (dbInstance) return dbInstance;

  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    const rawConfig = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(rawConfig);

    const app = getApps().some((a) => a.name === 'server-app')
      ? getApp('server-app')
      : initializeApp(config, 'server-app');

    dbInstance = getFirestore(app, config.firestoreDatabaseId || '(default)');
    return dbInstance;
  } catch (err) {
    console.error('Failed to initialize server Firestore:', err);
    throw err;
  }
}

export {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
};
