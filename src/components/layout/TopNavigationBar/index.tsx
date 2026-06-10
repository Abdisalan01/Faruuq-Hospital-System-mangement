import { Suspense } from 'react'

import LeftSideBarToggle from './components/LeftSideBarToggle'
import ProfileDropdown from './components/ProfileDropdown'
import ThemeCustomizerToggle from './components/ThemeCustomizerToggle'
import ThemeModeToggle from './components/ThemeModeToggle'
import FullScreenToggler from './components/FullScreenToggler'

const TopNavigationBar = () => {
  return (
    <header className="topbar">
      <div className="container-fluid">
        <div className="navbar-header">
          <div className="d-flex align-items-center gap-2">
            <LeftSideBarToggle />
          </div>
          <div className="d-flex align-items-center gap-1">
            <ThemeModeToggle />

            <Suspense>
              <FullScreenToggler />
            </Suspense>

            <ThemeCustomizerToggle />

            <ProfileDropdown />
          </div>
        </div>
      </div>
    </header>
  )
}

export default TopNavigationBar
