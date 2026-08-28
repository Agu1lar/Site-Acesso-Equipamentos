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
          : `h-[4.5rem] w-auto max-w-[min(90vw,340px)] object-contain object-left sm:h-20 sm:max-w-[360px] md:max-w-[380px] ${className}`
      }
      height={BRAND_LOGO_HEIGHT}
      priority
      sizes={compact ? '172px' : '(max-width: 768px) 340px, 380px'}
      src={BRAND_LOGO_SRC}
      width={BRAND_LOGO_WIDTH}
    />
  );
}
