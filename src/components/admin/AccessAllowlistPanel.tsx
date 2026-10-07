'use client';

import { useState } from 'react';
import {
  addAllowlistEmailAction,
  removeAllowlistEmailAction,
  updateAllowlistPasswordAction,
} from '@/app/actions/access-admin';
import type { DashboardUserListItem } from '@/lib/dashboard-allowlist';
import { validatePasswordField } from '@/lib/dashboard-auth-errors';
import { normalizeAllowlistEmail } from '@/lib/dashboard-allowlist-email';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PasswordField } from '@/components/ui/PasswordField';
import { Select } from '@/components/ui/Select';

type AccessAllowlistPanelProps = {
  entries: DashboardUserListItem[];
  currentEmail: string;
  labels: {
    addTitle: string;
    addHint: string;
    emailLabel: string;
    emailPlaceholder: string;
    passwordLabel: string;
    passwordPlaceholder: string;
    passwordHint: string;
    showPassword: string;
    hidePassword: string;
    errorPasswordTooShort: string;
    errorPasswordTooLong: string;
    roleLabel: string;
    roleAdmin: string;
    roleComercial: string;
    addButton: string;
    listTitle: string;
    emptyList: string;
    colEmail: string;
    colRole: string;
    colPassword: string;
    colAdded: string;
    colActions: string;
    removeButton: string;
    resetPasswordButton: string;
    passwordMissingBadge: string;
    youBadge: string;
    errorInvalid: string;
    errorDuplicate: string;
    errorLastAdmin: string;
    errorGeneric: string;
    errorNetwork: string;
    addingLabel: string;
    successAdded: string;
    successPasswordReset: string;
  };
};

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function mapAllowlistError(
  code: 'unauthorized' | 'invalid' | 'duplicate' | 'last_admin' | 'not_found' | 'generic',
  labels: AccessAllowlistPanelProps['labels'],
) {
  switch (code) {
    case 'duplicate': {
      return labels.errorDuplicate;
    }
    case 'invalid': {
      return labels.errorInvalid;
    }
    case 'last_admin': {
      return labels.errorLastAdmin;
    }
    default: {
      return labels.errorGeneric;
    }
  }
}

export function AccessAllowlistPanel(props: AccessAllowlistPanelProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null);
  const [role, setRole] = useState<'admin' | 'comercial'>('comercial');
  const [isAdding, setIsAdding] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [resettingId, setResettingId] = useState<number | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="font-heading text-lg font-bold text-neutral-900">{props.labels.addTitle}</h2>
        <p className="mt-1 text-sm text-neutral-600">{props.labels.addHint}</p>
        <form
          className="mt-4 grid gap-4 sm:grid-cols-2"
          onSubmit={async (event) => {
            event.preventDefault();
            setError(null);
            setSuccess(null);
            setPasswordError(null);

            const normalizedEmail = normalizeAllowlistEmail(email);
            if (!normalizedEmail) {
              setError(props.labels.errorInvalid);
              return;
            }

            const nextPasswordError = validatePasswordField(password, {
              passwordTooShort: props.labels.errorPasswordTooShort,
              passwordTooLong: props.labels.errorPasswordTooLong,
            });
            if (nextPasswordError) {
              setPasswordError(nextPasswordError);
              return;
            }

            setIsAdding(true);

            try {
              const result = await addAllowlistEmailAction({
                email: normalizedEmail,
                role,
                password,
              });

              if (!result.ok) {
                setError(mapAllowlistError(result.code, props.labels));
                return;
              }

              setEmail('');
              setPassword('');
              setRole('comercial');
              setSuccess(
                props.labels.successAdded.replace('{email}', result.email ?? normalizedEmail),
              );
            } catch {
              setError(props.labels.errorNetwork);
            } finally {
              setIsAdding(false);
            }
          }}
        >
          <Input
            disabled={isAdding}
            label={props.labels.emailLabel}
            name="allowlistEmail"
            onChange={(event) => {
              setEmail(event.target.value);
            }}
            placeholder={props.labels.emailPlaceholder}
            required
            type="email"
            autoComplete="off"
            spellCheck={false}
            value={email}
          />
          <PasswordField
            disabled={isAdding}
            error={passwordError ?? undefined}
            hideLabel={props.labels.hidePassword}
            hint={props.labels.passwordHint}
            label={props.labels.passwordLabel}
            minLength={8}
            name="allowlistPassword"
            onChange={(event) => {
              setPassword(event.target.value);
              setPasswordError(null);
            }}
            placeholder={props.labels.passwordPlaceholder}
            required
            autoComplete="new-password"
            showLabel={props.labels.showPassword}
            value={password}
          />
          <Select
            disabled={isAdding}
            label={props.labels.roleLabel}
            name="allowlistRole"
            onChange={(event) => {
              setRole(event.target.value as 'admin' | 'comercial');
            }}
            value={role}
          >
            <option value="comercial">{props.labels.roleComercial}</option>
            <option value="admin">{props.labels.roleAdmin}</option>
          </Select>
          <div className="flex items-end sm:col-span-2">
            <Button disabled={isAdding} type="submit">
              {isAdding ? props.labels.addingLabel : props.labels.addButton}
            </Button>
          </div>
        </form>
        {success ? <p className="mt-3 text-sm text-green-700">{success}</p> : null}
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </section>

      <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-100 px-5 py-4">
          <h2 className="font-heading text-lg font-bold text-neutral-900">{props.labels.listTitle}</h2>
        </div>
        {props.entries.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-neutral-500">{props.labels.emptyList}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50/80 text-neutral-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">{props.labels.colEmail}</th>
                  <th className="px-4 py-3 font-semibold">{props.labels.colRole}</th>
                  <th className="px-4 py-3 font-semibold">{props.labels.colPassword}</th>
                  <th className="px-4 py-3 font-semibold">{props.labels.colAdded}</th>
                  <th className="px-4 py-3 font-semibold">{props.labels.colActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {props.entries.map((entry) => {
                  const isSelf = entry.email === props.currentEmail;
                  const roleLabel =
                    entry.role === 'admin' ? props.labels.roleAdmin : props.labels.roleComercial;
                  const isResetting = resettingId === entry.id;

                  return (
                    <tr className="hover:bg-neutral-50/80" key={entry.id}>
                      <td className="px-4 py-3">
                        <span className="font-medium text-neutral-900">{entry.email}</span>
                        {isSelf ? (
                          <span className="ml-2 inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            {props.labels.youBadge}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-neutral-700">{roleLabel}</td>
                      <td className="px-4 py-3 text-neutral-700">
                        {entry.hasPassword ? (
                          <span className="text-green-700">OK</span>
                        ) : (
                          <span className="text-amber-700">{props.labels.passwordMissingBadge}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-neutral-600">
                        {formatDateTime(entry.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {isResetting ? (
                            <form
                              className="flex flex-wrap items-end gap-2"
                              onSubmit={async (event) => {
                                event.preventDefault();
                                setError(null);
                                setSuccess(null);
                                setResetPasswordError(null);

                                const nextResetPasswordError = validatePasswordField(resetPassword, {
                                  passwordTooShort: props.labels.errorPasswordTooShort,
                                  passwordTooLong: props.labels.errorPasswordTooLong,
                                });
                                if (nextResetPasswordError) {
                                  setResetPasswordError(nextResetPasswordError);
                                  return;
                                }

                                try {
                                  const result = await updateAllowlistPasswordAction({
                                    id: entry.id,
                                    password: resetPassword,
                                  });

                                  if (!result.ok) {
                                    setError(mapAllowlistError(result.code, props.labels));
                                    return;
                                  }

                                  setResettingId(null);
                                  setResetPassword('');
                                  setSuccess(
                                    props.labels.successPasswordReset.replace(
                                      '{email}',
                                      result.email ?? entry.email,
                                    ),
                                  );
                                } catch {
                                  setError(props.labels.errorNetwork);
                                }
                              }}
                            >
                              <PasswordField
                                error={resetPasswordError ?? undefined}
                                hideLabel={props.labels.hidePassword}
                                label={props.labels.passwordLabel}
                                minLength={8}
                                name={`reset-${entry.id}`}
                                onChange={(event) => {
                                  setResetPassword(event.target.value);
                                  setResetPasswordError(null);
                                }}
                                required
                                showLabel={props.labels.showPassword}
                                value={resetPassword}
                              />
                              <Button size="sm" type="submit">
                                {props.labels.resetPasswordButton}
                              </Button>
                              <Button
                                onClick={() => {
                                  setResettingId(null);
                                  setResetPassword('');
                                }}
                                size="sm"
                                type="button"
                                variant="outline"
                              >
                                Cancelar
                              </Button>
                            </form>
                          ) : (
                            <>
                              <Button
                                onClick={() => {
                                  setResettingId(entry.id);
                                  setResetPassword('');
                                  setResetPasswordError(null);
                                }}
                                size="sm"
                                type="button"
                                variant="outline"
                              >
                                {props.labels.resetPasswordButton}
                              </Button>
                              <Button
                                disabled={removingId === entry.id}
                                onClick={async () => {
                                  setError(null);
                                  setSuccess(null);
                                  setRemovingId(entry.id);

                                  try {
                                    const result = await removeAllowlistEmailAction(entry.id);

                                    if (!result.ok) {
                                      setError(mapAllowlistError(result.code, props.labels));
                                    }
                                  } catch {
                                    setError(props.labels.errorNetwork);
                                  } finally {
                                    setRemovingId(null);
                                  }
                                }}
                                size="sm"
                                type="button"
                                variant="outline"
                              >
                                {props.labels.removeButton}
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {error && props.entries.length > 0 ? (
          <p className="border-t border-neutral-100 px-5 py-3 text-sm text-red-600">{error}</p>
        ) : null}
      </section>
    </div>
  );
}
