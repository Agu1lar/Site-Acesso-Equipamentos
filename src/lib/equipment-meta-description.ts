import { brand } from '@/lib/brand';
import { resolveEquipmentLongDescription } from '@/lib/equipment-long-description';
import type { Equipment, EquipmentCategory } from '@/types/equipment';

const META_MAX_LENGTH = 160;

const CATEGORY_META: Record<EquipmentCategory, (name: string) => string> = {
  'plataformas-elevatorias': (name) =>
    `Alugue ${name} (plataforma aérea) em BH e região. Plataforma elevatória revisada, entrega na obra e orçamento rápido.`,
  'guindaste-industrial': (name) =>
    `Locação de ${name} em BH e região. Operação planejada para içamento e remoção. Peça orçamento agora.`,
  'manipuladores-telescopicos': (name) =>
    `Alugue ${name} para movimentação de cargas em obra. Orçamento sob consulta em ${brand.seoRegion}.`,
  andaimes: (name) =>
    `Alugue ${name} para sua obra em BH e RMBH. Atendimento comercial ágil e entrega conforme disponibilidade.`,
  'ferramentas-eletricas': (name) =>
    `Locação de ${name} em BH e RMBH. Retire na loja ou combine entrega — solicite orçamento online.`,
  'ferramentas-combustao': (name) =>
    `Alugue ${name} à combustão para sua obra em BH e região. Frota revisada e orçamento sob consulta.`,
};

function trimMetaDescription(text: string) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= META_MAX_LENGTH) {
    return normalized;
  }

  const cut = normalized.slice(0, META_MAX_LENGTH - 1);
  const lastSpace = cut.lastIndexOf(' ');
  const end = lastSpace > META_MAX_LENGTH * 0.6 ? lastSpace : META_MAX_LENGTH - 1;
  return `${cut.slice(0, end).trim()}…`;
}

function specHighlight(equipment: Equipment) {
  const priorityLabels = [
    'Altura de trabalho',
    'Altura da plataforma',
    'Capacidade máxima',
    'Capacidade da plataforma',
    'Alcance horizontal',
    'Comprimento máximo da lança',
    'Altura máxima de elevação',
    'Capacidade de carga',
    'Capacidade',
    'Aplicação',
  ];
  for (const label of priorityLabels) {
    const spec = equipment.specs.find((item) => item.label === label);
    if (spec?.value) {
      return `${label.toLowerCase()}: ${spec.value}`;
    }
  }
  return null;
}

/** Meta descriptions otimizadas para equipamentos em destaque na home. */
const FEATURED_META_OVERRIDES: Partial<Record<string, string>> = {
  'franna-fr17':
    'Alugue guindaste Franna FR17 (17 t) em BH e região. Pick and carry com lança até 20,40 m. Frota revisada — orçamento pelo site ou WhatsApp.',
  'plataforma-elevatoria-s80':
    'Alugue plataforma Genie S-85 XC E em BH. Lança telescópica: altura 27,91 m e alcance 22,71 m. Entrega na obra — solicite orçamento.',
  'plataforma-elevatoria-s60':
    'Alugue plataforma Genie Z-80/60 articulada em BH. Altura 25,77 m e alcance 18,29 m. Locação com entrega na obra — peça orçamento.',
  'plataforma-elevatoria-gs4655':
    'Alugue tesoura Genie GS-4655 E-Drive em BH. Altura interna 15,95 m e capacidade 350 kg. Frota revisada — orçamento sob consulta.',
  'plataforma-elevatoria-1350sjp':
    'Alugue plataforma JLG 1350SJP em BH e região. Lança telescópica com 41,30 m de altura de plataforma. Ultra Boom — solicite orçamento.',
  'plataforma-aerea-gs-3246':
    'Alugue plataforma aérea Genie GS-3246 (elevatória) em BH. Tesoura ~11,8 m — entrega na obra e orçamento rápido.',
  'plataforma-aerea-articulada-z34':
    'Alugue plataforma aérea articulada JLG Z34 (elevatória) em BH. ~12 m de altura — solicite orçamento.',
  'manipulador-telescopico-mxt840':
    'Alugue manipulador Manitou MXT 840 em BH. Capacidade 4 t e elevação até 7,60 m. Movimentação de cargas em obra — orçamento rápido.',
};

/**
 * Builds a click-oriented meta description distinct from shortDescription and longDescription.
 */
export function buildEquipmentMetaDescription(equipment: Equipment) {
  const override = FEATURED_META_OVERRIDES[equipment.slug];
  if (override) {
    return trimMetaDescription(override);
  }

  const base = CATEGORY_META[equipment.category](equipment.name);
  const highlight = specHighlight(equipment);

  if (!highlight) {
    return trimMetaDescription(base);
  }

  const withSpec = `${base} ${highlight.charAt(0).toUpperCase()}${highlight.slice(1)}.`;
  return trimMetaDescription(withSpec);
}

/**
 * Returns on-page body copy: enriched longDescription or shortDescription fallback.
 */
export function getEquipmentPageBodyDescription(equipment: Equipment) {
  const resolved = resolveEquipmentLongDescription(equipment);
  if (resolved) {
    return resolved;
  }
  return equipment.shortDescription.trim();
}

/**
 * Service/schema summary — prefer technical long copy over catalog blurb.
 */
export function getEquipmentSchemaDescription(equipment: Equipment) {
  return getEquipmentPageBodyDescription(equipment);
}
