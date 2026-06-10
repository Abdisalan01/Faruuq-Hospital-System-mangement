import type { ReactNode } from 'react'
import { Breadcrumb, Button, Col, Row } from 'react-bootstrap'
import { Link } from 'react-router-dom'

import IconifyIcon from '@/components/wrappers/IconifyIcon'

type BreadcrumbItem = {
  label: string
  href?: string
}

type PageHeaderProps = {
  title: string
  subtitle?: string
  breadcrumbs?: BreadcrumbItem[]
  actionLabel?: string
  actionHref?: string
  onAction?: () => void
  actionIcon?: string
  children?: ReactNode
}

const PageHeader = ({
  title,
  subtitle,
  breadcrumbs,
  actionLabel,
  actionHref,
  onAction,
  actionIcon = 'bx:plus',
  children,
}: PageHeaderProps) => {
  return (
    <Row className="mb-3">
      <Col>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <Breadcrumb className="mb-2">
            {breadcrumbs.map((item, idx) => (
              <Breadcrumb.Item key={idx} active={!item.href} linkAs={item.href ? Link : undefined} linkProps={item.href ? { to: item.href } : undefined}>
                {item.label}
              </Breadcrumb.Item>
            ))}
          </Breadcrumb>
        )}
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div>
            <h4 className="mb-0">{title}</h4>
            {subtitle && <p className="text-muted mb-0 mt-1">{subtitle}</p>}
          </div>
          <div className="d-flex gap-2">
            {children}
            {actionLabel &&
              (actionHref ? (
                <Link to={actionHref}>
                  <Button variant="success">
                    <IconifyIcon icon={actionIcon} className="me-1" />
                    {actionLabel}
                  </Button>
                </Link>
              ) : (
                <Button variant="success" onClick={onAction}>
                  <IconifyIcon icon={actionIcon} className="me-1" />
                  {actionLabel}
                </Button>
              ))}
          </div>
        </div>
      </Col>
    </Row>
  )
}

export default PageHeader
