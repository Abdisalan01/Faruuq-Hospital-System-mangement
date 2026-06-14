import { useMemo } from 'react'
import { Row } from 'react-bootstrap'

import PageMetaData from '@/components/PageTitle'
import { useHmsStoreContext } from '@/context/HmsStoreContext'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import StatCard from '@/shared/components/StatCard'
import { getLabVisibleRequests, labRequests as storeLabRequests } from '@/shared/services/hmsStore'

const LabDashboardPage = () => {
  const { dataVersion } = useHmsStoreContext()

  const stats = useMemo(() => {
    const visible = getLabVisibleRequests()
    const pending = visible.filter((l) => l.status === 'Pending' || l.status === 'In Progress').length
    const completed = visible.filter((l) => l.status === 'Completed').length
    return { pending, completed, total: visible.length }
  }, [dataVersion, storeLabRequests.length])

  return (
    <PermissionGuard permissions={['view_lab_requests']}>
      <PageMetaData title="Lab Dashboard" />
      <PageHeader
        title="Lab Dashboard"
        subtitle="Laboratory workflow overview"
        breadcrumbs={[{ label: 'Laboratory', href: '/hms/laboratory/dashboard' }, { label: 'Dashboard' }]}
      />
      <Row>
        <StatCard
          title="All Lab Requests"
          value={stats.total}
          icon="solar:test-tube-broken"
          variant="primary"
          link="/hms/laboratory/all"
        />
        <StatCard
          title="Pending"
          value={stats.pending}
          icon="solar:clock-circle-broken"
          variant="warning"
          link="/hms/laboratory/all"
        />
        <StatCard
          title="Completed"
          value={stats.completed}
          icon="solar:check-circle-broken"
          variant="success"
          link="/hms/laboratory/completed"
        />
      </Row>
    </PermissionGuard>
  )
}

export default LabDashboardPage
