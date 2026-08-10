import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { saveBlogArticleAction } from '@/app/actions/blog-admin';
import { AdminBackLink } from '@/components/admin/AdminBackLink';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { BlogArticleForm } from '@/components/admin/BlogArticleForm';
import { requireDashboardAccess } from '@/lib/auth-roles';
import { blogAdminListPath } from '@/lib/admin-return-path';
import { resolveAppLocale } from '@/utils/locale';

type BlogAdminNewProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; status?: string }>;
};

export async function generateMetadata(props: BlogAdminNewProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({
    locale: resolveAppLocale(locale),
    namespace: 'BlogAdminPage',
  });
  return { title: t('new_meta_title') };
}

export default async function BlogAdminNewPage(props: BlogAdminNewProps) {
  const { locale } = await props.params;
  const searchParams = await props.searchParams;
  setRequestLocale(resolveAppLocale(locale));
  const t = await getTranslations({
    locale: resolveAppLocale(locale),
    namespace: 'BlogAdminPage',
  });
  const tCommon = await getTranslations({
    locale: resolveAppLocale(locale),
    namespace: 'AdminCommon',
  });

  const access = await requireDashboardAccess();
  if (!access.ok) {
    return <p className="py-8 text-sm text-neutral-600">{t('no_permission')}</p>;
  }

  const listPath = blogAdminListPath({
    q: searchParams.q,
    status: searchParams.status,
  });

  return (
    <div className="space-y-8">
      <AdminBackLink href={listPath} label={tCommon('back_to_list')} />
      <AdminPageHeader description={t('new_description')} title={t('new_title')} />
      <BlogArticleForm action={saveBlogArticleAction} returnTo={listPath} showAiGenerator />
    </div>
  );
}
