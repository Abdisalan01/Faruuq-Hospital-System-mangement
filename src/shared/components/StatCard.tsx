import IconifyIcon from '@/components/wrappers/IconifyIcon'
import { Card, CardBody, CardFooter, Col } from 'react-bootstrap'
import { Link } from 'react-router-dom'

type StatCardProps = {
  title: string
  value: string | number
  icon: string
  variant?: string
  link?: string
  linkLabel?: string
}

const StatCard = ({ title, value, icon, variant = 'primary', link, linkLabel = 'View More' }: StatCardProps) => {
  return (
    <Col md={6} xl={3}>
      <Card>
        <CardBody>
          <div className="d-flex align-items-center justify-content-between">
            <div>
              <p className="text-muted mb-1 text-truncate">{title}</p>
              <h3 className="mb-0">{value}</h3>
            </div>
            <div className={`avatar-md bg-light bg-opacity-50 rounded flex-centered`}>
              <IconifyIcon icon={icon} className={`fs-32 text-${variant}`} />
            </div>
          </div>
        </CardBody>
        {link && (
          <CardFooter className="border-0 py-2 bg-light bg-opacity-50">
            <Link to={link} className="text-reset fw-medium fs-12">
              {linkLabel}
            </Link>
          </CardFooter>
        )}
      </Card>
    </Col>
  )
}

export default StatCard
