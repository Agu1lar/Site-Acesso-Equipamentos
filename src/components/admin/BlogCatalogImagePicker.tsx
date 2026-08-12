'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import imageManifest from '@/data/equipment-image-manifest.json';

type BlogCatalogImagePickerProps = {
  onSelect: (url: string) => void;
};

const catalogEntries = Object.entries(imageManifest).map(([slug, url]) => ({ slug, url }));

/**
 * Lets the editor pick a real equipment photo as the article cover.
 * @param props Selection callback.
 */
export function BlogCatalogImagePicker(props: BlogCatalogImagePickerProps) {
  const t = useTranslations('BlogArticleForm');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const tokens = query
      .toLowerCase()
      .normalize('NFD')
      .replaceAll(/\p{M}/gu, '')
      .split(/[^a-z0-9]+/u)
      .filter((token) => token.length >= 2);

    const filtered =
      tokens.length === 0
        ? catalogEntries
        : catalogEntries.filter((entry) => {
            const haystack = `${entry.slug} ${entry.url}`.toLowerCase();
            return tokens.every((token) => haystack.includes(token));
          });

    return filtered.slice(0, 24);
  }, [query]);

  return (
    <div className="space-y-3">
      <button
        className="text-sm font-medium text-primary hover:underline"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        {open ? t('cover_catalog_hide') : t('cover_catalog_show')}
      </button>

      {open ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-3">
          <label className="block text-xs font-medium text-neutral-600" htmlFor="blog-cover-catalog-search">
            {t('cover_catalog_search')}
          </label>
          <input
            className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
            id="blog-cover-catalog-search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('cover_catalog_search_placeholder')}
            type="search"
            value={query}
          />
          <ul className="mt-3 grid max-h-72 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
            {matches.map((entry) => (
              <li key={entry.slug}>
                <button
                  className="group w-full overflow-hidden rounded-md border border-neutral-200 bg-neutral-50 text-left hover:border-primary"
                  onClick={() => props.onSelect(entry.url)}
                  title={entry.slug}
                  type="button"
                >
                  <span className="relative block aspect-[4/3] w-full">
                    <Image
                      alt=""
                      className="object-contain object-center p-1"
                      fill
                      sizes="120px"
                      src={entry.url}
                      unoptimized
                    />
                  </span>
                  <span className="block truncate px-1.5 py-1 text-[10px] text-neutral-600 group-hover:text-primary">
                    {entry.slug.replaceAll('-', ' ')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
