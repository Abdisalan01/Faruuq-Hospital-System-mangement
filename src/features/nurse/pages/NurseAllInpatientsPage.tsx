import { useMemo } from 'react'

import { useHmsStoreContext } from '@/context/HmsStoreContext'
import ClinicalInpatientsView from '@/features/inpatient/components/ClinicalInpatientsView'
import { admissions as storeAdmissions, getAllInpatientAdmissions } from '@/shared/services/hmsStore'

const NurseAllInpatientsPage = () => {
  const { dataVersion } = useHmsStoreContext()
  const admissions = useMemo(
    () => getAllInpatientAdmissions(),
    [storeAdmissions.length, dataVersion],
  )

  return (
    <ClinicalInpatientsView
      pageTitle="All Inpatients"
      pageSubtitle="All hospital inpatients — view reports, order care, and discharge"
      breadcrumbs={[
        { label: 'Nursing', href: '/hms/inpatient/dashboard' },
        { label: 'All Inpatients' },
      ]}
      permissions={['manage_admitted_patients']}
      admissions={admissions}
      canDischarge
      canOrderClinical
    />
  )
}

export default NurseAllInpatientsPage
