import { currency } from '@/context/constants'
import PrintDocumentHeader from '@/shared/components/PrintDocumentHeader'
import { getPatientById } from '@/shared/services/hmsStore'
import type { PatientHistorySummary } from '@/shared/types'

type PrintablePatientHistoryProps = {
  history: PatientHistorySummary
}

const statusLabel = (status: string) => {
  if (status === 'On book') return 'On Book (Debt)'
  if (status === 'Unpaid') return 'Unpaid (Debt)'
  return status
}

const PrintablePatientHistory = ({ history }: PrintablePatientHistoryProps) => {
  const patient = getPatientById(history.patientId)
  if (!patient) return null

  const generatedAt = new Date().toLocaleString()

  return (
    <div className="a4-hospital-letter patient-history-a4">
      <PrintDocumentHeader variant="a4" />
      <p className="patient-history-doc-title">Patient Transaction History</p>

      <section className="patient-history-patient-box">
        <div className="row g-2">
          <div className="col-6">
            <p>
              <strong>Patient ID:</strong> {patient.id}
            </p>
            <p>
              <strong>Name:</strong> {patient.fullName}
            </p>
            <p>
              <strong>Phone:</strong> {patient.phone}
            </p>
          </div>
          <div className="col-6">
            <p>
              <strong>Gender / Age:</strong> {patient.gender}, {patient.age} yrs
            </p>
            <p>
              <strong>Payment Type:</strong> {patient.paymentType === 'credit' ? 'Credit' : 'Cash'}
            </p>
            <p>
              <strong>Generated:</strong> {generatedAt}
            </p>
          </div>
        </div>
      </section>

      <section className="patient-history-summary row g-2 mb-3">
        <div className="col-4">
          <div className="summary-box">
            <span>Total Charged</span>
            <strong>
              {currency}
              {history.totalCharged.toFixed(2)}
            </strong>
          </div>
        </div>
        <div className="col-4">
          <div className="summary-box">
            <span>Total Paid</span>
            <strong>
              {currency}
              {history.totalPaid.toFixed(2)}
            </strong>
          </div>
        </div>
        <div className="col-4">
          <div className={`summary-box ${history.hasDebt ? 'summary-debt' : 'summary-clear'}`}>
            <span>Outstanding / Debt</span>
            <strong>
              {currency}
              {history.outstandingBalance.toFixed(2)}
            </strong>
          </div>
        </div>
      </section>

      <table className="patient-history-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Category</th>
            <th>Description</th>
            <th>Reference</th>
            <th className="text-end">Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {history.entries.length === 0 ? (
            <tr>
              <td colSpan={6} className="text-center text-muted">
                No transactions recorded
              </td>
            </tr>
          ) : (
            history.entries.map((entry) => (
              <tr key={entry.id}>
                <td>{new Date(entry.date).toLocaleDateString()}</td>
                <td>{entry.category}</td>
                <td>{entry.description}</td>
                <td>{entry.reference ?? '—'}</td>
                <td className="text-end">
                  {entry.amount > 0 ? `${currency}${entry.amount.toFixed(2)}` : '—'}
                </td>
                <td className={entry.paymentStatus !== 'Paid' ? 'text-danger fw-medium' : 'text-success'}>
                  {statusLabel(entry.paymentStatus)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {history.hasDebt && (
        <p className="patient-history-debt-note">
          This patient has outstanding balance or unpaid charges. Please settle at reception before discharge
          where applicable.
        </p>
      )}

    </div>
  )
}

export default PrintablePatientHistory
