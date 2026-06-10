import PasswordFormInput from '@/components/form/PasswordFormInput'
import TextFormInput from '@/components/form/TextFormInput'
import { Button, FormCheck } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import useSignIn from './useSignIn'

const LoginForm = () => {
  const { loading, login, control } = useSignIn()

  return (
    <form className="authentication-form" onSubmit={login}>
      <TextFormInput control={control} name="email" containerClassName="mb-3" label="Email or username" id="email-id" placeholder="e.g. admin@hms.com or reception" />

      <PasswordFormInput
        control={control}
        name="password"
        containerClassName="mb-3"
        placeholder="Enter your password"
        id="password-id"
        label={
          <>
            <Link to="/auth/reset-pass" className="float-end text-muted text-unline-dashed ms-1">
              Reset password
            </Link>
            <label className="form-label" htmlFor="example-password">
              Password
            </label>
          </>
        }
      />
      <div className="mb-3">
        <FormCheck label="Remember me" id="sign-in" />
      </div>
      <div className="mb-1 text-center d-grid">
        <Button variant="primary" type="submit" disabled={loading}>
          Sign In
        </Button>
      </div>
    </form>
  )
}

export default LoginForm
