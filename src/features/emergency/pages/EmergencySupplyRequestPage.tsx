import PageMetaData from '@/components/PageTitle'
import { useAuthContext } from '@/context/useAuthContext'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import DepartmentSupplyRequestForm from '@/features/pharmacy/components/DepartmentSupplyRequestForm'

const EmergencySupplyRequestPage = () => {
  const { user } = useAuthContext()
  const staffId = user?.id ?? 'staff-007'

  return (
    <PermissionGuard permissions={['request_department_supplies']}>
      <PageMetaData title="Supplies Request" />
      <PageHeader
        title="Supplies Request"
        subtitle="Request emergency department supplies from pharmacy"
        breadcrumbs={[
          { label: 'Emergency', href: '/hms/emergency/queue' },
          { label: 'Supplies Request' },
        ]}
      />
      <DepartmentSupplyRequestForm department="Emergency" requesterId={staffId} />
    </PermissionGuard>
  )
}

export default EmergencySupplyRequestPage
