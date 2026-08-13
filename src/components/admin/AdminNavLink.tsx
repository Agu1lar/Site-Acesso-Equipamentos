'use client';

import { usePathname } from 'next/navigation';
import {
  IconAccess,
  IconAnalytics,
  IconBlog,
  IconChatPro,
  IconClients,
  IconEquipment,
  IconLeads,
  IconPlus,
  IconSearch,
} from '@/components/admin/admin-icons';
import { isAdminNavActive } from '@/lib/admin-nav';
import { Link } from '@/libs/I18nNavigation';

export type AdminNavIcon = 'leads' | 'clients' | 'analytics' | 'chatpro' | 'equipment' | 'blog' | 'plus' | 'access' | 'search';

const navIcons = {
  leads: IconLeads,
  clients: IconClients,
  analytics: IconAnalytics,
  chatpro: IconChatPro,
  equipment: IconEquipment,
  blog: IconBlog,
  plus: IconPlus,
  access: IconAccess,
  search: IconSearch,
} as const;

type AdminNavLinkProps = {
  href: string;
  label: string;
  icon?: AdminNavIcon;
};

/**
 * Sidebar navigation link with active state for the admin shell.
 */
export function AdminNavLink(props: AdminNavLinkProps) {
  const pathname = usePathname();
  const active = isAdminNavActive(pathname, props.href);
  const Icon = props.icon ? navIcons[props.icon] : null;

  return (
    <Link
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
        active
          ? 'bg-white/10 text-white shadow-sm ring-1 ring-white/10'
          : 'text-slate-300 hover:bg-white/5 hover:text-white'
      }`}
      href={props.href}
    >
      {Icon ? (
        <span className="shrink-0 opacity-90">
          <Icon />
        </span>
      ) : null}
      <span>{props.label}</span>
    </Link>
  );
}
