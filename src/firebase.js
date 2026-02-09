// Firebase configuration for Spelling Bee app
// Users configure their own Firebase project details via the Settings page
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, updateDoc, deleteField, collection, getDocs } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage';

let app = null;
let db = null;
let storage = null;

const FIREBASE_CONFIG_KEY = 'spellingBee_firebaseConfig';

// Hardcoded Firebase config — this is safe to embed in frontend code
// (Firebase security rules protect the data, not the config)
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyD-VFK6pNhdM3M7ymyCIL0bDvEmR05u_RM",
  authDomain: "spelling-bee-d8d8e.firebaseapp.com",
  projectId: "spelling-bee-d8d8e",
  storageBucket: "spelling-bee-d8d8e.firebasestorage.app",
  messagingSenderId: "57333490926",
  appId: "1:57333490926:web:34cc5c9b8034bf5a00ffff",
  measurementId: "G-NKDL2LJL3P"
};

export function getStoredFirebaseConfig() {
  return DEFAULT_FIREBASE_CONFIG;
}

export function saveFirebaseConfig(config) {
  // Config is hardcoded, but we still support the save path for the setup wizard
  return initFirebase(config || DEFAULT_FIREBASE_CONFIG);
}

export function initFirebase(config) {
  try {
    app = initializeApp(config);
    db = getFirestore(app);
    storage = getStorage(app);
    return true;
  } catch (e) {
    console.error('Firebase init error:', e);
    return false;
  }
}

export function isFirebaseReady() {
  return db !== null && storage !== null;
}

// --- API Keys (stored in Firestore so only one parent needs to enter them) ---
export async function getApiKeys() {
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, 'config', 'apiKeys'));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.error('Error getting API keys:', e);
    return null;
  }
}

export async function saveApiKeys(keys) {
  if (!db) return;
  await setDoc(doc(db, 'config', 'apiKeys'), keys, { merge: true });
}

// --- Spelling Groups ---
export async function getGroups() {
  if (!db) return [];
  try {
    const snap = await getDoc(doc(db, 'config', 'groups'));
    return snap.exists() ? (snap.data().groups || []) : [];
  } catch {
    return [];
  }
}

export async function saveGroups(groups) {
  if (!db) return;
  await setDoc(doc(db, 'config', 'groups'), { groups });
}

// --- Week Data (spelling lists, sentences, stories, per group) ---
function getWeekId() {
  // Get the current "spelling week" — runs Thursday noon to Thursday noon UK time
  const now = new Date();
  // Convert to UK time
  const ukTime = new Date(now.toLocaleString('en-GB', { timeZone: 'Europe/London' }));
  const day = ukTime.getDay(); // 0=Sun, 4=Thu
  const hour = ukTime.getHours();

  // If it's Thursday after noon, or any day after Thursday (Fri-Wed), we're in the new week
  // We use the Thursday date as the week ID
  const d = new Date(ukTime);
  if (day === 4 && hour >= 12) {
    // It's Thursday afternoon — this Thursday is the start
  } else if (day > 4) {
    // Fri or Sat — go back to Thursday
    d.setDate(d.getDate() - (day - 4));
  } else {
    // Sun(0), Mon(1), Tue(2), Wed(3), or Thu morning
    // Go back to last Thursday
    d.setDate(d.getDate() - ((day + 3) % 7));
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getCurrentWeekId() {
  return getWeekId();
}

export async function getWeekData(groupName) {
  if (!db) return null;
  const weekId = getWeekId();
  try {
    const snap = await getDoc(doc(db, 'weeks', `${weekId}_${groupName}`));
    if (snap.exists()) {
      const data = snap.data();
      // Check it's for the current week
      if (data.weekId === weekId) return data;
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveWeekData(groupName, data) {
  if (!db) return;
  const weekId = getWeekId();
  await setDoc(doc(db, 'weeks', `${weekId}_${groupName}`), {
    ...data,
    weekId,
    groupName,
    updatedAt: new Date().toISOString()
  });
}

// --- Audio Storage ---
export async function uploadAudio(groupName, filename, audioBlob) {
  if (!storage) return null;
  const weekId = getWeekId();
  const path = `audio/${weekId}/${groupName}/${filename}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, audioBlob);
  return getDownloadURL(storageRef);
}

export async function getAudioUrl(groupName, filename) {
  if (!storage) return null;
  const weekId = getWeekId();
  const path = `audio/${weekId}/${groupName}/${filename}`;
  try {
    return await getDownloadURL(ref(storage, path));
  } catch {
    return null;
  }
}

// --- Practice Tracking ---
export async function logPractice(groupName, childName, score, totalWords) {
  if (!db) return;
  const weekId = getWeekId();
  const docRef = doc(db, 'practice', `${weekId}_${groupName}`);
  try {
    const snap = await getDoc(docRef);
    const existing = snap.exists() ? snap.data() : { weekId, groupName, children: {} };
    
    if (!existing.children[childName]) {
      existing.children[childName] = { attempts: 0 };
    }
    existing.children[childName].attempts += 1;
    existing.children[childName].lastPractice = new Date().toISOString();
    
    await setDoc(docRef, existing);
  } catch (e) {
    console.error('Error logging practice:', e);
  }
}

export async function getPracticeData(groupName) {
  if (!db) return null;
  const weekId = getWeekId();
  try {
    const snap = await getDoc(doc(db, 'practice', `${weekId}_${groupName}`));
    return snap.exists() ? snap.data() : null;
  } catch {
    return null;
  }
}

// --- Children Names ---
export async function getChildren() {
  if (!db) return [];
  try {
    const snap = await getDoc(doc(db, 'config', 'children'));
    return snap.exists() ? (snap.data().names || []) : [];
  } catch {
    return [];
  }
}

export async function saveChildren(names) {
  if (!db) return;
  await setDoc(doc(db, 'config', 'children'), { names });
}

// --- Cleanup old weeks ---
export async function cleanupOldAudio() {
  if (!storage) return;
  const weekId = getWeekId();
  const audioRef = ref(storage, 'audio');
  try {
    const result = await listAll(audioRef);
    for (const folderRef of result.prefixes) {
      if (folderRef.name !== weekId) {
        const files = await listAll(folderRef);
        for (const groupFolder of files.prefixes) {
          const groupFiles = await listAll(groupFolder);
          for (const fileRef of groupFiles.items) {
            await deleteObject(fileRef);
          }
        }
      }
    }
  } catch (e) {
    console.log('Cleanup skipped:', e.message);
  }
}
