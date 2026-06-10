import { systemSettings } from '@/shared/services/hmsStore'

const HOSPITAL_WEBSITE = 'www.faaruuqhospital.com'

const A4LetterFooter = () => (
  <div className="rx-footer-wrap">
    <div className="rx-footer-rule" aria-hidden />
    <footer className="rx-letter-footer">
      <p className="rx-footer-hospital">{systemSettings.hospitalName}</p>
      <p className="rx-footer-tagline">Quality Healthcare You Can Trust</p>
      <div className="rx-footer-contact">
        <span className="rx-footer-line">
          <strong>Tel</strong> {systemSettings.phone}
        </span>
        <span className="rx-footer-dot" aria-hidden>
          •
        </span>
        <span className="rx-footer-line">
          <strong>Email</strong> {systemSettings.email}
        </span>
        <span className="rx-footer-dot" aria-hidden>
          •
        </span>
        <span className="rx-footer-line">
          <strong>Web</strong> {HOSPITAL_WEBSITE}
        </span>
        <span className="rx-footer-dot" aria-hidden>
          •
        </span>
        <span className="rx-footer-line">
          <strong>Address</strong> {systemSettings.address}
        </span>
      </div>
    </footer>
  </div>
)

export default A4LetterFooter
