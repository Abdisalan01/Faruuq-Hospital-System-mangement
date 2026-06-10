import { Card, CardBody, Col } from 'react-bootstrap'
import { Link } from 'react-router-dom'

import PageMetaData from '@/components/PageTitle'
import Timer from './components/Timer'

import logoDark from '@/assets/images/logo-dark.png'
import logoLight from '@/assets/images/logo-light.png'
import logoSm from '@/assets/images/logo-sm.png'

const ComingSoon = () => {
  return (
    <>
      <PageMetaData title="Coming Soon" />

      <Col lg={8} className="mx-auto">
        <Card className="auth-card text-center">
          <CardBody>
            <div className="mx-auto text-center auth-logo my-5">
              <Link to="/" className="logo-dark">
                <img src={logoSm} height={30} className="me-1" alt="logo sm" />
                <img src={logoDark} height={24} alt="logo dark" />
              </Link>
              <Link to="/" className="logo-light">
                <img src={logoSm} height={30} className="me-1" alt="logo sm" />
                <img src={logoLight} height={24} alt="logo light" />
              </Link>
            </div>
            <h2 className="fw-bold text-uppercase">We Are Launching Soon...</h2>
            <p className="lead mt-3 w-75 mx-auto pb-4 fst-italic">
              Exciting news is on the horizon! We're thrilled to announce that something incredible is coming your way very soon.
            </p>
            <Timer />
          </CardBody>
        </Card>
      </Col>
    </>
  )
}

export default ComingSoon
