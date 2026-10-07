'use client';

import { useTranslations } from 'next-intl';
import { AdminPendingButton } from '@/components/admin/AdminPendingButton';

type BlogUnpublishFormProps = {
  action: (formData: FormData) => void;
  returnTo?: string;
  slug: string;
};

/**
 * Submits unpublish with a browser confirmation prompt.
 */
export function BlogUnpublishForm(props: BlogUnpublishFormProps) {
  const t = useTranslations('BlogAdminPage');
  const tCommon = useTranslations('AdminCommon');

  return (
    <form
      action={props.action}
      onSubmit={(event) => {
        // Native confirmation intentionally protects this destructive action.
        // eslint-disable-next-line no-alert
        if (!window.confirm(t('unpublish_confirm'))) {
          event.preventDefault();
        }
      }}
    >
      {props.returnTo ? <input name="returnTo" type="hidden" value={props.returnTo} /> : null}
      <input name="slug" type="hidden" value={props.slug} />
      <AdminPendingButton
        label={t('unpublish')}
        pendingLabel={tCommon('unpublishing')}
        variant="link"
      />
    </form>
  );
}
