import type { NextRequest } from 'next/server';
import {
  getDashboardSession,
  getDashboardSessionFromRequest,
} from '@/lib/dashboard-session';

const DASHBOARD_ROLES = ['admin', 'comercial'] as const;

export type DashboardRole = (typeof DASHBOARD_ROLES)[number];

type DashboardAccessResult =
  | { ok: true; userId: string; role: DashboardRole; email: string }
  | { ok: false; status: 401 | 403 };

/**
 * Ensures the request is from an authenticated dashboard user.
 */
export async function requireDashboardAccess(): Promise<DashboardAccessResult> {
  const session = await getDashboardSession();
  if (!session) {
    return { ok: false, status: 401 };
  }

  return {
    ok: true,
    userId: String(session.userId),
    role: session.role,
    email: session.email,
  };
}

/**
 * Ensures the request is from an authenticated dashboard user (middleware).
 */
export function requireDashboardAccessFromRequest(
  request: NextRequest,
): DashboardAccessResult {
  const session = getDashboardSessionFromRequest(request);
  if (!session) {
    return { ok: false, status: 401 };
  }

  return {
    ok: true,
    userId: String(session.userId),
    role: session.role,
    email: session.email,
  };
}

/**
 * Ensures the user has admin role (equipment CRUD, settings).
 */
export async function requireAdminAccess(): Promise<DashboardAccessResult> {
  const access = await requireDashboardAccess();
  if (!access.ok) {
    return access;
  }
  if (access.role !== 'admin') {
    return { ok: false, status: 403 };
  }
  return access;
}

/** Returns the signed-in dashboard user's e-mail. */
export async function getDashboardUserEmail(userId: string) {
  const session = await getDashboardSession();
  if (session && String(session.userId) === userId) {
    return session.email;
  }
  return undefined;
}

/**
 * Returns true when pathname is restricted to admin role only.
 */
export function isAdminOnlyDashboardPath(pathname: string) {
  return (
    /\/dashboard\/equipamentos/u.test(pathname)
    || /\/dashboard\/acesso/u.test(pathname)
  );
}

/**
 * Returns true for dashboard modules not yet shipped (blocked in middleware).
 */
export function isDeferredDashboardPath(pathname: string) {
  return (
    /\/dashboard\/exportacoes/u.test(pathname)
    || /\/dashboard\/configuracoes/u.test(pathname)
  );
}
