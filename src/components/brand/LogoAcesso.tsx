type LogoAcessoProps = {
  /** `header` — sem tagline (barra compacta); `full` — com linha de serviços */
  variant?: 'header' | 'full';
  className?: string;
};

const BRAND_RED = '#A51C1C';

/**
 * Logo vetorial oficial — fundo transparente, proporção horizontal (470×158).
 */
export function LogoAcesso({ variant = 'header', className = '' }: LogoAcessoProps) {
  const viewBox = variant === 'full' ? '0 0 470 158' : '0 0 380 108';

  return (
    <svg
      aria-label="Acesso Equipamentos"
      className={className}
      fill="none"
      role="img"
      viewBox={viewBox}
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="52" cy="54" fill={BRAND_RED} r="48" />
      <path
        d="M52 18 L82 78 H22 Z"
        fill="white"
        stroke="white"
        strokeLinejoin="round"
        strokeWidth="2.5"
      />

      <text
        fill="#000000"
        fontFamily="var(--font-heading), 'Arial Black', Helvetica, sans-serif"
        fontSize="44"
        fontWeight="700"
        letterSpacing="-0.02em"
        x="118"
        y="50"
      >
        ACESSO
      </text>

      <rect fill={BRAND_RED} height="36" rx="2" width="248" x="118" y="60" />
      <text
        fill="#FFFFFF"
        fontFamily="var(--font-body), Arial, Helvetica, sans-serif"
        fontSize="22"
        fontWeight="500"
        x="130"
        y="85"
      >
        equipamentos
      </text>

      {variant === 'full' ? (
        <text
          fill="#000000"
          fontFamily="var(--font-body), Arial, Helvetica, sans-serif"
          fontSize="13"
          fontWeight="600"
          letterSpacing="0.08em"
          x="118"
          y="124"
        >
          PLATAFORMAS ELEVATÓRIAS • ANDAIMES • MÁQUINAS
        </text>
      ) : null}
    </svg>
  );
}
