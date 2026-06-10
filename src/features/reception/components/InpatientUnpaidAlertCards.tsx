import { Card, CardBody, Col, Row } from 'react-bootstrap'

import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { currency } from '@/context/constants'
import type { InpatientUnpaidAlert } from '@/shared/types'

type Props = {
  alerts: InpatientUnpaidAlert[]
  onSelectAlert?: (alert: InpatientUnpaidAlert) => void
}

const alertMessage = (alert: InpatientUnpaidAlert): string => {
  if (alert.scenario === 'released_still_admitted') {
    return 'Doctor released this patient — payment has not been collected yet.'
  }
  return 'Patient was discharged — payment has not been collected yet.'
}

const InpatientUnpaidAlertCards = ({ alerts, onSelectAlert }: Props) => {
  if (alerts.length === 0) return null

  return (
    <div className="mb-3">
      <h6 className="text-danger mb-2 d-flex align-items-center gap-1">
        <IconifyIcon icon="solar:danger-triangle-broken" width={20} />
        Unpaid inpatient — action required ({alerts.length})
      </h6>
      <Row>
        {alerts.map((alert) => (
          <Col key={alert.admissionId} xs={12} md={6} lg={4} className="mb-3">
            <Card
              role={onSelectAlert ? 'button' : undefined}
              tabIndex={onSelectAlert ? 0 : undefined}
              className={`inpatient-unpaid-alert-card h-100 ${onSelectAlert ? 'inpatient-unpaid-alert-card--clickable' : ''}`}
              onClick={onSelectAlert ? () => onSelectAlert(alert) : undefined}
              onKeyDown={
                onSelectAlert
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onSelectAlert(alert)
                      }
                    }
                  : undefined
              }
            >
              <CardBody>
                <div className="d-flex align-items-start gap-2 mb-2">
                  <span className="inpatient-unpaid-alert-card__icon">
                    <IconifyIcon icon="solar:wallet-money-broken" width={22} />
                  </span>
                  <div className="flex-grow-1">
                    <h6 className="text-danger mb-1">Payment not collected</h6>
                    <p className="small text-muted mb-0">{alertMessage(alert)}</p>
                  </div>
                </div>
                <ul className="list-unstyled small mb-0">
                  <li>
                    <span className="text-muted">Patient</span>
                    <div className="fw-semibold">
                      {alert.patientName}{' '}
                      <span className="text-muted fw-normal">({alert.patientId})</span>
                    </div>
                  </li>
                  <li className="mt-2">
                    <span className="text-muted">Doctor</span>
                    <div>{alert.doctorName}</div>
                  </li>
                  {alert.bedLabel && (
                    <li className="mt-2">
                      <span className="text-muted">Bed</span>
                      <div>{alert.bedLabel}</div>
                    </li>
                  )}
                  {alert.dischargedAt && (
                    <li className="mt-2">
                      <span className="text-muted">Discharged</span>
                      <div>{alert.dischargedAt}</div>
                    </li>
                  )}
                  <li className="mt-2">
                    <span className="text-muted">Outstanding</span>
                    <div className="fw-bold text-danger">
                      {currency}
                      {alert.outstandingAmount.toFixed(2)}
                    </div>
                  </li>
                </ul>
              </CardBody>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  )
}

export default InpatientUnpaidAlertCards
