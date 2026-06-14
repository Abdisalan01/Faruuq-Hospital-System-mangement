import PrintDocumentHeader from '@/shared/components/PrintDocumentHeader'
import A4LetterPatientBox, { type A4PatientInfo } from '@/features/doctor/components/a4/A4LetterPatientBox'

export type SurgeryRequestLetterData = A4PatientInfo & {
  surgeryId: string
  surgeryName: string
  category: string
  duration?: string
  anesthesiaType?: string
  riskLevel?: string
  description?: string
  requiredEquipment?: string
  preOpInstructions?: string
  postOpCare?: string
  notes?: string
  scheduledNotes?: string
  createdAt: string
}

type SurgeryRequestLetterA4Props = {
  data: SurgeryRequestLetterData
}

const DetailRow = ({ label, value }: { label: string; value?: string }) => {
  if (!value?.trim()) return null
  return (
    <div className="rx-field rx-field-span mb-3">
      <span className="rx-label">{label} :</span>
      <span className="rx-value">{value}</span>
    </div>
  )
}

const SurgeryRequestLetterA4 = ({ data }: SurgeryRequestLetterA4Props) => (
  <div className="a4-hospital-letter">
    <div className="rx-letter-main">
    <PrintDocumentHeader variant="a4" />

    <div className="rx-title-block">
      <h1 className="rx-letter-title">SURGERY REQUEST LETTER</h1>
      <div className="rx-title-ornament" aria-hidden>
        <span className="rx-title-line" />
        <span className="rx-title-diamond">◆</span>
        <span className="rx-title-line" />
      </div>
    </div>

    <A4LetterPatientBox patient={data} />

    <div className="rx-surgery-details">
      <DetailRow label="Surgery ID" value={data.surgeryId} />
      <DetailRow label="Surgery / Procedure" value={data.surgeryName} />
      <DetailRow label="Category" value={data.category} />
      <DetailRow label="Duration" value={data.duration} />
      <DetailRow label="Anesthesia Type" value={data.anesthesiaType} />
      <DetailRow label="Risk Level" value={data.riskLevel} />
      <DetailRow label="Description" value={data.description} />
      <DetailRow label="Required Equipment" value={data.requiredEquipment} />
      <DetailRow label="Pre-op Instructions" value={data.preOpInstructions} />
      <DetailRow label="Post-op Care" value={data.postOpCare} />
      <DetailRow label="Clinical Notes" value={data.notes} />
    </div>

    {data.scheduledNotes && (
      <div className="rx-followup">
        <p className="rx-followup-text mb-0">{data.scheduledNotes}</p>
      </div>
    )}
    </div>
  </div>
)

export default SurgeryRequestLetterA4
