import type { SVGProps } from 'react';

/** Icônes maison (trait 2 px, angles droits). Toujours accompagnées d'un libellé texte. */
const PATHS = {
  check: <path d="M4 12.5 9.5 18 20 6" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  alert: (
    <>
      <path d="M12 3 2 21h20L12 3Z" />
      <path d="M12 10v5M12 17.5v.5" />
    </>
  ),
  info: (
    <>
      <rect x="3" y="3" width="18" height="18" />
      <path d="M12 11v6M12 7.5v.5" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
    </>
  ),
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />,
  sunrise: (
    <>
      <path d="M3 19h18M7 19a5 5 0 0 1 10 0" />
      <path d="M12 3v6M9 6l3-3 3 3M4.2 11.2l1.4 1.4M19.8 11.2l-1.4 1.4" />
    </>
  ),
  sunset: (
    <>
      <path d="M3 19h18M7 19a5 5 0 0 1 10 0" />
      <path d="M12 9V3M9 6l3 3 3-3M4.2 11.2l1.4 1.4M19.8 11.2l-1.4 1.4" />
    </>
  ),
  golden: (
    <>
      <path d="M3 17h18M6 17a6 6 0 0 1 12 0" />
      <path d="M3 21h18" />
      <path d="M12 5v2M5.6 8.6l1.4 1.4M18.4 8.6 17 10" />
    </>
  ),
  cloud: <path d="M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9.5 4.3 4.3 0 0 0 7 18Z" />,
  rain: (
    <>
      <path d="M7 14h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 5.5 4.3 4.3 0 0 0 7 14Z" />
      <path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3" />
    </>
  ),
  wind: <path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8" />,
  pin: (
    <>
      <path d="M12 22s7-7 7-12a7 7 0 1 0-14 0c0 5 7 12 7 12Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  film: (
    <>
      <rect x="3" y="3" width="18" height="18" />
      <path d="M7 3v18M17 3v18M3 8h4M3 12h4M3 16h4M17 8h4M17 12h4M17 16h4" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="10" width="16" height="11" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  arrowRight: <path d="M4 12h16M14 6l6 6-6 6" />,
  arrowLeft: <path d="M20 12H4M10 6l-6 6 6 6" />,
  upload: <path d="M12 16V4M6 10l6-6 6 6M4 20h16" />,
  download: <path d="M12 4v12M6 10l6 6 6-6M4 20h16" />,
  copy: (
    <>
      <rect x="8" y="8" width="13" height="13" />
      <path d="M16 8V3H3v13h5" />
    </>
  ),
  printer: (
    <>
      <path d="M6 9V3h12v6M6 18H3v-9h18v9h-3" />
      <rect x="6" y="14" width="12" height="7" />
    </>
  ),
  grip: (
    <>
      <path d="M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01" strokeWidth="3" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" />,
  external: <path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6" />,
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2 20a7 7 0 0 1 14 0M16 4.5a3.5 3.5 0 0 1 0 7M18 13.5a7 7 0 0 1 4 6.5" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </>
  ),
  phone: (
    <>
      <rect x="6" y="2" width="12" height="20" />
      <path d="M11 18h2" />
    </>
  ),
  menu: <path d="M3 6h18M3 12h18M3 18h18" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  chevronLeft: <path d="m15 6-6 6 6 6" />,
  edit: <path d="M4 20h4L19 9l-4-4L4 16v4ZM14 6l4 4" />,
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
  sparkle: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />,
  logout: <path d="M15 4h5v16h-5M10 8l-4 4 4 4M6 12h11" />,
  door: (
    <>
      <path d="M5 21V3h14v18M3 21h18" />
      <path d="M15 12h.01" strokeWidth="3" />
    </>
  ),
  home: <path d="M3 11 12 3l9 8M5 9.5V21h14V9.5" />,
  doc: (
    <>
      <path d="M6 2h9l5 5v15H6z" />
      <path d="M14 2v6h6M9 13h8M9 17h6" />
    </>
  ),
  layers: <path d="m12 3 9 5-9 5-9-5 9-5ZM3 13l9 5 9-5M3 17l9 5 9-5" />,
} as const;

export type IconName = keyof typeof PATHS;

type Props = Omit<SVGProps<SVGSVGElement>, 'name'> & {
  name: IconName;
  size?: number;
  /** Libellé accessible ; omis = décoratif (aria-hidden). */
  label?: string;
};

export function Icon({ name, size = 20, label, className, ...rest }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="square"
      strokeLinejoin="miter"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      className={className}
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
