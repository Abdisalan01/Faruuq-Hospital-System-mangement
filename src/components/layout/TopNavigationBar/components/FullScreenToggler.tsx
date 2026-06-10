import { useState } from 'react'

import IconifyIcon from '@/components/wrappers/IconifyIcon'

type DocumentWithFullscreen = Document & {
  mozFullScreenElement?: Element
  msFullscreenElement?: Element
  webkitFullscreenElement?: Element
  msExitFullscreen?: () => void
  mozCancelFullScreen?: () => void
  webkitExitFullscreen?: () => void
}

type DocumentElementWithFullscreen = HTMLElement & {
  msRequestFullscreen?: () => void
  mozRequestFullScreen?: () => void
  webkitRequestFullscreen?: () => void
}

const FullScreenToggler = () => {
  const [fullScreenOn, setFullScreenOn] = useState(isFullScreen())

  function isFullScreen(): boolean {
    const doc = document as DocumentWithFullscreen
    return !!(doc.fullscreenElement || doc.mozFullScreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement)
  }

  function requestFullScreen(element: DocumentElementWithFullscreen) {
    if (element.requestFullscreen) {
      element.requestFullscreen()
    } else if (element.msRequestFullscreen) {
      element.msRequestFullscreen()
    } else if (element.webkitRequestFullscreen) {
      element.webkitRequestFullscreen()
    } else if (element.mozRequestFullScreen) {
      element.mozRequestFullScreen()
    }
  }

  function exitFullScreen(doc: DocumentWithFullscreen) {
    if (doc.exitFullscreen) {
      doc.exitFullscreen()
    } else if (doc.msExitFullscreen) {
      doc.msExitFullscreen()
    } else if (doc.webkitExitFullscreen) {
      doc.webkitExitFullscreen()
    } else if (doc.mozCancelFullScreen) {
      doc.mozCancelFullScreen()
    }
  }

  function toggleFullScreen(): void {
    if (!isFullScreen()) {
      requestFullScreen(document.documentElement)
      setFullScreenOn(true)
    } else {
      exitFullScreen(document)
      setFullScreenOn(false)
    }
  }

  return (
    <div className="topbar-item d-none d-lg-flex">
      <button type="button" onClick={toggleFullScreen} className="topbar-button" data-toggle="fullscreen">
        <IconifyIcon icon={`solar:${fullScreenOn ? 'quit-full-screen' : 'full-screen'}-broken`} className="fs-24 align-middle fullscreen" />
      </button>
    </div>
  )
}

export default FullScreenToggler
