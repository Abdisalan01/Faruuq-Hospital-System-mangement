import { lazy, Suspense } from 'react'

import FallbackLoading from '@/components/FallbackLoading'
import Footer from '@/components/layout/Footer'
import { useHmsStoreContext } from '@/context/HmsStoreContext'
import type { ChildrenType } from '@/types/component-props'
import Preloader from '@/components/Preloader'

const TopNavigationBar = lazy(() => import('@/components/layout/TopNavigationBar'))
const VerticalNavigationBar = lazy(() => import('@/components/layout/VerticalNavigationBar'))

const AdminLayout = ({ children }: ChildrenType) => {
  // Re-render all HMS pages when Supabase data reloads (reception ↔ doctor sync)
  const { dataVersion } = useHmsStoreContext()
  void dataVersion

  return (
    <div className="wrapper">
      <Suspense fallback={<FallbackLoading />}>
        <TopNavigationBar />
      </Suspense>

      <Suspense fallback={<FallbackLoading />}>
        <VerticalNavigationBar />
      </Suspense>

      <div className="page-content">
        <div className="container-fluid">
          <Suspense fallback={<Preloader />}>{children}</Suspense>
        </div>

        <Footer />
      </div>
    </div>
  )
}

export default AdminLayout
