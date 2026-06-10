import type { MenuItemType } from '@/types/menu'
import type { Permission, UserRole } from '@/shared/types/roles'

export type HMSMenuItemType = MenuItemType & {
  permissions?: Permission[]
  /** Hide this menu block for these roles */
  hiddenForRoles?: UserRole[]
}

export const HMS_MENU_ITEMS: HMSMenuItemType[] = [
  { key: 'hms-title', label: 'HOSPITAL', isTitle: true },
  {
    key: 'hms-dashboard',
    icon: 'solar:home-2-broken',
    label: 'Reception Dashboard',
    url: '/hms/reception/dashboard',
    permissions: ['register_patients', 'receive_payments'],
  },
  {
    key: 'hms-patients',
    icon: 'solar:user-heart-broken',
    label: 'Patients',
    permissions: ['register_patients'],
    children: [
      { key: 'hms-patients-list', label: 'Patient List', url: '/hms/patients', parentKey: 'hms-patients', permissions: ['register_patients'] },
      { key: 'hms-patients-create', label: 'Register Patient', url: '/hms/patients/create', parentKey: 'hms-patients', permissions: ['register_patients'] },
      { key: 'hms-reception-activate-patient', label: 'Activate Patient', url: '/hms/reception/activate-patient', parentKey: 'hms-patients', permissions: ['register_patients'] },
    ],
  },
  {
    key: 'hms-reception-lab-fees',
    icon: 'solar:test-tube-broken',
    label: 'Lab Fees',
    url: '/hms/reception/lab-fees',
    permissions: ['receive_payments'],
  },
  {
    key: 'hms-reception-patient-discounts-menu',
    icon: 'solar:tag-price-broken',
    label: 'Patient Discounts',
    url: '/hms/reception/patient-discounts',
    permissions: ['receive_payments'],
  },
  {
    key: 'hms-reception-inpatient-request',
    icon: 'solar:clipboard-list-broken',
    label: 'In Patient Request',
    url: '/hms/reception/inpatient-request',
    permissions: ['register_patients'],
  },
  {
    key: 'hms-reception-all-inpatients',
    icon: 'solar:bed-broken',
    label: 'All Inpatients',
    url: '/hms/reception/all-inpatients',
    permissions: ['register_patients'],
  },
  {
    key: 'hms-reception-surgery',
    icon: 'solar:heart-pulse-broken',
    label: 'Surgery',
    url: '/hms/reception/surgery',
    permissions: ['receive_payments'],
  },
  {
    key: 'hms-reception-inpatient-medicine',
    icon: 'solar:document-medicine-broken',
    label: 'Inpatient Medicine',
    url: '/hms/reception/inpatient-medicine',
    permissions: ['receive_payments'],
  },
  {
    key: 'hms-visits',
    icon: 'solar:clipboard-list-broken',
    label: 'Visits',
    permissions: ['create_visits', 'manage_queue'],
    hiddenForRoles: ['reception_cashier'],
    children: [
      { key: 'hms-visits-active', label: 'Active Visits', url: '/hms/visits/active', parentKey: 'hms-visits', permissions: ['create_visits'] },
      { key: 'hms-visits-history', label: 'Visit History', url: '/hms/visits/history', parentKey: 'hms-visits', permissions: ['create_visits'] },
    ],
  },
  {
    key: 'hms-reception',
    icon: 'solar:card-recive-broken',
    label: 'Reception & Cashier',
    permissions: ['register_patients', 'receive_payments', 'manage_patient_credit'],
    hiddenForRoles: ['reception_cashier'],
    children: [
      { key: 'hms-reception-register', label: 'Register Patient', url: '/hms/reception/register-patient', parentKey: 'hms-reception', permissions: ['register_patients'] },
      { key: 'hms-reception-billing', label: 'Billing', url: '/hms/reception/billing', parentKey: 'hms-reception', permissions: ['receive_payments'] },
      { key: 'hms-reception-receipts', label: 'Receipts', url: '/hms/reception/receipts', parentKey: 'hms-reception', permissions: ['print_receipts'] },
      { key: 'hms-reception-credit', label: 'Credit Accounts', url: '/hms/reception/credit-accounts', parentKey: 'hms-reception', permissions: ['manage_patient_credit'] },
      { key: 'hms-reception-patient-discounts', label: 'Patient Discounts', url: '/hms/reception/patient-discounts', parentKey: 'hms-reception', permissions: ['receive_payments'] },
    ],
  },
  {
    key: 'hms-doctor-dashboard',
    icon: 'solar:widget-5-broken',
    label: 'Doctor Dashboard',
    url: '/hms/doctor/dashboard',
    permissions: ['view_assigned_patients'],
  },
  {
    key: 'hms-doctor-patients',
    icon: 'solar:users-group-rounded-broken',
    label: 'All Patients',
    url: '/hms/doctor/patients',
    permissions: ['view_assigned_patients'],
  },
  {
    key: 'hms-doctor-lab-results',
    icon: 'solar:test-tube-broken',
    label: 'View Lab Results',
    url: '/hms/doctor/lab-results',
    permissions: ['view_patient_lab_results'],
  },
  {
    key: 'hms-doctor-inpatients',
    icon: 'solar:bed-broken',
    label: 'In-Patients',
    url: '/hms/doctor/inpatients',
    permissions: ['view_assigned_patients'],
  },
  {
    key: 'hms-doctor-surgery',
    icon: 'solar:heart-pulse-broken',
    label: 'Surgery',
    url: '/hms/doctor/surgery',
    permissions: ['surgery_requests'],
  },
  {
    key: 'hms-doctor-supplies',
    icon: 'solar:box-broken',
    label: 'Supplies Request',
    url: '/hms/doctor/supplies-request',
    permissions: ['request_department_supplies', 'request_pharmacy_supplies'],
  },
  {
    key: 'hms-lab-dashboard',
    icon: 'solar:widget-5-broken',
    label: 'Lab Dashboard',
    url: '/hms/laboratory/dashboard',
    permissions: ['view_lab_requests'],
  },
  {
    key: 'hms-lab-all',
    icon: 'solar:test-tube-broken',
    label: 'All Labs',
    url: '/hms/laboratory/all',
    permissions: ['view_lab_requests'],
  },
  {
    key: 'hms-lab-catalog',
    icon: 'solar:clipboard-list-broken',
    label: 'Test Catalog',
    url: '/hms/laboratory/catalog',
    permissions: ['view_lab_requests'],
  },
  {
    key: 'hms-lab-completed-menu',
    icon: 'solar:check-circle-broken',
    label: 'Completed Labs',
    url: '/hms/laboratory/completed',
    permissions: ['enter_lab_results'],
  },
  {
    key: 'hms-lab-supplies',
    icon: 'solar:box-broken',
    label: 'Order Supply',
    url: '/hms/laboratory/order-supply',
    permissions: ['request_department_supplies', 'request_lab_supplies'],
  },
  {
    key: 'hms-laboratory',
    icon: 'solar:test-tube-broken',
    label: 'Laboratory',
    permissions: ['view_lab_requests', 'process_lab_tests', 'enter_lab_results'],
    hiddenForRoles: ['laboratory'],
    children: [
      { key: 'hms-lab-pending', label: 'Pending Requests', url: '/hms/laboratory/all', parentKey: 'hms-laboratory', permissions: ['view_lab_requests'] },
      { key: 'hms-lab-active', label: 'Active Tests', url: '/hms/laboratory/active', parentKey: 'hms-laboratory', permissions: ['process_lab_tests'] },
      { key: 'hms-lab-completed', label: 'Completed Results', url: '/hms/laboratory/completed', parentKey: 'hms-laboratory', permissions: ['enter_lab_results'] },
    ],
  },
  {
    key: 'hms-pharmacy',
    icon: 'solar:pill-broken',
    label: 'Pharmacy',
    permissions: ['inventory_management', 'dispense_medicines', 'process_prescriptions', 'stock_management'],
    hiddenForRoles: ['pharmacy'],
    children: [
      { key: 'hms-pharmacy-prescriptions', label: 'Prescription Queue', url: '/hms/pharmacy/prescriptions', parentKey: 'hms-pharmacy', permissions: ['process_prescriptions'] },
      { key: 'hms-pharmacy-inventory', label: 'Inventory', url: '/hms/pharmacy/inventory', parentKey: 'hms-pharmacy', permissions: ['inventory_management'] },
      { key: 'hms-pharmacy-stock', label: 'Stock Movements', url: '/hms/pharmacy/stock', parentKey: 'hms-pharmacy', permissions: ['stock_management'] },
      { key: 'hms-pharmacy-sales', label: 'Sales', url: '/hms/pharmacy/sales', parentKey: 'hms-pharmacy', permissions: ['dispense_medicines'] },
      { key: 'hms-pharmacy-consumption', label: 'Internal Consumption', url: '/hms/pharmacy/consumption', parentKey: 'hms-pharmacy', permissions: ['internal_consumption'] },
    ],
  },
  {
    key: 'hms-pharmacy-dashboard',
    icon: 'solar:widget-5-broken',
    label: 'Pharmacy Dashboard',
    url: '/hms/pharmacy/dashboard',
    permissions: ['inventory_management'],
  },
  {
    key: 'hms-pharmacy-medicine-requests',
    icon: 'solar:document-medicine-broken',
    label: 'Inpatient Medicine Requests',
    url: '/hms/pharmacy/prescriptions',
    permissions: ['process_prescriptions'],
  },
  {
    key: 'hms-pharmacy-catalog',
    icon: 'solar:pill-broken',
    label: 'Medical Catalog',
    url: '/hms/pharmacy/catalog',
    permissions: ['inventory_management'],
  },
  {
    key: 'hms-pharmacy-stock-menu',
    icon: 'solar:box-broken',
    label: 'Stock Transactions',
    url: '/hms/pharmacy/stock',
    permissions: ['stock_management'],
  },
  {
    key: 'hms-pharmacy-supply-requests',
    icon: 'solar:clipboard-list-broken',
    label: 'Supply Requests',
    url: '/hms/pharmacy/supply-requests',
    permissions: ['inventory_management'],
  },
  {
    key: 'hms-emergency-dashboard',
    icon: 'solar:widget-5-broken',
    label: 'Emergency Dashboard',
    url: '/hms/emergency/dashboard',
    permissions: ['emergency_registration', 'triage', 'emergency_treatment'],
  },
  {
    key: 'hms-emergency',
    icon: 'solar:ambulance-broken',
    label: 'Emergency',
    permissions: ['emergency_registration', 'triage', 'emergency_treatment'],
    children: [
      { key: 'hms-emergency-cases', label: 'All Cases', url: '/hms/emergency/cases', parentKey: 'hms-emergency', permissions: ['emergency_registration'] },
      { key: 'hms-emergency-register', label: 'Register Case', url: '/hms/emergency/cases/create', parentKey: 'hms-emergency', permissions: ['emergency_registration'] },
      { key: 'hms-emergency-queue', label: 'Emergency Queue', url: '/hms/emergency/queue', parentKey: 'hms-emergency', permissions: ['triage'] },
      { key: 'hms-emergency-supplies', label: 'Supplies Request', url: '/hms/emergency/supply-request', parentKey: 'hms-emergency', permissions: ['request_department_supplies'] },
    ],
  },
  {
    key: 'hms-inpatient',
    icon: 'solar:bed-broken',
    label: 'Inpatient Ward',
    permissions: ['manage_admitted_patients', 'view_rooms_beds', 'medication_administration'],
    hiddenForRoles: ['nurse'],
    children: [
      { key: 'hms-inpatient-wards', label: 'Wards', url: '/hms/inpatient/wards', parentKey: 'hms-inpatient', permissions: ['view_rooms_beds'] },
      { key: 'hms-inpatient-rooms', label: 'Rooms', url: '/hms/inpatient/rooms', parentKey: 'hms-inpatient', permissions: ['view_rooms_beds'] },
      { key: 'hms-inpatient-beds', label: 'Beds', url: '/hms/inpatient/beds', parentKey: 'hms-inpatient', permissions: ['view_rooms_beds'] },
      { key: 'hms-inpatient-admissions', label: 'Admitted Patients', url: '/hms/inpatient/admissions', parentKey: 'hms-inpatient', permissions: ['manage_admitted_patients'] },
    ],
  },
  {
    key: 'hms-nurse-dashboard',
    icon: 'solar:widget-5-broken',
    label: 'Nursing Dashboard',
    url: '/hms/inpatient/dashboard',
    permissions: ['manage_admitted_patients'],
  },
  {
    key: 'hms-nurse-all-inpatients',
    icon: 'solar:bed-broken',
    label: 'All Inpatients',
    url: '/hms/inpatient/all',
    permissions: ['manage_admitted_patients'],
  },
  {
    key: 'hms-nurse-supplies',
    icon: 'solar:box-broken',
    label: 'Supplies Request',
    url: '/hms/inpatient/supply-request',
    permissions: ['request_department_supplies'],
  },
  {
    key: 'hms-accounting',
    icon: 'solar:wallet-money-broken',
    label: 'Accounting',
    permissions: ['accounting'],
    children: [
      { key: 'hms-accounting-income', label: 'Income', url: '/hms/accounting/income', parentKey: 'hms-accounting', permissions: ['accounting'] },
      { key: 'hms-accounting-expenses', label: 'Expenses', url: '/hms/accounting/expenses', parentKey: 'hms-accounting', permissions: ['accounting'] },
      { key: 'hms-accounting-receivables', label: 'Receivables', url: '/hms/accounting/receivables', parentKey: 'hms-accounting', permissions: ['accounting'] },
      { key: 'hms-accounting-revenue', label: 'Revenue Reports', url: '/hms/accounting/revenue', parentKey: 'hms-accounting', permissions: ['accounting'] },
      { key: 'hms-accounting-financial', label: 'Financial Reports', url: '/hms/accounting/financial-reports', parentKey: 'hms-accounting', permissions: ['accounting'] },
    ],
  },
  {
    key: 'hms-reports',
    icon: 'solar:chart-2-broken',
    label: 'Reports',
    url: '/hms/reports',
    permissions: ['reports', 'accounting'],
  },
  {
    key: 'hms-administration',
    icon: 'solar:shield-user-broken',
    label: 'Administration',
    permissions: ['user_management', 'department_management'],
    children: [
      { key: 'hms-admin-users', label: 'Users', url: '/hms/administration/users', parentKey: 'hms-administration', permissions: ['user_management'] },
      { key: 'hms-admin-roles', label: 'Roles', url: '/hms/administration/roles', parentKey: 'hms-administration', permissions: ['user_management'] },
      { key: 'hms-admin-permissions', label: 'Permissions', url: '/hms/administration/permissions', parentKey: 'hms-administration', permissions: ['user_management'] },
      { key: 'hms-admin-departments', label: 'Departments', url: '/hms/administration/departments', parentKey: 'hms-administration', permissions: ['department_management'] },
      { key: 'hms-admin-lab-tests', label: 'Lab Tests', url: '/hms/administration/lab-tests', parentKey: 'hms-administration', permissions: ['system_settings'] },
      { key: 'hms-admin-medicines', label: 'Medical Catalog', url: '/hms/administration/medicines', parentKey: 'hms-administration', permissions: ['system_settings'] },
      { key: 'hms-admin-surgeries', label: 'Surgeries', url: '/hms/administration/surgeries', parentKey: 'hms-administration', permissions: ['system_settings'] },
      { key: 'hms-admin-rooms', label: 'Rooms & Beds', url: '/hms/administration/rooms-beds', parentKey: 'hms-administration', permissions: ['system_settings'] },
      { key: 'hms-admin-discounts', label: 'Discounts', url: '/hms/administration/discounts', parentKey: 'hms-administration', permissions: ['system_settings'] },
    ],
  },
  {
    key: 'hms-settings',
    icon: 'solar:settings-broken',
    label: 'Settings',
    permissions: ['system_settings'],
    children: [
      { key: 'hms-settings-hospital', label: 'Hospital Information', url: '/hms/settings/hospital', parentKey: 'hms-settings', permissions: ['system_settings'] },
      { key: 'hms-settings-pricing', label: 'Services & Pricing', url: '/hms/settings/pricing', parentKey: 'hms-settings', permissions: ['system_settings'] },
      { key: 'hms-settings-general', label: 'General Settings', url: '/hms/settings/general', parentKey: 'hms-settings', permissions: ['system_settings'] },
    ],
  },
  // ─── Admin sidebar (flat, role-filtered) ───────────────────────────────────
  {
    key: 'hms-admin-dashboard',
    icon: 'solar:home-2-broken',
    label: 'Hospital Dashboard',
    url: '/hms/dashboard',
    permissions: ['user_management', 'system_settings'],
  },
  {
    key: 'hms-admin-users',
    icon: 'solar:users-group-rounded-broken',
    label: 'User Management',
    permissions: ['user_management'],
    children: [
      { key: 'hms-admin-users-list', label: 'All Users', url: '/hms/administration/users', parentKey: 'hms-admin-users', permissions: ['user_management'] },
      { key: 'hms-admin-users-create', label: 'Add User', url: '/hms/administration/users/create', parentKey: 'hms-admin-users', permissions: ['user_management'] },
    ],
  },
  {
    key: 'hms-admin-discounts',
    icon: 'solar:tag-price-broken',
    label: 'Discounts',
    permissions: ['system_settings', 'user_management'],
    children: [
      { key: 'hms-admin-discount-mgmt', label: 'Discount Management', url: '/hms/administration/discounts', parentKey: 'hms-admin-discounts', permissions: ['system_settings', 'user_management'] },
      { key: 'hms-admin-patient-discount', label: 'Patient Discounts', url: '/hms/administration/patient-discounts', parentKey: 'hms-admin-discounts', permissions: ['system_settings', 'user_management'] },
    ],
  },
  {
    key: 'hms-admin-patient-number-fee',
    icon: 'solar:wallet-money-broken',
    label: 'Patient Number Fee',
    url: '/hms/administration/patient-number-fee',
    permissions: ['system_settings'],
  },
  {
    key: 'hms-admin-lab-tests',
    icon: 'solar:test-tube-broken',
    label: 'Lab Tests',
    url: '/hms/administration/lab-tests',
    permissions: ['system_settings'],
  },
  {
    key: 'hms-admin-medicines',
    icon: 'solar:pill-broken',
    label: 'Medicine Catalog',
    url: '/hms/administration/medicines',
    permissions: ['system_settings'],
  },
  {
    key: 'hms-admin-surgeries',
    icon: 'solar:heart-pulse-broken',
    label: 'Surgery Catalog',
    url: '/hms/administration/surgeries',
    permissions: ['system_settings'],
  },
  {
    key: 'hms-admin-rooms-beds',
    icon: 'solar:bed-broken',
    label: 'Rooms & Beds',
    url: '/hms/administration/rooms-beds',
    permissions: ['system_settings'],
  },
  {
    key: 'hms-admin-patient-reports',
    icon: 'solar:clipboard-list-broken',
    label: 'All Patient Reports',
    url: '/hms/administration/patient-reports',
    permissions: ['reports', 'user_management'],
  },
  {
    key: 'hms-admin-financial-reports',
    icon: 'solar:wallet-money-broken',
    label: 'Financial Accounting',
    url: '/hms/accounting/financial-reports',
    permissions: ['accounting'],
  },
  {
    key: 'hms-admin-operational-reports',
    icon: 'solar:chart-2-broken',
    label: 'Reports',
    url: '/hms/administration/operational-reports',
    permissions: ['reports', 'user_management'],
  },
]

/** Reception & Cashier sidebar (no Visit menus) */
const RECEPTION_CASHIER_MENU_KEYS = new Set([
  'hms-title',
  'hms-dashboard',
  'hms-patients',
  'hms-patients-list',
  'hms-patients-create',
  'hms-reception-activate-patient',
  'hms-reception',
  'hms-reception-register',
  'hms-reception-billing',
  'hms-reception-receipts',
  'hms-reception-credit',
  'hms-reception-patient-discounts',
  'hms-reception-lab-fees',
  'hms-reception-patient-discounts-menu',
  'hms-reception-inpatient-request',
  'hms-reception-all-inpatients',
  'hms-reception-surgery',
  'hms-reception-inpatient-medicine',
])

/** Laboratory staff sidebar */
const LAB_MENU_KEYS = new Set([
  'hms-title',
  'hms-lab-dashboard',
  'hms-lab-all',
  'hms-lab-catalog',
  'hms-lab-completed-menu',
  'hms-lab-supplies',
])

/** Doctor sidebar: flat doctor menu only (no HMS Dashboard) */
const DOCTOR_MENU_KEYS = new Set([
  'hms-title',
  'hms-doctor-dashboard',
  'hms-doctor-patients',
  'hms-doctor-lab-results',
  'hms-doctor-inpatients',
  'hms-doctor-surgery',
  'hms-doctor-supplies',
])

/** Admin sidebar — hospital management only */
const ADMIN_MENU_KEYS = new Set([
  'hms-title',
  'hms-admin-dashboard',
  'hms-admin-users',
  'hms-admin-users-list',
  'hms-admin-users-create',
  'hms-admin-discounts',
  'hms-admin-discount-mgmt',
  'hms-admin-patient-discount',
  'hms-admin-patient-number-fee',
  'hms-admin-lab-tests',
  'hms-admin-medicines',
  'hms-admin-surgeries',
  'hms-admin-rooms-beds',
  'hms-admin-patient-reports',
  'hms-admin-financial-reports',
  'hms-admin-operational-reports',
])

/** Nurse sidebar — nursing dashboard + all inpatients only */
const NURSE_MENU_KEYS = new Set([
  'hms-title',
  'hms-nurse-dashboard',
  'hms-nurse-all-inpatients',
  'hms-nurse-supplies',
])

/** Pharmacy sidebar — flat pharmacy menu only */
const PHARMACY_MENU_KEYS = new Set([
  'hms-title',
  'hms-pharmacy-dashboard',
  'hms-pharmacy-medicine-requests',
  'hms-pharmacy-catalog',
  'hms-pharmacy-stock-menu',
  'hms-pharmacy-supply-requests',
])

export function filterMenuByPermissions(
  items: HMSMenuItemType[],
  hasAnyPermission: (p: Permission[]) => boolean,
  role?: UserRole,
): MenuItemType[] {
  const result: MenuItemType[] = []

  for (const item of items) {
    if (item.isTitle) {
      result.push(item)
      continue
    }

    if (role === 'reception_cashier' && !RECEPTION_CASHIER_MENU_KEYS.has(item.key)) {
      continue
    }

    if (role === 'doctor' && !DOCTOR_MENU_KEYS.has(item.key)) {
      continue
    }

    if (role === 'emergency' && !DOCTOR_MENU_KEYS.has(item.key)) {
      continue
    }

    if (role === 'laboratory' && !LAB_MENU_KEYS.has(item.key)) {
      continue
    }

    if (role === 'admin' && !ADMIN_MENU_KEYS.has(item.key)) {
      continue
    }

    if (role === 'nurse' && !NURSE_MENU_KEYS.has(item.key)) {
      continue
    }

    if (role === 'pharmacy' && !PHARMACY_MENU_KEYS.has(item.key)) {
      continue
    }

    if (role && item.hiddenForRoles?.includes(role)) {
      continue
    }

    if (item.children) {
      const filteredChildren = item.children.filter((child) => {
        const hmsChild = child as HMSMenuItemType
        if (role === 'reception_cashier' && !RECEPTION_CASHIER_MENU_KEYS.has(child.key)) {
          return false
        }
        if (role === 'admin' && !ADMIN_MENU_KEYS.has(child.key)) {
          return false
        }
        if (role === 'nurse' && !NURSE_MENU_KEYS.has(child.key)) {
          return false
        }
        if (role === 'pharmacy' && !PHARMACY_MENU_KEYS.has(child.key)) {
          return false
        }
        return !hmsChild.permissions || hasAnyPermission(hmsChild.permissions)
      })
      if (filteredChildren.length === 0) continue
      result.push({ ...item, children: filteredChildren })
      continue
    }

    if (item.permissions && !hasAnyPermission(item.permissions)) continue
    result.push(item)
  }

  return result
}
