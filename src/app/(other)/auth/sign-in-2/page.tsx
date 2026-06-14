import { Card, CardBody, Col } from 'react-bootstrap'

import LogoBox from '@/components/LogoBox'
import PageMetaData from '@/components/PageTitle'
import LoginForm from './components/LoginForm'

const SignIn2 = () => {
  return (
    <>
      <PageMetaData title="Sign In" />

      <Col xl={5} className="mx-auto">
        <Card className="auth-card">
          <CardBody className="px-3 py-5">
            <LogoBox
              textLogo={{ height: 100, width: 100 }}
              containerClassName="mx-auto mb-4 text-center auth-logo"
            />
            <h2 className="fw-bold text-center fs-18">FSH Hospital</h2>
            <p className="text-muted text-center mt-1 mb-4">Hospital Management System — sign in with your staff credentials.</p>
            <div className="px-4">
              <LoginForm />
            </div>
          </CardBody>
        </Card>
      </Col>
    </>
  )
}

export default SignIn2
