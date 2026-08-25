import type { EquipmentCategory } from '@/types/equipment';

type CategoryIconProps = {
  category: EquipmentCategory;
  className?: string;
};

/**
 * Line-drawn glyph representing an equipment category.
 * Uses currentColor so it inherits from the surrounding text/badge.
 */
export function CategoryIcon(props: CategoryIconProps) {
  return (
    <svg
      aria-hidden
      className={props.className ?? 'h-6 w-6'}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.75}
      viewBox="0 0 24 24"
    >
      {renderCategoryPaths(props.category)}
    </svg>
  );
}

function renderCategoryPaths(category: EquipmentCategory) {
  if (category === 'plataformas-elevatorias') {
    return (
      <>
        <path d="M4 20h16" />
        <path d="M6 20V9l6-3 6 3v11" />
        <path d="M9 14h6v6" />
      </>
    );
  }
  if (category === 'guindaste-industrial') {
    return (
      <>
        <path d="M4 20h6" />
        <path d="M7 20V5h13" />
        <path d="M20 5l-6 8" />
        <path d="M14 13v3a2 2 0 002 2h2" />
      </>
    );
  }
  if (category === 'manipuladores-telescopicos') {
    return (
      <>
        <path d="M3 18h14" />
        <path d="M6 18v-5l4-2 6 4" />
        <circle cx="7.5" cy="19.5" r="1.6" />
        <circle cx="14.5" cy="19.5" r="1.6" />
        <path d="M17 13l4-3" />
      </>
    );
  }
  if (category === 'andaimes') {
    return (
      <>
        <path d="M4 4v16M20 4v16" />
        <path d="M4 9h16M4 15h16" />
        <path d="M9 4v16M15 4v16" />
      </>
    );
  }
  if (category === 'ferramentas-eletricas') {
    return (
      <>
        <path d="M13 3L5 14h6l-1 7 8-11h-6l1-7z" />
      </>
    );
  }
  return (
    <>
      <path d="M12 3s5 5 5 10a5 5 0 11-10 0c0-3 2-5 5-10z" />
      <path d="M12 18a3 3 0 003-3" />
    </>
  );
}
