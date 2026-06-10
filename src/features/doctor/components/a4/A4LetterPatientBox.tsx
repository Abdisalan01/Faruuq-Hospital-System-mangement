export type A4PatientInfo = {
  patientId: string
  patientName: string
  age: number
  gender: string
  referredDoctorName: string
}

type A4LetterPatientBoxProps = {
  patient: A4PatientInfo
  extraRow?: { label: string; value: string }
}

const A4LetterPatientBox = ({ patient, extraRow }: A4LetterPatientBoxProps) => (
  <div className="rx-patient-box">
    <div className="rx-patient-grid">
      {extraRow && (
        <div className="rx-field rx-field-span">
          <span className="rx-label">{extraRow.label} :</span>
          <span className="rx-value">{extraRow.value}</span>
        </div>
      )}
      <div className="rx-field">
        <span className="rx-label">Patient ID :</span>
        <span className="rx-value">{patient.patientId}</span>
      </div>
      <div className="rx-field">
        <span className="rx-label">Patient Name :</span>
        <span className="rx-value">{patient.patientName}</span>
      </div>
      <div className="rx-field">
        <span className="rx-label">Age :</span>
        <span className="rx-value">{patient.age}</span>
      </div>
      <div className="rx-field">
        <span className="rx-label">Gender :</span>
        <span className="rx-value">{patient.gender}</span>
      </div>
      <div className="rx-field rx-field-span">
        <span className="rx-label">Referred Doctor :</span>
        <span className="rx-value">{patient.referredDoctorName}</span>
      </div>
    </div>
  </div>
)

export default A4LetterPatientBox
