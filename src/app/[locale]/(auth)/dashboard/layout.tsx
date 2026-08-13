import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminShell } from '@/components/admin/AdminShell';
import { requireDashboardAccess } from '@/lib/auth-roles';
import { redirect } from 'next/navigation';
import { resolveAppLocale } from '@/utils/locale';

type DashboardLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(props: DashboardLayoutProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({
    locale: resolveAppLocale(locale),
    namespace: 'DashboardLayout',
  });

  return {
    title: t('meta_title'),
    description: t('meta_description'),
  };
}

export default async function DashboardLayout(props: DashboardLayoutProps) {
  const { locale } = await props.params;
  setRequestLocale(resolveAppLocale(locale));

  const access = await requireDashboardAccess();
  if (!access.ok) {
    redirect(access.status === 403 ? '/unauthorized' : '/sign-in');
  }

  const t = await getTranslations('DashboardLayout');

  return (
    <AdminShell
      labels={{
        roleAdmin: t('role_admin'),
        roleComercial: t('role_comercial'),
        adminPanelLabel: t('admin_panel_label'),
        adminNavLabel: t('admin_nav_label'),
        navGroupCommercial: t('nav_group_commercial'),
        navGroupCatalog: t('nav_group_catalog'),
        navGroupSettings: t('nav_group_settings'),
        leadsLink: t('leads_link'),
        leadsConsultaLink: t('leads_consulta_link'),
        clientsLink: t('clients_link'),
        analyticsLink: t('analytics_link'),
        chatproRoiLink: t('chatpro_roi_link'),
        blogLink: t('blog_link'),
        blogNewLink: t('blog_new_link'),
        equipmentLink: t('equipment_link'),
        equipmentNewLink: t('equipment_new_link'),
        accessLink: t('access_link'),
        supportTitle: t('support_title'),
        supportHint: t('support_hint'),
        developedBy: t('developed_by'),
        signOut: t('sign_out'),
      }}
      role={access.role}
    >
      {props.children}
    </AdminShell>
  );
}
