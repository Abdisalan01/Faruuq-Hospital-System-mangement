import { THERMAL_LOGO_SRC } from '@/shared/constants/branding'
import A4LetterFooter from '@/features/doctor/components/a4/A4LetterFooter'
import A4LetterPatientBox, { type A4PatientInfo } from '@/features/doctor/components/a4/A4LetterPatientBox'
import type { LabTestItem } from '@/shared/types'

export type LabResultReportData = A4PatientInfo & {
  requestNumber: string
  tests: LabTestItem[]
  completedAt: string
}

type LabResultReportA4Props = {
  data: LabResultReportData
}

const MIN_ROWS = 6

const LabResultReportA4 = ({ data }: LabResultReportA4Props) => {
  const rows = [...data.tests]
  while (rows.length < MIN_ROWS) {
    rows.push({ testName: '', result: '', referenceValue: '', remarks: '' })
  }

  return (
    <div className="a4-hospital-letter">
      <div className="rx-letter-main">
        <header className="rx-letter-header">
          <img src={THERMAL_LOGO_SRC} alt="Faaruuq Specialist Hospital" className="rx-letter-logo" />
          <div className="rx-header-rule" aria-hidden />
        </header>

        <div className="rx-title-block">
          <h1 className="rx-letter-title">LABORATORY RESULT REPORT</h1>
          <div className="rx-title-ornament" aria-hidden>
            <span className="rx-title-line" />
            <span className="rx-title-diamond">◆</span>
            <span className="rx-title-line" />
          </div>
        </div>

        <A4LetterPatientBox
          patient={data}
          extraRow={{ label: 'Request No.', value: data.requestNumber }}
        />

        <p className="small text-muted mb-2">
          Report date: {new Date(data.completedAt).toLocaleString()}
        </p>

        <table className="rx-meds-table rx-lab-result-table">
          <thead>
            <tr>
              <th className="rx-col-num">#</th>
              <th>Test Name</th>
              <th>Result</th>
              <th>Reference</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((test, idx) => (
              <tr key={idx}>
                <td className="text-center">{test.testName ? idx + 1 : ''}</td>
                <td>{test.testName}</td>
                <td className="fw-semibold">{test.result ?? ''}</td>
                <td>{test.referenceValue ?? '—'}</td>
                <td>{test.remarks ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <A4LetterFooter />
    </div>
  )
}

export default LabResultReportA4
