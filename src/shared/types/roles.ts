export const USER_ROLES = [
  'admin',
  'reception_cashier',
  'doctor',
  'nurse',
  'laboratory',
  'pharmacy',
  'emergency',
] as const

export type UserRole = (typeof USER_ROLES)[number]

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  reception_cashier: 'Reception & Cashier',
  doctor: 'Doctor',
  nurse: 'Nurse',
  laboratory: 'Laboratory Staff',
  pharmacy: 'Pharmacy Staff',
  emergency: 'Emergency Staff',
}

export const PERMISSIONS = [
  'user_management',
  'department_management',
  'accounting',
  'reports',
  'system_settings',
  'register_patients',
  'create_visits',
  'manage_queue',
  'receive_payments',
  'print_receipts',
  'manage_patient_credit',
  'view_assigned_patients',
  'diagnosis',
  'clinical_notes',
  'prescriptions',
  'lab_requests',
  'admission_requests',
  'manage_admitted_patients',
  'view_rooms_beds',
  'medication_administration',
  'nursing_notes',
  'patient_monitoring',
  'view_lab_requests',
  'process_lab_tests',
  'enter_lab_results',
  'print_lab_results',
  'send_lab_results',
  'inventory_management',
  'stock_management',
  'dispense_medicines',
  'process_prescriptions',
  'internal_consumption',
  'emergency_registration',
  'triage',
  'emergency_treatment',
  'emergency_prescription',
  'emergency_lab_requests',
  'emergency_admission',
  'view_patient_lab_results',
  'create_nurse_orders',
  'request_pharmacy_supplies',
  'request_department_supplies',
  'surgery_requests',
  'request_lab_supplies',
] as const

export type Permission = (typeof PERMISSIONS)[number]

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    'user_management',
    'department_management',
    'accounting',
    'reports',
    'system_settings',
  ],
  reception_cashier: [
    'register_patients',
    'create_visits',
    'manage_queue',
    'receive_payments',
    'print_receipts',
    'manage_patient_credit',
  ],
  doctor: [
    'view_assigned_patients',
    'diagnosis',
    'clinical_notes',
    'prescriptions',
    'lab_requests',
    'admission_requests',
    'view_patient_lab_results',
    'request_pharmacy_supplies',
    'request_department_supplies',
    'surgery_requests',
  ],
  nurse: [
    'manage_admitted_patients',
    'view_rooms_beds',
    'medication_administration',
    'nursing_notes',
    'patient_monitoring',
    'prescriptions',
    'lab_requests',
    'surgery_requests',
    'request_department_supplies',
  ],
  laboratory: [
    'view_lab_requests',
    'process_lab_tests',
    'enter_lab_results',
    'print_lab_results',
    'send_lab_results',
    'request_lab_supplies',
    'request_department_supplies',
  ],
  pharmacy: [
    'inventory_management',
    'stock_management',
    'dispense_medicines',
    'process_prescriptions',
    'internal_consumption',
  ],
  emergency: [
    'view_assigned_patients',
    'diagnosis',
    'clinical_notes',
    'prescriptions',
    'lab_requests',
    'admission_requests',
    'view_patient_lab_results',
    'request_pharmacy_supplies',
    'request_department_supplies',
    'surgery_requests',
  ],
}

export function roleHasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

export function roleHasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some((p) => roleHasPermission(role, p))
}
