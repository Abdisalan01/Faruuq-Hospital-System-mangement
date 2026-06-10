import { ToastContainer } from 'react-toastify'
import { AuthProvider } from '@/context/useAuthContext'
import { HmsStoreProvider } from '@/context/HmsStoreContext'
import { LayoutProvider } from '@/context/useLayoutContext'
import { NotificationProvider } from '@/context/useNotificationContext'
import type { ChildrenType } from '@/types/component-props'

const AppProvidersWrapper: React.FC<ChildrenType> = ({ children }) => {
  return (
    <HmsStoreProvider>
      <AuthProvider>
        <LayoutProvider>
          <NotificationProvider>
            {children}
            <ToastContainer theme="colored" />
          </NotificationProvider>
        </LayoutProvider>
      </AuthProvider>
    </HmsStoreProvider>
  )
}

export default AppProvidersWrapper
