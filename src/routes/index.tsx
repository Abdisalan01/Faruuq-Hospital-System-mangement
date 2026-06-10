import { lazy } from 'react'
import type { RouteProps } from 'react-router-dom'

import RoleHomeRedirect from '@/routes/RoleHomeRedirect'
import { hmsRoutes } from '@/routes/hmsRoutes'

const NotFound = lazy(() => import('@/app/(other)/(error-pages)/error-404/page'))
const AuthSignIn = lazy(() => import('@/app/(other)/auth/sign-in-2/page'))

export type RoutesProps = {
  path: RouteProps['path']
  name: string
  element: RouteProps['element']
  exact?: boolean
}

const initialRoutes: RoutesProps[] = [
  {
    path: '/',
    name: 'root',
    element: <RoleHomeRedirect />,
  },
]

export const authRoutes: RoutesProps[] = [
  {
    name: 'Sign In',
    path: '/auth/sign-in',
    element: <AuthSignIn />,
  },
  {
    path: '*',
    name: 'not-found',
    element: <NotFound />,
  },
]

export const appRoutes = [...initialRoutes, ...hmsRoutes, ...authRoutes]
