'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { GoogleAdsOfflineConversionResult } from '@/lib/google-ads-offline-conversions';
import { LEAD_QUALIFICATIONS } from '@/lib/lead-qualification';
import type { LeadQualification } from '@/lib/lead-qualification';

type LeadQualificationFormProps = {
  leadId: number;
  currentQualification: string;
  labels: Record<LeadQualification, string>;
  fieldLabel: string;
  saveLabel: string;
  errorMessage: string;
  resultLabels: Record<
    NonNullable<GoogleAdsOfflineConversionResult['reason']> | 'uploaded',
    string
  >;
  savedLabel: string;
};

export function LeadQualificationForm(props: LeadQualificationFormProps) {
  const router = useRouter();
  const selectId = `lead-qualification-${props.leadId}`;
  const [qualification, setQualification] = useState<LeadQualification>(
    LEAD_QUALIFICATIONS.includes(props.currentQualification as LeadQualification)
      ? (props.currentQualification as LeadQualification)
      : 'pending',
  );
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="mt-3 flex flex-wrap items-end gap-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setError(null);
        setMessage(null);
        setIsSaving(true);

        const response = await fetch(`/api/admin/leads/${props.leadId}/qualification`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ qualification }),
        });
        const body = (await response.json()) as {
          error?: string;
          conversion?: GoogleAdsOfflineConversionResult | null;
        };

        if (!response.ok) {
          setError(body.error ?? props.errorMessage);
          setIsSaving(false);
          return;
        }

        const resultKey = body.conversion?.uploaded ? 'uploaded' : body.conversion?.reason;
        setMessage(resultKey ? props.resultLabels[resultKey] : props.savedLabel);
        setIsSaving(false);
        router.refresh();
      }}
    >
      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700" htmlFor={selectId}>
          {props.fieldLabel}
        </label>
        <select
          className="rounded-lg border border-neutral-200 bg-surface px-3 py-2 text-sm"
          disabled={isSaving}
          id={selectId}
          onChange={(event) => {
            setQualification(event.target.value as LeadQualification);
            setMessage(null);
          }}
          value={qualification}
        >
          {LEAD_QUALIFICATIONS.map((value) => (
            <option key={value} value={value}>
              {props.labels[value]}
            </option>
          ))}
        </select>
      </div>
      <Button disabled={isSaving} size="sm" type="submit">
        {props.saveLabel}
      </Button>
      {error ? <p className="w-full text-sm text-red-600">{error}</p> : null}
      {message ? <p className="w-full text-sm text-emerald-700">{message}</p> : null}
    </form>
  );
}
