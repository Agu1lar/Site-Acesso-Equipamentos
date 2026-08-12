import { NextResponse } from 'next/server';
import { requireDashboardAccess } from '@/lib/auth-roles';
import { generateBlogDraftWithClaude } from '@/lib/blog-ai';
import { BlogAiRequestSchema } from '@/validations/blog-ai';

export const maxDuration = 180;

/**
 * Generates an editable blog draft for an authenticated dashboard user.
 * @param request Authenticated JSON request containing the article topic.
 * @returns A JSON response containing the draft or a safe error code.
 */
export async function POST(request: Request) {
  const access = await requireDashboardAccess();
  if (!access.ok) {
    return NextResponse.json(
      { error: access.status === 401 ? 'not_authenticated' : 'forbidden' },
      { status: access.status },
    );
  }

  const requestBody = await request.json().catch(() => null);
  const parsed = BlogAiRequestSchema.safeParse(requestBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_topic' }, { status: 400 });
  }

  try {
    const draft = await generateBlogDraftWithClaude(parsed.data.topic, {
      imageSource: parsed.data.imageSource,
    });
    return NextResponse.json({ draft });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'generation_failed';
    let status = 502;
    if (message === 'anthropic_not_configured' || message === 'openai_not_configured' || message === 'openai_no_credits') {
      status = 503;
    }
    return NextResponse.json({ error: message }, { status });
  }
}
