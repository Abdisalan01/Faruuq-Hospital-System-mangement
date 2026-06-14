import PrintDocumentHeader from '@/shared/components/PrintDocumentHeader'
import type { PrescriptionItem } from '@/shared/types'

export type PrescriptionLetterData = {
  patientId: string
  patientName: string
  age: number
  gender: string
  referredDoctorName: string
  items: PrescriptionItem[]
  followUpNote?: string
  createdAt: string
}

type PrescriptionLetterA4Props = {
  data: PrescriptionLetterData
}

const MIN_TABLE_ROWS = 6

const IconCalendar = () => (
  <svg className="rx-followup-svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z" />
  </svg>
)

const PrescriptionLetterA4 = ({ data }: PrescriptionLetterA4Props) => {
  const rows = [...data.items.filter((i) => i.medicine.trim())]
  while (rows.length < MIN_TABLE_ROWS) {
    rows.push({ medicine: '', dosage: '', frequency: '', duration: '', instructions: '' })
  }

  const followUp = data.followUpNote ?? 'Soo laabshadu waa muddo 2 isbuuc ah.'

  return (
    <div className="prescription-letter-a4">
      <div className="rx-letter-main">
      <PrintDocumentHeader variant="a4" />

      <div className="rx-title-block">
        <h1 className="rx-letter-title">PRESCRIPTION LETTER</h1>
        <div className="rx-title-ornament" aria-hidden>
          <span className="rx-title-line" />
          <span className="rx-title-diamond">◆</span>
          <span className="rx-title-line" />
        </div>
      </div>

      <div className="rx-patient-box">
        <div className="rx-patient-grid">
          <div className="rx-field">
            <span className="rx-label">Patient ID :</span>
            <span className="rx-value">{data.patientId}</span>
          </div>
          <div className="rx-field">
            <span className="rx-label">Patient Name :</span>
            <span className="rx-value">{data.patientName}</span>
          </div>
          <div className="rx-field">
            <span className="rx-label">Age :</span>
            <span className="rx-value">{data.age}</span>
          </div>
          <div className="rx-field">
            <span className="rx-label">Gender :</span>
            <span className="rx-value">{data.gender}</span>
          </div>
          <div className="rx-field rx-field-span">
            <span className="rx-label">Referred Doctor :</span>
            <span className="rx-value">{data.referredDoctorName}</span>
          </div>
        </div>
      </div>

      <table className="rx-meds-table">
        <thead>
          <tr>
            <th>Medicine</th>
            <th>Dosage</th>
            <th>Frequency</th>
            <th>Duration</th>
            <th>Instruction</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item, idx) => (
            <tr key={idx}>
              <td>{item.medicine}</td>
              <td>{item.dosage}</td>
              <td>{item.frequency}</td>
              <td>{item.duration}</td>
              <td>{item.instructions}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="rx-followup">
        <div className="rx-followup-icon">
          <IconCalendar />
        </div>
        <p className="rx-followup-text">{followUp}</p>
      </div>
      </div>
    </div>
  )
}

export default PrescriptionLetterA4
