import { useState } from 'react'
import { Badge, Card, CardBody, Collapse } from 'react-bootstrap'

import IconifyIcon from '@/components/wrappers/IconifyIcon'
import StatusBadge from '@/shared/components/StatusBadge'
import type { PatientHistoryEntry } from '@/shared/utils/visitConsultation'

type PatientHistoryPanelProps = {
  history: PatientHistoryEntry[]
}

const PatientHistoryPanel = ({ history }: PatientHistoryPanelProps) => {
  const [open, setOpen] = useState(true)

  if (history.length === 0) return null

  return (
    <Card className="mb-3 border-primary border-opacity-25">
      <CardBody className="py-3">
        <button
          type="button"
          className="btn btn-link p-0 text-decoration-none w-100 text-start d-flex justify-content-between align-items-center"
          onClick={() => setOpen((v) => !v)}
        >
          <span>
            <IconifyIcon icon="solar:history-broken" className="me-2 text-primary" />
            <strong>Previous visits — clinical history</strong>
            <Badge bg="primary-subtle" text="primary" className="ms-2">
              {history.length}
            </Badge>
          </span>
          <IconifyIcon icon={open ? 'solar:alt-arrow-up-broken' : 'solar:alt-arrow-down-broken'} />
        </button>

        <Collapse in={open}>
          <div className="mt-3">
            {history.map((entry) => (
              <div key={entry.visitId} className="border rounded p-3 mb-2 bg-light bg-opacity-50">
                <div className="d-flex flex-wrap justify-content-between gap-2 mb-2">
                  <div>
                    <strong>{entry.visitDate}</strong>
                    <span className="text-muted small ms-2">{entry.visitNumber}</span>
                  </div>
                  <StatusBadge status={entry.status} />
                </div>

                {entry.notes.map((n) => (
                  <p key={n.id} className="small mb-2">
                    <span className="text-muted">Note:</span> {n.note}
                  </p>
                ))}

                {entry.diagnoses.map((d) => (
                  <p key={d.id} className="small mb-2">
                    <span className="text-muted">Diagnosis:</span> {d.diagnosis}
                  </p>
                ))}

                {entry.prescriptions.map((rx) => (
                  <div key={rx.id} className="small mb-2">
                    <span className="text-muted">Prescription ({rx.status}):</span>{' '}
                    {rx.items.map((i) => i.medicine).join(', ')}
                  </div>
                ))}

                {entry.labs.map((lab) => (
                  <div key={lab.id} className="small mb-2">
                    <span className="text-muted">Lab ({lab.status}):</span>{' '}
                    {lab.tests.map((t) => t.testName).join(', ')}
                    <span className="text-muted">
                      {' '}
                      · ordered {new Date(lab.createdAt).toLocaleDateString()}
                    </span>
                    {lab.status === 'Cancelled' && (
                      <span className="text-danger">
                        {' '}
                        · cancelled{' '}
                        {new Date(
                          lab.cancelledAt ?? lab.lastModifiedAt ?? lab.createdAt,
                        ).toLocaleDateString()}
                      </span>
                    )}
                    {lab.status === 'Completed' && lab.completedAt && (
                      <span className="text-success">
                        {' '}
                        · completed {new Date(lab.completedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                ))}

                {entry.surgeries.map((s) => (
                  <div key={s.id} className="small mb-2">
                    <span className="text-muted">Surgery ({s.status}):</span> {s.surgeryName}
                  </div>
                ))}

                {entry.admissionRequests.map((a) => (
                  <div key={a.id} className="small mb-0">
                    <span className="text-muted">In-patient ({a.status}):</span> {a.reason}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Collapse>
      </CardBody>
    </Card>
  )
}

export default PatientHistoryPanel
