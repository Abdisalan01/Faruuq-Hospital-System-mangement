import PrintDocumentHeader from '@/shared/components/PrintDocumentHeader'
import type { Gender } from '@/shared/types'

export type PatientRegistrationSlipData = {
  patientId: string
  patientNumber: number
  isEmergency: boolean
  fullName: string
  gender: Gender
  age: number
  phone: string
  referredDoctorName: string
  registrationFee: number
  createdAt: string
}

type PatientRegistrationSlipProps = {
  data: PatientRegistrationSlipData
}

const PatientRegistrationSlip = ({ data }: PatientRegistrationSlipProps) => {
  const numberLabel = data.isEmergency ? 'Emergency Number' : 'Patient Number'

  return (
    <div className="thermal-slip patient-registration-slip bg-white text-dark">
      <style>{`
        .slip-patient-number {
          text-align: center;
          margin: 4mm 0;
          padding: 3mm 2mm;
          border: 2px solid #000;
          border-radius: 2mm;
        }
        .slip-patient-number.emergency {
          border-color: #c00;
        }
        .slip-patient-number-label {
          font-size: 9pt;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 1mm;
        }
        .slip-patient-number-value {
          font-size: 28pt;
          font-weight: 800;
          line-height: 1.1;
          letter-spacing: 1px;
        }
        .slip-row {
          display: flex;
          justify-content: space-between;
          gap: 2mm;
          padding: 1.5mm 0;
          border-bottom: 1px dashed #ccc;
          font-size: 10pt;
        }
        .slip-row:last-child {
          border-bottom: none;
        }
        .slip-label {
          font-weight: 600;
          flex-shrink: 0;
        }
        .slip-value {
          text-align: right;
          word-break: break-word;
        }
      `}</style>

      <PrintDocumentHeader variant="thermal" />

      <div className={`slip-patient-number ${data.isEmergency ? 'emergency' : ''}`}>
        <div className="slip-patient-number-label">{numberLabel}</div>
        <div className="slip-patient-number-value">{data.patientNumber}</div>
      </div>

      <div className="slip-row">
        <span className="slip-label">Patient ID</span>
        <span className="slip-value">{data.patientId}</span>
      </div>
      <div className="slip-row">
        <span className="slip-label">Full Name</span>
        <span className="slip-value">{data.fullName}</span>
      </div>
      <div className="slip-row">
        <span className="slip-label">Gender</span>
        <span className="slip-value">{data.gender}</span>
      </div>
      <div className="slip-row">
        <span className="slip-label">Age</span>
        <span className="slip-value">{data.age}</span>
      </div>
      <div className="slip-row">
        <span className="slip-label">Phone Number</span>
        <span className="slip-value">{data.phone}</span>
      </div>
      <div className="slip-row">
        <span className="slip-label">Referred Doctor</span>
        <span className="slip-value">{data.referredDoctorName}</span>
      </div>
    </div>
  )
}

export default PatientRegistrationSlip
