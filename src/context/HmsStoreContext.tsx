import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

import SupabaseSetupError from '@/components/SupabaseSetupError'
import { ensureBootstrapStaffInSnapshot } from '@/shared/services/hmsEmptyState'
import { getSupabase } from '@/shared/lib/supabase'
import {
  applyHmsStoreSnapshot,
  applyRemoteHmsStoreSnapshot,
  exportHmsStoreSnapshot,
  getHmsStoreRevision,
  getHmsStoreSeedSnapshot,
  registerStoreChangeNotifier,
  registerSupabasePersistence,
  registerSupabaseSaveNotifier,
  type HmsStoreSnapshot,
} from '@/shared/services/hmsStore'
import { clearHmsLocalStorage, clearStoreDirty, flushPersistAsync, hasPendingPersist } from '@/shared/services/hmsStorePersistence'
import {
  fetchHmsWithMetaFromSupabase,
  isSupabaseBackendEnabled,
  pollHmsSnapshotFromSupabase,
  saveHmsSnapshotToSupabase,
} from '@/shared/services/hmsSupabaseSync'

const SUPABASE_POLL_MS = 8_000
const REFRESH_DEBOUNCE_MS = 400
const HMS_META_ROW_ID = 'main'

type HmsStoreContextType = {
  isReady: boolean
  isSupabase: boolean
  error: string | null
  /** Increments when data reloads from Supabase — all role dashboards stay in sync */
  dataVersion: number
  /** Lightweight meta sync (default). Full bootstrap only on first load or error retry. */
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
  clearStoreDirty()
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
  const [isReady, setIsReady] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dataVersion, setDataVersion] = useState(0)
  const refreshInFlight = useRef(false)
  const refreshDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasBootstrapped = useRef(false)
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

  const scheduleRefreshFromSupabase = useCallback(() => {
    if (!isSupabase) return
    if (refreshDebounceRef.current) clearTimeout(refreshDebounceRef.current)
    refreshDebounceRef.current = setTimeout(() => {
      refreshDebounceRef.current = null
      void refreshFromSupabase()
    }, REFRESH_DEBOUNCE_MS)
  }, [isSupabase, refreshFromSupabase])

  const bootstrap = useCallback(async () => {
    if (!isSupabase) return

    setError(null)
    try {
      remoteUpdatedAt.current = await bootstrapFromSupabase()
      hasBootstrapped.current = true
      clearHmsLocalStorage()

      registerSupabaseSaveNotifier((savedAt) => {
        remoteUpdatedAt.current = savedAt
        bumpDataVersion()
      })
      registerStoreChangeNotifier(() => {
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

  const reload = useCallback(async () => {
    if (!isSupabase) return
    if (hasBootstrapped.current) {
      await refreshFromSupabase()
      return
    }
    await bootstrap()
  }, [isSupabase, bootstrap, refreshFromSupabase])

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  useEffect(() => {
    if (!isSupabase || !hasBootstrapped.current) return

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
      if (refreshDebounceRef.current) clearTimeout(refreshDebounceRef.current)
    }
  }, [isSupabase, error, refreshFromSupabase])

  useEffect(() => {
    if (!isSupabase || error) return

    const supabase = getSupabase()
    const channel = supabase
      .channel('hms-live-sync')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'hms_meta',
          filter: `id=eq.${HMS_META_ROW_ID}`,
        },
        () => {
          scheduleRefreshFromSupabase()
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'hms_lab_requests',
        },
        () => {
          scheduleRefreshFromSupabase()
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'hms_surgery_requests',
        },
        () => {
          scheduleRefreshFromSupabase()
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'hms_admission_requests',
        },
        () => {
          scheduleRefreshFromSupabase()
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'hms_visits',
        },
        () => {
          scheduleRefreshFromSupabase()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [isSupabase, error, scheduleRefreshFromSupabase])

  if (error && isSupabase) {
    return <SupabaseSetupError error={error} onRetry={() => void bootstrap()} />
  }

  return (
    <HmsStoreContext.Provider
      value={{ isReady, isSupabase, error, dataVersion, reload }}
    >
      {children}
    </HmsStoreContext.Provider>
  )
}
