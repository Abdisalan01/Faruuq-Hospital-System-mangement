import MedicalCatalogView from '@/shared/components/MedicalCatalogView'
import LabTestCatalogView from '@/shared/components/LabTestCatalogView'
import SurgeryCatalogView from '@/shared/components/SurgeryCatalogView'

// ─── Lab Tests Catalog ───────────────────────────────────────────────────────

export const LabCatalogPage = () => (
  <LabTestCatalogView
    permissions={['system_settings', 'user_management']}
    breadcrumbs={[
      { label: 'Administration', href: '/hms/administration/users' },
      { label: 'Lab Tests' },
    ]}
  />
)

// ─── Medical Catalog (same layout as Pharmacy) ───────────────────────────────

export const MedicineCatalogPage = () => (
  <MedicalCatalogView
    permissions={['system_settings', 'user_management']}
    breadcrumbs={[
      { label: 'Administration', href: '/hms/administration/users' },
      { label: 'Medical Catalog' },
    ]}
  />
)

// ─── Surgery Catalog ─────────────────────────────────────────────────────────

export const SurgeryCatalogPage = () => (
  <SurgeryCatalogView
    permissions={['system_settings', 'user_management']}
    breadcrumbs={[
      { label: 'Administration', href: '/hms/administration/users' },
      { label: 'Surgeries' },
    ]}
  />
)

export { default as RoomBedManagementPage } from './RoomBedManagementPage'
