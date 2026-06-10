import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

import SupabaseSetupError from '@/components/SupabaseSetupError'
import { ensureBootstrapStaffInSnapshot } from '@/shared/services/hmsEmptyState'
import {
  applyHmsStoreSnapshot,
  applyRemoteHmsStoreSnapshot,
  exportHmsStoreSnapshot,
  getHmsStoreRevision,
  getHmsStoreSeedSnapshot,
  registerSupabasePersistence,
  registerSupabaseSaveNotifier,
  type HmsStoreSnapshot,
} from '@/shared/services/hmsStore'
import { clearHmsLocalStorage, flushPersistAsync, hasPendingPersist } from '@/shared/services/hmsStorePersistence'
import {
  fetchHmsWithMetaFromSupabase,
  isSupabaseBackendEnabled,
  pollHmsSnapshotFromSupabase,
  saveHmsSnapshotToSupabase,
} from '@/shared/services/hmsSupabaseSync'

const SUPABASE_POLL_MS = 3_000

type HmsStoreContextType = {
  isReady: boolean
  isSupabase: boolean
  error: string | null
  /** Increments when data reloads from Supabase — all role dashboards stay in sync */
  dataVersion: number
  reload: () => Promise<void>
}

const HmsStoreContext = createContext<HmsStoreContextType | undefined>(undefined)

export function useHmsStoreContext() {
  const context = useContext(HmsStoreContext)
  if (!context) {
    throw new Error('useHmsStoreContext must be used within HmsStoreProvider')
  }
  return context
}

async function applySnapshotFromSupabase(snapshot: HmsStoreSnapshot | null, remoteWins = true) {
  if (!snapshot) return false

  const { snapshot: safeSnapshot, repaired: staffRepaired } = ensureBootstrapStaffInSnapshot(snapshot)
  const staffEmailsFixed = remoteWins
    ? applyRemoteHmsStoreSnapshot(safeSnapshot)
    : applyHmsStoreSnapshot(safeSnapshot)
  if (staffRepaired || staffEmailsFixed) {
    await saveHmsSnapshotToSupabase(exportHmsStoreSnapshot())
  }
  return true
}

async function bootstrapFromSupabase(): Promise<string | null> {
  let fetched = await fetchHmsWithMetaFromSupabase()

  if (!fetched) {
    const seed = getHmsStoreSeedSnapshot()
    await saveHmsSnapshotToSupabase(seed)
    fetched = await fetchHmsWithMetaFromSupabase()
    if (!fetched) {
      await applySnapshotFromSupabase(seed)
      return new Date().toISOString()
    }
  }

  await applySnapshotFromSupabase(fetched.snapshot)
  return fetched.updatedAt
}

export function HmsStoreProvider({ children }: { children: ReactNode }) {
  const isSupabase = isSupabaseBackendEnabled()
  const [isReady, setIsReady] = useState(!isSupabase)
  const [error, setError] = useState<string | null>(null)
  const [dataVersion, setDataVersion] = useState(0)
  const refreshInFlight = useRef(false)
  const remoteUpdatedAt = useRef<string | null>(null)

  const bumpDataVersion = useCallback(() => {
    setDataVersion(getHmsStoreRevision())
  }, [])

  const refreshFromSupabase = useCallback(async () => {
    if (!isSupabase || refreshInFlight.current || hasPendingPersist()) return

    refreshInFlight.current = true
    try {
      const polled = await pollHmsSnapshotFromSupabase(remoteUpdatedAt.current)
      if (!polled) return

      remoteUpdatedAt.current = polled.updatedAt
      if (await applySnapshotFromSupabase(polled.snapshot, true)) {
        bumpDataVersion()
      }
    } catch (err) {
      console.warn('[HMS] Background refresh failed', err)
    } finally {
      refreshInFlight.current = false
    }
  }, [isSupabase, bumpDataVersion])

  const load = useCallback(async () => {
    if (!isSupabase) {
      setIsReady(true)
      return
    }

    setError(null)
    try {
      remoteUpdatedAt.current = await bootstrapFromSupabase()
      clearHmsLocalStorage()

      registerSupabaseSaveNotifier((savedAt) => {
        remoteUpdatedAt.current = savedAt
        bumpDataVersion()
      })
      registerSupabasePersistence(async () => {
        const savedAt = await saveHmsSnapshotToSupabase(exportHmsStoreSnapshot())
        if (savedAt) remoteUpdatedAt.current = savedAt
      })
      bumpDataVersion()
      setIsReady(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load hospital data'
      setError(message)
      setIsReady(true)
    }
  }, [isSupabase, bumpDataVersion])

  useEffect(() => {
    void load()
  }, [load])

  // Keep Admin, Reception, Doctor, Emergency, Nurse, Pharmacy, Lab dashboards in sync
  useEffect(() => {
    if (!isSupabase || !isReady) return

    const interval = setInterval(() => {
      void refreshFromSupabase()
    }, SUPABASE_POLL_MS)

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void refreshFromSupabase()
      } else if (document.visibilityState === 'hidden') {
        void flushPersistAsync().catch((err) => {
          console.warn('[HMS] Save before hide failed', err)
        })
      }
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [isSupabase, isReady, refreshFromSupabase])

  if (!isReady) {
    return (
      <div className="d-flex flex-column align-items-center justify-content-center min-vh-100 gap-2">
        <div className="spinner-border spinner-border-sm text-primary" role="status" />
        <p className="text-muted mb-0 small">FSH Hospital — loading…</p>
      </div>
    )
  }

  if (error && isSupabase) {
    return <SupabaseSetupError error={error} onRetry={() => void load()} />
  }

  return (
    <HmsStoreContext.Provider
      value={{ isReady, isSupabase, error, dataVersion, reload: load }}
    >
      {children}
    </HmsStoreContext.Provider>
  )
}
