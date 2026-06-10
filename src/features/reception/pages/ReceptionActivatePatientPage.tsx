import { useMemo, useState } from 'react'
import { Alert, Button, Card, CardBody, Form, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'

import PageMetaData from '@/components/PageTitle'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { useHmsStoreContext } from '@/context/HmsStoreContext'
import PageHeader from '@/shared/components/PageHeader'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import StatusBadge from '@/shared/components/StatusBadge'
import {
  getDisplayVisitForPatient,
  getPatientById,
  getStaffById,
  patients,
  persistPatientsNowAsync,
} from '@/shared/services/hmsStore'
import {
  activatePatientForFollowUp,
  FOLLOW_UP_ACTIVATION_DAYS,
  getFollowUpActivationInfo,
  getPatientCareDisplayStatusFromPatient,
} from '@/shared/utils/visitConsultation'

const ReceptionActivatePatientPage = () => {
  const { dataVersion, isReady, isSupabase } = useHmsStoreContext()
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)

  const inactivePatients = useMemo(() => {
    return patients.filter((p) => getPatientCareDisplayStatusFromPatient(p) === 'Inactive')
  }, [patients.length, dataVersion])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return inactivePatients
    return inactivePatients.filter(
      (p) =>
        p.fullName.toLowerCase().includes(q) ||
        p.phone.includes(q) ||
        p.id.toLowerCase().includes(q),
    )
  }, [inactivePatients, search, dataVersion])

  const handleActivate = async (patientId: string) => {
    setError('')
    setSuccess('')
    const info = getFollowUpActivationInfo(patientId)
    if (!info.eligible) {
      setError(info.error ?? 'Cannot activate this patient.')
      return
    }

    setSavingId(patientId)
    try {
      const result = activatePatientForFollowUp(patientId)
      if (!result.ok) {
        setError(result.error ?? 'Activation failed.')
        return
      }

      if (isSupabase) {
        await persistPatientsNowAsync()
      }

      const patient = getPatientById(patientId)
      const visit = getDisplayVisitForPatient(patientId)
      const staff = visit?.assignedDoctorId ? getStaffById(visit.assignedDoctorId) : undefined
      const doctorLabel = staff
        ? staff.role === 'emergency'
          ? 'Emergency'
          : `Dr. ${staff.firstName} ${staff.lastName}`
        : 'assigned doctor'
      const num = visit?.patientNumber ?? visit?.queueNumber

      setSuccess(
        `${patient?.fullName ?? 'Patient'} activated — status Active, Patient #${num} unchanged. Send to ${doctorLabel}.`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save to database.')
    } finally {
      setSavingId(null)
    }
  }

  if (!isReady) {
    return (
      <PermissionGuard permissions={['register_patients']}>
        <PageMetaData title="Activate Patient" />
        <div className="d-flex flex-column align-items-center justify-content-center py-5 gap-2">
          <div className="spinner-border spinner-border-sm text-primary" role="status" />
          <p className="text-muted mb-0 small">Loading…</p>
        </div>
      </PermissionGuard>
    )
  }

  return (
    <PermissionGuard permissions={['register_patients']}>
      <PageMetaData title="Activate Patient" />
      <PageHeader
        title="Activate Patient"
        subtitle={`Follow-up return within ${FOLLOW_UP_ACTIVATION_DAYS} days — same patient number, no registration fee`}
        breadcrumbs={[
          { label: 'Reception', href: '/hms/reception/dashboard' },
          { label: 'Activate Patient' },
        ]}
      />

      <Alert variant="info" className="py-2 mb-3">
        <strong>When to use:</strong> Doctor told patient to return within 2 weeks. Search by phone,
        activate here — patient meets doctor as <strong>Active</strong> with the same number. After{' '}
        <strong>{FOLLOW_UP_ACTIVATION_DAYS} days</strong> from release, use{' '}
        <Link to="/hms/patients">Edit Patient → Assign a new patient number</Link>.
      </Alert>

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert variant="success" dismissible onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      <Card className="mb-3">
        <CardBody className="py-2">
          <Form.Control
            type="search"
            placeholder="Search by phone, name, or patient ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </CardBody>
      </Card>

      <Card>
        <CardBody className="p-0">
          <div className="table-responsive">
            <Table hover className="mb-0">
              <thead className="bg-light bg-opacity-50">
                <tr>
                  <th>Patient ID</th>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Last #</th>
                  <th>Doctor</th>
                  <th>Follow-up</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center text-muted py-4">
                      {search
                        ? 'No inactive patients match your search'
                        : 'No inactive patients — released patients appear here'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((patient) => {
                    const info = getFollowUpActivationInfo(patient.id)
                    const lastVisit = info.lastVisit
                    const displayVisit = getDisplayVisitForPatient(patient.id)
                    const staff = lastVisit?.assignedDoctorId
                      ? getStaffById(lastVisit.assignedDoctorId)
                      : undefined
                    const doctorLabel = staff
                      ? staff.role === 'emergency'
                        ? 'Emergency'
                        : `Dr. ${staff.firstName} ${staff.lastName}`
                      : '—'
                    const lastNum = lastVisit?.patientNumber ?? lastVisit?.queueNumber

                    return (
                      <tr key={patient.id}>
                        <td className="fw-medium">{patient.id}</td>
                        <td>{patient.fullName}</td>
                        <td>{patient.phone}</td>
                        <td className="fw-semibold">{lastNum ? `#${lastNum}` : '—'}</td>
                        <td>{doctorLabel}</td>
                        <td>
                          {info.eligible ? (
                            <span className="text-success small fw-semibold">
                              {info.daysRemaining} day{info.daysRemaining === 1 ? '' : 's'} left
                              <span className="text-muted fw-normal d-block">
                                until {info.deadlineDate}
                              </span>
                            </span>
                          ) : (
                            <span className="text-danger small">{info.error}</span>
                          )}
                        </td>
                        <td>
                          <StatusBadge
                            status={
                              displayVisit
                                ? getPatientCareDisplayStatusFromPatient(patient)
                                : 'Inactive'
                            }
                          />
                        </td>
                        <td>
                          {info.eligible ? (
                            <Button
                              size="sm"
                              variant="success"
                              disabled={savingId === patient.id}
                              onClick={() => void handleActivate(patient.id)}
                            >
                              <IconifyIcon icon="solar:user-check-broken" className="me-1" />
                              {savingId === patient.id ? 'Activating…' : 'Activate'}
                            </Button>
                          ) : (
                            <Link
                              to={`/hms/patients/${patient.id}/edit`}
                              className="btn btn-sm btn-outline-secondary"
                            >
                              New number
                            </Link>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </Table>
          </div>
        </CardBody>
      </Card>
    </PermissionGuard>
  )
}

export default ReceptionActivatePatientPage
