import LabTestCatalogView from '@/shared/components/LabTestCatalogView'

const LabTestCatalogBrowsePage = () => (
  <LabTestCatalogView
    readOnly
    permissions={['view_lab_requests']}
    title="Lab Test Catalog"
    subtitle="Browse active tests by category — pricing and sample requirements"
    breadcrumbs={[
      { label: 'Laboratory', href: '/hms/laboratory/dashboard' },
      { label: 'Test Catalog' },
    ]}
  />
)

export default LabTestCatalogBrowsePage
