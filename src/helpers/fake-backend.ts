import type { UserType } from '@/types/auth'
import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'

import { staffUsers } from '@/shared/services/hmsStore'
import type { StaffUser } from '@/shared/types'

const mock = new MockAdapter(axios)

const DEFAULT_PASSWORD = 'password'

function staffToAuthUser(staff: StaffUser): UserType {
  return {
    id: staff.id,
    email: staff.email,
    username: staff.username,
    password: staff.password ?? DEFAULT_PASSWORD,
    firstName: staff.firstName,
    lastName: staff.lastName,
    role: staff.role,
    departmentId: staff.departmentId,
    token: `hms-token-${staff.id}`,
  }
}

/** @deprecated Use staffUsers — kept for any legacy imports */
export const fakeUsers: UserType[] = staffUsers
  .filter((s) => s.isActive)
  .map(staffToAuthUser)

export default function configureFakeBackend() {
  mock.onPost('/login').reply(function (config) {
    return new Promise(function (resolve) {
      setTimeout(function () {
        const params = JSON.parse(config.data)
        const loginId = String(params.email ?? '').trim().toLowerCase()
        const password = String(params.password ?? '')

        const staff = staffUsers.find((user) => {
          if (!user.isActive) return false
          const emailMatch = user.email.toLowerCase() === loginId
          const usernameMatch = user.username.toLowerCase() === loginId
          const passwordMatch = (user.password ?? DEFAULT_PASSWORD) === password
          return (emailMatch || usernameMatch) && passwordMatch
        })

        if (staff) {
          resolve([200, staffToAuthUser(staff)])
        } else {
          resolve([401, { error: 'Username or password is incorrect' }])
        }
      }, 500)
    })
  })
}
