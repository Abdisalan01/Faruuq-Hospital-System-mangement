import MedicalCatalogView from '@/shared/components/MedicalCatalogView'

const PharmacyMedicalCatalogPage = () => (
  <MedicalCatalogView
    permissions={['inventory_management']}
    breadcrumbs={[
      { label: 'Pharmacy', href: '/hms/pharmacy/dashboard' },
      { label: 'Medical Catalog' },
    ]}
  />
)

export default PharmacyMedicalCatalogPage
