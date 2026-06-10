import { useState } from 'react'
import { Button, Card, Collapse } from 'react-bootstrap'

import IconifyIcon from '@/components/wrappers/IconifyIcon'
import {
  getSupabaseSqlEditorUrl,
  HMS_TABLES_SETUP_SQL,
} from '@/shared/constants/supabaseSetupSql'

type SupabaseSetupErrorProps = {
  error: string
  onRetry: () => void
}

type UserFacingCopy = {
  title: string
  message: string
  hint: string
}

function getUserFacingCopy(error: string): UserFacingCopy {
  const lower = error.toLowerCase()

  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('network request failed')
  ) {
    return {
      title: 'Isku xirka lama helin',
      message:
        'Ma suuragelin in xogta hospital-ka la soo shubo. Hubi internet-kaaga kadibna mar kale isku day.',
      hint: 'Haddii dhibaatadu sii socoto, la xiriir maamulaha system-ka.',
    }
  }

  if (
    lower.includes('hms_meta') ||
    lower.includes('does not exist') ||
    lower.includes('relation') ||
    lower.includes('missing table') ||
    lower.includes('sql editor')
  ) {
    return {
      title: 'System-ka waa la diyaarinayaa',
      message:
        'Xogta hospital-ka lama heli karo waqtigan. Fadlan sug ama la xiriir maamulaha IT-ga hospital-ka.',
      hint: 'Maamulaha ayaa xaqiijin doona database-ka.',
    }
  }

  return {
    title: 'Cilad ayaa dhacday',
    message:
      'Waan ka xunnahay — ma suuragelin in xogta hospital-ka la soo shubo. Fadlan mar kale isku day.',
    hint: 'Haddii dhibaatadu sii socoto, la xiriir maamulaha system-ka.',
  }
}

const SupabaseSetupError = ({ error, onRetry }: SupabaseSetupErrorProps) => {
  const [retrying, setRetrying] = useState(false)
  const [showDevTools, setShowDevTools] = useState(false)
  const [copied, setCopied] = useState(false)
  const sqlEditorUrl = getSupabaseSqlEditorUrl()
  const copy = getUserFacingCopy(error)
  const isDev = import.meta.env.DEV

  const handleRetry = () => {
    setRetrying(true)
    onRetry()
    window.setTimeout(() => setRetrying(false), 1500)
  }

  const copySql = async () => {
    await navigator.clipboard.writeText(HMS_TABLES_SETUP_SQL)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="d-flex flex-column align-items-center justify-content-center min-vh-100 p-4 bg-light">
      <Card className="border-0 shadow-sm text-center" style={{ maxWidth: 440, width: '100%' }}>
        <Card.Body className="p-4 p-md-5">
          <div
            className="d-inline-flex align-items-center justify-content-center rounded-circle bg-primary bg-opacity-10 text-primary mb-4"
            style={{ width: 72, height: 72 }}>
            <IconifyIcon icon="solar:cloud-cross-broken" className="fs-1" />
          </div>

          <h4 className="fw-semibold mb-2">{copy.title}</h4>
          <p className="text-muted mb-2">{copy.message}</p>
          <p className="text-muted small mb-4">{copy.hint}</p>

          <Button
            variant="primary"
            className="px-4"
            onClick={handleRetry}
            disabled={retrying}>
            {retrying ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" />
                Loading…
              </>
            ) : (
              'Mar kale isku day'
            )}
          </Button>
        </Card.Body>
      </Card>

      {isDev && (
        <div className="mt-4" style={{ maxWidth: 720, width: '100%' }}>
          <Button
            variant="link"
            size="sm"
            className="text-muted text-decoration-none"
            onClick={() => setShowDevTools((open) => !open)}
            aria-expanded={showDevTools}>
            <IconifyIcon icon="solar:code-square-broken" className="me-1 align-text-bottom" />
            Developer setup {showDevTools ? '▲' : '▼'}
          </Button>
          <Collapse in={showDevTools}>
            <Card className="border mt-2 text-start">
              <Card.Body className="small">
                <p className="text-danger mb-2 font-monospace">{error}</p>
                <p className="mb-2">
                  Run HMS migration SQL in Supabase SQL Editor, then retry.
                </p>
                <pre
                  className="bg-light border rounded p-2 font-monospace small mb-3"
                  style={{ maxHeight: 200, overflow: 'auto' }}>
                  {HMS_TABLES_SETUP_SQL.slice(0, 800)}…
                </pre>
                <div className="d-flex flex-wrap gap-2">
                  <Button variant="outline-primary" size="sm" onClick={() => void copySql()}>
                    {copied ? 'Copied!' : 'Copy SQL'}
                  </Button>
                  {sqlEditorUrl && (
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      href={sqlEditorUrl}
                      target="_blank"
                      rel="noreferrer"
                      as="a">
                      Open SQL Editor
                    </Button>
                  )}
                </div>
              </Card.Body>
            </Card>
          </Collapse>
        </div>
      )}
    </div>
  )
}

export default SupabaseSetupError
