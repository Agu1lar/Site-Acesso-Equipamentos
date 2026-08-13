'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AdminCallout } from '@/components/admin/AdminCallout';
import { Button } from '@/components/ui/Button';
import { parseAdminJsonResponse } from '@/lib/admin-fetch';
import { useRouter } from '@/libs/I18nNavigation';

type ArchiveStaleLeadsButtonProps = {
  pendingCount: number;
};

/**
 * Confirms and archives new leads from previous weeks on demand.
 */
export function ArchiveStaleLeadsButton(props: ArchiveStaleLeadsButtonProps) {
  const t = useTranslations('LeadsAdminPage');
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [remainingCount, setRemainingCount] = useState(props.pendingCount);

  useEffect(() => {
    setRemainingCount(props.pendingCount);
  }, [props.pendingCount]);

  useEffect(() => {
    if (!dialogOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isArchiving) {
        setDialogOpen(false);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [dialogOpen, isArchiving]);

  if (remainingCount <= 0 && successCount === null) {
    return null;
  }

  const runArchive = async () => {
    setIsArchiving(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/leads/archive-stale', {
        method: 'POST',
      });
      const body = await parseAdminJsonResponse(response);

      if (!response.ok) {
        setError(typeof body.error === 'string' ? body.error : t('archive_stale_error'));
        setIsArchiving(false);
        return;
      }

      const archivedCount =
        typeof body.archivedCount === 'number' ? body.archivedCount : remainingCount;

      setSuccessCount(archivedCount);
      setRemainingCount(0);
      setDialogOpen(false);
      setIsArchiving(false);
      router.refresh();
    } catch {
      setError(t('archive_stale_error'));
      setIsArchiving(false);
    }
  };

  return (
    <div className="space-y-3">
      {successCount !== null && successCount > 0 ? (
        <AdminCallout variant="tip">{t('archive_stale_success', { count: successCount })}</AdminCallout>
      ) : null}

      {remainingCount > 0 ? (
        <Button
          onClick={() => {
            setError(null);
            setDialogOpen(true);
          }}
          size="sm"
          type="button"
          variant="outline"
        >
          {t('archive_stale_button', { count: remainingCount })}
        </Button>
      ) : null}

      {dialogOpen ? (
        <div
          aria-labelledby="archive-stale-title"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
        >
          <div className="w-full max-w-md rounded-[var(--radius-card)] bg-surface p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-neutral-900" id="archive-stale-title">
              {t('archive_stale_dialog_title')}
            </h2>
            <p className="mt-2 text-sm text-neutral-600">
              {t('archive_stale_dialog_body', { count: remainingCount })}
            </p>

            {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                disabled={isArchiving}
                onClick={() => setDialogOpen(false)}
                type="button"
              >
                {t('archive_stale_cancel')}
              </button>
              <button
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                disabled={isArchiving}
                onClick={() => void runArchive()}
                type="button"
              >
                {isArchiving ? t('archive_stale_running') : t('archive_stale_confirm')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
