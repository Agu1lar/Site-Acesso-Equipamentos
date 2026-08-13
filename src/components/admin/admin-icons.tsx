'use client';

type IconProps = {
  className?: string;
};

export function IconLeads({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg aria-hidden className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4-4v2M9 11a4 4 0 100-8 4 4 0 000 8zm11 10v-2a4 4 0 00-3-3.87M19 7a4 4 0 11-8 0 4 4 0 018 0z"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
    </svg>
  );
}

export function IconAnalytics({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg aria-hidden className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        d="M4 19V5M9 19V9m6 10V3m5 16v-6"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
    </svg>
  );
}

export function IconEquipment({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg aria-hidden className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        d="M4 7h16M4 12h16M4 17h10"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
    </svg>
  );
}

export function IconBlog({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg aria-hidden className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        d="M9 12h6M9 16h6M7 4h7l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
    </svg>
  );
}

export function IconPlus({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg aria-hidden className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" />
    </svg>
  );
}

export function IconAccess({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg aria-hidden className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
    </svg>
  );
}

export function IconClients({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg aria-hidden className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
    </svg>
  );
}

export function IconSearch({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg aria-hidden className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
    </svg>
  );
}

export function IconChatPro({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg aria-hidden className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        d="M8 10h8M8 14h5M21 12c0 3.866-3.582 7-8 7-.873 0-1.713-.13-2.5-.37L5 21l1.37-3.5A7.7 7.7 0 015 12c0-3.866 3.582-7 8-7s8 3.134 8 7z"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
    </svg>
  );
}
