import PageMetaData from '@/components/PageTitle'
import { useAuthContext } from '@/context/useAuthContext'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import DepartmentSupplyRequestForm from '@/features/pharmacy/components/DepartmentSupplyRequestForm'

const LabOrderSupplyPage = () => {
  const { user } = useAuthContext()
  const labStaffId = user?.id ?? 'staff-005'

  return (
    <PermissionGuard permissions={['request_department_supplies', 'request_lab_supplies']}>
      <PageMetaData title="Order Supply" />
      <PageHeader
        title="Order Supply"
        subtitle="Request laboratory supplies from pharmacy"
        breadcrumbs={[
          { label: 'Laboratory', href: '/hms/laboratory/dashboard' },
          { label: 'Order Supply' },
        ]}
      />
      <DepartmentSupplyRequestForm department="Laboratory" requesterId={labStaffId} />
    </PermissionGuard>
  )
}

export default LabOrderSupplyPage
