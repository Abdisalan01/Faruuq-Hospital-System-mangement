import { Col, Form } from 'react-bootstrap'

type AutoPatientNumberDisplayProps = {
  number: number | null
  isEmergency: boolean
  doctorName?: string
}

const AutoPatientNumberDisplay = ({
  number,
  isEmergency,
  doctorName,
}: AutoPatientNumberDisplayProps) => {
  const label = isEmergency ? 'Emergency Number' : 'New Patient Number'

  return (
    <Col md={6}>
      <Form.Group className="mb-3">
        <Form.Label>{label}</Form.Label>
        <div className="p-3 bg-primary bg-opacity-10 border border-primary border-opacity-25 rounded text-center">
          <span className="text-muted small d-block mb-1">Auto-generated on submit</span>
          <span className="fs-2 fw-bold text-primary">{number ?? '—'}</span>
        </div>
        <Form.Text className="text-muted">
          {isEmergency ? (
            <>Emergency queue · starts at <strong>1</strong> each day</>
          ) : (
            <>
              For <strong>{doctorName ?? 'selected doctor'}</strong> · starts at <strong>1</strong> each
              day · each doctor has their own counter (e.g. Dr. A → #2, Dr. B → #8)
            </>
          )}
        </Form.Text>
      </Form.Group>
    </Col>
  )
}

export default AutoPatientNumberDisplay
