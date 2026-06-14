import {
  PRINT_HOSPITAL_ADDRESS,
  PRINT_HOSPITAL_PHONES,
  THERMAL_LOGO_SRC,
} from '@/shared/constants/branding'

type PrintDocumentHeaderProps = {
  variant?: 'thermal' | 'a4'
}

const PrintDocumentHeader = ({ variant = 'a4' }: PrintDocumentHeaderProps) => {
  if (variant === 'thermal') {
    return (
      <header className="print-doc-header print-doc-header--thermal">
        <img src={THERMAL_LOGO_SRC} alt="" className="slip-logo" />
        <div className="print-doc-header__contact">
          <span>{PRINT_HOSPITAL_PHONES}</span>
          <span>{PRINT_HOSPITAL_ADDRESS}</span>
        </div>
        <hr className="print-doc-header__rule my-2" />
      </header>
    )
  }

  return (
    <header className="rx-letter-header print-doc-header print-doc-header--a4">
      <img src={THERMAL_LOGO_SRC} alt="Faaruuq Specialist Hospital" className="rx-letter-logo" />
      <div className="print-doc-header__contact">
        <p className="print-doc-header__phones">{PRINT_HOSPITAL_PHONES}</p>
        <p className="print-doc-header__address">{PRINT_HOSPITAL_ADDRESS}</p>
      </div>
      <div className="rx-header-rule" aria-hidden />
    </header>
  )
}

export default PrintDocumentHeader
