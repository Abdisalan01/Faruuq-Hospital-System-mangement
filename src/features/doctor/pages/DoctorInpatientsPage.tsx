import { useMemo } from 'react'

import { useAuthContext } from '@/context/useAuthContext'
import ClinicalInpatientsView from '@/features/inpatient/components/ClinicalInpatientsView'
import { getInpatientsForDoctor } from '@/shared/services/hmsStore'

const DoctorInpatientsPage = () => {
  const { user } = useAuthContext()
  const doctorId = user?.id ?? 'staff-003'

  const admissions = useMemo(() => getInpatientsForDoctor(doctorId), [doctorId])

  return (
    <ClinicalInpatientsView
      pageTitle="In-Patients"
      pageSubtitle="Patients you admitted — search, filter, and view full reports"
      breadcrumbs={[
        { label: 'Doctor', href: '/hms/doctor/dashboard' },
        { label: 'In-Patients' },
      ]}
      permissions={['view_assigned_patients']}
      admissions={admissions}
      canDischarge
      canOrderClinical={false}
      orderDoctorId={doctorId}
      consultationLink={(visitId) => `/hms/doctor/consultation/${visitId}`}
    />
  )
}

export default DoctorInpatientsPage
