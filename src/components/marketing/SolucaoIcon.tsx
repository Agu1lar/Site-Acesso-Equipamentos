import type { SolucaoContent } from '@/data/solucoes';

type SolucaoIconProps = {
  slug: SolucaoContent['slug'];
  className?: string;
};

/**
 * Drawn segment glyph for Mills-style solution cards (hub + home).
 */
export function SolucaoIcon(props: SolucaoIconProps) {
  return (
    <svg
      aria-hidden
      className={props.className ?? 'h-10 w-10'}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.6}
      viewBox="0 0 48 48"
    >
      {renderSolucaoPaths(props.slug)}
    </svg>
  );
}

function renderSolucaoPaths(slug: string) {
  if (slug === 'mineracao') {
    return (
      <>
        <path d="M8 36h32" />
        <path d="M12 36V22l8-6 8 4 8-5v21" />
        <path d="M20 36v-8h8v8" />
        <path d="M28 14l6-6M34 8h6v6" />
      </>
    );
  }
  if (slug === 'industria') {
    return (
      <>
        <path d="M8 38h32" />
        <path d="M10 38V18h10v20" />
        <path d="M20 26h10l4-6v18" />
        <path d="M14 14v-4M18 14v-6M22 14v-3" />
      </>
    );
  }
  if (slug === 'siderurgia') {
    return (
      <>
        <path d="M8 38h32" />
        <path d="M14 38V16h8v22" />
        <path d="M22 24h12v14" />
        <path d="M28 24V12h10" />
        <path d="M34 12l6 8" />
      </>
    );
  }
  if (slug === 'construcao-civil') {
    return (
      <>
        <path d="M8 38h32" />
        <path d="M12 38V20l12-10 12 10v18" />
        <path d="M20 38v-10h8v10" />
        <path d="M18 24h4M26 24h4" />
      </>
    );
  }
  if (slug === 'manutencao-industrial') {
    return (
      <>
        <path d="M18 30l-6 6 4 4 6-6" />
        <path d="M20 28l8-8 6 2-2 6-8 8" />
        <circle cx="32" cy="16" r="5" />
        <path d="M32 11v3M32 18v3M27 16h3M34 16h3" />
      </>
    );
  }
  if (slug === 'logistica') {
    return (
      <>
        <path d="M8 34h20l8-8h4v8h-4" />
        <path d="M10 34V20h16v14" />
        <circle cx="16" cy="36" r="3" />
        <circle cx="30" cy="36" r="3" />
        <path d="M14 24h8M14 28h10" />
      </>
    );
  }
  return (
    <>
      <path d="M8 38h32" />
      <path d="M12 38V22l10-8 6 4v20" />
      <path d="M28 18l8-6M36 12h4v6" />
      <path d="M20 28h8" />
    </>
  );
}
