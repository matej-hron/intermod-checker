import type { JSX } from 'react';

export type IconName =
  | 'lock'
  | 'unlock'
  | 'delete'
  | 'add'
  | 'analyse'
  | 'tune'
  | 'project'
  | 'close'
  | 'more';

export interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

function iconContent(name: IconName): JSX.Element {
  switch (name) {
    case 'lock':
      return (
        <>
          <path d="M9 10V8.5a3 3 0 0 1 6 0V10" />
          <rect x="5.5" y="10" width="13" height="9" rx="2" />
          <path d="M12 13.5v2.5" />
        </>
      );
    case 'unlock':
      return (
        <>
          <path d="M8.5 10V8.5a3 3 0 0 1 5.7-1.3" />
          <path d="M7 10h10.5a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z" />
          <path d="M12 13.5v2.5" />
        </>
      );
    case 'delete':
      return (
        <>
          <path d="M6.5 8h11" />
          <path d="M9 8l.5-1.5h5L15 8" />
          <path d="M8.5 8.5h7v9a1.5 1.5 0 0 1-1.5 1.5h-4A1.5 1.5 0 0 1 8.5 17.5Z" />
          <path d="M10.5 11.5v4" />
          <path d="M13.5 11.5v4" />
        </>
      );
    case 'add':
      return (
        <>
          <path d="M12 5.5v13" />
          <path d="M5.5 12h13" />
        </>
      );
    case 'analyse':
      return (
        <>
          <path d="M11 16a5 5 0 1 1 0-10 5 5 0 0 1 0 10Z" />
          <path d="m15.2 15.2 3.3 3.3" />
          <path d="M8.5 12h2.5l1.2-2 1.1 4 1-2H16" />
        </>
      );
    case 'tune':
      return (
        <>
          <path d="M7 5.5v13" />
          <path d="M12 5.5v13" />
          <path d="M17 5.5v13" />
          <path d="M5.5 9h3" />
          <path d="M10.5 15h3" />
          <path d="M15.5 11h3" />
          <circle cx="7" cy="9" r="1.5" />
          <circle cx="12" cy="15" r="1.5" />
          <circle cx="17" cy="11" r="1.5" />
        </>
      );
    case 'project':
      return (
        <>
          <path d="M4.5 8a2 2 0 0 1 2-2h3.4l1.6 2H17.5a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2Z" />
          <path d="M7 13.5h10" />
          <path d="M7 16.5h7" />
        </>
      );
    case 'close':
      return (
        <>
          <path d="m6.5 6.5 11 11" />
          <path d="m17.5 6.5-11 11" />
        </>
      );
    case 'more':
      return (
        <>
          <circle cx="7" cy="12" r="1.2" />
          <circle cx="12" cy="12" r="1.2" />
          <circle cx="17" cy="12" r="1.2" />
        </>
      );
  }
}

export function Icon({ name, size = 24, className }: IconProps): JSX.Element {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {iconContent(name)}
    </svg>
  );
}
