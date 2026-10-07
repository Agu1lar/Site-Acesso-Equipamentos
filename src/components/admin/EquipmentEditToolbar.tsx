'use client';

import { useTranslations } from 'next-intl';
import { AdminPendingButton } from '@/components/admin/AdminPendingButton';

type EquipmentEditToolbarProps = {
  archiveAction: (formData: FormData) => void;
  duplicateAction: (formData: FormData) => void;
  returnTo: string;
  slug: string;
};

/**
 * Archive and duplicate actions for equipment edit with loading feedback.
 */
export function EquipmentEditToolbar(props: EquipmentEditToolbarProps) {
  const tPage = useTranslations('EquipmentAdminPage');
  const tCommon = useTranslations('AdminCommon');

  return (
    <div className="flex flex-wrap gap-2">
      <form action={props.duplicateAction}>
        <input name="returnTo" type="hidden" value={props.returnTo} />
        <input name="slug" type="hidden" value={props.slug} />
        <AdminPendingButton
          label={tPage('duplicate')}
          pendingLabel={tCommon('duplicating')}
          variant="default"
        />
      </form>
      <form
        action={props.archiveAction}
        onSubmit={(event) => {
          // Native confirmation intentionally protects this destructive action.
          // eslint-disable-next-line no-alert
          if (!window.confirm(tPage('archive_confirm'))) {
            event.preventDefault();
          }
        }}
      >
        <input name="returnTo" type="hidden" value={props.returnTo} />
        <input name="slug" type="hidden" value={props.slug} />
        <AdminPendingButton
          label={tPage('archive')}
          pendingLabel={tCommon('archiving')}
          variant="danger"
        />
      </form>
    </div>
  );
}
