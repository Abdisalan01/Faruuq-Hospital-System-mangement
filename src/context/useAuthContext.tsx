import type { UserType } from '@/types/auth'
import { deleteCookie, getCookie, setCookie } from 'cookies-next'
import { createContext, useContext, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ChildrenType } from '../types/component-props'
import { isStaffUserActive } from '@/shared/services/hmsStore'

export type AuthContextType = {
  user: UserType | undefined
  isAuthenticated: boolean
  saveSession: (session: UserType) => void
  removeSession: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuthContext() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider')
  }
  return context
}

const authSessionKey = '_Rasket_AUTH_KEY_'

function readValidSession(): UserType | undefined {
  const fetchedCookie = getCookie(authSessionKey)?.toString()
  if (!fetchedCookie) return undefined

  try {
    const parsed = JSON.parse(fetchedCookie) as UserType
    if (!isStaffUserActive(parsed.id)) {
      deleteCookie(authSessionKey)
      return undefined
    }
    const { password: _password, ...safeUser } = parsed
    return safeUser
  } catch {
    deleteCookie(authSessionKey)
    return undefined
  }
}

export function AuthProvider({ children }: ChildrenType) {
  const navigate = useNavigate()
  const [user, setUser] = useState<UserType | undefined>(readValidSession())

  const saveSession = (session: UserType) => {
    const { password: _password, ...safeUser } = session
    setCookie(authSessionKey, JSON.stringify(safeUser))
    setUser(safeUser)
  }

  const removeSession = () => {
    deleteCookie(authSessionKey)
    setUser(undefined)
    navigate('/auth/sign-in')
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        saveSession,
        removeSession,
      }}>
      {children}
    </AuthContext.Provider>
  )
}
