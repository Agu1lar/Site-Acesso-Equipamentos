'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import type { ClientListItem } from '@/types/client-admin';
import { parseAdminJsonResponse } from '@/lib/admin-fetch';
import {
  EMPTY_HIDDEN_CLIENT_STORE,
  hideClients,
  isClientHidden,
  loadHiddenClientStore,
  type HideableClient,
} from '@/lib/clients-hidden';
import { ClientsAdminToolbar } from '@/components/admin/ClientsAdminToolbar';
import { ClientsMergeDialog } from './ClientsMergeDialog';
import { ClientsTable } from '@/components/admin/ClientsTable';
import { useRouter } from '@/libs/I18nNavigation';

type ClientsTableWithMergeProps = {
  clients: ClientListItem[];
  canManage: boolean;
};

export function ClientsTableWithMerge(props: ClientsTableWithMergeProps) {
  const { clients, canManage } = props;
  const t = useTranslations('ClientsPage');
  const router = useRouter();
  const [hiddenVersion, setHiddenVersion] = useState(0);
  const [storageReady, setStorageReady] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [mergeTargets, setMergeTargets] = useState<ClientListItem[]>([]);
  const [deleteTargets, setDeleteTargets] = useState<ClientListItem[]>([]);
  const [isMerging, setIsMerging] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mergeSuccess, setMergeSuccess] = useState<{ primaryClientId: number } | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<number | null>(null);

  useEffect(() => {
    loadHiddenClientStore();
    setStorageReady(true);
    setHiddenVersion((value) => value + 1);
  }, []);

  const hiddenStore = useMemo(() => {
    if (!storageReady) {
      return EMPTY_HIDDEN_CLIENT_STORE;
    }
    return loadHiddenClientStore();
  }, [hiddenVersion, storageReady]);
  const visibleClients = useMemo(
    () => clients.filter((client) => !isClientHidden(client, hiddenStore)),
    [clients, hiddenStore],
  );

  const selectedClients = visibleClients.filter((client) => selectedIds.includes(client.id));
  const allSelected = visibleClients.length > 0 && selectedIds.length === visibleClients.length;
  const isBusy = isMerging || isDeleting;

  useEffect(() => {
    const visibleIds = new Set(visibleClients.map((client) => client.id));
    setSelectedIds((current) => current.filter((id) => visibleIds.has(id)));
  }, [visibleClients]);

  const dismissFromList = (clientsToHide: HideableClient[]) => {
    if (clientsToHide.length === 0) {
      return;
    }
    hideClients(clientsToHide);
    setHiddenVersion((value) => value + 1);
  };

  const toggleOne = (clientId: number, checked: boolean) => {
    setSelectedIds((current) =>
      checked ? [...new Set([...current, clientId])] : current.filter((id) => id !== clientId),
    );
    setError(null);
    setMergeSuccess(null);
    setDeleteSuccess(null);
  };

  const toggleAll = (checked: boolean) => {
    setSelectedIds(checked ? visibleClients.map((client) => client.id) : []);
    setError(null);
    setMergeSuccess(null);
    setDeleteSuccess(null);
  };

  const runMerge = async () => {
    const ids = mergeTargets.map((client) => client.id);
    if (ids.length < 2) {
      setError(t('merge_error'));
      return;
    }

    setIsMerging(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/clients/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientIds: ids }),
      });

      const body = await parseAdminJsonResponse(response);

      if (!response.ok || !body.primaryClientId) {
        setError(body.error ?? t('merge_error'));
        setIsMerging(false);
        return;
      }

      const duplicateClients = mergeTargets.filter((client) => client.id !== body.primaryClientId);
      dismissFromList(duplicateClients);

      setMergeDialogOpen(false);
      setSelectedIds([]);
      setMergeSuccess({ primaryClientId: body.primaryClientId });
      setDeleteSuccess(null);
      setIsMerging(false);
      router.refresh();
    } catch {
      setError(t('merge_error'));
      setIsMerging(false);
    }
  };

  const runDelete = async () => {
    if (deleteTargets.length === 0) {
      setError(t('delete_error'));
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/clients/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientIds: deleteTargets.map((client) => client.id) }),
      });

      const body = await parseAdminJsonResponse(response);

      if (!response.ok && response.status !== 404) {
        setError(body.error ?? t('delete_error'));
        setIsDeleting(false);
        return;
      }

      dismissFromList(deleteTargets);
      setDeleteDialogOpen(false);
      setSelectedIds([]);
      setDeleteSuccess(deleteTargets.length);
      setMergeSuccess(null);
      setIsDeleting(false);
      router.refresh();
    } catch {
      setError(t('delete_error'));
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {canManage && selectedIds.length >= 1 ? (
        <ClientsAdminToolbar
          canMerge={selectedIds.length >= 2}
          deleteLabel={t('delete_button')}
          label={t('merge_selected_count', { count: selectedIds.length })}
          mergeLabel={t('merge_button')}
          onDelete={() => {
            setDeleteTargets(selectedClients);
            setDeleteDialogOpen(true);
            setError(null);
          }}
          onMerge={() => {
            setMergeTargets(selectedClients);
            setMergeDialogOpen(true);
            setError(null);
          }}
        />
      ) : null}

      {mergeSuccess ? (
        <div className="rounded-[var(--radius-card)] border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
          <p>{t('merge_success')}</p>
          <button
            className="mt-1 font-medium text-primary hover:underline"
            onClick={() => router.push(`/dashboard/clientes/${mergeSuccess.primaryClientId}`)}
            type="button"
          >
            {t('merge_view_result')}
          </button>
        </div>
      ) : null}

      {deleteSuccess !== null ? (
        <div className="rounded-[var(--radius-card)] border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
          {t('delete_success', { count: deleteSuccess })}
        </div>
      ) : null}

      {error ? (
        <p className="rounded-[var(--radius-card)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <ClientsTable
        allSelected={allSelected}
        canManage={canManage}
        clients={visibleClients}
        onToggleAll={toggleAll}
        onToggleOne={toggleOne}
        selectedIds={selectedIds}
      />

      {canManage ? (
        <>
          <ClientsMergeDialog
            cancelLabel={t('merge_cancel_button')}
            clients={mergeTargets}
            confirmLabel={t('merge_confirm_button')}
            description={t('merge_confirm_body')}
            error={mergeDialogOpen ? error : null}
            isBusy={isMerging}
            onClose={() => {
              if (!isBusy) {
                setMergeDialogOpen(false);
              }
            }}
            onConfirm={runMerge}
            open={mergeDialogOpen}
            title={t('merge_confirm_title')}
          />
          <ClientsMergeDialog
            cancelLabel={t('merge_cancel_button')}
            clients={deleteTargets}
            confirmLabel={t('delete_confirm_button')}
            confirmVariant="danger"
            description={t('delete_confirm_body')}
            error={deleteDialogOpen ? error : null}
            isBusy={isDeleting}
            onClose={() => {
              if (!isBusy) {
                setDeleteDialogOpen(false);
              }
            }}
            onConfirm={runDelete}
            open={deleteDialogOpen}
            title={t('delete_confirm_title')}
          />
        </>
      ) : null}
    </div>
  );
}
