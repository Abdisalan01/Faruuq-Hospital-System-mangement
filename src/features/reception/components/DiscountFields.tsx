import { Col, Form } from 'react-bootstrap'

import { currency } from '@/context/constants'
import { calculateDiscountAmount, discounts } from '@/shared/services/hmsStore'

type DiscountFieldsProps = {
  subtotal: number
  discountId: string
  onDiscountIdChange: (id: string) => void
  paymentConfirmed: boolean
  onPaymentConfirmedChange: (v: boolean) => void
}

const DiscountFields = ({
  subtotal,
  discountId,
  onDiscountIdChange,
  paymentConfirmed,
  onPaymentConfirmedChange,
}: DiscountFieldsProps) => {
  const discountAmount = calculateDiscountAmount(subtotal, discountId || undefined)
  const total = Math.max(0, subtotal - discountAmount)

  return (
    <>
      <Col md={6}>
        <Form.Group className="mb-3">
          <Form.Label>Discount (optional)</Form.Label>
          <Form.Select value={discountId} onChange={(e) => onDiscountIdChange(e.target.value)}>
            <option value="">No discount</option>
            {discounts
              .filter((d) => d.isActive)
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.type === 'percentage' ? `${d.value}%` : `${currency}${d.value}`})
                </option>
              ))}
          </Form.Select>
        </Form.Group>
      </Col>
      <Col md={6}>
        <Form.Group className="mb-3">
          <Form.Label>Total after discount</Form.Label>
          <Form.Control value={`${currency}${total.toFixed(2)}`} disabled className="fw-bold" />
        </Form.Group>
      </Col>
      <Col md={12}>
        <Form.Check
          type="checkbox"
          id="payment-confirmed"
          label="Confirm patient has paid (xaqiiji lacag bixiyay)"
          checked={paymentConfirmed}
          onChange={(e) => onPaymentConfirmedChange(e.target.checked)}
          className="mb-3 fw-medium"
        />
      </Col>
    </>
  )
}

export default DiscountFields
