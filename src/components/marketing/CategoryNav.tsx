import type { ReactNode } from 'react';
import { CategoryIcon } from '@/components/marketing/CategoryIcon';
import { Link } from '@/libs/I18nNavigation';
import type { EquipmentCategory } from '@/types/equipment';
import { CATEGORY_LABELS } from '@/types/equipment';

function chipClassName(active: boolean, hasIcon: boolean) {
  return [
    'group inline-flex min-h-11 items-center rounded-[var(--radius-card)] border text-left transition duration-200',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
    hasIcon ? 'gap-2.5 px-2.5 py-2 sm:px-3' : 'gap-2 px-3.5 py-2 sm:px-4',
    active
      ? 'border-primary bg-primary text-primary-foreground shadow-sm'
      : 'border-neutral-200 bg-surface text-neutral-800 shadow-sm hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_14px_40px_-20px_rgba(196,30,36,0.35)]',
  ].join(' ');
}

function chipIconWrapClassName(active: boolean) {
  return [
    'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors',
    active
      ? 'bg-white/15 text-primary-foreground'
      : 'bg-primary/[0.08] text-primary group-hover:bg-primary group-hover:text-primary-foreground',
  ].join(' ');
}

type FilterChipContentProps = {
  active: boolean;
  count?: number;
  icon?: ReactNode;
  label: string;
};

function FilterChipContent(props: FilterChipContentProps) {
  return (
    <>
      {props.icon ? (
        <span className={chipIconWrapClassName(props.active)}>{props.icon}</span>
      ) : null}
      <span className="font-heading text-sm font-semibold leading-tight">{props.label}</span>
      {typeof props.count === 'number' ? (
        <span
          className={`ml-auto text-xs font-medium tabular-nums ${
            props.active ? 'text-primary-foreground/80' : 'text-neutral-500'
          }`}
        >
          {props.count}
        </span>
      ) : null}
    </>
  );
}

type FilterChipLinkProps = FilterChipContentProps & {
  href: string;
};

export function FilterChipLink(props: FilterChipLinkProps) {
  return (
    <Link
      aria-current={props.active ? 'page' : undefined}
      className={chipClassName(props.active, Boolean(props.icon))}
      href={props.href}
    >
      <FilterChipContent
        active={props.active}
        count={props.count}
        icon={props.icon}
        label={props.label}
      />
    </Link>
  );
}

type FilterChipButtonProps = FilterChipContentProps & {
  onClick: () => void;
};

export function FilterChipButton(props: FilterChipButtonProps) {
  return (
    <button
      aria-pressed={props.active}
      className={`shrink-0 ${chipClassName(props.active, Boolean(props.icon))}`}
      onClick={props.onClick}
      type="button"
    >
      <FilterChipContent
        active={props.active}
        count={props.count}
        icon={props.icon}
        label={props.label}
      />
    </button>
  );
}

function AllCategoriesIcon() {
  return (
    <svg
      aria-hidden
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.75}
      viewBox="0 0 24 24"
    >
      <rect height="7" rx="1.2" width="7" x="3.5" y="3.5" />
      <rect height="7" rx="1.2" width="7" x="13.5" y="3.5" />
      <rect height="7" rx="1.2" width="7" x="3.5" y="13.5" />
      <rect height="7" rx="1.2" width="7" x="13.5" y="13.5" />
    </svg>
  );
}

type CategoryFilterChipProps = {
  active: boolean;
  count?: number;
  href: string;
  label: string;
  category?: EquipmentCategory;
};

export function CategoryFilterChip(props: CategoryFilterChipProps) {
  return (
    <FilterChipLink
      active={props.active}
      count={props.count}
      href={props.href}
      icon={
        props.category ? (
          <CategoryIcon category={props.category} className="h-5 w-5" />
        ) : (
          <AllCategoriesIcon />
        )
      }
      label={props.label}
    />
  );
}

type CategoryLinkCardProps = {
  category: EquipmentCategory;
  href: string;
  label?: string;
};

export function CategoryLinkCard(props: CategoryLinkCardProps) {
  const label = props.label ?? CATEGORY_LABELS[props.category];

  return (
    <Link
      className="group flex h-full items-center gap-4 rounded-[var(--radius-card)] border border-neutral-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_14px_40px_-20px_rgba(196,30,36,0.35)]"
      href={props.href}
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/[0.08] text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        <CategoryIcon category={props.category} className="h-6 w-6" />
      </span>
      <span className="flex-1 font-heading text-base font-semibold text-neutral-900 group-hover:text-primary sm:text-lg">
        {label}
      </span>
      <span
        aria-hidden
        className="text-primary transition-transform group-hover:translate-x-0.5"
      >
        →
      </span>
    </Link>
  );
}
