import PageMetaData from '@/components/PageTitle'
import { currency } from '@/context/constants'
import { useAuthContext } from '@/context/useAuthContext'
import { Navigate } from 'react-router-dom'
import { Row } from 'react-bootstrap'

import InpatientUnpaidAlertCards from '@/features/reception/components/InpatientUnpaidAlertCards'
import StatCard from '@/shared/components/StatCard'
import { getRoleHomePath } from '@/shared/config/roleHomeRoutes'
import { usePermission } from '@/shared/hooks/usePermission'
import { getDashboardStats, getReceptionInpatientUnpaidAlerts } from '@/shared/services/hmsStore'
import { ROLE_LABELS } from '@/shared/types/roles'

const ReceptionDashboardPage = () => {
  const { user } = useAuthContext()
  const { role } = usePermission()
  const stats = getDashboardStats()
  const unpaidAlerts = getReceptionInpatientUnpaidAlerts()

  if (role && role !== 'reception_cashier') {
    return <Navigate to={getRoleHomePath(role)} replace />
  }

  return (
    <>
      <PageMetaData title="Reception Dashboard" />
      <div className="mb-3">
        <h4 className="mb-1">Reception Dashboard</h4>
        <p className="text-muted mb-0">
          Welcome, {user?.firstName} {user?.lastName} — {ROLE_LABELS.reception_cashier}
        </p>
      </div>

      <Row>
        <StatCard
          title="Patients Today"
          value={stats.todayVisits}
          icon="solar:users-group-rounded-broken"
          variant="primary"
          link="/hms/patients"
        />
        <StatCard
          title="Waiting in Queue"
          value={stats.waitingPatients}
          icon="solar:clock-circle-broken"
          variant="warning"
          link="/hms/patients"
        />
        <StatCard
          title="Lab Fees Pending"
          value={stats.awaitingLabFees}
          icon="solar:test-tube-broken"
          variant="info"
          link="/hms/reception/lab-fees"
        />
        <StatCard
          title="Outstanding Credit"
          value={`${currency}${stats.totalOutstanding}`}
          icon="solar:wallet-broken"
          variant="danger"
          link="/hms/reception/credit-accounts"
        />
        <StatCard
          title="Inpatient Unpaid"
          value={stats.inpatientUnpaidAlerts}
          icon="solar:danger-triangle-broken"
          variant="danger"
          link="/hms/reception/all-inpatients"
        />
        <StatCard
          title="Obstetric Pending"
          value={stats.obstetricPendingPayments}
          icon="solar:heart-pulse-broken"
          variant="info"
          link="/hms/reception/obstetric"
        />
      </Row>

      {unpaidAlerts.length > 0 && (
        <div className="mt-3">
          <InpatientUnpaidAlertCards alerts={unpaidAlerts} />
        </div>
      )}
    </>
  )
}

export default ReceptionDashboardPage
