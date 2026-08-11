/**
 * Custom icon set — replaces emoji glyphs so the app doesn't depend on the
 * platform's emoji font for meaning (rendering varies a lot across OSes,
 * and none of them draw a chairlift/gondola/drag-lift distinction anyway).
 *
 * Sourced from the "Ski app icon set" design (claude.ai/design). All icons
 * share one convention so they read as one family at any size: 24×24
 * viewBox, stroke-only, `currentColor` (inherits the surrounding text/icon
 * color — including selected/unselected tab-bar states — with no extra
 * CSS), round caps/joins, 2px stroke width. Lift icons additionally share
 * a cable motif and differ only in what hangs from it.
 */
const STROKE = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

export const ICONS = {
  home: `<svg viewBox="0 0 24 24" ${STROKE}>
    <path d="M10.9 4.5 Q12 3.4 13.1 4.5 L21.4 11 L18.7 11 V20.4 H5.3 V11 L2.6 11 Z"/>
  </svg>`,

  resorts: `<svg viewBox="0 0 24 24" ${STROKE}>
    <path d="M15.2 17.3 L16.8 13.9 Q17.6 12.2 18.5 14 L21.6 19.8"/>
    <path d="M2.2 19.8 L8.3 8.1 Q9.4 6 10.5 8.1 L16.6 19.8 Z"/>
    <path d="M6.6 13.6 Q9.4 9.3 12.2 13.6"/>
  </svg>`,

  alerts: `<svg viewBox="0 0 24 24" ${STROKE}>
    <path d="M10.8 5.2 Q12 3.2 13.2 5.2 L21.4 18.9 Q22.3 20.4 20.6 20.4 H3.4 Q1.7 20.4 2.6 18.9 Z"/>
    <path d="M12 9.9 V14.5"/>
    <circle cx="12" cy="17.5" r="1" fill="currentColor" stroke="none"/>
  </svg>`,

  /** Downhill skier — used for slope/piste route steps. */
  ski: `<svg viewBox="0 0 24 24" ${STROKE}>
    <circle cx="16.1" cy="6.2" r="1.8"/>
    <path d="M14.2 9.2 L11.2 11.9"/>
    <path d="M11.2 11.9 L13.4 15.4 L9.4 17.6"/>
    <path d="M3.4 15.6 L17 20.2"/>
    <path d="M17 20.2 C18.4 20.7 19.2 20.2 19.4 19.2"/>
  </svg>`,

  /** Open bench seat with footrest, hung from the cable. */
  chairlift: `<svg viewBox="0 0 24 24" ${STROKE}>
    <path d="M2 10 L21.8 3.3"/>
    <path d="M10.2 7.2 L12.1 10.6"/>
    <path d="M12.1 10.6 V14.8 Q12.1 16 13.3 16 H17.7 V13.7"/>
  </svg>`,

  /** Enclosed cabin hung from the cable. */
  gondola: `<svg viewBox="0 0 24 24" ${STROKE}>
    <path d="M2 10 L21.8 3.3"/>
    <path d="M12 6.6 V9.2"/>
    <rect x="7.2" y="9.2" width="9.6" height="10.6" rx="3.8"/>
    <path d="M8.9 13.6 H15.1"/>
  </svg>`,

  /** Drag/button/T-bar lift — a towline down to the platter, no cabin. */
  surface: `<svg viewBox="0 0 24 24" ${STROKE}>
    <path d="M2 10 L21.8 3.3"/>
    <path d="M11.6 6.7 V15.6"/>
    <path d="M8.2 15.6 H15"/>
    <path d="M2.8 20.4 L21.2 18.6"/>
  </svg>`,

  /** Snowflake — fresh snow / base depth stat. */
  snow: `<svg viewBox="0 0 24 24" ${STROKE}>
    <path d="M12 3.6 V20.4"/>
    <path d="M4.7 7.8 L19.3 16.2"/>
    <path d="M4.7 16.2 L19.3 7.8"/>
    <path d="M9.6 6.2 Q12 8.9 14.4 6.2"/>
    <path d="M9.6 17.8 Q12 15.1 14.4 17.8"/>
  </svg>`,

  /** Wind — wind speed/direction stat. */
  wind: `<svg viewBox="0 0 24 24" ${STROKE}>
    <path d="M2.8 9.2 H13.4 A2.6 2.6 0 1 0 10.8 6.6"/>
    <path d="M2.8 14.8 H16.4 A2.8 2.8 0 1 1 13.6 17.6"/>
    <path d="M5.2 12 H19.4"/>
  </svg>`,
};

/** Maps a network node's `lift_type` to an icon key, defaulting to the most common type. */
export function liftIcon(liftType) {
  return ICONS[liftType] ?? ICONS.chairlift;
}
