import {
  collection,
  updateDoc,
  doc,
  getDocs,
  getDoc,
  query,
  orderBy,
  where,
  Timestamp,
  limit,
  startAfter,
  setDoc,
  deleteDoc,
  type DocumentSnapshot,
} from "firebase/firestore"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { db, storage } from "./firebase"
import type { Participant, TestSession, Trial, DetailedTapCoordinate, ERPSession, ERPTrialData } from "./types"

const sanitizeForFirestore = <T>(value: T): T => {
  if (value === undefined) {
    return value
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForFirestore(item)) as T
  }

  if (value instanceof Timestamp) {
    return value
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, sanitizeForFirestore(v)])
    return Object.fromEntries(entries) as T
  }

  return value
}

// Participant operations
export const saveParticipant = async (
  participant: Omit<Participant, "id" | "createdAt">,
  id?: string,
): Promise<string> => {
  try {
    const collectionRef = collection(db, "participants")
    const docRef = id ? doc(collectionRef, id) : doc(collectionRef)
    const payload = sanitizeForFirestore({
      ...participant,
      createdAt: Timestamp.now(),
    })
    await setDoc(docRef, payload)
    return docRef.id
  } catch (error) {
    throw error
  }
}

export const getParticipant = async (id: string): Promise<Participant | null> => {
  try {
    const docRef = doc(db, "participants", id)
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      const data = docSnap.data()
      return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt.toDate(),
      } as Participant
    }
    return null
  } catch {
    return null
  }
}

// Test session operations
export const saveTestSession = async (
  session: Omit<TestSession, "id" | "createdAt">,
  id?: string,
): Promise<string> => {
  try {
    const collectionRef = collection(db, "sessions")
    const docRef = id ? doc(collectionRef, id) : doc(collectionRef)
    const payload = sanitizeForFirestore({
      ...session,
      createdAt: Timestamp.now(),
      completedAt: session.completedAt ? Timestamp.fromDate(session.completedAt) : null,
    })
    await setDoc(docRef, payload)
    return docRef.id
  } catch (error) {
    console.error("Error saving test session:", error)
    throw error
  }
}

export const updateTestSession = async (sessionId: string, updates: Partial<TestSession>): Promise<void> => {
  try {
    const sessionRef = doc(db, "sessions", sessionId)
    const updateData: Record<string, unknown> = { ...updates }

    if (Object.prototype.hasOwnProperty.call(updates, "completedAt")) {
      const completedAt = updates.completedAt
      updateData.completedAt = completedAt ? Timestamp.fromDate(completedAt) : null
    }

    const sanitized = sanitizeForFirestore(updateData) as Record<string, unknown>
    if (Object.keys(sanitized).length === 0) {
      return
    }
    await updateDoc(sessionRef, sanitized)
  } catch (error) {
    console.error("Error updating test session:", error)
    throw error
  }
}

export const getTestSession = async (sessionId: string): Promise<TestSession | null> => {
  try {
    const sessionRef = doc(db, "sessions", sessionId)
    const sessionSnap = await getDoc(sessionRef)

    if (!sessionSnap.exists()) {
      return null
    }

    const sessionData = sessionSnap.data()

    // Get trials for this session
    // Try to get trials with ordering, fallback to unordered if index missing
    let trials: Trial[] = []
    try {
      const trialsQuery = query(
        collection(db, "trials"),
        where("sessionId", "==", sessionId),
        orderBy("trialNumber", "asc"),
      )
      const trialsSnapshot = await getDocs(trialsQuery)
      trials = trialsSnapshot.docs.map((trialDoc) => ({
        id: trialDoc.id,
        ...trialDoc.data(),
        createdAt: trialDoc.data().createdAt.toDate(),
      })) as Trial[]
    } catch {
      const trialsQuery = query(
        collection(db, "trials"),
        where("sessionId", "==", sessionId),
      )
      const trialsSnapshot = await getDocs(trialsQuery)
      trials = trialsSnapshot.docs.map((trialDoc) => ({
        id: trialDoc.id,
        ...trialDoc.data(),
        createdAt: trialDoc.data().createdAt.toDate(),
      })) as Trial[]
      trials.sort((a, b) => a.trialNumber - b.trialNumber)
    }

    return {
      id: sessionSnap.id,
      ...sessionData,
      createdAt: sessionData.createdAt.toDate(),
      completedAt: sessionData.completedAt?.toDate(),
      trials,
    } as TestSession
  } catch (error) {
    console.error("Error getting test session:", error)
    return null
  }
}

// Trial operations
export const saveTrial = async (trial: Omit<Trial, "id" | "createdAt">, id?: string): Promise<string> => {
  try {
    const collectionRef = collection(db, "trials")
    const docRef = id ? doc(collectionRef, id) : doc(collectionRef)
    const payload = sanitizeForFirestore({
      ...trial,
      createdAt: Timestamp.now(),
    })
    await setDoc(docRef, payload)
    return docRef.id
  } catch (error) {
    throw error
  }
}

export const getParticipantSessions = async (participantId: string): Promise<TestSession[]> => {
  try {
    const q = query(
      collection(db, "sessions"),
      where("participantId", "==", participantId),
      orderBy("createdAt", "desc"),
    )

    const querySnapshot = await getDocs(q)
    const sessions: TestSession[] = []

    for (const doc of querySnapshot.docs) {
      const data = doc.data()

      // Get trials for this session with fallback
      let trials: Trial[] = []
      try {
        const trialsQuery = query(
          collection(db, "trials"),
          where("sessionId", "==", doc.id),
          orderBy("trialNumber", "asc"),
        )
        const trialsSnapshot = await getDocs(trialsQuery)
        trials = trialsSnapshot.docs.map((trialDoc) => ({
          id: trialDoc.id,
          ...trialDoc.data(),
          createdAt: trialDoc.data().createdAt.toDate(),
        })) as Trial[]
      } catch {
        const trialsQuery = query(
          collection(db, "trials"),
          where("sessionId", "==", doc.id),
        )
        const trialsSnapshot = await getDocs(trialsQuery)
        trials = trialsSnapshot.docs.map((trialDoc) => ({
          id: trialDoc.id,
          ...trialDoc.data(),
          createdAt: trialDoc.data().createdAt.toDate(),
        })) as Trial[]
        trials.sort((a, b) => a.trialNumber - b.trialNumber)
      }

      sessions.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt.toDate(),
        completedAt: data.completedAt?.toDate(),
        trials,
      } as TestSession)
    }

    return sessions
  } catch {
    return []
  }
}

export const getAllSessions = async (
  pageSize = 20,
  lastDoc?: DocumentSnapshot,
): Promise<{
  sessions: TestSession[]
  lastDoc: DocumentSnapshot | null
  hasMore: boolean
}> => {
  try {
    let q = query(collection(db, "sessions"), orderBy("createdAt", "desc"), limit(pageSize))

    if (lastDoc) {
      q = query(collection(db, "sessions"), orderBy("createdAt", "desc"), startAfter(lastDoc), limit(pageSize))
    }

    const querySnapshot = await getDocs(q)
    const sessions: TestSession[] = []

    for (const doc of querySnapshot.docs) {
      const data = doc.data()

      // Get trials for this session with fallback
      let trials: Trial[] = []
      try {
        const trialsQuery = query(
          collection(db, "trials"),
          where("sessionId", "==", doc.id),
          orderBy("trialNumber", "asc"),
        )
        const trialsSnapshot = await getDocs(trialsQuery)
        trials = trialsSnapshot.docs.map((trialDoc) => ({
          id: trialDoc.id,
          ...trialDoc.data(),
          createdAt: trialDoc.data().createdAt.toDate(),
        })) as Trial[]
      } catch {
        const trialsQuery = query(
          collection(db, "trials"),
          where("sessionId", "==", doc.id),
        )
        const trialsSnapshot = await getDocs(trialsQuery)
        trials = trialsSnapshot.docs.map((trialDoc) => ({
          id: trialDoc.id,
          ...trialDoc.data(),
          createdAt: trialDoc.data().createdAt.toDate(),
        })) as Trial[]
        trials.sort((a, b) => a.trialNumber - b.trialNumber)
      }

      sessions.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt.toDate(),
        completedAt: data.completedAt?.toDate(),
        trials,
      } as TestSession)
    }

    const lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1]
    const hasMore = querySnapshot.docs.length === pageSize

    return {
      sessions,
      lastDoc: lastVisible || null,
      hasMore,
    }
  } catch {
    return {
      sessions: [],
      lastDoc: null,
      hasMore: false,
    }
  }
}

export const uploadRecording = async (file: Blob, sessionId: string, type: "screen" | "camera"): Promise<string> => {
  try {
    const fileName = `${sessionId}_${type}_${Date.now()}.webm`
    const storageRef = ref(storage, `recordings/${fileName}`)

    await uploadBytes(storageRef, file)
    const downloadURL = await getDownloadURL(storageRef)

    const sessionRef = doc(db, "sessions", sessionId)
    const updateField = type === "screen" ? "screenRecordingUrl" : "cameraRecordingUrl"
    await updateDoc(sessionRef, {
      [updateField]: downloadURL,
    })

    return downloadURL
  } catch (error) {
    throw error
  }
}

export const searchSessions = async (
  searchTerm: string,
  filters?: {
    shape?: string
    dateFrom?: Date
    dateTo?: Date
  },
): Promise<TestSession[]> => {
  try {
    let q = query(collection(db, "sessions"), orderBy("createdAt", "desc"))

    // Apply filters
    if (filters?.shape) {
      q = query(q, where("shape", "==", filters.shape))
    }

    if (filters?.dateFrom) {
      q = query(q, where("createdAt", ">=", Timestamp.fromDate(filters.dateFrom)))
    }

    if (filters?.dateTo) {
      q = query(q, where("createdAt", "<=", Timestamp.fromDate(filters.dateTo)))
    }

    const querySnapshot = await getDocs(q)
    const sessions: TestSession[] = []

    for (const doc of querySnapshot.docs) {
      const data = doc.data()

      // Filter by search term (client-side since Firestore doesn't support full-text search)
      if (searchTerm && !data.participantName.toLowerCase().includes(searchTerm.toLowerCase())) {
        continue
      }

      // Get trials for this session with fallback
      let trials: Trial[] = []
      try {
        const trialsQuery = query(
          collection(db, "trials"),
          where("sessionId", "==", doc.id),
          orderBy("trialNumber", "asc"),
        )
        const trialsSnapshot = await getDocs(trialsQuery)
        trials = trialsSnapshot.docs.map((trialDoc) => ({
          id: trialDoc.id,
          ...trialDoc.data(),
          createdAt: trialDoc.data().createdAt.toDate(),
        })) as Trial[]
      } catch {
        const trialsQuery = query(
          collection(db, "trials"),
          where("sessionId", "==", doc.id),
        )
        const trialsSnapshot = await getDocs(trialsQuery)
        trials = trialsSnapshot.docs.map((trialDoc) => ({
          id: trialDoc.id,
          ...trialDoc.data(),
          createdAt: trialDoc.data().createdAt.toDate(),
        })) as Trial[]
        trials.sort((a, b) => a.trialNumber - b.trialNumber)
      }

      sessions.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt.toDate(),
        completedAt: data.completedAt?.toDate(),
        trials,
      } as TestSession)
    }

    return sessions
  } catch {
    return []
  }
}

export const saveWrongTap = async (
  trialId: string,
  tap: DetailedTapCoordinate,
  id?: string,
): Promise<string> => {
  try {
    const collectionRef = collection(db, "wrong_taps")
    const docRef = id ? doc(collectionRef, id) : doc(collectionRef)
    const payload = sanitizeForFirestore({
      trialId,
      tap,
      createdAt: Timestamp.now(),
    })
    await setDoc(docRef, payload)
    return docRef.id
  } catch (error) {
    throw error
  }
}

export const saveERPSession = async (
  session: Omit<ERPSession, "id" | "createdAt" | "trials">,
  id?: string,
): Promise<string> => {
  try {
    const collectionRef = collection(db, "erp_sessions")
    const docRef = id ? doc(collectionRef, id) : doc(collectionRef)
    const payload = sanitizeForFirestore({
      ...session,
      createdAt: Timestamp.now(),
    })
    await setDoc(docRef, payload)
    return docRef.id
  } catch (error) {
    throw error
  }
}

export const saveERPTrial = async (
  trial: Omit<ERPTrialData, "id">,
  id?: string,
): Promise<string> => {
  try {
    const collectionRef = collection(db, "erp_trials")
    const docRef = id ? doc(collectionRef, id) : doc(collectionRef)
    const payload = sanitizeForFirestore({
      ...trial,
      createdAt: Timestamp.now(),
    })
    await setDoc(docRef, payload)
    return docRef.id
  } catch (error) {
    throw error
  }
}

export const updateERPSession = async (
  sessionId: string,
  updates: Partial<ERPSession>,
): Promise<void> => {
  try {
    const sessionRef = doc(db, "erp_sessions", sessionId)
    const updateData: Record<string, unknown> = { ...updates }
    if (Object.prototype.hasOwnProperty.call(updates, "completedAt")) {
      const completedAt = updates.completedAt
      updateData.completedAt = completedAt ? Timestamp.fromDate(completedAt) : null
    }
    const sanitized = sanitizeForFirestore(updateData) as Record<string, unknown>
    if (Object.keys(sanitized).length === 0) return
    await updateDoc(sessionRef, sanitized)
  } catch (error) {
    throw error
  }
}

export const getERPSession = async (sessionId: string): Promise<ERPSession | null> => {
  try {
    const sessionRef = doc(db, "erp_sessions", sessionId)
    const sessionSnap = await getDoc(sessionRef)

    if (!sessionSnap.exists()) {
      return null
    }

    const sessionData = sessionSnap.data()

    let trials: ERPTrialData[] = []
    try {
      const trialsQuery = query(
        collection(db, "erp_trials"),
        where("sessionId", "==", sessionId),
        orderBy("trialNumber", "asc"),
      )
      const trialsSnapshot = await getDocs(trialsQuery)
      trials = trialsSnapshot.docs.map((trialDoc) => ({
        id: trialDoc.id,
        ...trialDoc.data(),
        createdAt: trialDoc.data().createdAt?.toDate(),
      })) as ERPTrialData[]
    } catch {
      const trialsQuery = query(
        collection(db, "erp_trials"),
        where("sessionId", "==", sessionId),
      )
      const trialsSnapshot = await getDocs(trialsQuery)
      trials = trialsSnapshot.docs.map((trialDoc) => ({
        id: trialDoc.id,
        ...trialDoc.data(),
        createdAt: trialDoc.data().createdAt?.toDate(),
      })) as ERPTrialData[]
      trials.sort((a, b) => a.trialNumber - b.trialNumber)
    }

    return {
      id: sessionSnap.id,
      ...sessionData,
      createdAt: sessionData.createdAt.toDate(),
      completedAt: sessionData.completedAt?.toDate(),
      trials,
    } as ERPSession
  } catch (error) {
    console.error("Error getting ERP session:", error)
    return null
  }
}

export const getAllERPSessions = async (): Promise<ERPSession[]> => {
  try {
    const q = query(collection(db, "erp_sessions"), orderBy("createdAt", "desc"))
    const querySnapshot = await getDocs(q)
    const sessions: ERPSession[] = []

    for (const docSnap of querySnapshot.docs) {
      const data = docSnap.data()

      let trials: ERPTrialData[] = []
      try {
        const trialsQuery = query(
          collection(db, "erp_trials"),
          where("sessionId", "==", docSnap.id),
          orderBy("trialNumber", "asc"),
        )
        const trialsSnapshot = await getDocs(trialsQuery)
        trials = trialsSnapshot.docs.map((trialDoc) => ({
          id: trialDoc.id,
          ...trialDoc.data(),
          createdAt: trialDoc.data().createdAt?.toDate(),
        })) as ERPTrialData[]
      } catch {
        const trialsQuery = query(
          collection(db, "erp_trials"),
          where("sessionId", "==", docSnap.id),
        )
        const trialsSnapshot = await getDocs(trialsQuery)
        trials = trialsSnapshot.docs.map((trialDoc) => ({
          id: trialDoc.id,
          ...trialDoc.data(),
          createdAt: trialDoc.data().createdAt?.toDate(),
        })) as ERPTrialData[]
        trials.sort((a, b) => a.trialNumber - b.trialNumber)
      }

      sessions.push({
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt.toDate(),
        completedAt: data.completedAt?.toDate(),
        trials,
      } as ERPSession)
    }

    return sessions
  } catch (error) {
    console.error("Error getting all ERP sessions:", error)
    return []
  }
}

export const deleteTestSession = async (sessionId: string): Promise<void> => {
  try {
    const trialsQuery = query(collection(db, "trials"), where("sessionId", "==", sessionId))
    const trialsSnap = await getDocs(trialsQuery)

    for (const trialDoc of trialsSnap.docs) {
      const wrongTapsQuery = query(collection(db, "wrong_taps"), where("trialId", "==", trialDoc.id))
      const wrongTapsSnap = await getDocs(wrongTapsQuery)
      await Promise.all(wrongTapsSnap.docs.map(d => deleteDoc(d.ref)))
      await deleteDoc(trialDoc.ref)
    }

    await deleteDoc(doc(db, "sessions", sessionId))
  } catch (error) {
    console.error("Error deleting test session:", error)
    throw error
  }
}

export const deleteERPSession = async (sessionId: string): Promise<void> => {
  try {
    const trialsQuery = query(collection(db, "erp_trials"), where("sessionId", "==", sessionId))
    const trialsSnap = await getDocs(trialsQuery)
    await Promise.all(trialsSnap.docs.map(d => deleteDoc(d.ref)))

    await deleteDoc(doc(db, "erp_sessions", sessionId))
  } catch (error) {
    console.error("Error deleting ERP session:", error)
    throw error
  }
}
