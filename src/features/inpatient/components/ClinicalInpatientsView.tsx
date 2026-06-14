import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  Col,
  Form,
  Modal,
  Nav,
  Row,
  Tab,
  Table,
} from 'react-bootstrap'

import PageMetaData from '@/components/PageTitle'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { currency } from '@/context/constants'
import { useAuthContext } from '@/context/useAuthContext'
import { useHmsStoreContext } from '@/context/HmsStoreContext'
import PageHeader from '@/shared/components/PageHeader'
import LabTestSelect from '@/shared/components/LabTestPicker'
import SurgerySelect from '@/shared/components/SurgeryPicker'
import { PermissionGuard } from '@/shared/components/PermissionGuard'
import StatusBadge from '@/shared/components/StatusBadge'
import TablePagination from '@/shared/components/TablePagination'
import { useTablePagination } from '@/shared/hooks/useTablePagination'
import type { Admission, Permission, PrescriptionItem } from '@/shared/types'
import {
  beds,
  createInpatientPrescription,
  createLabRequestForVisit,
  persistAdmissionAssignmentNowAsync,
  persistDoctorConsultationNowAsync,
  persistInpatientMedicineApprovalNowAsync,
  persistInpatientPaymentNowAsync,
  persistLabRequestNowAsync,
  getActiveAdmissionForVisit,
  saveSurgeryRequestForVisit,
  getPatientById,
  getRoomById,
  getStaffById,
  getVisitById,
  getWardById,
  getActiveLabTests,
  getActiveSurgeries,
  labRequests,
  medicineCatalog,
  prescriptions,
  surgeryRequests,
} from '@/shared/services/hmsStore'
import { dischargeAdmission, refreshVisitWorkflow } from '@/shared/utils/visitConsultation'

type StatusFilter = 'all' | 'active' | 'inactive'

type ClinicalInpatientsViewProps = {
  pageTitle: string
  pageSubtitle: string
  breadcrumbs: { label: string; href?: string }[]
  permissions: Permission[]
  admissions: Admission[]
  canDischarge: boolean
  canOrderClinical: boolean
  orderDoctorId?: string
  consultationLink?: (visitId: string) => string
}

const emptyRxItem = (): PrescriptionItem => ({
  medicine: '',
  dosage: '',
  frequency: '',
  duration: '',
  instructions: '',
})

const ClinicalInpatientsView = ({
  pageTitle,
  pageSubtitle,
  breadcrumbs,
  permissions,
  admissions,
  canDischarge,
  canOrderClinical,
  orderDoctorId,
  consultationLink,
}: ClinicalInpatientsViewProps) => {
  const { user } = useAuthContext()
  const { dataVersion, isSupabase } = useHmsStoreContext()
  const [tick, setTick] = useState(0)
  const refresh = () => setTick((t) => t + 1)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [selectedAdmission, setSelectedAdmission] = useState<Admission | null>(null)
  const [actionMsg, setActionMsg] = useState('')
  const [modalTab, setModalTab] = useState<'report' | 'orders'>('report')

  const [rxItems, setRxItems] = useState<PrescriptionItem[]>([emptyRxItem()])
  const [labTests, setLabTests] = useState<string[]>([''])
  const [surgeryCatalogId, setSurgeryCatalogId] = useState('')
  const [surgeryNotes, setSurgeryNotes] = useState('')

  const activeMedicines = useMemo(
    () => medicineCatalog.filter((m) => m.isActive).sort((a, b) => a.name.localeCompare(b.name)),
    [],
  )
  const activeLabTestCount = useMemo(() => getActiveLabTests().length, [])
  const activeSurgeryCount = useMemo(() => getActiveSurgeries().length, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return admissions.filter((adm) => {
      const patient = getPatientById(adm.patientId)
      const visit = getVisitById(adm.visitId)
      const doctor = visit?.assignedDoctorId ? getStaffById(visit.assignedDoctorId) : undefined
      const room = getRoomById(adm.roomId)
      const ward = getWardById(adm.wardId)
      const bed = beds.find((b) => b.id === adm.bedId)

      if (statusFilter === 'active' && adm.status !== 'Active') return false
      if (statusFilter === 'inactive' && adm.status !== 'Discharged') return false

      if (!q) return true
      const hay = [
        patient?.id,
        patient?.fullName,
        room?.name,
        ward?.name,
        bed?.bedNumber,
        doctor ? `${doctor.firstName} ${doctor.lastName}` : '',
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [admissions, search, statusFilter, tick, dataVersion])

  const filteredPagination = useTablePagination(filtered, 10, [
    filtered.length,
    search,
    statusFilter,
    tick,
    dataVersion,
  ])

  const openAdmission = (adm: Admission) => {
    setSelectedAdmission(adm)
    setActionMsg('')
    setModalTab('report')
    setRxItems([emptyRxItem()])
    setLabTests([''])
    setSurgeryCatalogId('')
    setSurgeryNotes('')
  }

  const modalPatient = selectedAdmission ? getPatientById(selectedAdmission.patientId) : undefined
  const modalVisit = selectedAdmission ? getVisitById(selectedAdmission.visitId) : undefined
  const modalDoctor = modalVisit?.assignedDoctorId ? getStaffById(modalVisit.assignedDoctorId) : undefined
  const modalRoom = selectedAdmission ? getRoomById(selectedAdmission.roomId) : undefined
  const modalWard = selectedAdmission ? getWardById(selectedAdmission.wardId) : undefined
  const modalBed = selectedAdmission ? beds.find((b) => b.id === selectedAdmission.bedId) : undefined

  const visitPrescriptions = modalVisit
    ? prescriptions.filter((p) => p.visitId === modalVisit.id)
    : []
  const visitLabs = modalVisit ? labRequests.filter((l) => l.visitId === modalVisit.id) : []
  const visitSurgeries = modalVisit ? surgeryRequests.filter((s) => s.visitId === modalVisit.id) : []

  const handleDischarge = async () => {
    if (!selectedAdmission) return
    if (!window.confirm('Discharge this patient? They can go home and status will become Active.')) return
    const ok = dischargeAdmission(selectedAdmission.id)
    if (!ok) return

    try {
      if (isSupabase) await persistAdmissionAssignmentNowAsync()
      setActionMsg(
        `Patient discharged — they can go home. Status is now Active.${isSupabase ? ' Saved to database.' : ''}`,
      )
      setSelectedAdmission(null)
      refresh()
    } catch {
      setActionMsg('Discharged locally but database save failed.')
      refresh()
    }
  }

  const resolveOrderDoctorId = (): string | undefined => {
    if (orderDoctorId) return orderDoctorId
    return modalVisit?.assignedDoctorId
  }

  const handleSavePrescription = async () => {
    if (!modalVisit || !canOrderClinical) return
    const doctorId = resolveOrderDoctorId()
    if (!doctorId) return
    const validItems = rxItems.filter((i) => i.medicine.trim())
    if (validItems.length === 0) return
    const adm = selectedAdmission ?? getActiveAdmissionForVisit(modalVisit.id)
    if (!adm) {
      setActionMsg('Patient must be actively admitted to send medicine to pharmacy.')
      return
    }
    createInpatientPrescription({
      visitId: modalVisit.id,
      patientId: modalVisit.patientId,
      admissionId: adm.id,
      doctorId,
      orderedById: user?.id ?? doctorId,
      items: validItems,
    })
    refreshVisitWorkflow(modalVisit.id)

    try {
      if (isSupabase) await persistInpatientMedicineApprovalNowAsync()
    } catch {
      setActionMsg('Prescription sent locally but database save failed.')
      refresh()
      return
    }

    const billingNote =
      adm.billingMode === 'credit_book'
        ? 'Pharmacy will add to credit book or collect payment.'
        : 'Patient will pay cash at pharmacy when dispensed.'
    setActionMsg(
      `Prescription sent to pharmacy — appears on Inpatient Medicine Requests.${isSupabase ? ' Saved to database.' : ''} ${billingNote}`,
    )
    setRxItems([emptyRxItem()])
    refresh()
  }

  const handleSaveLab = async () => {
    if (!modalVisit || !canOrderClinical) return
    const doctorId = resolveOrderDoctorId()
    if (!doctorId) return
    const testNames = labTests.filter((n) => n.trim())
    if (testNames.length === 0) return

    try {
      const lab = createLabRequestForVisit({
        visitId: modalVisit.id,
        patientId: modalVisit.patientId,
        doctorId,
        testNames,
      })
      refreshVisitWorkflow(modalVisit.id)

      if (isSupabase) await persistLabRequestNowAsync(lab.id)

      setActionMsg(
        `Lab request sent to reception for payment.${isSupabase ? ' Saved to database.' : ''}`,
      )
      setLabTests([''])
      refresh()
    } catch {
      setActionMsg('Lab request created locally but database save failed.')
      refresh()
    }
  }

  const handleSaveSurgery = async () => {
    if (!modalVisit || !canOrderClinical || !surgeryCatalogId) return
    const doctorId = resolveOrderDoctorId()
    if (!doctorId) return
    try {
      const surgeryReq = saveSurgeryRequestForVisit({
        visitId: modalVisit.id,
        patientId: modalVisit.patientId,
        doctorId,
        surgeryCatalogId,
        notes: surgeryNotes.trim(),
      })
      refreshVisitWorkflow(modalVisit.id)

      if (isSupabase) {
        await persistDoctorConsultationNowAsync({
          visitId: modalVisit.id,
          patientId: modalVisit.patientId,
        })
        if (surgeryReq.paymentMethod === 'Credit Book') {
          await persistInpatientPaymentNowAsync()
        }
      }

      setActionMsg(
        `${surgeryReq.paymentMethod === 'Credit Book'
          ? 'Surgery ordered — fee attached to inpatient credit book. Reception will schedule.'
          : 'Surgery request submitted — patient pays at Reception Surgery.'}${isSupabase ? ' Saved to database.' : ''}`,
      )
      setSurgeryCatalogId('')
      setSurgeryNotes('')
      refresh()
    } catch (err) {
      setActionMsg(
        err instanceof Error ? err.message : 'Could not save surgery request to database',
      )
    }
  }

  return (
    <PermissionGuard permissions={permissions}>
      <PageMetaData title={pageTitle} />
      <PageHeader title={pageTitle} subtitle={pageSubtitle} breadcrumbs={breadcrumbs} />

      <Card className="mb-3">
        <CardBody>
          <Row className="g-2 align-items-center">
            <Col md={5}>
              <Form.Control
                type="search"
                placeholder="Search patient, room, ward, doctor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Col>
            <Col md={7}>
              <div className="d-flex flex-wrap gap-1">
                {(
                  [
                    ['all', 'All'],
                    ['active', 'Active'],
                    ['inactive', 'Inactive'],
                  ] as const
                ).map(([key, label]) => (
                  <Button
                    key={key}
                    size="sm"
                    variant={statusFilter === key ? 'primary' : 'outline-secondary'}
                    onClick={() => setStatusFilter(key)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </Col>
          </Row>
          <div className="d-flex gap-3 mt-2 small text-muted">
            <span>
              <Badge bg="success-subtle" text="success" className="me-1">
                Active
              </Badge>
              Currently admitted in hospital
            </span>
            <span>
              <Badge bg="secondary-subtle" text="secondary" className="me-1">
                Inactive
              </Badge>
              Discharged / released
            </span>
          </div>
        </CardBody>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <CardBody className="text-center text-muted py-5">No inpatients match your search or filter.</CardBody>
        </Card>
      ) : (
        <>
          <Row>
            {filteredPagination.pageItems.map((adm) => {
            const patient = getPatientById(adm.patientId)
            const visit = getVisitById(adm.visitId)
            const doctor = visit?.assignedDoctorId ? getStaffById(visit.assignedDoctorId) : undefined
            const room = getRoomById(adm.roomId)
            const ward = getWardById(adm.wardId)
            const bed = beds.find((b) => b.id === adm.bedId)
            const isActiveInpatient = adm.status === 'Active'

            return (
              <Col key={adm.id} xs={12} sm={6} lg={4} xl={3} className="mb-3">
                <Card
                  role="button"
                  tabIndex={0}
                  className={`inpatient-bed-card inpatient-bed-card--clickable h-100 ${isActiveInpatient ? 'inpatient-bed-card--occupied' : 'inpatient-bed-card--vacant'}`}
                  onClick={() => openAdmission(adm)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      openAdmission(adm)
                    }
                  }}
                >
                  <CardBody>
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <div>
                        <h6 className="mb-0">{patient?.fullName ?? '—'}</h6>
                        <small className="text-muted">{patient?.id}</small>
                      </div>
                      <Badge
                        bg={isActiveInpatient ? 'success-subtle' : 'secondary-subtle'}
                        text={isActiveInpatient ? 'success' : 'secondary'}
                      >
                        {isActiveInpatient ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <ul className="list-unstyled small mb-0">
                      <li>
                        <span className="text-muted">Ward / Room</span>
                        <div>
                          {ward?.name} · {room?.name}
                        </div>
                      </li>
                      <li className="mt-2">
                        <span className="text-muted">Bed</span>
                        <div>{bed?.bedNumber ?? '—'}</div>
                      </li>
                      <li className="mt-2">
                        <span className="text-muted">Doctor</span>
                        <div>
                          {doctor ? `Dr. ${doctor.firstName} ${doctor.lastName}` : '—'}
                        </div>
                      </li>
                      <li className="mt-2">
                        <span className="text-muted">Admitted</span>
                        <div>{adm.admittedAt}</div>
                      </li>
                    </ul>
                  </CardBody>
                </Card>
              </Col>
            )
            })}
          </Row>
          <TablePagination
            className="pt-3 border-top mt-3"
            totalItems={filteredPagination.totalItems}
            rangeStart={filteredPagination.rangeStart}
            rangeEnd={filteredPagination.rangeEnd}
            safePage={filteredPagination.safePage}
            totalPages={filteredPagination.totalPages}
            onPageChange={filteredPagination.setPage}
          />
        </>
      )}

      <Modal show={!!selectedAdmission} onHide={() => setSelectedAdmission(null)} size="lg" centered scrollable>
        <Modal.Header closeButton>
          <Modal.Title>Patient Report — {modalPatient?.fullName ?? 'Inpatient'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {actionMsg && (
            <Alert variant="success" dismissible onClose={() => setActionMsg('')}>
              {actionMsg}
            </Alert>
          )}

          {modalPatient && selectedAdmission && (
            <>
              <Card className="mb-3 bg-light border-0">
                <CardBody className="py-3">
                  <Row className="g-2 small">
                    <Col sm={6}>
                      <span className="text-muted">Patient ID</span>
                      <p className="fw-semibold mb-0">{modalPatient.id}</p>
                    </Col>
                    <Col sm={6}>
                      <span className="text-muted">Name</span>
                      <p className="fw-semibold mb-0">{modalPatient.fullName}</p>
                    </Col>
                    <Col sm={6}>
                      <span className="text-muted">Age / Gender</span>
                      <p className="mb-0">
                        {modalPatient.age} · {modalPatient.gender}
                      </p>
                    </Col>
                    <Col sm={6}>
                      <span className="text-muted">Phone</span>
                      <p className="mb-0">{modalPatient.phone}</p>
                    </Col>
                    <Col sm={6}>
                      <span className="text-muted">Doctor</span>
                      <p className="mb-0">
                        {modalDoctor ? `Dr. ${modalDoctor.firstName} ${modalDoctor.lastName}` : '—'}
                      </p>
                    </Col>
                    <Col sm={6}>
                      <span className="text-muted">Location</span>
                      <p className="mb-0">
                        {modalWard?.name} · {modalRoom?.name} · {modalBed?.bedNumber}
                      </p>
                    </Col>
                    <Col sm={6}>
                      <span className="text-muted">Admitted</span>
                      <p className="mb-0">{selectedAdmission.admittedAt}</p>
                    </Col>
                    <Col sm={6}>
                      <span className="text-muted">Status</span>
                      <p className="mb-0">
                        <StatusBadge status={selectedAdmission.status === 'Active' ? 'In Active' : 'Active'} />
                      </p>
                    </Col>
                  </Row>
                </CardBody>
              </Card>

              <Tab.Container activeKey={modalTab} onSelect={(k) => setModalTab((k as 'report' | 'orders') ?? 'report')}>
                <Nav variant="tabs" className="mb-3">
                  <Nav.Item>
                    <Nav.Link eventKey="report">Patient Report</Nav.Link>
                  </Nav.Item>
                  {canOrderClinical && selectedAdmission.status === 'Active' && (
                    <Nav.Item>
                      <Nav.Link eventKey="orders">Prescription / Lab / Surgery</Nav.Link>
                    </Nav.Item>
                  )}
                </Nav>

                <Tab.Content>
                  <Tab.Pane eventKey="report">
                    <h6 className="mb-2">Medicines (Prescriptions)</h6>
                    {visitPrescriptions.length === 0 ? (
                      <p className="text-muted small">No prescriptions for this visit.</p>
                    ) : (
                      visitPrescriptions.map((rx) => (
                        <Card key={rx.id} className="mb-2 border">
                          <CardBody className="py-2 small">
                            <div className="d-flex justify-content-between mb-1">
                              <StatusBadge status={rx.status} />
                              <span className="text-muted">{new Date(rx.createdAt).toLocaleDateString()}</span>
                            </div>
                            <ul className="mb-0 ps-3">
                              {rx.items.map((item, i) => (
                                <li key={i}>
                                  {item.medicine} — {item.dosage}, {item.frequency}, {item.duration}
                                </li>
                              ))}
                            </ul>
                          </CardBody>
                        </Card>
                      ))
                    )}

                    <h6 className="mb-2 mt-3">Laboratory</h6>
                    {visitLabs.length === 0 ? (
                      <p className="text-muted small">No lab requests for this visit.</p>
                    ) : (
                      <div className="table-responsive">
                        <Table size="sm" hover className="mb-0">
                          <thead className="bg-light bg-opacity-50">
                            <tr>
                              <th>Request #</th>
                              <th>Tests</th>
                              <th>Fee</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {visitLabs.map((lab) => (
                              <tr key={lab.id}>
                                <td>{lab.requestNumber}</td>
                                <td>{lab.tests.map((t) => t.testName).join(', ')}</td>
                                <td>
                                  {currency}
                                  {lab.totalFee}
                                </td>
                                <td>
                                  <StatusBadge status={lab.status} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      </div>
                    )}

                    <h6 className="mb-2 mt-3">Surgery</h6>
                    {visitSurgeries.length === 0 ? (
                      <p className="text-muted small">No surgery requests for this visit.</p>
                    ) : (
                      visitSurgeries.map((srg) => (
                        <Card key={srg.id} className="mb-2 border">
                          <CardBody className="py-2 small">
                            <div className="fw-semibold">{srg.surgeryName}</div>
                            <div className="text-muted">
                              {currency}
                              {srg.surgeryFee} · <StatusBadge status={srg.status} />
                            </div>
                            {srg.notes && <p className="mb-0 mt-1">{srg.notes}</p>}
                          </CardBody>
                        </Card>
                      ))
                    )}
                  </Tab.Pane>

                  {canOrderClinical && selectedAdmission.status === 'Active' && (
                    <Tab.Pane eventKey="orders">
                      <h6 className="mb-2">New Prescription</h6>
                      {rxItems.map((item, index) => (
                        <Row key={index} className="g-2 mb-2 align-items-end">
                          <Col md={4}>
                            <Form.Select
                              size="sm"
                              value={item.medicine}
                              onChange={(e) => {
                                const med = activeMedicines.find((m) => m.name === e.target.value)
                                setRxItems((items) =>
                                  items.map((it, i) =>
                                    i === index
                                      ? {
                                          ...it,
                                          medicine: e.target.value,
                                          dosage: it.dosage || (med?.unit ? `1 ${med.unit}` : ''),
                                        }
                                      : it,
                                  ),
                                )
                              }}
                            >
                              <option value="">Select medicine...</option>
                              {activeMedicines.map((m) => (
                                <option key={m.id} value={m.name}>
                                  {m.name}
                                </option>
                              ))}
                            </Form.Select>
                          </Col>
                          <Col md={2}>
                            <Form.Control
                              size="sm"
                              placeholder="Dosage"
                              value={item.dosage}
                              onChange={(e) =>
                                setRxItems((items) =>
                                  items.map((it, i) => (i === index ? { ...it, dosage: e.target.value } : it)),
                                )
                              }
                            />
                          </Col>
                          <Col md={2}>
                            <Form.Control
                              size="sm"
                              placeholder="Frequency"
                              value={item.frequency}
                              onChange={(e) =>
                                setRxItems((items) =>
                                  items.map((it, i) => (i === index ? { ...it, frequency: e.target.value } : it)),
                                )
                              }
                            />
                          </Col>
                          <Col md={2}>
                            <Form.Control
                              size="sm"
                              placeholder="Duration"
                              value={item.duration}
                              onChange={(e) =>
                                setRxItems((items) =>
                                  items.map((it, i) => (i === index ? { ...it, duration: e.target.value } : it)),
                                )
                              }
                            />
                          </Col>
                          <Col md={2}>
                            <Button
                              size="sm"
                              variant="outline-danger"
                              onClick={() => setRxItems((items) => items.filter((_, i) => i !== index))}
                              disabled={rxItems.length === 1}
                            >
                              ×
                            </Button>
                          </Col>
                        </Row>
                      ))}
                      <div className="d-flex gap-2 mb-3">
                        <Button size="sm" variant="outline-secondary" onClick={() => setRxItems((items) => [...items, emptyRxItem()])}>
                          Add Medicine
                        </Button>
                        <Button size="sm" variant="primary" onClick={() => void handleSavePrescription()}>
                          <IconifyIcon icon="solar:plain-2-broken" className="me-1" />
                          Send to Pharmacy
                        </Button>
                      </div>

                      <hr />
                      <h6 className="mb-2">Lab Request ({activeLabTestCount} tests in catalog)</h6>
                      {labTests.map((test, index) => (
                        <Row key={index} className="g-2 mb-2 align-items-center">
                          <Col>
                            <LabTestSelect
                              size="sm"
                              value={test}
                              onChange={(value) =>
                                setLabTests((tests) => tests.map((t, i) => (i === index ? value : t)))
                              }
                              excludeNames={labTests.filter((_, i) => i !== index)}
                            />
                          </Col>
                          <Col xs="auto">
                            <Button
                              size="sm"
                              variant="outline-danger"
                              onClick={() => setLabTests((tests) => tests.filter((_, i) => i !== index))}
                              disabled={labTests.length === 1}
                            >
                              ×
                            </Button>
                          </Col>
                        </Row>
                      ))}
                      <div className="d-flex gap-2 mb-3">
                        <Button size="sm" variant="outline-secondary" onClick={() => setLabTests((t) => [...t, ''])}>
                          Add Test
                        </Button>
                        <Button size="sm" variant="primary" onClick={handleSaveLab}>
                          Send Lab Request
                        </Button>
                      </div>

                      <hr />
                      <h6 className="mb-2">Surgery Request ({activeSurgeryCount} in catalog)</h6>
                      <Row className="g-2 mb-2">
                        <Col md={6}>
                          <SurgerySelect
                            size="sm"
                            value={surgeryCatalogId}
                            onChange={setSurgeryCatalogId}
                          />
                        </Col>
                        <Col md={6}>
                          <Form.Control
                            size="sm"
                            placeholder="Notes (optional)"
                            value={surgeryNotes}
                            onChange={(e) => setSurgeryNotes(e.target.value)}
                          />
                        </Col>
                      </Row>
                      <Button size="sm" variant="primary" onClick={handleSaveSurgery} disabled={!surgeryCatalogId}>
                        Submit Surgery Request
                      </Button>
                    </Tab.Pane>
                  )}
                </Tab.Content>
              </Tab.Container>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          {consultationLink && modalVisit && selectedAdmission?.status === 'Active' && (
            <Link to={consultationLink(modalVisit.id)} className="btn btn-primary">
              Open Consultation
            </Link>
          )}
          {canDischarge && selectedAdmission?.status === 'Active' && (
            <Button variant="danger" onClick={handleDischarge}>
              <IconifyIcon icon="solar:logout-2-broken" className="me-1" />
              Discharge (Fasax — Go Home)
            </Button>
          )}
          <Button variant="light" onClick={() => setSelectedAdmission(null)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </PermissionGuard>
  )
}

export default ClinicalInpatientsView
