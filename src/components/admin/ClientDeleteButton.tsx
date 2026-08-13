'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { parseAdminJsonResponse } from '@/lib/admin-fetch';
import { hideClients } from '@/lib/clients-hidden';
import { ClientsMergeDialog } from './ClientsMergeDialog';
import { useRouter } from '@/libs/I18nNavigation';

type ClientDeleteButtonProps = {
  clientId: number;
  displayName: string;
  email: string | null;
  phone: string | null;
  googleSub?: string | null;
};

export function ClientDeleteButton(props: ClientDeleteButtonProps) {
  const t = useTranslations('ClientsPage');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientPreview = {
    id: props.clientId,
    displayName: props.displayName,
    email: props.email,
    phone: props.phone,
    phoneNormalized: null,
    googleSub: props.googleSub ?? null,
    company: null,
    firstSeenAt: new Date(),
    lastActivityAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    leadCount: 0,
    quoteCount: 0,
    cookieConsentCount: 0,
  };

  const runDelete = async () => {
    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/clients/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientIds: [props.clientId] }),
      });

      const body = await parseAdminJsonResponse(response);

      if (!response.ok && response.status !== 404) {
        setError(body.error ?? t('delete_error'));
        setIsDeleting(false);
        return;
      }

      hideClients([clientPreview]);
      setOpen(false);
      setIsDeleting(false);
      router.replace('/dashboard/clientes');
      router.refresh();
    } catch {
      setError(t('delete_error'));
      setIsDeleting(false);
    }
  };

  return (
    <>
      <button
        className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
        onClick={() => {
          setOpen(true);
          setError(null);
        }}
        type="button"
      >
        {t('delete_button')}
      </button>
      <ClientsMergeDialog
        cancelLabel={t('merge_cancel_button')}
        clients={[clientPreview]}
        confirmLabel={t('delete_confirm_button')}
        confirmVariant="danger"
        description={t('delete_confirm_body')}
        error={error}
        isBusy={isDeleting}
        onClose={() => {
          if (!isDeleting) {
            setOpen(false);
          }
        }}
        onConfirm={runDelete}
        open={open}
        title={t('delete_confirm_title')}
      />
    </>
  );
}
