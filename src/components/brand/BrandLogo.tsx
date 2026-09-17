import Image from 'next/image';

/** Logo oficial vetorizado — raster 1002×280 (fundo claro, tipografia original). */
const BRAND_LOGO_SRC = '/assets/brand/logo-acesso-header.jpg';
const BRAND_LOGO_WIDTH = 1002;
const BRAND_LOGO_HEIGHT = 280;

type BrandLogoProps = {
  className?: string;
  compact?: boolean;
};

export function BrandLogo({ className = '', compact = false }: BrandLogoProps) {
  return (
    <Image
      alt="Acesso Equipamentos — plataformas elevatórias, andaimes e máquinas"
      className={
        compact
          ? `h-11 w-[158px] object-contain object-left sm:h-12 sm:w-[172px] ${className}`
          : `h-12 w-auto max-w-[min(90vw,280px)] object-contain object-left sm:h-14 sm:max-w-[320px] ${className}`
      }
      height={BRAND_LOGO_HEIGHT}
      sizes={compact ? '172px' : '(max-width: 768px) 280px, 320px'}
      src={BRAND_LOGO_SRC}
      width={BRAND_LOGO_WIDTH}
    />
  );
}
