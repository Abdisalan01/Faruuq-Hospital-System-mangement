import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import App from './App'
import { basePath } from './context/constants'
import '@/shared/services/hmsStore'
import { reconcileAllPatientStatuses } from '@/shared/utils/visitConsultation'

reconcileAllPatientStatuses()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={basePath}>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
