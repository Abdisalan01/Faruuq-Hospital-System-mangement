export const HMS_STORE_STORAGE_KEY = 'fsh_hms_store_v1'
export const HMS_STORE_VERSION = 1

const DEBOUNCE_MS = 400
const AUTO_SAVE_MS = 2000

let persistTimer: ReturnType<typeof setTimeout> | null = null
let autoSaveTimer: ReturnType<typeof setInterval> | null = null
let getSnapshotFn: (() => unknown) | null = null
let supabasePersistFn: (() => Promise<void>) | null = null
let supabaseSaveInFlight = false
let fastSaveInFlight = false

const MUTATING_ARRAY_METHODS = new Set([
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse',
])

export function schedulePersist(): void {
  if (!getSnapshotFn || typeof window === 'undefined') return
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(flushPersist, DEBOUNCE_MS)
}

/** Cancel debounced save before an immediate Supabase write */
export function clearPendingPersist(): void {
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
}

/** Block background poll while an immediate Supabase write is running */
export function beginFastSave(): void {
  fastSaveInFlight = true
}

export function endFastSave(): void {
  fastSaveInFlight = false
}

/** True while a debounced or in-flight Supabase save is pending */
export function hasPendingPersist(): boolean {
  return persistTimer !== null || supabaseSaveInFlight || fastSaveInFlight
}

export function registerSupabasePersistHandler(handler: () => Promise<void>): void {
  supabasePersistFn = handler
}

export function flushPersist(): void {
  if (!getSnapshotFn) return

  // Database mode: Supabase only — skip localStorage
  if (!supabasePersistFn && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(HMS_STORE_STORAGE_KEY, JSON.stringify(getSnapshotFn()))
    } catch (error) {
      console.warn('[HMS] Failed to persist store to localStorage', error)
    }
  }

  if (!supabasePersistFn) return
  void runSupabasePersist()
}

/** Wait for Supabase save — use after create/update before navigating away */
export async function flushPersistAsync(): Promise<void> {
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  if (!getSnapshotFn) return

  if (!supabasePersistFn) {
    flushPersist()
    return
  }

  await runSupabasePersist(true)
}

async function runSupabasePersist(rethrow = false): Promise<void> {
  if (!supabasePersistFn) return
  if (fastSaveInFlight) return

  if (supabaseSaveInFlight) {
    await waitForSupabaseSaveIdle()
    return runSupabasePersist(rethrow)
  }

  supabaseSaveInFlight = true
  try {
    await supabasePersistFn()
  } catch (error) {
    console.warn('[HMS] Failed to persist store to Supabase', error)
    if (rethrow) throw error
  } finally {
    supabaseSaveInFlight = false
  }
}

function waitForSupabaseSaveIdle(): Promise<void> {
  return new Promise((resolve) => {
    const tick = () => {
      if (!supabaseSaveInFlight) {
        resolve()
        return
      }
      setTimeout(tick, 50)
    }
    tick()
  })
}

export function loadHmsStoreSnapshot<T>(): T | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(HMS_STORE_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as T
    return parsed
  } catch {
    return null
  }
}

export function clearHmsLocalStorage(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(HMS_STORE_STORAGE_KEY)
}

export function registerHmsStorePersistence(getSnapshot: () => unknown): void {
  getSnapshotFn = getSnapshot

  if (typeof window === 'undefined') return

  window.addEventListener('beforeunload', flushPersist)

  if (autoSaveTimer) clearInterval(autoSaveTimer)
  autoSaveTimer = setInterval(flushPersist, AUTO_SAVE_MS)
}

/** Wrap arrays so push/splice and index writes trigger a debounced save */
export function createPersistableArray<T>(items: T[]): T[] {
  const arr = [...items]
  return new Proxy(arr, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver)
      if (typeof value === 'function' && MUTATING_ARRAY_METHODS.has(String(prop))) {
        return (...args: unknown[]) => {
          const result = (value as (...a: unknown[]) => unknown).apply(target, args)
          schedulePersist()
          return result
        }
      }
      return value
    },
    set(target, prop, value, receiver) {
      const ok = Reflect.set(target, prop, value, receiver)
      schedulePersist()
      return ok
    },
  })
}

/** Wrap settings object so property updates trigger a debounced save */
export function createPersistableObject<T extends object>(obj: T): T {
  return new Proxy(obj, {
    set(target, prop, value, receiver) {
      const ok = Reflect.set(target, prop, value, receiver)
      schedulePersist()
      return ok
    },
  })
}
