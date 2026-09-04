import { describe, expect, it } from 'vitest';
import {
  dashboardAccessFailurePath,
  isAdminOnlyDashboardPath,
  isDeferredDashboardPath,
} from '@/lib/auth-roles';
import { hashDashboardPassword, verifyDashboardPassword } from '@/lib/dashboard-password';

describe('dashboard password hashing', () => {
  it('verifies a hashed password', () => {
    const hash = hashDashboardPassword('TecnoAcesso123');
    expect(verifyDashboardPassword('TecnoAcesso123', hash)).toBe(true);
    expect(verifyDashboardPassword('wrong', hash)).toBe(false);
  });
});

describe('dashboardAccessFailurePath', () => {
  it('sends untrusted network to the restricted page', () => {
    expect(dashboardAccessFailurePath({ ok: false, status: 403, reason: 'network' })).toBe(
      '/network-restricted',
    );
  });

  it('sends missing session to sign-in', () => {
    expect(dashboardAccessFailurePath({ ok: false, status: 401, reason: 'unauthenticated' })).toBe(
      '/sign-in',
    );
  });

  it('sends forbidden role to unauthorized', () => {
    expect(dashboardAccessFailurePath({ ok: false, status: 403, reason: 'forbidden_role' })).toBe(
      '/unauthorized',
    );
  });
});

describe('isDeferredDashboardPath', () => {
  it('allows analytics dashboard', () => {
    expect(isDeferredDashboardPath('/dashboard/analytics')).toBe(false);
    expect(isDeferredDashboardPath('/pt-BR/dashboard/analytics')).toBe(false);
  });

  it('allows access management dashboard', () => {
    expect(isDeferredDashboardPath('/dashboard/acesso')).toBe(false);
  });

  it('blocks unshipped export and settings routes', () => {
    expect(isDeferredDashboardPath('/dashboard/exportacoes')).toBe(true);
    expect(isDeferredDashboardPath('/dashboard/configuracoes')).toBe(true);
  });
});

describe('isAdminOnlyDashboardPath', () => {
  it('restricts equipment and access routes', () => {
    expect(isAdminOnlyDashboardPath('/dashboard/equipamentos')).toBe(true);
    expect(isAdminOnlyDashboardPath('/dashboard/acesso')).toBe(true);
    expect(isAdminOnlyDashboardPath('/dashboard/leads')).toBe(false);
    expect(isAdminOnlyDashboardPath('/dashboard/dicas')).toBe(false);
  });
});
