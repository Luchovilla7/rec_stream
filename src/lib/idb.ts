// Simple Promise wrapper for IndexedDB to store video blobs and chunks locally
const DB_NAME = 'rec_stream_db';
const DB_VERSION = 1;
const RECORDINGS_STORE = 'recordings';
const CHUNKS_STORE = 'chunks';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(RECORDINGS_STORE)) {
        db.createObjectStore(RECORDINGS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(CHUNKS_STORE)) {
        db.createObjectStore(CHUNKS_STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveLocalRecordingBlob(id: string, blob: Blob): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RECORDINGS_STORE, 'readwrite');
    const store = tx.objectStore(RECORDINGS_STORE);
    store.put({ id, blob, updatedAt: new Date().toISOString() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getLocalRecordingBlob(id: string): Promise<Blob | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RECORDINGS_STORE, 'readonly');
    const store = tx.objectStore(RECORDINGS_STORE);
    const request = store.get(id);
    request.onsuccess = () => {
      if (request.result && request.result.blob) {
        resolve(request.result.blob as Blob);
      } else {
        resolve(null);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteLocalRecordingBlob(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RECORDINGS_STORE, 'readwrite');
    const store = tx.objectStore(RECORDINGS_STORE);
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
