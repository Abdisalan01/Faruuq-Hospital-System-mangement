import { currency } from '@/context/constants'
import { THERMAL_LOGO_SRC } from '@/shared/constants/branding'
import { getPatientById, systemSettings } from '@/shared/services/hmsStore'
import type { ReceptionReceipt } from '@/shared/types'

type PrintableReceiptProps = {
  receipt: ReceptionReceipt
}

const PrintableReceipt = ({ receipt }: PrintableReceiptProps) => {
  const patient = getPatientById(receipt.patientId)
  const numberLabel = receipt.isEmergency ? 'Emergency Number' : 'Patient Number'

  return (
    <div className="thermal-slip reception-receipt bg-white text-dark">
      <img src={THERMAL_LOGO_SRC} alt="" className="slip-logo" />

      <div className="text-center mb-2" style={{ fontSize: '10pt' }}>
        <strong>{systemSettings.hospitalName}</strong>
        <br />
        <span className="text-muted">{systemSettings.address}</span>
        <br />
        <span className="text-muted">{systemSettings.phone}</span>
      </div>

      <hr className="my-2" />

      {receipt.type === 'lab' && (
        <p className="text-center fw-bold mb-2" style={{ fontSize: '11pt' }}>
          LAB FEES RECEIPT
        </p>
      )}
      {receipt.type === 'surgery' && (
        <p className="text-center fw-bold mb-2" style={{ fontSize: '11pt' }}>
          SURGERY FEES RECEIPT
        </p>
      )}
      {receipt.type === 'pharmacy' && (
        <p className="text-center fw-bold mb-2" style={{ fontSize: '11pt' }}>
          INPATIENT MEDICINE RECEIPT
        </p>
      )}
      {receipt.type === 'checkout' && (
        <p className="text-center fw-bold mb-2" style={{ fontSize: '11pt' }}>
          {receipt.paymentMethod === 'Credit book'
            ? 'CREDIT BOOK CHARGE'
            : receipt.lineItems.length > 1
              ? 'INPATIENT TOTAL PAID RECEIPT'
              : 'PAYMENT RECEIPT'}
        </p>
      )}

      <div className="slip-row">
        <span className="slip-label">Receipt #</span>
        <span className="slip-value">{receipt.receiptNumber}</span>
      </div>
      <div className="slip-row">
        <span className="slip-label">Date</span>
        <span className="slip-value">{new Date(receipt.createdAt).toLocaleString()}</span>
      </div>
      {receipt.labRequestNumber && (
        <div className="slip-row">
          <span className="slip-label">Lab Request</span>
          <span className="slip-value">{receipt.labRequestNumber}</span>
        </div>
      )}
      {receipt.surgeryRequestNumber && (
        <div className="slip-row">
          <span className="slip-label">Surgery Request</span>
          <span className="slip-value">{receipt.surgeryRequestNumber}</span>
        </div>
      )}
      <div className="slip-row">
        <span className="slip-label">Patient ID</span>
        <span className="slip-value">{receipt.patientId}</span>
      </div>
      <div className="slip-row">
        <span className="slip-label">{numberLabel}</span>
        <span className="slip-value fw-bold">{receipt.patientNumber}</span>
      </div>
      {receipt.isEmergency && (
        <p className="text-center text-danger fw-bold small mb-2">EMERGENCY</p>
      )}
      <div className="slip-row">
        <span className="slip-label">Doctor</span>
        <span className="slip-value">{receipt.doctorName}</span>
      </div>
      <div className="slip-row">
        <span className="slip-label">Patient</span>
        <span className="slip-value">{patient?.fullName}</span>
      </div>
      <div className="slip-row">
        <span className="slip-label">Age / Gender</span>
        <span className="slip-value">
          {patient?.age} · {patient?.gender}
        </span>
      </div>
      <div className="slip-row">
        <span className="slip-label">Phone</span>
        <span className="slip-value">{patient?.phone}</span>
      </div>

      <table className="w-100 my-2" style={{ fontSize: '9pt', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #000' }}>
            <th className="text-start py-1">Item</th>
            <th className="text-end py-1">Fee</th>
          </tr>
        </thead>
        <tbody>
          {receipt.lineItems.map((line, i) => (
            <tr key={i} style={{ borderBottom: '1px dashed #ccc' }}>
              <td className="py-1">{line.description}</td>
              <td className="text-end py-1">
                {currency}
                {line.amount.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="border-top pt-2" style={{ fontSize: '10pt' }}>
        {receipt.discountAmount > 0 && (
          <>
            <div className="d-flex justify-content-between">
              <span>Subtotal</span>
              <span>
                {currency}
                {receipt.subtotal.toFixed(2)}
              </span>
            </div>
            <div className="d-flex justify-content-between">
              <span>
                Discount
                {receipt.discountPercent != null && receipt.discountPercent > 0
                  ? ` (${receipt.discountPercent}%)`
                  : ''}
              </span>
              <span>
                −{currency}
                {receipt.discountAmount.toFixed(2)}
              </span>
            </div>
          </>
        )}
        <div className="d-flex justify-content-between fw-bold mt-1" style={{ fontSize: '12pt' }}>
          <span>Total</span>
          <span>
            {currency}
            {receipt.total.toFixed(2)}
          </span>
        </div>
        {receipt.paymentConfirmed && <p className="small mb-0 mt-2">✓ Payment confirmed</p>}
      </div>

      <div className="slip-footer mt-3">
        Thank you — {systemSettings.hospitalName}
      </div>

      <style>{`
        .reception-receipt .slip-row {
          display: flex;
          justify-content: space-between;
          gap: 2mm;
          padding: 1.5mm 0;
          border-bottom: 1px dashed #ccc;
          font-size: 10pt;
        }
        .reception-receipt .slip-label {
          font-weight: 600;
          flex-shrink: 0;
        }
        .reception-receipt .slip-value {
          text-align: right;
          word-break: break-word;
        }
        .reception-receipt .slip-footer {
          text-align: center;
          font-size: 8pt;
          color: #444;
          padding-top: 2mm;
          border-top: 1px solid #000;
        }
      `}</style>
    </div>
  )
}

export default PrintableReceipt
