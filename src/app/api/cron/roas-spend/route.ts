import { formatBrasiliaDateOnly } from '@/lib/app-datetime';
import { syncRoasSpend } from '@/lib/roas-panel-store';
import { Env } from '@/libs/Env';
import { logger } from '@/libs/Logger';

export const maxDuration = 60;

function shiftDate(date: string, days: number) {
  const cursor = new Date(`${date}T00:00:00Z`);
  cursor.setUTCDate(cursor.getUTCDate() + days);
  return cursor.toISOString().slice(0, 10);
}

/**
 * Refreshes the last 90 days of media spend for the ROAS panel.
 * @param request Cron request carrying the configured bearer secret.
 * @returns How many spend days were saved.
 */
export async function GET(request: Request) {
  const secret = Env.CRON_SECRET?.trim();
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const dateTo = formatBrasiliaDateOnly();
  const dateFrom = shiftDate(dateTo, -89);
  const days = await syncRoasSpend(dateFrom, dateTo);
  logger.info('ROAS spend refresh completed', { days });

  return Response.json({ success: true, days });
}
