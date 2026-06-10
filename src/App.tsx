import AppProvidersWrapper from './components/wrappers/AppProvidersWrapper'
import configureFakeBackend from './helpers/fake-backend'
import AppRouter from './routes/router'
import { isSupabaseBackendEnabled } from '@/shared/services/hmsSupabaseSync'

import '@/assets/scss/app.scss'

if (!isSupabaseBackendEnabled()) {
  configureFakeBackend()
}

const App = () => {
  return (
    <AppProvidersWrapper>
      <AppRouter />
    </AppProvidersWrapper>
  )
}

export default App
