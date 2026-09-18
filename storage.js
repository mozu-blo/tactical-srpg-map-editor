const DATABASE_NAME = 'srpg-map-editor';
const STORE_NAME = 'maps';
const DATABASE_VERSION = 1;
export const AUTO_SAVE_ID = '__autosave__';

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function runTransaction(mode, operation) {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const request = operation(transaction.objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}

export async function saveMapRecord(id, map) {
  const record = { id, map: structuredClone(map), mapName: map.mapName, updatedAt: new Date().toISOString() };
  await runTransaction('readwrite', (store) => store.put(record));
  return record;
}

export async function loadMapRecord(id) {
  return runTransaction('readonly', (store) => store.get(id));
}

export async function listMapRecords() {
  const records = await runTransaction('readonly', (store) => store.getAll());
  return records.filter((record) => record.id !== AUTO_SAVE_ID).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt));
}
