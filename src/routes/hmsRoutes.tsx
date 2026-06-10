import { lazy, type ReactNode } from 'react'
import { Navigate, useParams, type RouteProps } from 'react-router-dom'

import { RoleGuardRoute } from '@/shared/components/PermissionGuard'

function RedirectEmergencyConsultation() {
  const { id } = useParams()
  return <Navigate to={`/hms/emergency/cases/${id ?? ''}`} replace />
}

export type HMSRoutesProps = {
  path: RouteProps['path']
  name: string
  element: RouteProps['element']
}

// Dashboard
const HMSDashboard = lazy(() => import('@/features/dashboard/pages/HMSDashboardPage'))

// Patients
const PatientList = lazy(() => import('@/features/patients/pages/PatientListPage'))
const PatientCreate = lazy(() => import('@/features/reception/pages/ReceptionRegisterPage'))
const ReceptionRegister = lazy(() => import('@/features/reception/pages/ReceptionRegisterPage'))
const PatientDetail = lazy(() => import('@/features/patients/pages/PatientDetailPage'))
const PatientEdit = lazy(() => import('@/features/patients/pages/PatientEditPage'))
const PatientCredit = lazy(() => import('@/features/patients/pages/PatientCreditPage'))
const PatientHistory = lazy(() => import('@/features/patients/pages/PatientHistoryPage'))

// Reception
const ReceptionDashboard = lazy(() => import('@/features/reception/pages/ReceptionDashboardPage'))
const PaymentsPage = lazy(() => import('@/features/visits/pages/PaymentsPage'))
const ReceiptsPage = lazy(() => import('@/features/reception/pages/ReceiptsPage'))
const ReceptionLabFeesPage = lazy(() => import('@/features/reception/pages/ReceptionLabFeesPage'))
const ReceptionInpatientRequest = lazy(
  () => import('@/features/reception/pages/ReceptionInpatientRequestPage'),
)
const ReceptionAllInpatients = lazy(
  () => import('@/features/reception/pages/ReceptionAllInpatientsPage'),
)
const ReceptionSurgeryPage = lazy(() => import('@/features/reception/pages/ReceptionSurgeryPage'))
const ReceptionInpatientMedicinePage = lazy(
  () => import('@/features/reception/pages/ReceptionInpatientMedicinePage'),
)
const ReceptionPatientDiscounts = lazy(() => import('@/features/reception/pages/ReceptionPatientDiscountsPage'))
const ReceptionActivatePatient = lazy(
  () => import('@/features/reception/pages/ReceptionActivatePatientPage'),
)

// Doctor
const DoctorDashboard = lazy(() => import('@/features/doctor/pages/DoctorDashboardPage'))
const DoctorAllPatients = lazy(() => import('@/features/doctor/pages/DoctorAllPatientsPage'))
const DoctorLabResults = lazy(() => import('@/features/doctor/pages/DoctorLabResultsPage'))
const DoctorInpatients = lazy(() => import('@/features/doctor/pages/DoctorInpatientsPage'))
const DoctorSuppliesRequest = lazy(() => import('@/features/doctor/pages/DoctorSuppliesRequestPage'))
const DoctorSurgery = lazy(() => import('@/features/doctor/pages/DoctorSurgeryPage'))
const Consultation = lazy(() => import('@/features/doctor/pages/ConsultationPage'))

// Laboratory
const LabDashboard = lazy(() => import('@/features/laboratory/pages/LabDashboardPage'))
const LabAllRequests = lazy(() => import('@/features/laboratory/pages/LabAllRequestsPage'))
const LabOrderSupply = lazy(() => import('@/features/laboratory/pages/LabOrderSupplyPage'))
const LabCompleted = lazy(() => import('@/features/laboratory/pages/LabCompletedLabsPage'))
const LabRequestDetail = lazy(() => import('@/features/laboratory/pages/LabRequestDetailPage'))
const LabRequestEdit = lazy(() => import('@/features/laboratory/pages/LabRequestEditPage'))
const LabTestCatalogBrowse = lazy(() => import('@/features/laboratory/pages/LabTestCatalogBrowsePage'))

// Pharmacy
const PrescriptionsPage = lazy(() => import('@/features/pharmacy/pages/PrescriptionsPage'))
const PharmacyDashboard = lazy(() => import('@/features/pharmacy/pages/PharmacyDashboardPage'))
const PharmacyMedicalCatalog = lazy(() => import('@/features/pharmacy/pages/PharmacyMedicalCatalogPage'))
const PharmacySupplyRequests = lazy(() => import('@/features/pharmacy/pages/PharmacySupplyRequestsPage'))
const StockTransactions = lazy(() => import('@/features/pharmacy/pages/StockTransactionsPage'))

// Emergency
const EmergencyDashboard = lazy(() => import('@/features/emergency/pages/EmergencyDashboardPage'))
const EmergencyCasesList = lazy(() => import('@/features/emergency/pages/EmergencyCasesListPage'))
const EmergencyCaseCreate = lazy(() => import('@/features/emergency/pages/EmergencyCaseCreatePage'))
const EmergencyCaseEdit = lazy(() => import('@/features/emergency/pages/EmergencyCaseEditPage'))
const EmergencySupplyRequest = lazy(() => import('@/features/emergency/pages/EmergencySupplyRequestPage'))
const EmergencyCaseDetail = lazy(() => import('@/features/emergency/pages/EmergencyCaseDetailPage'))
const EmergencyQueue = lazy(() => import('@/features/emergency/pages/EmergencyQueuePage'))

// Inpatient / Nursing
const NurseDashboard = lazy(() => import('@/features/nurse/pages/NurseDashboardPage'))
const NurseAllInpatients = lazy(() => import('@/features/nurse/pages/NurseAllInpatientsPage'))
const NurseSupplyRequest = lazy(() => import('@/features/inpatient/pages/NurseSupplyRequestPage'))

// Administration
const UsersList = lazy(() => import('@/features/admin/pages/UsersListPage'))
const UserCreate = lazy(() => import('@/features/admin/pages/UserCreatePage'))
const UserDetail = lazy(() => import('@/features/admin/pages/UserDetailPage'))
const UserEdit = lazy(() => import('@/features/admin/pages/UserEditPage'))
const DepartmentsList = lazy(() => import('@/features/admin/pages/DepartmentsListPage'))
const DepartmentCreate = lazy(() => import('@/features/admin/pages/DepartmentCreatePage'))
const DepartmentDetail = lazy(() => import('@/features/admin/pages/DepartmentDetailPage'))
const DepartmentEdit = lazy(() => import('@/features/admin/pages/DepartmentEditPage'))
const RolesPage = lazy(() => import('@/features/admin/pages/RolesPermissionsPages').then((m) => ({ default: m.RolesPage })))
const PermissionsPage = lazy(() => import('@/features/admin/pages/RolesPermissionsPages').then((m) => ({ default: m.PermissionsPage })))
const LabCatalog = lazy(() => import('@/features/admin/pages/AdminCatalogPages').then((m) => ({ default: m.LabCatalogPage })))
const MedicineCatalog = lazy(() => import('@/features/admin/pages/AdminCatalogPages').then((m) => ({ default: m.MedicineCatalogPage })))
const SurgeryCatalog = lazy(() => import('@/features/admin/pages/AdminCatalogPages').then((m) => ({ default: m.SurgeryCatalogPage })))
const RoomBedManagement = lazy(() => import('@/features/admin/pages/AdminCatalogPages').then((m) => ({ default: m.RoomBedManagementPage })))
const DiscountsAdmin = lazy(() => import('@/features/admin/pages/AdminDiscountManagementPage'))
const AdminPatientDiscounts = lazy(() => import('@/features/admin/pages/AdminPatientDiscountsPage'))
const AdminPatientNumberFee = lazy(() => import('@/features/admin/pages/AdminPatientNumberFeePage'))
const AdminReports = lazy(() => import('@/features/admin/pages/AdminReportsPage'))
const AdminOperationalReports = lazy(() => import('@/features/admin/pages/AdminOperationalReportsPage'))
const FinancialReports = lazy(() => import('@/features/accounting/pages/FinancialReportsPage'))

// Settings
const HospitalInfoPage = lazy(() => import('@/features/settings/pages/SettingsPages').then((m) => ({ default: m.HospitalInfoPage })))
const ServicesPricingPage = lazy(() => import('@/features/settings/pages/SettingsPages').then((m) => ({ default: m.ServicesPricingPage })))
const GeneralSettingsPage = lazy(() => import('@/features/settings/pages/SettingsPages').then((m) => ({ default: m.GeneralSettingsPage })))

const withAccounting = (element: ReactNode) => (
  <RoleGuardRoute permissions={['accounting']}>{element}</RoleGuardRoute>
)

export const hmsRoutes: HMSRoutesProps[] = [
  { path: '/hms/dashboard', name: 'Dashboard', element: <HMSDashboard /> },

  // Patients
  { path: '/hms/patients', name: 'Patient List', element: <PatientList /> },
  { path: '/hms/patients/create', name: 'Register Patient', element: <PatientCreate /> },
  { path: '/hms/patients/:id/edit', name: 'Edit Patient', element: <PatientEdit /> },
  { path: '/hms/patients/:id/history', name: 'Patient History', element: <PatientHistory /> },
  { path: '/hms/patients/:id/account', name: 'Patient Account', element: <PatientCredit /> },
  { path: '/hms/patients/:id', name: 'Patient Details', element: <PatientDetail /> },

  // Reception & Cashier
  { path: '/hms/reception/dashboard', name: 'Reception Dashboard', element: <ReceptionDashboard /> },
  { path: '/hms/reception/register-patient', name: 'Register Patient', element: <ReceptionRegister /> },
  { path: '/hms/reception/billing', name: 'Billing', element: <PaymentsPage /> },
  { path: '/hms/reception/receipts', name: 'Receipts', element: <ReceiptsPage /> },
  { path: '/hms/reception/credit-accounts', name: 'Credit Accounts', element: <PatientCredit /> },
  { path: '/hms/reception/lab-fees', name: 'Lab Fees', element: <ReceptionLabFeesPage /> },
  { path: '/hms/reception/inpatient-request', name: 'In Patient Request', element: <ReceptionInpatientRequest /> },
  { path: '/hms/reception/all-inpatients', name: 'All Inpatients', element: <ReceptionAllInpatients /> },
  { path: '/hms/reception/surgery', name: 'Surgery', element: <ReceptionSurgeryPage /> },
  {
    path: '/hms/reception/inpatient-medicine',
    name: 'Inpatient Medicine',
    element: <ReceptionInpatientMedicinePage />,
  },
  { path: '/hms/reception/patient-discounts', name: 'Patient Discounts', element: <ReceptionPatientDiscounts /> },
  { path: '/hms/reception/activate-patient', name: 'Activate Patient', element: <ReceptionActivatePatient /> },

  // Doctors
  { path: '/hms/doctor/dashboard', name: 'Doctor Dashboard', element: <DoctorDashboard /> },
  { path: '/hms/doctor/patients', name: 'All Patients', element: <DoctorAllPatients /> },
  { path: '/hms/doctor/lab-results', name: 'Lab Results', element: <DoctorLabResults /> },
  { path: '/hms/doctor/inpatients', name: 'In-Patients', element: <DoctorInpatients /> },
  { path: '/hms/doctor/surgery', name: 'Surgery', element: <DoctorSurgery /> },
  { path: '/hms/doctor/supplies-request', name: 'Supplies Request', element: <DoctorSuppliesRequest /> },
  { path: '/hms/doctor/consultation/:visitId', name: 'Consultation', element: <Consultation /> },

  // Laboratory
  { path: '/hms/laboratory/dashboard', name: 'Lab Dashboard', element: <LabDashboard /> },
  { path: '/hms/laboratory/all', name: 'All Labs', element: <LabAllRequests /> },
  { path: '/hms/laboratory/catalog', name: 'Lab Test Catalog', element: <LabTestCatalogBrowse /> },
  { path: '/hms/laboratory/completed', name: 'Completed Labs', element: <LabCompleted /> },
  { path: '/hms/laboratory/order-supply', name: 'Order Supply', element: <LabOrderSupply /> },
  { path: '/hms/laboratory/requests/:id/edit', name: 'Enter Results', element: <LabRequestEdit /> },
  { path: '/hms/laboratory/requests/:id', name: 'Lab Request', element: <LabRequestDetail /> },

  // Pharmacy
  { path: '/hms/pharmacy/dashboard', name: 'Pharmacy Dashboard', element: <PharmacyDashboard /> },
  { path: '/hms/pharmacy/catalog', name: 'Medical Catalog', element: <PharmacyMedicalCatalog /> },
  { path: '/hms/pharmacy/supply-requests', name: 'Supply Requests', element: <PharmacySupplyRequests /> },
  { path: '/hms/pharmacy/prescriptions', name: 'Prescription Queue', element: <PrescriptionsPage /> },
  { path: '/hms/pharmacy/stock', name: 'Stock Movements', element: <StockTransactions /> },

  // Emergency
  { path: '/hms/emergency/dashboard', name: 'Emergency Dashboard', element: <EmergencyDashboard /> },
  { path: '/hms/emergency/cases', name: 'Emergency Cases', element: <EmergencyCasesList /> },
  { path: '/hms/emergency/cases/create', name: 'Register Emergency Case', element: <EmergencyCaseCreate /> },
  { path: '/hms/emergency/cases/:id/edit', name: 'Edit Emergency Case', element: <EmergencyCaseEdit /> },
  { path: '/hms/emergency/cases/:id', name: 'Emergency Case', element: <EmergencyCaseDetail /> },
  { path: '/hms/emergency/queue', name: 'Emergency Queue', element: <EmergencyQueue /> },
  { path: '/hms/emergency/supply-request', name: 'Supplies Request', element: <EmergencySupplyRequest /> },
  { path: '/hms/emergency/register', name: 'Emergency Registration', element: <Navigate to="/hms/emergency/cases/create" replace /> },
  { path: '/hms/emergency/consultation/:id', name: 'Emergency Consultation', element: <RedirectEmergencyConsultation /> },

  // Nursing
  { path: '/hms/inpatient/dashboard', name: 'Nursing Dashboard', element: <NurseDashboard /> },
  { path: '/hms/inpatient/all', name: 'All Inpatients', element: <NurseAllInpatients /> },
  { path: '/hms/inpatient/supply-request', name: 'Supplies Request', element: <NurseSupplyRequest /> },

  // Accounting
  { path: '/hms/accounting/financial-reports', name: 'Financial Reports', element: withAccounting(<FinancialReports />) },

  // Administration
  { path: '/hms/administration/users', name: 'Users', element: <UsersList /> },
  { path: '/hms/administration/users/create', name: 'Create User', element: <UserCreate /> },
  { path: '/hms/administration/users/:id/edit', name: 'Edit User', element: <UserEdit /> },
  { path: '/hms/administration/users/:id', name: 'User Detail', element: <UserDetail /> },
  { path: '/hms/administration/roles', name: 'Roles', element: <RolesPage /> },
  { path: '/hms/administration/permissions', name: 'Permissions', element: <PermissionsPage /> },
  { path: '/hms/administration/departments', name: 'Departments', element: <DepartmentsList /> },
  { path: '/hms/administration/departments/create', name: 'Create Department', element: <DepartmentCreate /> },
  { path: '/hms/administration/departments/:id/edit', name: 'Edit Department', element: <DepartmentEdit /> },
  { path: '/hms/administration/departments/:id', name: 'Department Detail', element: <DepartmentDetail /> },
  { path: '/hms/administration/lab-tests', name: 'Lab Tests Catalog', element: <LabCatalog /> },
  { path: '/hms/administration/medicines', name: 'Medicines Catalog', element: <MedicineCatalog /> },
  { path: '/hms/administration/surgeries', name: 'Surgery Catalog', element: <SurgeryCatalog /> },
  { path: '/hms/administration/rooms-beds', name: 'Rooms & Beds', element: <RoomBedManagement /> },
  { path: '/hms/administration/discounts', name: 'Discounts', element: <DiscountsAdmin /> },
  { path: '/hms/administration/patient-discounts', name: 'Patient Discounts', element: <AdminPatientDiscounts /> },
  { path: '/hms/administration/patient-number-fee', name: 'Patient Number Fee', element: <AdminPatientNumberFee /> },
  { path: '/hms/administration/patient-reports', name: 'All Patient Reports', element: <AdminReports /> },
  { path: '/hms/administration/operational-reports', name: 'Operational Reports', element: <AdminOperationalReports /> },

  // Settings
  { path: '/hms/settings/hospital', name: 'Hospital Information', element: <HospitalInfoPage /> },
  { path: '/hms/settings/pricing', name: 'Services & Pricing', element: <ServicesPricingPage /> },
  { path: '/hms/settings/general', name: 'General Settings', element: <GeneralSettingsPage /> },
]
