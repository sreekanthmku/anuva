type IconProps = {
  size?: number;
  className?: string;
  strokeWidth?: number;
};

const base = (size: number, className?: string) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  className,
  'aria-hidden': true,
});

export function CalendarIcon({ size = 22, className, strokeWidth = 1.6 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <rect x="3" y="5" width="18" height="16" rx="3.5" />
      <path d="M3 10h18M8.5 3v4M15.5 3v4" />
      <circle cx="8.5" cy="14.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="14.5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ChatIcon({ size = 22, className, strokeWidth = 1.6 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="M20.5 12.2c0 3.9-3.8 7-8.5 7a9.8 9.8 0 01-2.7-.37L4.5 20.5l1.2-3.4A6.7 6.7 0 013.5 12.2c0-3.87 3.8-7 8.5-7s8.5 3.13 8.5 7z" />
      <path d="M9.8 10.4a2.3 2.3 0 013.7-1.35c.9.7.8 1.85-.1 2.45-.6.4-1.2.75-1.2 1.5" />
      <circle cx="12.2" cy="15.4" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function BellIcon({ size = 22, className, strokeWidth = 1.6 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="M18 15.5V11a6 6 0 10-12 0v4.5L4.5 18h15L18 15.5z" />
      <path d="M10 20.5a2.2 2.2 0 004 0" />
    </svg>
  );
}

export function UserIcon({ size = 22, className, strokeWidth = 1.6 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <circle cx="12" cy="8.5" r="3.9" />
      <path d="M4.6 20.2c.9-3.6 3.8-5.6 7.4-5.6s6.5 2 7.4 5.6" />
    </svg>
  );
}

export function VideoIcon({ size = 18, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <rect x="2.5" y="6" width="12.5" height="12" rx="3" />
      <path d="M15 11l6-3.2v8.4L15 13z" />
    </svg>
  );
}

export function FileIcon({ size = 18, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="M13.5 3H7a2.5 2.5 0 00-2.5 2.5v13A2.5 2.5 0 007 21h10a2.5 2.5 0 002.5-2.5V9z" />
      <path d="M13.5 3v4.5A1.5 1.5 0 0015 9h4.5M8.5 13h7M8.5 16.5h4.5" />
    </svg>
  );
}

export function ClipboardIcon({ size = 18, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="M9 4.5h6M9 4.5a1.5 1.5 0 00-1.5 1.5v.5h9V6A1.5 1.5 0 0015 4.5" />
      <path d="M7.5 6H6a2 2 0 00-2 2v11a2 2 0 002 2h12a2 2 0 002-2V8a2 2 0 00-2-2h-1.5" />
      <path d="M8.5 11.5h7M8.5 15h4.5" />
    </svg>
  );
}

export function ChevronRightIcon({ size = 18, className, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="M9.5 5.5l6.5 6.5-6.5 6.5" />
    </svg>
  );
}

export function LockIcon({ size = 18, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <rect x="4.5" y="10" width="15" height="10.5" rx="3" />
      <path d="M8 10V7.5a4 4 0 018 0V10" />
    </svg>
  );
}

export function SignOutIcon({ size = 18, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="M14.5 4.5H7a2.5 2.5 0 00-2.5 2.5v10A2.5 2.5 0 007 19.5h7.5" />
      <path d="M17 8.5l3.5 3.5L17 15.5M20 12h-9" />
    </svg>
  );
}

export function CheckIcon({ size = 18, className, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  );
}
