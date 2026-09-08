'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { brand } from '@/lib/brand';

type AdminHelpLauncherProps = {
  role: 'admin' | 'comercial';
};

type HelpItem = {
  title: string;
  body: string;
};

type HelpSection = {
  id: string;
  title: string;
  items: HelpItem[];
};

function HelpCircleIcon() {
  return (
    <svg aria-hidden className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
    </svg>
  );
}

/**
 * Floating help control with a guide to dashboard metrics and workflows.
 */
export function AdminHelpLauncher(props: AdminHelpLauncherProps) {
  const t = useTranslations('AdminHelp');
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, close]);

  const sections: HelpSection[] = [
    {
      id: 'navigation',
      title: t('section_navigation_title'),
      items: [
        { title: t('nav_leads_title'), body: t('nav_leads_body') },
        { title: t('nav_clients_title'), body: t('nav_clients_body') },
        { title: t('nav_analytics_title'), body: t('nav_analytics_body') },
        ...(props.role === 'admin'
          ? [{ title: t('nav_equipment_title'), body: t('nav_equipment_body') }]
          : []),
      ],
    },
    {
      id: 'leads',
      title: t('section_leads_title'),
      items: [
        { title: t('leads_queue_title'), body: t('leads_queue_body') },
        { title: t('leads_priority_title'), body: t('leads_priority_body') },
        { title: t('leads_stale_title'), body: t('leads_stale_body') },
        { title: t('leads_status_title'), body: t('leads_status_body') },
        { title: t('leads_export_title'), body: t('leads_export_body') },
        { title: t('leads_attribution_title'), body: t('leads_attribution_body') },
        { title: t('leads_traffic_counters_title'), body: t('leads_traffic_counters_body') },
      ],
    },
    {
      id: 'clients',
      title: t('section_clients_title'),
      items: [
        { title: t('clients_dedup_title'), body: t('clients_dedup_body') },
        { title: t('clients_search_title'), body: t('clients_search_body') },
        { title: t('clients_history_title'), body: t('clients_history_body') },
        ...(props.role === 'admin'
          ? [
              { title: t('clients_merge_title'), body: t('clients_merge_body') },
              { title: t('clients_delete_title'), body: t('clients_delete_body') },
            ]
          : []),
      ],
    },
    {
      id: 'analytics',
      title: t('section_analytics_title'),
      items: [
        { title: t('metric_page_views_title'), body: t('metric_page_views_body') },
        { title: t('metric_active_time_title'), body: t('metric_active_time_body') },
        { title: t('metric_whatsapp_title'), body: t('metric_whatsapp_body') },
        { title: t('metric_leads_title'), body: t('metric_leads_body') },
        { title: t('metric_top_pages_title'), body: t('metric_top_pages_body') },
        { title: t('metric_equipment_conv_title'), body: t('metric_equipment_conv_body') },
        { title: t('metric_whatsapp_origin_title'), body: t('metric_whatsapp_origin_body') },
        { title: t('metric_traffic_source_title'), body: t('metric_traffic_source_body') },
        { title: t('metric_top_equipment_whatsapp_title'), body: t('metric_top_equipment_whatsapp_body') },
        { title: t('metric_top_equipment_leads_title'), body: t('metric_top_equipment_leads_body') },
        { title: t('metric_landing_pages_title'), body: t('metric_landing_pages_body') },
        { title: t('metric_device_title'), body: t('metric_device_body') },
        { title: t('metric_campaigns_title'), body: t('metric_campaigns_body') },
      ],
    },
    ...(props.role === 'admin'
      ? [
          {
            id: 'equipment',
            title: t('section_equipment_title'),
            items: [
              { title: t('equipment_catalog_title'), body: t('equipment_catalog_body') },
              { title: t('equipment_photos_title'), body: t('equipment_photos_body') },
              { title: t('equipment_publish_title'), body: t('equipment_publish_body') },
            ],
          } satisfies HelpSection,
        ]
      : []),
    {
      id: 'support',
      title: t('section_support_title'),
      items: [
        { title: t('support_site_title'), body: t('support_site_body') },
        { title: t('developed_by_title'), body: t('developed_by_body') },
      ],
    },
  ];

  return (
    <>
      <button
        ref={triggerRef}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={t('trigger_label')}
        className="fixed bottom-6 right-5 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-neutral-200 bg-white text-primary shadow-lg ring-1 ring-black/5 transition-colors hover:border-primary/40 hover:bg-primary-light/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:right-8"
        onClick={() => setOpen(true)}
        type="button"
      >
        <HelpCircleIcon />
      </button>

      {open ? (
        <div
          aria-labelledby="admin-help-title"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
          role="dialog"
        >
          <button
            aria-label={t('close_label')}
            className="absolute inset-0 bg-neutral-900/50 backdrop-blur-[2px]"
            onClick={close}
            type="button"
          />
          <div
            ref={panelRef}
            className="relative flex max-h-[min(90vh,42rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl"
          >
            <div className="border-b border-neutral-100 px-5 py-4 sm:px-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-heading text-lg font-bold text-neutral-900" id="admin-help-title">
                    {t('dialog_title')}
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-neutral-600">{t('dialog_intro')}</p>
                </div>
                <button
                  aria-label={t('close_label')}
                  className="shrink-0 rounded-lg p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800"
                  onClick={close}
                  type="button"
                >
                  <span aria-hidden className="text-xl leading-none">
                    ×
                  </span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6">
              <div className="space-y-8">
                {sections.map((section) => (
                  <section key={section.id}>
                    <h3 className="font-heading text-sm font-bold tracking-wide text-primary uppercase">
                      {section.title}
                    </h3>
                    <ul className="mt-3 space-y-4">
                      {section.items.map((item) => (
                        <li key={item.title}>
                          <p className="text-sm font-semibold text-neutral-900">{item.title}</p>
                          <p className="mt-1 text-sm leading-relaxed text-neutral-600">{item.body}</p>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </div>

            <div className="border-t border-neutral-100 px-5 py-3 sm:px-6">
              <p className="text-xs text-neutral-500">{t('support_email_label')}</p>
              <a
                className="mt-1 inline-block text-sm font-semibold text-primary hover:underline"
                href={`mailto:${brand.techSupportEmail}`}
              >
                {brand.techSupportEmail}
              </a>
              <button
                className="mt-3 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
                onClick={close}
                type="button"
              >
                {t('close_button')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
