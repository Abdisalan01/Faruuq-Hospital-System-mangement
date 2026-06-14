import { useMemo } from 'react'
import { Row } from 'react-bootstrap'
import { Link } from 'react-router-dom'

import PageMetaData from '@/components/PageTitle'
import { useAuthContext } from '@/context/useAuthContext'
import { useHmsStoreContext } from '@/context/HmsStoreContext'
import { getLoggedInStaffId } from '@/features/doctor/utils/doctorContext'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import StatCard from '@/shared/components/StatCard'
import { getVisitsForDoctorToday, visits as storeVisits } from '@/shared/services/hmsStore'
import { isVisitCompletedConsultation } from '@/shared/utils/visitConsultation'

const DoctorDashboardPage = () => {
  const { user } = useAuthContext()
  const { dataVersion } = useHmsStoreContext()

  const doctorId = user?.id ?? getLoggedInStaffId()

  const todayVisits = useMemo(
    () => (doctorId ? getVisitsForDoctorToday(doctorId) : []),
    [doctorId, dataVersion, storeVisits.length],
  )

  const waiting = todayVisits.filter((v) => v.status === 'Waiting').length
  const active = todayVisits.filter((v) => v.status === 'In Consultation').length
  const completed = todayVisits.filter((v) => isVisitCompletedConsultation(v)).length

  return (
    <PermissionGuard permissions={['view_assigned_patients']}>
      <PageMetaData title="Doctor Dashboard" />
      <PageHeader
        title="Doctor Dashboard"
        subtitle={`Today's patient queue overview`}
        breadcrumbs={[
          { label: 'Doctor', href: '/hms/doctor/dashboard' },
          { label: 'Dashboard' },
        ]}
        actionLabel="View Queue"
        actionHref="/hms/doctor/patients"
        actionIcon="solar:clipboard-list-broken"
      />
      <Row>
        <StatCard title="Today's Queue" value={todayVisits.length} icon="solar:users-group-rounded-broken" variant="primary" link="/hms/doctor/patients" />
        <StatCard title="Waiting" value={waiting} icon="solar:clock-circle-broken" variant="warning" link="/hms/doctor/patients" />
        <StatCard title="In Consultation" value={active} icon="solar:stethoscope-broken" variant="info" link="/hms/doctor/patients" />
        <StatCard title="Processed Today" value={completed} icon="solar:check-circle-broken" variant="success" link="/hms/doctor/patients" />
      </Row>
      {todayVisits.length > 0 && (
        <div className="mt-3 d-flex flex-wrap gap-2">
          <Link to="/hms/doctor/patients" className="btn btn-primary">
            All Patients
          </Link>
          <Link to="/hms/doctor/inpatients" className="btn btn-outline-primary">
            In-Patients
          </Link>
          <Link to="/hms/doctor/lab-results" className="btn btn-outline-secondary">
            Lab Results
          </Link>
        </div>
      )}
    </PermissionGuard>
  )
}

export default DoctorDashboardPage
