import PageMetaData from '@/components/PageTitle'
import { currency } from '@/context/constants'
import { useAuthContext } from '@/context/useAuthContext'
import { Navigate } from 'react-router-dom'
import { Col, Row } from 'react-bootstrap'

import StatCard from '@/shared/components/StatCard'
import { getRoleHomePath } from '@/shared/config/roleHomeRoutes'
import { usePermission } from '@/shared/hooks/usePermission'
import { getDashboardStats } from '@/shared/services/hmsStore'
import { ROLE_LABELS } from '@/shared/types/roles'

import DailyRevenueChart from '../components/DailyRevenueChart'
import DepartmentActivityChart from '../components/DepartmentActivityChart'
import MonthlyRevenueChart from '../components/MonthlyRevenueChart'
import PatientTrendsChart from '../components/PatientTrendsChart'
import RecentActivities from '../components/RecentActivities'

const HMSDashboardPage = () => {
  const { user } = useAuthContext()
  const { role } = usePermission()
  const stats = getDashboardStats()

  if (role && role !== 'admin') {
    return <Navigate to={getRoleHomePath(role)} replace />
  }

  return (
    <>
      <PageMetaData title="Hospital Dashboard" />
      <div className="mb-3">
        <h4 className="mb-1">Hospital Dashboard</h4>
        <p className="text-muted mb-0">
          Welcome, {user?.firstName} {user?.lastName} — {role ? ROLE_LABELS[role] : 'Staff'}
        </p>
      </div>

      <Row>
        <StatCard title="Patients Today" value={stats.todayVisits} icon="solar:users-group-rounded-broken" variant="primary" link="/hms/administration/patient-reports" />
        <StatCard title="Active Visits" value={stats.todayVisits - stats.waitingPatients} icon="solar:clipboard-list-broken" variant="success" link="/hms/administration/operational-reports" />
        <StatCard title="Waiting Patients" value={stats.waitingPatients} icon="solar:clock-circle-broken" variant="warning" link="/hms/administration/operational-reports" />
        <StatCard title="Admitted Patients" value={stats.admittedPatients} icon="solar:bed-broken" variant="info" link="/hms/administration/operational-reports" />
        <StatCard title="Today's Revenue" value={`${currency}${stats.todayRevenue}`} icon="solar:dollar-minimalistic-broken" variant="success" link="/hms/accounting/revenue" />
        <StatCard title="Outstanding Balances" value={`${currency}${stats.totalOutstanding}`} icon="solar:wallet-broken" variant="danger" link="/hms/accounting/receivables" />
        <StatCard title="Lab Requests" value={stats.pendingLabRequests} icon="solar:test-tube-broken" variant="primary" link="/hms/administration/operational-reports" />
        <StatCard title="Pharmacy Sales" value={stats.pendingPrescriptions} icon="solar:pill-broken" variant="secondary" link="/hms/administration/operational-reports" />
      </Row>

      <Row className="mt-1">
        <Col xl={6}>
          <DailyRevenueChart />
        </Col>
        <Col xl={6}>
          <MonthlyRevenueChart />
        </Col>
      </Row>

      <Row className="mt-1">
        <Col xl={6}>
          <PatientTrendsChart />
        </Col>
        <Col xl={6}>
          <DepartmentActivityChart />
        </Col>
      </Row>

      <Row className="mt-1">
        <Col>
          <RecentActivities />
        </Col>
      </Row>
    </>
  )
}

export default HMSDashboardPage
