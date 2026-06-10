import { Link } from 'react-router-dom'

import type { LogoBoxProps } from '@/types/component-props'
import {
  SIDEBAR_LOGO_HORIZONTAL_COLOR,
  SIDEBAR_LOGO_HORIZONTAL_WHITE,
  SIDEBAR_LOGO_SHORT_COLOR,
  SIDEBAR_LOGO_SHORT_WHITE,
} from '@/shared/constants/branding'

const LogoBox = ({ containerClassName, squareLogo, textLogo }: LogoBoxProps) => {
  const horizontalHeight = textLogo?.height ?? 44
  const shortHeight = squareLogo?.height ?? 36
  const shortWidth = squareLogo?.width ?? shortHeight

  return (
    <div className={containerClassName ?? ''}>
      {/* Light sidebar — color horizontal + fsh short when condensed */}
      <Link to="/" className="logo-dark">
        <img
          src={SIDEBAR_LOGO_HORIZONTAL_COLOR}
          className={`logo-lg fsh-logo fsh-logo-horizontal ${textLogo?.className ?? ''}`}
          height={horizontalHeight}
          alt="Faaruuq Specialist Hospital"
        />
        <img
          src={SIDEBAR_LOGO_SHORT_COLOR}
          className={`logo-sm fsh-logo fsh-logo-short ${squareLogo?.className ?? ''}`}
          height={shortHeight}
          width={shortWidth}
          alt="FSH"
        />
      </Link>

      {/* Dark sidebar — white horizontal + white short when condensed */}
      <Link to="/" className="logo-light">
        <img
          src={SIDEBAR_LOGO_HORIZONTAL_WHITE}
          className={`logo-lg fsh-logo fsh-logo-horizontal ${textLogo?.className ?? ''}`}
          height={horizontalHeight}
          alt="Faaruuq Specialist Hospital"
        />
        <img
          src={SIDEBAR_LOGO_SHORT_WHITE}
          className={`logo-sm fsh-logo fsh-logo-short ${squareLogo?.className ?? ''}`}
          height={shortHeight}
          width={shortWidth}
          alt="FSH"
        />
      </Link>
    </div>
  )
}

export default LogoBox
