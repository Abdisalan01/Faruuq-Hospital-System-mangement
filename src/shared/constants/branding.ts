/**
 * Hospital logos in `public/` — uses Vite BASE_URL for deploy path (e.g. `/Faaruuq_hms/`).
 */
const pub = (filename: string) =>
  `${import.meta.env.BASE_URL}${encodeURIComponent(filename)}`

/** Thermal slip — full horizontal color */
export const THERMAL_LOGO_SRC = pub('Faaruuq Horizental color.png')

/** Sidebar expanded — dark menu */
export const SIDEBAR_LOGO_HORIZONTAL_WHITE = pub('Faaruuq Horizental white.png')

/** Sidebar expanded — light menu */
export const SIDEBAR_LOGO_HORIZONTAL_COLOR = pub('Faaruuq Horizental color.png')

/** Sidebar condensed — dark menu */
export const SIDEBAR_LOGO_SHORT_WHITE = pub('logo short white.png')

/** Sidebar condensed — light menu */
export const SIDEBAR_LOGO_SHORT_COLOR = pub('fsh-logo.png')

/** Standard thermal receipt width (80mm roll) */
export const THERMAL_PAPER_WIDTH_MM = 80
