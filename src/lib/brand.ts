import { formatOriginForOutgoingMessage } from '@/lib/analytics-display-labels';

/** Brand & contact constants — Acesso Equipamentos */
export const brand = {
  name: 'Acesso Equipamentos',
  legalName: 'Acesso Equipamentos LTDA',
  foundedYear: 2013,
  phone: '3133763377',
  phoneDisplay: '(31) 3376-3377',
  whatsapp: '5531994700201',
  whatsappDisplay: '(31) 99470-0201',
  email: 'comercial@acessoequipamentos.com.br',
  techSupportEmail: 'tecnologia@acessoequipamentos.com.br',
  /** Canonical public site URL (go-live domain). */
  officialSiteUrl: 'https://acessoequipamentos.com.br',
  instagram: 'acessoequipamentos',
  instagramUrl: 'https://www.instagram.com/acessoequipamentos/',
  linkedinUrl: 'https://www.linkedin.com/company/acesso-equipamentos-ltda',
  footerTagline:
    'Locação de equipamentos para construção civil em Minas Gerais e em todo o território nacional. Empresa desde 2013.',
  address: {
    street: 'Praça Chuí, 100',
    neighborhood: 'João Pinheiro',
    city: 'Belo Horizonte',
    state: 'MG',
    zip: '30530-120',
    full: 'Praça Chuí, 100 — João Pinheiro, Belo Horizonte — MG',
  },
  hours: 'Segunda a sexta, 7h30 às 17h15',
  seoRegion: 'região metropolitana de Belo Horizonte',
  /** Municípios atendidos — LocalBusiness areaServed e copy SEO local. */
  serviceAreaCities: [
    'Belo Horizonte',
    'Contagem',
    'Betim',
    'Nova Lima',
    'Ribeirão das Neves',
    'Santa Luzia',
    'Vespasiano',
    'Sabará',
    'Ibirité',
    'Lagoa Santa',
    'Sarzedo',
    'Brumadinho',
  ],
} as const;

/** Comma-separated service area for SEO copy and schema. */
export function formatBrandServiceArea() {
  const cities = brand.serviceAreaCities;
  if (cities.length <= 4) {
    return cities.join(', ');
  }
  const head = cities.slice(0, 4).join(', ');
  return `${head} e demais municípios da região metropolitana`;
}

export type WhatsAppMessageOptions = {
  equipmentName?: string;
  equipmentSlug?: string;
  /** Assunto livre quando não for locação de item específico (ex.: treinamento) */
  topic?: string;
  /** Identificador de origem para o comercial (ex.: site, home, detalhe) */
  origin?: string;
};

export function buildWhatsAppMessage(
  equipmentOrOptions?: string | WhatsAppMessageOptions,
  legacyOrigin?: string,
): string {
  const options: WhatsAppMessageOptions =
    typeof equipmentOrOptions === 'string'
      ? { equipmentName: equipmentOrOptions, origin: legacyOrigin ?? 'site' }
      : { origin: 'site', ...equipmentOrOptions };

  let item = ' em equipamentos para minha obra';
  if (options.equipmentName) {
    item = ` na locação de ${options.equipmentName}`;
  } else if (options.topic) {
    item = ` sobre ${options.topic}`;
  }
  const ref = options.equipmentSlug ? ` Ref.: ${options.equipmentSlug}.` : '';
  const origin = formatOriginForOutgoingMessage(options.origin ?? 'site');

  return `Olá! Tenho interesse${item} na ${brand.seoRegion}.${ref} Origem: ${origin}. Poderiam enviar um orçamento?`;
}

export function buildWhatsAppUrl(message: string): string {
  return `https://wa.me/${brand.whatsapp}?text=${encodeURIComponent(message)}`;
}

export function buildEquipmentWhatsAppUrl(
  equipment: { name: string; slug: string },
  origin = 'site-detalhe',
): string {
  return buildWhatsAppUrl(
    buildWhatsAppMessage({
      equipmentName: equipment.name,
      equipmentSlug: equipment.slug,
      origin,
    }),
  );
}

/** Título SEO: equipamento ou página institucional */
export function seoTitle(page: string, suffix = brand.name): string {
  return `${page} | ${suffix}`;
}

/** Título SEO para equipamento */
export function equipmentSeoTitle(equipmentName: string): string {
  return `${equipmentName} para locação em BH | ${brand.name}`;
}

