import { cleanupChatProRetention } from '@/lib/chatpro-retention';
import { Env } from '@/libs/Env';
import { logger } from '@/libs/Logger';

export const maxDuration = 60;

/**
 * Runs the daily ChatPro retention policy from Vercel Cron.
 * @param request Cron request carrying the configured bearer secret.
 * @returns Cleanup counters or an authorization error.
 */
export async function GET(request: Request) {
  const secret = Env.CRON_SECRET?.trim();
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const result = await cleanupChatProRetention();
  logger.info('ChatPro retention completed', result);

  return Response.json({
    success: true,
    ...result,
    cutoff: result.cutoff.toISOString(),
  });
}
