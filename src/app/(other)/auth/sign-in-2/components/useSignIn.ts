import { yupResolver } from '@hookform/resolvers/yup'
import type { AxiosResponse } from 'axios'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import * as yup from 'yup'

import { useAuthContext } from '@/context/useAuthContext'
import { useNotificationContext } from '@/context/useNotificationContext'
import httpClient from '@/helpers/httpClient'
import { getRoleHomePath } from '@/shared/config/roleHomeRoutes'
import { authenticateStaff } from '@/shared/services/authService'
import { isSupabaseBackendEnabled } from '@/shared/services/hmsSupabaseSync'
import type { UserType } from '@/types/auth'

const useSignIn = () => {
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const { saveSession } = useAuthContext()

  const { showNotification } = useNotificationContext()

  const loginFormSchema = yup.object({
    email: yup.string().trim().required('Please enter your email or username'),
    password: yup.string().required('Please enter your password'),
  })

  const { control, handleSubmit } = useForm({
    resolver: yupResolver(loginFormSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  type LoginFormFields = yup.InferType<typeof loginFormSchema>

  const redirectUser = (loggedInUser?: UserType) => {
    // Always land on the role's dashboard — avoids stale redirectTo sending users to forbidden routes
    navigate(getRoleHomePath(loggedInUser?.role))
  }

  const login = handleSubmit(async (values: LoginFormFields) => {
    setLoading(true)
    try {
      if (isSupabaseBackendEnabled()) {
        const user = await authenticateStaff(values.email, values.password)
        if (user) {
          saveSession(user)
          redirectUser(user)
          showNotification({ message: 'Successfully logged in. Redirecting....', variant: 'success' })
        } else {
          showNotification({
            message: 'Username/email or password is incorrect. Use your username or full login email.',
            variant: 'danger',
          })
        }
        return
      }

      const res: AxiosResponse<UserType> = await httpClient.post('/login', values)
      if (res.data.token) {
        saveSession({
          ...(res.data ?? {}),
          token: res.data.token,
        })
        redirectUser(res.data)
        showNotification({ message: 'Successfully logged in. Redirecting....', variant: 'success' })
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      if (e.response?.data?.error) {
        showNotification({ message: e.response?.data?.error, variant: 'danger' })
      }
    } finally {
      setLoading(false)
    }
  })

  return { loading, login, control }
}

export default useSignIn
