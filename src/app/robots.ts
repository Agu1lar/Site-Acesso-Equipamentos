import type { MetadataRoute } from 'next';
import { AI_CRAWLER_USER_AGENTS } from '@/lib/ai-discovery';
import { shouldBlockSearchIndexing } from '@/utils/deployment';
import { getBaseUrl } from '@/utils/Helpers';

const PUBLIC_DISALLOW = ['/dashboard', '/sign-in', '/api/', '/_next/'];

type RobotsRule = {
  userAgent: string | string[];
  allow?: string | string[];
  disallow?: string | string[];
  crawlDelay?: number;
};

function publicCrawlRules(userAgent: string): RobotsRule {
  return {
    userAgent,
    allow: '/',
    disallow: PUBLIC_DISALLOW,
  };
}

export default function robots(): MetadataRoute.Robots {
  if (shouldBlockSearchIndexing()) {
    return {
      rules: {
        userAgent: '*',
        disallow: '/',
      },
    };
  }

  const baseUrl = getBaseUrl();

  return {
    rules: [
      publicCrawlRules('*'),
      ...AI_CRAWLER_USER_AGENTS.map((userAgent) => publicCrawlRules(userAgent)),
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
