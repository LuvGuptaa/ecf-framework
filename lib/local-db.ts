import type { Recording } from "./types"

const DB_NAME = "reaction-time-recordings"
const DB_VERSION = 1
const STORE_RECORDINGS = "recordings"

let dbPromise: Promise<IDBDatabase> | null = null

const isIndexedDBAvailable = () => typeof window !== "undefined" && "indexedDB" in window

const getDb = (): Promise<IDBDatabase> => {
  if (!isIndexedDBAvailable()) {
    return Promise.reject(new Error("IndexedDB is not available."))
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(STORE_RECORDINGS)) {
          db.createObjectStore(STORE_RECORDINGS, { keyPath: "id" })
        }
      }

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  return dbPromise
}

const requestToPromise = <T>(request: IDBRequest<T>): Promise<T> => {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export const localDB = {
  async saveRecording(recording: Recording): Promise<void> {
    const db = await getDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_RECORDINGS, "readwrite")
      const store = tx.objectStore(STORE_RECORDINGS)
      store.put(recording)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  },

  async getRecording(id: string): Promise<Recording | null> {
    const db = await getDb()
    const tx = db.transaction(STORE_RECORDINGS, "readonly")
    const store = tx.objectStore(STORE_RECORDINGS)
    const result = await requestToPromise<Recording | undefined>(store.get(id))
    return result ?? null
  },

  async getRecordingsBySession(sessionId: string): Promise<Recording[]> {
    const db = await getDb()
    const tx = db.transaction(STORE_RECORDINGS, "readonly")
    const store = tx.objectStore(STORE_RECORDINGS)
    const allRecordings = await requestToPromise<Recording[]>(store.getAll())
    return allRecordings.filter((rec) => rec.sessionId === sessionId)
  },
}
