import type { ReactNode } from 'react'
import { Button, Modal } from 'react-bootstrap'

import IconifyIcon from '@/components/wrappers/IconifyIcon'

type A4PrintModalProps = {
  show: boolean
  onHide: () => void
  title: string
  children: ReactNode
}

const A4PrintModal = ({ show, onHide, title, children }: A4PrintModalProps) => (
  <Modal
    show={show}
    onHide={onHide}
    size="xl"
    centered
    className="a4-hospital-print-modal a4-prescription-print-modal"
    dialogClassName="a4-prescription-print-dialog"
  >
    <Modal.Header closeButton className="no-print">
      <Modal.Title>{title}</Modal.Title>
    </Modal.Header>
    <Modal.Body className="d-flex justify-content-center p-3 overflow-auto">{children}</Modal.Body>
    <Modal.Footer className="no-print flex-column align-items-stretch">
      <p className="text-muted small mb-2 mb-md-0">
        Print: choose <strong>A4</strong>, scale <strong>100%</strong>, and turn off browser headers/footers
        (date/URL) for a clean PDF.
      </p>
      <div className="d-flex gap-2 justify-content-end">
        <Button variant="light" onClick={onHide}>
          Close
        </Button>
        <Button variant="primary" onClick={() => window.print()}>
          <IconifyIcon icon="solar:printer-broken" className="me-1" />
          Print / Save as PDF
        </Button>
      </div>
    </Modal.Footer>
  </Modal>
)

export default A4PrintModal
