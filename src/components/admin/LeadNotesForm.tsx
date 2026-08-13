'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';

type LeadNotesFormProps = {
  leadId: number;
  initialNotes: string;
  fieldLabel: string;
  saveLabel: string;
  savedLabel: string;
  errorMessage: string;
  placeholder: string;
};

/**
 * Saves internal team notes for a lead via PATCH /api/admin/leads/[id]/notes.
 */
export function LeadNotesForm(props: LeadNotesFormProps) {
  const router = useRouter();
  const [notes, setNotes] = useState(props.initialNotes);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  return (
    <form
      className="mt-3 space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setError(null);
        setSaved(false);
        setIsSaving(true);

        const response = await fetch(`/api/admin/leads/${props.leadId}/notes`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ internalNotes: notes }),
        });

        const body = (await response.json()) as { error?: string };

        if (!response.ok) {
          setError(body.error ?? props.errorMessage);
          setIsSaving(false);
          return;
        }

        router.refresh();
        setSaved(true);
        setIsSaving(false);
      }}
    >
      <Textarea
        disabled={isSaving}
        id="leadInternalNotes"
        label={props.fieldLabel}
        onChange={(event) => {
          setNotes(event.target.value);
          setSaved(false);
        }}
        placeholder={props.placeholder}
        rows={4}
        value={notes}
      />
      <Button disabled={isSaving} size="sm" type="submit">
        {props.saveLabel}
      </Button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {saved ? <p className="text-sm text-emerald-700">{props.savedLabel}</p> : null}
    </form>
  );
}
