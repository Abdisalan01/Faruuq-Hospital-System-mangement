import PageMetaData from '@/components/PageTitle'
import { useAuthContext } from '@/context/useAuthContext'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import DepartmentSupplyRequestForm from '@/features/pharmacy/components/DepartmentSupplyRequestForm'

const DoctorSuppliesRequestPage = () => {
  const { user } = useAuthContext()
  const doctorId = user?.id ?? 'staff-003'

  return (
    <PermissionGuard permissions={['request_department_supplies', 'request_pharmacy_supplies']}>
      <PageMetaData title="Supplies Request" />
      <PageHeader
        title="Supplies Request"
        subtitle="Request medical supplies from pharmacy"
        breadcrumbs={[
          { label: 'Doctor', href: '/hms/doctor/dashboard' },
          { label: 'Supplies Request' },
        ]}
      />
      <DepartmentSupplyRequestForm department="Doctor" requesterId={doctorId} />
    </PermissionGuard>
  )
}

export default DoctorSuppliesRequestPage
