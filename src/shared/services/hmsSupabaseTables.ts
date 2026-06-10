import { getSupabase } from '@/shared/lib/supabase'
import type { Patient, StaffUser, Visit } from '@/shared/types'

import { createEmptyHmsSnapshot, ensureBootstrapStaffInSnapshot } from './hmsEmptyState'
import type { HmsStoreSnapshot } from './hmsStore'
import { normalizeStaffUserEmail } from './passwordUtils'

const HMS_META_ID = 'main'

const REGISTRATION_MIRROR_TABLES: {
  key:
    | 'patients'
    | 'visits'
    | 'payments'
    | 'incomeRecords'
    | 'receptionReceipts'
  table: string
}[] = [
  { key: 'patients', table: 'hms_patients' },
  { key: 'visits', table: 'hms_visits' },
  { key: 'payments', table: 'hms_payments' },
  { key: 'incomeRecords', table: 'hms_income_records' },
  { key: 'receptionReceipts', table: 'hms_reception_receipts' },
]

/** Payments, income, receipts — mirrored on every save so finance data is not JSON-only */
const RECEPTION_PAYMENT_MIRROR_TABLES: {
  key: 'payments' | 'incomeRecords' | 'receptionReceipts'
  table: string
}[] = [
  { key: 'payments', table: 'hms_payments' },
  { key: 'incomeRecords', table: 'hms_income_records' },
  { key: 'receptionReceipts', table: 'hms_reception_receipts' },
]

/** Reception surgery fee collection */
const SURGERY_FEE_MIRROR_TABLES: {
  key: 'surgeryRequests' | 'visits' | 'payments' | 'incomeRecords' | 'receptionReceipts'
  table: string
}[] = [
  { key: 'surgeryRequests', table: 'hms_surgery_requests' },
  { key: 'visits', table: 'hms_visits' },
  { key: 'payments', table: 'hms_payments' },
  { key: 'incomeRecords', table: 'hms_income_records' },
  { key: 'receptionReceipts', table: 'hms_reception_receipts' },
]

/** Inpatient charge collection — admissions, lab/surgery status, payments, receipts */
const INPATIENT_PAYMENT_MIRROR_TABLES: {
  key:
    | 'admissions'
    | 'beds'
    | 'labRequests'
    | 'surgeryRequests'
    | 'visits'
    | 'payments'
    | 'incomeRecords'
    | 'receptionReceipts'
    | 'patientAccounts'
    | 'accountTransactions'
  table: string
}[] = [
  { key: 'admissions', table: 'hms_admissions' },
  { key: 'beds', table: 'hms_beds' },
  { key: 'labRequests', table: 'hms_lab_requests' },
  { key: 'surgeryRequests', table: 'hms_surgery_requests' },
  { key: 'visits', table: 'hms_visits' },
  { key: 'payments', table: 'hms_payments' },
  { key: 'incomeRecords', table: 'hms_income_records' },
  { key: 'receptionReceipts', table: 'hms_reception_receipts' },
  { key: 'patientAccounts', table: 'hms_patient_accounts' },
  { key: 'accountTransactions', table: 'hms_account_transactions' },
]

const CATALOG_MIRROR_TABLES: {
  key: 'labTestCatalog' | 'medicineCatalog' | 'inventoryItems' | 'surgeryCatalog'
  table: string
}[] = [
  { key: 'labTestCatalog', table: 'hms_lab_test_catalog' },
  { key: 'medicineCatalog', table: 'hms_medicine_catalog' },
  { key: 'inventoryItems', table: 'hms_inventory_items' },
  { key: 'surgeryCatalog', table: 'hms_surgery_catalog' },
]

const FACILITY_MIRROR_TABLES: { key: 'wards' | 'rooms' | 'beds'; table: string }[] = [
  { key: 'wards', table: 'hms_wards' },
  { key: 'rooms', table: 'hms_rooms' },
  { key: 'beds', table: 'hms_beds' },
]

/** Doctor consultation workflow — notes, prescriptions, labs, surgery, admissions, nurse orders */
const DOCTOR_MIRROR_TABLES: {
  key:
    | 'clinicalNotes'
    | 'prescriptions'
    | 'labRequests'
    | 'surgeryRequests'
    | 'admissionRequests'
    | 'doctorOrders'
  table: string
}[] = [
  { key: 'clinicalNotes', table: 'hms_clinical_notes' },
  { key: 'prescriptions', table: 'hms_prescriptions' },
  { key: 'labRequests', table: 'hms_lab_requests' },
  { key: 'surgeryRequests', table: 'hms_surgery_requests' },
  { key: 'admissionRequests', table: 'hms_admission_requests' },
  { key: 'doctorOrders', table: 'hms_doctor_orders' },
]

const COLLECTION_TABLES: { key: keyof Omit<HmsStoreSnapshot, 'version' | 'idCounter' | 'systemSettings'>; table: string }[] = [
  { key: 'departments', table: 'hms_departments' },
  { key: 'staffUsers', table: 'hms_staff_users' },
  { key: 'patients', table: 'hms_patients' },
  { key: 'patientAccounts', table: 'hms_patient_accounts' },
  { key: 'accountTransactions', table: 'hms_account_transactions' },
  { key: 'receptionReceipts', table: 'hms_reception_receipts' },
  { key: 'visits', table: 'hms_visits' },
  { key: 'clinicalNotes', table: 'hms_clinical_notes' },
  { key: 'diagnoses', table: 'hms_diagnoses' },
  { key: 'prescriptions', table: 'hms_prescriptions' },
  { key: 'labRequests', table: 'hms_lab_requests' },
  { key: 'surgeryRequests', table: 'hms_surgery_requests' },
  { key: 'departmentSupplyRequests', table: 'hms_department_supply_requests' },
  { key: 'pharmacySupplyRequests', table: 'hms_pharmacy_supply_requests' },
  { key: 'labSupplyRequests', table: 'hms_lab_supply_requests' },
  { key: 'admissionRequests', table: 'hms_admission_requests' },
  { key: 'wards', table: 'hms_wards' },
  { key: 'rooms', table: 'hms_rooms' },
  { key: 'beds', table: 'hms_beds' },
  { key: 'labTestCatalog', table: 'hms_lab_test_catalog' },
  { key: 'medicineCatalog', table: 'hms_medicine_catalog' },
  { key: 'surgeryCatalog', table: 'hms_surgery_catalog' },
  { key: 'discounts', table: 'hms_discounts' },
  { key: 'patientDiscounts', table: 'hms_patient_discounts' },
  { key: 'admissions', table: 'hms_admissions' },
  { key: 'medicationAdministrations', table: 'hms_medication_administrations' },
  { key: 'nursingNotes', table: 'hms_nursing_notes' },
  { key: 'doctorOrders', table: 'hms_doctor_orders' },
  { key: 'inventoryItems', table: 'hms_inventory_items' },
  { key: 'stockTransactions', table: 'hms_stock_transactions' },
  { key: 'payments', table: 'hms_payments' },
  { key: 'emergencyCases', table: 'hms_emergency_cases' },
  { key: 'incomeRecords', table: 'hms_income_records' },
  { key: 'expenseRecords', table: 'hms_expense_records' },
]

function isMissingColumnError(message: string): boolean {
  return message.includes('full_snapshot')
}

function isMissingTableError(message: string): boolean {
  if (isMissingColumnError(message)) return false
  return (
    message.includes('schema cache') ||
    message.includes('relation') ||
    /table.*does not exist/i.test(message)
  )
}

function mergeSystemSettings(
  columnSettings: HmsStoreSnapshot['systemSettings'] | null | undefined,
  snapshotSettings: HmsStoreSnapshot['systemSettings'] | null | undefined,
  metaUpdatedAt: string,
  base: HmsStoreSnapshot['systemSettings'],
): HmsStoreSnapshot['systemSettings'] {
  const col = columnSettings ?? base
  const snap = snapshotSettings ?? base
  const colTime = Date.parse(col.lastModifiedAt ?? '') || 0
  const snapTime = Date.parse(snap.lastModifiedAt ?? '') || Date.parse(metaUpdatedAt) || 0
  const picked = snapTime >= colTime ? snap : col
  return { ...base, ...picked }
}

function hydrateSnapshotFromMeta(meta: {
  version: number
  id_counter: number
  system_settings: HmsStoreSnapshot['systemSettings']
  full_snapshot?: HmsStoreSnapshot | null
  updated_at?: string
}): HmsStoreSnapshot | null {
  if (!meta.full_snapshot || typeof meta.full_snapshot !== 'object') return null

  const snapshot = meta.full_snapshot as HmsStoreSnapshot
  const base = createEmptyHmsSnapshot()
  const metaUpdatedAt = meta.updated_at ?? new Date().toISOString()
  return {
    ...base,
    ...snapshot,
    version: (meta.version ?? snapshot.version ?? base.version) as typeof base.version,
    idCounter: meta.id_counter ?? snapshot.idCounter ?? base.idCounter,
    systemSettings: mergeSystemSettings(
      meta.system_settings,
      snapshot.systemSettings,
      metaUpdatedAt,
      base.systemSettings,
    ),
  }
}

/** Fast upsert — verifies rows saved (catches missing UPDATE policy / RLS blocks) */
async function upsertMirrorRows<T extends { id: string }>(
  table: string,
  items: T[],
  options?: { verify?: boolean },
): Promise<void> {
  if (items.length === 0) return
  const supabase = getSupabase()
  const updatedAt = new Date().toISOString()
  const rows = items.map((item) => ({
    id: item.id,
    data: { ...item, lastModifiedAt: updatedAt },
    updated_at: updatedAt,
  }))
  const verify = options?.verify ?? items.length <= 5

  const { data, error } = await supabase
    .from(table)
    .upsert(rows, { onConflict: 'id' })
    .select('id')

  if (error) {
    throw new Error(
      `${table} save failed: ${error.message}. Run supabase/migrations/004_hms_rls_policies_and_grants.sql in Supabase SQL Editor.`,
    )
  }

  if (verify) {
    const savedCount = data?.length ?? 0
    if (savedCount < rows.length) {
      throw new Error(
        `${table}: only ${savedCount}/${rows.length} rows saved. Check RLS UPDATE policy and GRANT for anon role in Supabase Dashboard → Authentication → Policies.`,
      )
    }
  }
}

/** Save hms_meta full_snapshot — source of truth on reload. Throws if not persisted. */
async function upsertMetaSnapshot(
  snapshot: HmsStoreSnapshot,
  updatedAt: string,
): Promise<string> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('hms_meta')
    .upsert({
      id: HMS_META_ID,
      version: snapshot.version,
      id_counter: snapshot.idCounter,
      system_settings: snapshot.systemSettings,
      full_snapshot: snapshot,
      updated_at: updatedAt,
    })
    .select('id, updated_at')
    .single()

  if (error) {
    if (isMissingColumnError(error.message)) {
      await saveHmsToLegacyTables(snapshot)
      return updatedAt
    }
    throw new Error(`hms_meta save failed: ${error.message}`)
  }

  if (!data?.updated_at) {
    throw new Error(
      'hms_meta save returned no rows. Enable UPDATE policy on hms_meta for anon role (run migration 004).',
    )
  }

  return data.updated_at as string
}

/** Delete staff rows removed locally (e.g. after admin deletes a user) */
async function deleteStaffRows(removedIds: string[]): Promise<void> {
  if (removedIds.length === 0) return
  const supabase = getSupabase()
  const { error } = await supabase.from('hms_staff_users').delete().in('id', removedIds)
  if (error) throw new Error(error.message)
}

async function syncCollection<T extends { id: string }>(table: string, items: T[]): Promise<void> {
  if (items.length === 0) return

  const supabase = getSupabase()
  const ids = new Set(items.map((item) => item.id))

  const { data: existing, error: fetchError } = await supabase.from(table).select('id')
  if (fetchError) throw new Error(fetchError.message)

  const staleIds = (existing ?? []).map((row) => row.id).filter((id) => !ids.has(id))
  if (staleIds.length > 0) {
    const { error: deleteError } = await supabase.from(table).delete().in('id', staleIds)
    if (deleteError) throw new Error(deleteError.message)
  }

  await upsertMirrorRows(table, items)
}

async function saveHmsToLegacyTables(snapshot: HmsStoreSnapshot): Promise<void> {
  const supabase = getSupabase()
  const { error: metaError } = await supabase.from('hms_meta').upsert({
    id: HMS_META_ID,
    version: snapshot.version,
    id_counter: snapshot.idCounter,
    system_settings: snapshot.systemSettings,
    updated_at: new Date().toISOString(),
  })
  if (metaError) throw new Error(metaError.message)

  await Promise.all(
    COLLECTION_TABLES.map(({ key, table }) =>
      syncCollection(table, snapshot[key] as { id: string }[]),
    ),
  )
}

async function fetchCollectionWithMeta<T extends { id: string }>(
  table: string,
): Promise<TableRowMeta<T>[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase.from(table).select('data, updated_at')

  if (error) throw new Error(`${table} read failed: ${error.message}`)
  return (data ?? []).map((row: { data: T; updated_at: string }) => ({
    item: row.data,
    updatedAt: row.updated_at,
  }))
}

async function fetchCollection<T extends { id: string }>(table: string): Promise<T[]> {
  const rows = await fetchCollectionWithMeta<T>(table)
  return rows.map((row) => row.item)
}

/** hms_* row with server-side updated_at for merge decisions */
type TableRowMeta<T> = { item: T; updatedAt: string }

type WithModifiedAt = { id: string; lastModifiedAt?: string }

const TERMINAL_VISIT_STATUSES = new Set<Visit['status']>(['Completed', 'Cancelled'])

function isTerminalVisitStatus(status: Visit['status']): boolean {
  return TERMINAL_VISIT_STATUSES.has(status)
}

function entityModifiedAt(item: WithModifiedAt | undefined): number {
  return Date.parse(item?.lastModifiedAt ?? '') || 0
}

/** Never downgrade Completed/Cancelled visits to Waiting during merge */
function pickMergedVisit(remote: Visit, local: Visit, preferLocalOnTie: boolean): Visit {
  const rTime = entityModifiedAt(remote)
  const lTime = entityModifiedAt(local)
  const rTerminal = isTerminalVisitStatus(remote.status)
  const lTerminal = isTerminalVisitStatus(local.status)

  if (rTerminal && !lTerminal) {
    return lTime > rTime ? { ...local } : { ...remote }
  }
  if (lTerminal && !rTerminal) {
    return rTime > lTime ? { ...remote } : { ...local }
  }

  if (lTime > rTime) return { ...local }
  if (rTime > lTime) return { ...remote }
  return preferLocalOnTie ? { ...local } : { ...remote }
}

function mergeVisitsPreferNewer(remote: Visit[], local: Visit[]): Visit[] {
  const remoteMap = new Map(remote.map((r) => [r.id, r]))
  const localMap = new Map(local.map((r) => [r.id, r]))
  const ids = new Set([...remoteMap.keys(), ...localMap.keys()])
  const result: Visit[] = []

  for (const id of ids) {
    const r = remoteMap.get(id)
    const l = localMap.get(id)
    if (!l) {
      if (r) result.push({ ...r })
      continue
    }
    if (!r) {
      result.push({ ...l })
      continue
    }
    result.push(pickMergedVisit(r, l, true))
  }

  return result
}

/** Pick visit row from mirror table or meta snapshot — respects terminal statuses */
function preferNewerVisitRows(
  snapshotRows: Visit[],
  tableRows: TableRowMeta<Visit>[],
  snapshotBatchUpdatedAt: string,
): Visit[] {
  const snapMap = new Map(snapshotRows.map((r) => [r.id, r]))
  const tableMap = new Map(tableRows.map((r) => [r.item.id, r]))
  const snapBatchTime = Date.parse(snapshotBatchUpdatedAt) || 0
  const ids = new Set([...snapMap.keys(), ...tableMap.keys()])
  const result: Visit[] = []

  const entityWriteTime = (item: unknown, rowUpdatedAt: string): number => {
    const embedded = (item as { lastModifiedAt?: string } | null)?.lastModifiedAt
    const rowTime = Date.parse(rowUpdatedAt) || 0
    if (embedded) return Math.max(Date.parse(embedded) || 0, rowTime)
    return rowTime
  }

  for (const id of ids) {
    const snap = snapMap.get(id)
    const table = tableMap.get(id)
    if (!table) {
      if (snap) result.push({ ...snap })
      continue
    }
    if (!snap) {
      result.push({ ...table.item })
      continue
    }

    const tableTime = entityWriteTime(table.item, table.updatedAt)
    const snapTime = Math.max(entityWriteTime(snap, ''), snapBatchTime)

    if (tableTime > snapTime) {
      result.push(pickMergedVisit(table.item, snap, false))
    } else if (tableTime < snapTime) {
      result.push(pickMergedVisit(snap, table.item, true))
    } else {
      result.push(pickMergedVisit(table.item, snap, entityModifiedAt(table.item) >= entityModifiedAt(snap)))
    }
  }

  return result
}

/** Pick row from mirror table or meta snapshot — whichever was updated most recently */
function preferNewerRows<T extends { id: string }>(
  snapshotRows: T[],
  tableRows: TableRowMeta<T>[],
  snapshotBatchUpdatedAt: string,
): T[] {
  const snapMap = new Map(snapshotRows.map((r) => [r.id, r]))
  const tableMap = new Map(tableRows.map((r) => [r.item.id, r]))
  const snapBatchTime = Date.parse(snapshotBatchUpdatedAt) || 0
  const ids = new Set([...snapMap.keys(), ...tableMap.keys()])
  const result: T[] = []

  const entityWriteTime = (item: unknown, rowUpdatedAt: string): number => {
    const embedded = (item as { lastModifiedAt?: string } | null)?.lastModifiedAt
    const rowTime = Date.parse(rowUpdatedAt) || 0
    if (embedded) return Math.max(Date.parse(embedded) || 0, rowTime)
    return rowTime
  }

  for (const id of ids) {
    const snap = snapMap.get(id)
    const table = tableMap.get(id)
    if (!table) {
      if (snap) result.push({ ...snap })
      continue
    }
    if (!snap) {
      result.push({ ...table.item })
      continue
    }
    const tableTime = entityWriteTime(table.item, table.updatedAt)
    const snapTime = Math.max(entityWriteTime(snap, ''), snapBatchTime)
    if (tableTime > snapTime) {
      result.push({ ...table.item })
    } else if (tableTime < snapTime) {
      result.push({ ...snap })
    } else {
      // Equal timestamps — prefer table when it carries a fresher lastModifiedAt
      const tableMod = entityModifiedAt(table.item as WithModifiedAt)
      const snapMod = entityModifiedAt(snap as WithModifiedAt)
      result.push(tableMod >= snapMod ? { ...table.item } : { ...snap })
    }
  }

  return result
}

function staffEntityWriteTime(item: StaffUser, rowUpdatedAt?: string): number {
  const rowTime = Date.parse(rowUpdatedAt ?? '') || 0
  const mod = Date.parse(item.lastModifiedAt ?? '') || 0
  return Math.max(mod, rowTime)
}

/** Staff merge — keeps login fields in sync while preserving the newest registration fee */
function mergeStaffRecord(
  snap: StaffUser,
  table: TableRowMeta<StaffUser>,
  snapBatchTime: number,
): StaffUser {
  const tableItem = table.item
  const snapTime = Math.max(staffEntityWriteTime(snap), snapBatchTime)
  const tableTime = staffEntityWriteTime(tableItem, table.updatedAt)

  let merged: StaffUser
  if (tableTime > snapTime) merged = { ...tableItem }
  else if (tableTime < snapTime) merged = { ...snap }
  else merged = { ...tableItem, ...snap }

  const snapHasFee = snap.serviceFee != null
  const tableHasFee = tableItem.serviceFee != null
  const snapFeeTime = snapHasFee ? staffEntityWriteTime(snap) : 0
  const tableFeeTime = tableHasFee ? staffEntityWriteTime(tableItem, table.updatedAt) : 0

  if (snapHasFee && (!tableHasFee || snapFeeTime >= tableFeeTime)) {
    merged.serviceFee = snap.serviceFee
  } else if (tableHasFee) {
    merged.serviceFee = tableItem.serviceFee
  }

  normalizeStaffUserEmail(merged)
  return merged
}

function preferNewerStaffRows(
  snapshotStaff: StaffUser[],
  tableRows: TableRowMeta<StaffUser>[],
  snapshotBatchUpdatedAt: string,
): StaffUser[] {
  const snapMap = new Map(snapshotStaff.map((r) => [r.id, r]))
  const tableMap = new Map(tableRows.map((r) => [r.item.id, r]))
  const snapBatchTime = Date.parse(snapshotBatchUpdatedAt) || 0
  const ids = new Set([...snapMap.keys(), ...tableMap.keys()])
  const result: StaffUser[] = []

  for (const id of ids) {
    const snap = snapMap.get(id)
    const table = tableMap.get(id)
    if (!table && snap) {
      const copy = { ...snap }
      normalizeStaffUserEmail(copy)
      result.push(copy)
      continue
    }
    if (!snap && table) {
      const copy = { ...table.item }
      normalizeStaffUserEmail(copy)
      result.push(copy)
      continue
    }
    if (snap && table) {
      result.push(mergeStaffRecord(snap, table, snapBatchTime))
    }
  }

  return result
}

/** Union by id — local entries win (prevents auto-save from wiping users created elsewhere) */
function mergeCollectionsLocalWins<T extends { id: string }>(base: T[], local: T[]): T[] {
  const merged = new Map<string, T>()
  for (const item of base) merged.set(item.id, { ...item })
  for (const item of local) merged.set(item.id, { ...item })
  return Array.from(merged.values())
}

/** Per-row merge — pick entity with newest lastModifiedAt; tie → local wins (in-memory edits) */
function mergeCollectionsPreferNewer<T extends WithModifiedAt>(remote: T[], local: T[]): T[] {
  const remoteMap = new Map(remote.map((r) => [r.id, r]))
  const localMap = new Map(local.map((r) => [r.id, r]))
  const ids = new Set([...remoteMap.keys(), ...localMap.keys()])
  const result: T[] = []

  for (const id of ids) {
    const r = remoteMap.get(id)
    const l = localMap.get(id)
    if (!l) {
      if (r) result.push({ ...r })
      continue
    }
    if (!r) {
      result.push({ ...l })
      continue
    }
    const rTime = entityModifiedAt(r)
    const lTime = entityModifiedAt(l)
    if (lTime >= rTime) result.push({ ...l })
    else result.push({ ...r })
  }

  return result
}

type MergeResult = {
  snapshot: HmsStoreSnapshot
  removedStaffIds: string[]
}

type SnapshotCollectionKey = (typeof COLLECTION_TABLES)[number]['key']

function mergeCollectionOnSave<K extends SnapshotCollectionKey>(
  remote: HmsStoreSnapshot,
  snapshot: HmsStoreSnapshot,
  key: K,
): HmsStoreSnapshot[K] {
  if (key === 'visits') {
    return mergeVisitsPreferNewer(remote.visits ?? [], snapshot.visits ?? []) as HmsStoreSnapshot[K]
  }
  const remoteRows = (remote[key] as WithModifiedAt[]) ?? []
  const localRows = (snapshot[key] as WithModifiedAt[]) ?? []
  return mergeCollectionsPreferNewer(remoteRows, localRows) as HmsStoreSnapshot[K]
}

function buildMergedCollectionsOnSave(
  remote: HmsStoreSnapshot,
  snapshot: HmsStoreSnapshot,
): Partial<HmsStoreSnapshot> {
  const merged: Partial<HmsStoreSnapshot> = {}
  for (const { key } of COLLECTION_TABLES) {
    ;(merged as Record<string, unknown>)[key] = mergeCollectionOnSave(remote, snapshot, key)
  }
  return merged
}

async function mergeSnapshotWithRemoteBeforeSave(snapshot: HmsStoreSnapshot): Promise<MergeResult> {
  const supabase = getSupabase()
  const { data: meta, error } = await supabase
    .from('hms_meta')
    .select('full_snapshot')
    .eq('id', HMS_META_ID)
    .maybeSingle()

  if (error) throw new Error(error.message)

  const remote = (meta?.full_snapshot as HmsStoreSnapshot | null) ?? null
  if (!remote) {
    return {
      snapshot: ensureBootstrapStaffInSnapshot(snapshot).snapshot,
      removedStaffIds: [],
    }
  }

  const staffUsers = mergeCollectionsLocalWins(remote.staffUsers ?? [], snapshot.staffUsers ?? []).map(
    (staff) => {
      const copy = { ...staff }
      normalizeStaffUserEmail(copy)
      return copy
    },
  )

  const localStaffIds = new Set(staffUsers.map((user) => user.id))
  const removedStaffIds = (remote.staffUsers ?? [])
    .map((user) => user.id)
    .filter((id) => !localStaffIds.has(id))

  const mergedCollections = buildMergedCollectionsOnSave(remote, snapshot)

  return {
    snapshot: ensureBootstrapStaffInSnapshot({
      ...snapshot,
      ...mergedCollections,
      idCounter: Math.max(snapshot.idCounter, remote.idCounter ?? snapshot.idCounter),
      staffUsers,
    }).snapshot,
    removedStaffIds,
  }
}

async function enrichSnapshotWithOperationalTables(
  snapshot: HmsStoreSnapshot,
  snapshotBatchUpdatedAt: string,
): Promise<HmsStoreSnapshot> {
  const tableEntries = await Promise.all(
    COLLECTION_TABLES.map(async ({ key, table }) => {
      const rows = await fetchCollectionWithMeta<{ id: string }>(table)
      return [key, rows] as const
    }),
  )
  const tableByKey = new Map(tableEntries)

  const pick = <T extends { id: string }>(snap: T[], table: TableRowMeta<T>[]) =>
    preferNewerRows(snap, table, snapshotBatchUpdatedAt)

  const staffTable = (tableByKey.get('staffUsers') ?? []) as TableRowMeta<StaffUser>[]
  const staffUsers = preferNewerStaffRows(
    snapshot.staffUsers ?? [],
    staffTable,
    snapshotBatchUpdatedAt,
  )

  const merged: HmsStoreSnapshot = {
    ...snapshot,
    staffUsers,
  }

  for (const { key } of COLLECTION_TABLES) {
    if (key === 'staffUsers') continue
    const tableRows = tableByKey.get(key) ?? []
    const snapRows = (snapshot[key] as { id: string }[]) ?? []
    if (key === 'visits') {
      merged.visits = preferNewerVisitRows(
        snapshot.visits ?? [],
        tableRows as TableRowMeta<Visit>[],
        snapshotBatchUpdatedAt,
      )
    } else {
      ;(merged as Record<string, unknown>)[key] = pick(snapRows, tableRows)
    }
  }

  return ensureBootstrapStaffInSnapshot(merged).snapshot
}

export type HmsMetaRefresh = {
  updatedAt: string
  snapshot: HmsStoreSnapshot
}

/** Lightweight poll — returns null when remote data has not changed */
export async function fetchHmsMetaIfUpdated(
  sinceUpdatedAt: string | null,
): Promise<HmsMetaRefresh | null> {
  const supabase = getSupabase()

  const { data: meta, error: metaError } = await supabase
    .from('hms_meta')
    .select('version, id_counter, system_settings, full_snapshot, updated_at')
    .eq('id', HMS_META_ID)
    .maybeSingle()

  if (metaError) throw new Error(metaError.message)
  if (!meta?.full_snapshot) return null
  if (sinceUpdatedAt && meta.updated_at === sinceUpdatedAt) return null

  const cached = hydrateSnapshotFromMeta(meta)
  if (!cached) return null

  return {
    updatedAt: meta.updated_at as string,
    snapshot: await enrichSnapshotWithOperationalTables(cached, meta.updated_at as string),
  }
}

/** Legacy slow path — 33 parallel table reads (only if full_snapshot column missing) */
async function fetchHmsFromLegacyTables(meta: {
  version: number
  id_counter: number
  system_settings: HmsStoreSnapshot['systemSettings']
}): Promise<HmsStoreSnapshot> {
  const collections = await Promise.all(
    COLLECTION_TABLES.map(async ({ key, table }) => [key, await fetchCollection(table)] as const),
  )

  return {
    ...createEmptyHmsSnapshot(),
    version: meta.version,
    idCounter: meta.id_counter,
    systemSettings: meta.system_settings,
    ...Object.fromEntries(collections),
  } as HmsStoreSnapshot
}

export type HmsFetchResult = {
  snapshot: HmsStoreSnapshot
  updatedAt: string
}

/** Fast path: single hms_meta request (~50–200ms vs 34 requests) */
export async function fetchHmsFromTables(): Promise<HmsFetchResult | null> {
  const supabase = getSupabase()

  const { data: meta, error: metaError } = await supabase
    .from('hms_meta')
    .select('version, id_counter, system_settings, full_snapshot, updated_at')
    .eq('id', HMS_META_ID)
    .maybeSingle()

  if (metaError) {
    if (isMissingColumnError(metaError.message)) {
      const { data: legacyMeta, error: legacyError } = await supabase
        .from('hms_meta')
        .select('version, id_counter, system_settings')
        .eq('id', HMS_META_ID)
        .maybeSingle()
      if (legacyError) throw new Error(legacyError.message)
      if (!legacyMeta) return null
      return {
        snapshot: await enrichSnapshotWithOperationalTables(
          await fetchHmsFromLegacyTables(legacyMeta),
          new Date().toISOString(),
        ),
        updatedAt: new Date().toISOString(),
      }
    }
    if (isMissingTableError(metaError.message)) {
      throw new Error(
        `${metaError.message}\n\nRun supabase/migrations/002_hms_normalized_tables.sql in Supabase SQL Editor.`,
      )
    }
    throw new Error(metaError.message)
  }

  if (!meta) return null

  const updatedAt = (meta.updated_at as string) ?? new Date().toISOString()
  const cached = hydrateSnapshotFromMeta(meta)
  if (cached) {
    return {
      snapshot: await enrichSnapshotWithOperationalTables(cached, updatedAt),
      updatedAt,
    }
  }

  return {
    snapshot: await enrichSnapshotWithOperationalTables(await fetchHmsFromLegacyTables(meta), updatedAt),
    updatedAt,
  }
}

/** Auto-save / background save — meta only (prevents stale bulk mirror overwrite) */
export async function saveHmsToTables(snapshot: HmsStoreSnapshot): Promise<string> {
  const updatedAt = new Date().toISOString()
  const { snapshot: safeSnapshot } = await mergeSnapshotWithRemoteBeforeSave(snapshot)
  return upsertMetaSnapshot(safeSnapshot, updatedAt)
}

/** Fast lab tests catalog save — hms_lab_test_catalog + meta (Test ID settings) */
export async function saveLabCatalogSnapshotToSupabase(snapshot: HmsStoreSnapshot): Promise<string> {
  const updatedAt = new Date().toISOString()
  const { snapshot: safeSnapshot } = await mergeSnapshotWithRemoteBeforeSave(snapshot)
  const persistedSnapshot: HmsStoreSnapshot = {
    ...safeSnapshot,
    labTestCatalog: (safeSnapshot.labTestCatalog ?? []).map((t) => ({ ...t })),
  }

  const savedAt = await upsertMetaSnapshot(persistedSnapshot, updatedAt)

  await Promise.all(
    CATALOG_MIRROR_TABLES.map(({ key, table }) =>
      upsertMirrorRows(table, persistedSnapshot[key] as { id: string }[], { verify: false }),
    ),
  )

  return savedAt
}

/** Fast medical catalog save — medicines + inventory + meta */
export async function saveMedicalCatalogSnapshotToSupabase(snapshot: HmsStoreSnapshot): Promise<string> {
  const updatedAt = new Date().toISOString()
  const { snapshot: safeSnapshot } = await mergeSnapshotWithRemoteBeforeSave(snapshot)
  const persistedSnapshot: HmsStoreSnapshot = {
    ...safeSnapshot,
    medicineCatalog: (safeSnapshot.medicineCatalog ?? []).map((m) => ({ ...m })),
    inventoryItems: (safeSnapshot.inventoryItems ?? []).map((i) => ({ ...i })),
  }

  const savedAt = await upsertMetaSnapshot(persistedSnapshot, updatedAt)

  await Promise.all([
    syncCollection('hms_medicine_catalog', persistedSnapshot.medicineCatalog ?? []),
    syncCollection('hms_inventory_items', persistedSnapshot.inventoryItems ?? []),
  ])

  return savedAt
}

/** Fast surgery catalog save — hms_surgery_catalog + meta */
export async function saveSurgeryCatalogSnapshotToSupabase(snapshot: HmsStoreSnapshot): Promise<string> {
  const updatedAt = new Date().toISOString()
  const { snapshot: safeSnapshot } = await mergeSnapshotWithRemoteBeforeSave(snapshot)
  const persistedSnapshot: HmsStoreSnapshot = {
    ...safeSnapshot,
    surgeryCatalog: (safeSnapshot.surgeryCatalog ?? []).map((s) => ({ ...s })),
  }

  const savedAt = await upsertMetaSnapshot(persistedSnapshot, updatedAt)

  await syncCollection('hms_surgery_catalog', persistedSnapshot.surgeryCatalog ?? [])

  return savedAt
}

/** Fast rooms & beds save — wards, rooms, beds tables + meta */
export async function saveRoomsBedsSnapshotToSupabase(snapshot: HmsStoreSnapshot): Promise<string> {
  const updatedAt = new Date().toISOString()
  const { snapshot: safeSnapshot } = await mergeSnapshotWithRemoteBeforeSave(snapshot)
  const persistedSnapshot: HmsStoreSnapshot = {
    ...safeSnapshot,
    wards: (safeSnapshot.wards ?? []).map((w) => ({
      ...w,
      lastModifiedAt: w.lastModifiedAt ?? updatedAt,
    })),
    rooms: (safeSnapshot.rooms ?? []).map((r) => ({
      ...r,
      lastModifiedAt: r.lastModifiedAt ?? updatedAt,
    })),
    beds: (safeSnapshot.beds ?? []).map((b) => ({
      ...b,
      lastModifiedAt: b.lastModifiedAt ?? updatedAt,
    })),
  }

  const savedAt = await upsertMetaSnapshot(persistedSnapshot, updatedAt)

  await Promise.all(
    FACILITY_MIRROR_TABLES.map(({ key, table }) =>
      syncCollection(table, persistedSnapshot[key] as { id: string }[]),
    ),
  )

  return savedAt
}

/** Fast staff save for Add/Edit User — 2 requests instead of 5+ */
export async function saveStaffUsersToSupabase(snapshot: HmsStoreSnapshot): Promise<string> {
  const updatedAt = new Date().toISOString()
  const { snapshot: safeSnapshot, removedStaffIds } = await mergeSnapshotWithRemoteBeforeSave(snapshot)

  const savedAt = await upsertMetaSnapshot(safeSnapshot, updatedAt)

  await deleteStaffRows(removedStaffIds)
  await upsertMirrorRows('hms_staff_users', safeSnapshot.staffUsers, { verify: false })

  return savedAt
}

/** Single patient profile update — table row first, then patch hms_meta */
export async function savePatientProfileToSupabase(patient: Patient): Promise<string> {
  const updatedAt = new Date().toISOString()
  const patientRow: Patient = { ...patient, lastModifiedAt: updatedAt }

  await upsertMirrorRows('hms_patients', [patientRow], { verify: true })

  const supabase = getSupabase()
  const { data: meta, error: metaFetchError } = await supabase
    .from('hms_meta')
    .select('version, id_counter, system_settings, full_snapshot')
    .eq('id', HMS_META_ID)
    .maybeSingle()
  if (metaFetchError) throw new Error(metaFetchError.message)

  const remote = (meta?.full_snapshot as HmsStoreSnapshot | null) ?? createEmptyHmsSnapshot()
  const mergedPatients = mergeCollectionsPreferNewer(remote.patients ?? [], [patientRow])

  const fullSnapshot: HmsStoreSnapshot = {
    ...createEmptyHmsSnapshot(),
    ...remote,
    patients: mergedPatients,
  }

  return upsertMetaSnapshot(fullSnapshot, updatedAt)
}

/** Fast doctor consultation save — notes, prescriptions, labs, surgery, admissions, nurse orders */
export async function saveDoctorConsultationSnapshotToSupabase(
  snapshot: HmsStoreSnapshot,
  focus?: { visitId?: string; patientId?: string },
): Promise<string> {
  const updatedAt = new Date().toISOString()
  const { snapshot: safeSnapshot } = await mergeSnapshotWithRemoteBeforeSave(snapshot)
  const persistedSnapshot: HmsStoreSnapshot = {
    ...safeSnapshot,
    clinicalNotes: (safeSnapshot.clinicalNotes ?? []).map((n) => ({ ...n })),
    prescriptions: (safeSnapshot.prescriptions ?? []).map((p) => ({ ...p })),
    labRequests: (safeSnapshot.labRequests ?? []).map((l) => ({ ...l })),
    surgeryRequests: (safeSnapshot.surgeryRequests ?? []).map((s) => ({ ...s })),
    admissionRequests: (safeSnapshot.admissionRequests ?? []).map((a) => ({ ...a })),
    doctorOrders: (safeSnapshot.doctorOrders ?? []).map((o) => ({ ...o })),
  }

  const savedAt = await upsertMetaSnapshot(persistedSnapshot, updatedAt)

  const mirrorTasks: Promise<void>[] = DOCTOR_MIRROR_TABLES.map(({ key, table }) =>
    upsertMirrorRows(table, persistedSnapshot[key] as { id: string }[], { verify: false }),
  )

  if (focus?.visitId) {
    const visit = (persistedSnapshot.visits ?? []).find((v) => v.id === focus.visitId)
    if (visit) mirrorTasks.push(upsertMirrorRows('hms_visits', [{ ...visit }], { verify: true }))
  }
  if (focus?.patientId) {
    const patient = (persistedSnapshot.patients ?? []).find((p) => p.id === focus.patientId)
    if (patient) mirrorTasks.push(upsertMirrorRows('hms_patients', [{ ...patient }], { verify: true }))
  }

  await Promise.all(mirrorTasks)

  return savedAt
}

/** Fast system settings save — meta + staff mirror (registration fees live on staff rows) */
export async function saveSystemSettingsSnapshotToSupabase(
  snapshot: HmsStoreSnapshot,
): Promise<string> {
  const updatedAt = new Date().toISOString()
  const { snapshot: safeSnapshot } = await mergeSnapshotWithRemoteBeforeSave(snapshot)
  const persistedSnapshot: HmsStoreSnapshot = {
    ...safeSnapshot,
    systemSettings: {
      ...safeSnapshot.systemSettings,
      lastModifiedAt: updatedAt,
    },
    staffUsers: (safeSnapshot.staffUsers ?? []).map((staff) => ({
      ...staff,
      lastModifiedAt: staff.lastModifiedAt ?? updatedAt,
    })),
  }

  const savedAt = await upsertMetaSnapshot(persistedSnapshot, updatedAt)
  await upsertMirrorRows('hms_staff_users', persistedSnapshot.staffUsers, { verify: false })
  return savedAt
}

/** Registration / patient number fees — mirror rows first, local serviceFee always wins */
export async function saveRegistrationFeesSnapshotToSupabase(
  snapshot: HmsStoreSnapshot,
): Promise<string> {
  const updatedAt = new Date().toISOString()
  const localStaffById = new Map((snapshot.staffUsers ?? []).map((s) => [s.id, s]))
  const { snapshot: safeSnapshot } = await mergeSnapshotWithRemoteBeforeSave(snapshot)

  const staffUsers = (safeSnapshot.staffUsers ?? []).map((staff) => {
    const local = localStaffById.get(staff.id)
    const merged: StaffUser = {
      ...staff,
      lastModifiedAt: local?.lastModifiedAt ?? staff.lastModifiedAt ?? updatedAt,
    }
    if (local?.serviceFee != null) merged.serviceFee = local.serviceFee
    normalizeStaffUserEmail(merged)
    return merged
  })

  const persistedSnapshot: HmsStoreSnapshot = {
    ...safeSnapshot,
    staffUsers,
    systemSettings: {
      ...safeSnapshot.systemSettings,
      lastModifiedAt: updatedAt,
    },
  }

  await upsertMirrorRows('hms_staff_users', staffUsers, { verify: true })
  return upsertMetaSnapshot(persistedSnapshot, updatedAt)
}

/** Fast lab fee payment — table rows first, then hms_meta (reception submit) */
export async function saveLabFeePaymentSnapshotToSupabase(
  snapshot: HmsStoreSnapshot,
  labRequestId: string,
): Promise<string> {
  const updatedAt = new Date().toISOString()
  const lab = (snapshot.labRequests ?? []).find((l) => l.id === labRequestId)
  if (!lab) throw new Error(`Lab request ${labRequestId} not found for save`)

  const labRow = { ...lab, lastModifiedAt: updatedAt }
  const visit = (snapshot.visits ?? []).find((v) => v.id === lab.visitId)
  const paymentsForLab = (snapshot.payments ?? []).filter((p) =>
    p.description?.includes(lab.requestNumber),
  )
  const incomeForLab = (snapshot.incomeRecords ?? []).filter((i) => i.reference === lab.id)
  const receiptsForLab = (snapshot.receptionReceipts ?? []).filter(
    (r) => r.labRequestNumber === lab.requestNumber,
  )

  await Promise.all([
    upsertMirrorRows('hms_lab_requests', [labRow], { verify: true }),
    visit ? upsertMirrorRows('hms_visits', [{ ...visit }], { verify: true }) : Promise.resolve(),
    paymentsForLab.length > 0
      ? upsertMirrorRows('hms_payments', paymentsForLab, { verify: true })
      : Promise.resolve(),
    incomeForLab.length > 0
      ? upsertMirrorRows('hms_income_records', incomeForLab, { verify: true })
      : Promise.resolve(),
    receiptsForLab.length > 0
      ? upsertMirrorRows('hms_reception_receipts', receiptsForLab, { verify: true })
      : Promise.resolve(),
  ])

  const supabase = getSupabase()
  const { data: meta, error: metaFetchError } = await supabase
    .from('hms_meta')
    .select('version, id_counter, system_settings, full_snapshot')
    .eq('id', HMS_META_ID)
    .maybeSingle()
  if (metaFetchError) throw new Error(metaFetchError.message)

  const remote = (meta?.full_snapshot as HmsStoreSnapshot | null) ?? createEmptyHmsSnapshot()
  const fullSnapshot: HmsStoreSnapshot = {
    ...createEmptyHmsSnapshot(),
    ...remote,
    labRequests: mergeCollectionsPreferNewer(remote.labRequests ?? [], [labRow]),
    payments: mergeCollectionsPreferNewer(remote.payments ?? [], paymentsForLab),
    incomeRecords: mergeCollectionsPreferNewer(remote.incomeRecords ?? [], incomeForLab),
    receptionReceipts: mergeCollectionsPreferNewer(remote.receptionReceipts ?? [], receiptsForLab),
  }

  return upsertMetaSnapshot(fullSnapshot, updatedAt)
}

/** Fast lab workflow update — table row first (Pending → In Progress → Completed) */
export async function saveLabRequestSnapshotToSupabase(
  snapshot: HmsStoreSnapshot,
  labRequestId: string,
): Promise<string> {
  const updatedAt = new Date().toISOString()
  const lab = (snapshot.labRequests ?? []).find((l) => l.id === labRequestId)
  if (!lab) throw new Error(`Lab request ${labRequestId} not found for save`)

  const labRow = { ...lab, lastModifiedAt: updatedAt }
  const visit = (snapshot.visits ?? []).find((v) => v.id === lab.visitId)

  await Promise.all([
    upsertMirrorRows('hms_lab_requests', [labRow], { verify: true }),
    visit ? upsertMirrorRows('hms_visits', [{ ...visit }], { verify: true }) : Promise.resolve(),
  ])

  const supabase = getSupabase()
  const { data: meta, error: metaFetchError } = await supabase
    .from('hms_meta')
    .select('version, id_counter, system_settings, full_snapshot')
    .eq('id', HMS_META_ID)
    .maybeSingle()
  if (metaFetchError) throw new Error(metaFetchError.message)

  const remote = (meta?.full_snapshot as HmsStoreSnapshot | null) ?? createEmptyHmsSnapshot()
  const fullSnapshot: HmsStoreSnapshot = {
    ...createEmptyHmsSnapshot(),
    ...remote,
    labRequests: mergeCollectionsPreferNewer(remote.labRequests ?? [], [labRow]),
  }

  return upsertMetaSnapshot(fullSnapshot, updatedAt)
}

/** Fast registration save — patients, visits, payments, receipts (reception register / edit) */
export async function saveRegistrationSnapshotToSupabase(
  snapshot: HmsStoreSnapshot,
): Promise<string> {
  const updatedAt = new Date().toISOString()
  const { snapshot: safeSnapshot } = await mergeSnapshotWithRemoteBeforeSave(snapshot)
  const persistedSnapshot: HmsStoreSnapshot = {
    ...safeSnapshot,
    patients: (safeSnapshot.patients ?? []).map((p) => ({ ...p })),
    visits: (safeSnapshot.visits ?? []).map((v) => ({ ...v })),
  }

  const savedAt = await upsertMetaSnapshot(persistedSnapshot, updatedAt)

  await Promise.all(
    REGISTRATION_MIRROR_TABLES.map(({ key, table }) =>
      upsertMirrorRows(table, persistedSnapshot[key] as { id: string }[], { verify: false }),
    ),
  )

  return savedAt
}

/** Fast surgery fee payment — surgery request + payment + receipt + visit */
export async function saveSurgeryFeePaymentSnapshotToSupabase(
  snapshot: HmsStoreSnapshot,
): Promise<string> {
  const updatedAt = new Date().toISOString()
  const { snapshot: safeSnapshot } = await mergeSnapshotWithRemoteBeforeSave(snapshot)
  const persistedSnapshot: HmsStoreSnapshot = {
    ...safeSnapshot,
    surgeryRequests: (safeSnapshot.surgeryRequests ?? []).map((s) => ({ ...s })),
    visits: (safeSnapshot.visits ?? []).map((v) => ({ ...v })),
    payments: (safeSnapshot.payments ?? []).map((p) => ({ ...p })),
    incomeRecords: (safeSnapshot.incomeRecords ?? []).map((i) => ({ ...i })),
    receptionReceipts: (safeSnapshot.receptionReceipts ?? []).map((r) => ({ ...r })),
  }

  const savedAt = await upsertMetaSnapshot(persistedSnapshot, updatedAt)

  await Promise.all(
    SURGERY_FEE_MIRROR_TABLES.map(({ key, table }) =>
      upsertMirrorRows(table, persistedSnapshot[key] as { id: string }[], { verify: false }),
    ),
  )

  return savedAt
}

/** Fast inpatient payment — admissions, lab/surgery status, payments, receipts */
export async function saveInpatientPaymentSnapshotToSupabase(
  snapshot: HmsStoreSnapshot,
): Promise<string> {
  const updatedAt = new Date().toISOString()
  const { snapshot: safeSnapshot } = await mergeSnapshotWithRemoteBeforeSave(snapshot)
  const persistedSnapshot: HmsStoreSnapshot = {
    ...safeSnapshot,
    admissions: (safeSnapshot.admissions ?? []).map((a) => ({ ...a })),
    beds: (safeSnapshot.beds ?? []).map((b) => ({ ...b })),
    labRequests: (safeSnapshot.labRequests ?? []).map((l) => ({ ...l })),
    surgeryRequests: (safeSnapshot.surgeryRequests ?? []).map((s) => ({ ...s })),
    visits: (safeSnapshot.visits ?? []).map((v) => ({ ...v })),
    payments: (safeSnapshot.payments ?? []).map((p) => ({ ...p })),
    incomeRecords: (safeSnapshot.incomeRecords ?? []).map((i) => ({ ...i })),
    receptionReceipts: (safeSnapshot.receptionReceipts ?? []).map((r) => ({ ...r })),
    patientAccounts: (safeSnapshot.patientAccounts ?? []).map((a) => ({ ...a })),
    accountTransactions: (safeSnapshot.accountTransactions ?? []).map((t) => ({ ...t })),
  }

  const savedAt = await upsertMetaSnapshot(persistedSnapshot, updatedAt)

  await Promise.all(
    INPATIENT_PAYMENT_MIRROR_TABLES.map(({ key, table }) =>
      upsertMirrorRows(table, persistedSnapshot[key] as { id: string }[], { verify: false }),
    ),
  )

  return savedAt
}

/** Fast patient discount save — discounts + payments + income + receipts */
export async function savePatientDiscountSnapshotToSupabase(
  snapshot: HmsStoreSnapshot,
): Promise<string> {
  const updatedAt = new Date().toISOString()
  const { snapshot: safeSnapshot } = await mergeSnapshotWithRemoteBeforeSave(snapshot)
  const persistedSnapshot: HmsStoreSnapshot = {
    ...safeSnapshot,
    patientDiscounts: (safeSnapshot.patientDiscounts ?? []).map((d) => ({ ...d })),
    payments: (safeSnapshot.payments ?? []).map((p) => ({ ...p })),
    incomeRecords: (safeSnapshot.incomeRecords ?? []).map((i) => ({ ...i })),
    receptionReceipts: (safeSnapshot.receptionReceipts ?? []).map((r) => ({ ...r })),
  }

  const savedAt = await upsertMetaSnapshot(persistedSnapshot, updatedAt)

  await Promise.all([
    upsertMirrorRows('hms_patient_discounts', persistedSnapshot.patientDiscounts ?? [], {
      verify: false,
    }),
    ...RECEPTION_PAYMENT_MIRROR_TABLES.map(({ key, table }) =>
      upsertMirrorRows(table, persistedSnapshot[key] as { id: string }[], { verify: false }),
    ),
  ])

  return savedAt
}

const ADMISSION_ASSIGNMENT_MIRROR_TABLES: {
  key: 'admissionRequests' | 'admissions' | 'beds' | 'visits'
  table: string
}[] = [
  { key: 'admissionRequests', table: 'hms_admission_requests' },
  { key: 'admissions', table: 'hms_admissions' },
  { key: 'beds', table: 'hms_beds' },
  { key: 'visits', table: 'hms_visits' },
]

const EMERGENCY_MIRROR_TABLES: {
  key: 'emergencyCases' | 'patients'
  table: string
}[] = [
  { key: 'emergencyCases', table: 'hms_emergency_cases' },
  { key: 'patients', table: 'hms_patients' },
]

const PHARMACY_MIRROR_TABLES: {
  key: 'prescriptions' | 'inventoryItems' | 'stockTransactions' | 'medicineCatalog'
  table: string
}[] = [
  { key: 'prescriptions', table: 'hms_prescriptions' },
  { key: 'inventoryItems', table: 'hms_inventory_items' },
  { key: 'stockTransactions', table: 'hms_stock_transactions' },
  { key: 'medicineCatalog', table: 'hms_medicine_catalog' },
]

const CREDIT_MIRROR_TABLES: {
  key: 'patientAccounts' | 'accountTransactions' | 'payments'
  table: string
}[] = [
  { key: 'patientAccounts', table: 'hms_patient_accounts' },
  { key: 'accountTransactions', table: 'hms_account_transactions' },
  { key: 'payments', table: 'hms_payments' },
]

const SUPPLY_MIRROR_TABLES: {
  key:
    | 'departmentSupplyRequests'
    | 'pharmacySupplyRequests'
    | 'labSupplyRequests'
    | 'inventoryItems'
  table: string
}[] = [
  { key: 'departmentSupplyRequests', table: 'hms_department_supply_requests' },
  { key: 'pharmacySupplyRequests', table: 'hms_pharmacy_supply_requests' },
  { key: 'labSupplyRequests', table: 'hms_lab_supply_requests' },
  { key: 'inventoryItems', table: 'hms_inventory_items' },
]

async function saveMirrorGroupSnapshot(
  snapshot: HmsStoreSnapshot,
  tables: { key: keyof HmsStoreSnapshot; table: string }[],
): Promise<string> {
  const updatedAt = new Date().toISOString()
  const { snapshot: safeSnapshot } = await mergeSnapshotWithRemoteBeforeSave(snapshot)
  const savedAt = await upsertMetaSnapshot(safeSnapshot, updatedAt)
  await Promise.all(
    tables.map(({ key, table }) =>
      upsertMirrorRows(table, (safeSnapshot[key] as { id: string }[]) ?? [], { verify: false }),
    ),
  )
  return savedAt
}

/** In-patient room/bed assignment — reception */
export async function saveAdmissionAssignmentSnapshotToSupabase(
  snapshot: HmsStoreSnapshot,
): Promise<string> {
  return saveMirrorGroupSnapshot(snapshot, ADMISSION_ASSIGNMENT_MIRROR_TABLES)
}

/** Emergency case register / edit */
export async function saveEmergencyCaseSnapshotToSupabase(
  snapshot: HmsStoreSnapshot,
): Promise<string> {
  return saveMirrorGroupSnapshot(snapshot, EMERGENCY_MIRROR_TABLES)
}

/** Pharmacy dispense — prescriptions, stock, inventory */
export async function savePharmacyDispenseSnapshotToSupabase(
  snapshot: HmsStoreSnapshot,
): Promise<string> {
  return saveMirrorGroupSnapshot(snapshot, PHARMACY_MIRROR_TABLES)
}

const INPATIENT_MEDICINE_PAYMENT_MIRROR_TABLES: {
  key:
    | 'prescriptions'
    | 'payments'
    | 'incomeRecords'
    | 'receptionReceipts'
    | 'patientAccounts'
    | 'accountTransactions'
  table: string
}[] = [
  { key: 'prescriptions', table: 'hms_prescriptions' },
  { key: 'payments', table: 'hms_payments' },
  { key: 'incomeRecords', table: 'hms_income_records' },
  { key: 'receptionReceipts', table: 'hms_reception_receipts' },
  { key: 'patientAccounts', table: 'hms_patient_accounts' },
  { key: 'accountTransactions', table: 'hms_account_transactions' },
]

export async function saveInpatientMedicinePaymentSnapshotToSupabase(
  snapshot: HmsStoreSnapshot,
): Promise<string> {
  return saveMirrorGroupSnapshot(snapshot, INPATIENT_MEDICINE_PAYMENT_MIRROR_TABLES)
}

const PRESCRIPTION_MIRROR_TABLES: { key: 'prescriptions'; table: string }[] = [
  { key: 'prescriptions', table: 'hms_prescriptions' },
]

/** Pharmacy approval — prescription status only */
export async function savePrescriptionSnapshotToSupabase(
  snapshot: HmsStoreSnapshot,
): Promise<string> {
  return saveMirrorGroupSnapshot(snapshot, PRESCRIPTION_MIRROR_TABLES)
}

/** Patient credit account payment */
export async function saveCreditPaymentSnapshotToSupabase(
  snapshot: HmsStoreSnapshot,
): Promise<string> {
  return saveMirrorGroupSnapshot(snapshot, CREDIT_MIRROR_TABLES)
}

/** Department supply requests */
export async function saveSupplyRequestSnapshotToSupabase(
  snapshot: HmsStoreSnapshot,
): Promise<string> {
  return saveMirrorGroupSnapshot(snapshot, SUPPLY_MIRROR_TABLES)
}

/** Full mirror sync — meta + all normalized tables */
export async function saveFullMirrorSnapshotToSupabase(
  snapshot: HmsStoreSnapshot,
): Promise<string> {
  const updatedAt = new Date().toISOString()
  const { snapshot: safeSnapshot } = await mergeSnapshotWithRemoteBeforeSave(snapshot)
  const savedAt = await upsertMetaSnapshot(safeSnapshot, updatedAt)
  await Promise.all(
    COLLECTION_TABLES.map(({ key, table }) =>
      upsertMirrorRows(table, (safeSnapshot[key] as { id: string }[]) ?? [], { verify: false }),
    ),
  )
  return savedAt
}
