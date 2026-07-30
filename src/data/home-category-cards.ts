import type { EquipmentCategory } from '@/types/equipment';

export type HomeCategoryCardConfig = {
  slug: EquipmentCategory;
  description: string;
  imageFit: 'cover' | 'contain';
  /** Fixed image — skips catalog rotation (e.g. andaimes). */
  staticImageSrc?: string;
};

/** Copy and layout for home category cards; photos come from the catalog pool. */
export const HOME_CATEGORY_CARDS: HomeCategoryCardConfig[] = [
  {
    slug: 'plataformas-elevatorias',
    description:
      'Aluguel de plataforma elevatória: tesouras, articuladas e telescópicas para obra em altura com entrega na região metropolitana de BH.',
    imageFit: 'contain',
  },
  {
    slug: 'guindaste-industrial',
    description:
      'Locação de guindaste industrial e içamento técnico para remoção de cargas pesadas, máquinas e estruturas em obra e indústria.',
    imageFit: 'contain',
  },
  {
    slug: 'manipuladores-telescopicos',
    description:
      'Manipuladores telescópicos (telehandlers) para movimentação de cargas com alcance e elevação em canteiros e galpões.',
    imageFit: 'contain',
  },
  {
    slug: 'andaimes',
    staticImageSrc: '/assets/images/category-andaimes.png',
    description:
      'Tubos, pisos metálicos, escoras e componentes para montagem de andaimes e acesso temporário em fachadas e obras.',
    imageFit: 'cover',
  },
  {
    slug: 'ferramentas-eletricas',
    description:
      'Marteletes, serras, betoneiras, compressores e ferramentas elétricas 220 V para corte, furação e acabamento no canteiro.',
    imageFit: 'contain',
  },
  {
    slug: 'ferramentas-combustao',
    description:
      'Geradores, compactadores, cortadoras a gasolina e equipamentos à combustão para obras sem rede elétrica.',
    imageFit: 'contain',
  },
];
