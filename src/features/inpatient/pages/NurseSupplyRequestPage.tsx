import PageMetaData from '@/components/PageTitle'
import { useAuthContext } from '@/context/useAuthContext'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import DepartmentSupplyRequestForm from '@/features/pharmacy/components/DepartmentSupplyRequestForm'

const NurseSupplyRequestPage = () => {
  const { user } = useAuthContext()
  const nurseId = user?.id ?? 'staff-004'

  return (
    <PermissionGuard permissions={['request_department_supplies']}>
      <PageMetaData title="Supplies Request" />
      <PageHeader
        title="Supplies Request"
        subtitle="Request ward supplies from pharmacy"
        breadcrumbs={[
          { label: 'Nursing', href: '/hms/inpatient/dashboard' },
          { label: 'Supplies Request' },
        ]}
      />
      <DepartmentSupplyRequestForm department="Nursing" requesterId={nurseId} />
    </PermissionGuard>
  )
}

export default NurseSupplyRequestPage
