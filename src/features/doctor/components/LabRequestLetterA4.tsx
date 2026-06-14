import PrintDocumentHeader from '@/shared/components/PrintDocumentHeader'
import A4LetterPatientBox, { type A4PatientInfo } from '@/features/doctor/components/a4/A4LetterPatientBox'

export type LabRequestLetterData = A4PatientInfo & {
  requestNumber: string
  testNames: string[]
  notes?: string
  createdAt: string
}

type LabRequestLetterA4Props = {
  data: LabRequestLetterData
}

const MIN_ROWS = 8

const LabRequestLetterA4 = ({ data }: LabRequestLetterA4Props) => {
  const rows = [...data.testNames.filter((n) => n.trim())]
  while (rows.length < MIN_ROWS) rows.push('')

  return (
    <div className="a4-hospital-letter">
      <div className="rx-letter-main">
      <PrintDocumentHeader variant="a4" />

      <div className="rx-title-block">
        <h1 className="rx-letter-title">LAB REQUEST LETTER</h1>
        <div className="rx-title-ornament" aria-hidden>
          <span className="rx-title-line" />
          <span className="rx-title-diamond">◆</span>
          <span className="rx-title-line" />
        </div>
      </div>

      <A4LetterPatientBox
        patient={{
          patientId: data.patientId,
          patientName: data.patientName,
          age: data.age,
          gender: data.gender,
          referredDoctorName: data.referredDoctorName,
        }}
        extraRow={{ label: 'Request No.', value: data.requestNumber }}
      />

      <table className="rx-meds-table rx-lab-table">
        <thead>
          <tr>
            <th className="rx-col-num">#</th>
            <th>Test Name</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((name, idx) => (
            <tr key={idx}>
              <td className="text-center">{name ? idx + 1 : ''}</td>
              <td>{name}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {data.notes && (
        <div className="rx-followup">
          <p className="rx-followup-text mb-0">{data.notes}</p>
        </div>
      )}
      </div>
    </div>
  )
}

export default LabRequestLetterA4
