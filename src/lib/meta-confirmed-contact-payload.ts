import { createHash } from 'node:crypto';

/** Builds a stable, minimal event for a lead's first actual WhatsApp message. */
export function buildMetaConfirmedContactPayload(input: {
  leadId: number;
  phone: string;
  repliedAt: Date;
  context: { consent: true; fbp?: string; fbc?: string };
}, now = new Date()) {
  let phone = input.phone.replace(/\D/g, '');
  if (phone.length === 10 || phone.length === 11) { phone = `55${phone}`; }
  const age = now.getTime() - input.repliedAt.getTime();
  if (!/^55\d{10,11}$/.test(phone) || !Number.isFinite(age) || age < -60_000 || age > 7 * 86_400_000) { return null; }
  return {
    event_name: 'Contact',
    event_id: `whatsapp-confirmed-lead-${input.leadId}`,
    event_time: Math.floor(Math.min(now.getTime(), input.repliedAt.getTime()) / 1000),
    action_source: 'chat',
    user_data: {
      ph: [createHash('sha256').update(phone).digest('hex')],
      ...(input.context.fbp ? { fbp: input.context.fbp } : {}),
      ...(input.context.fbc ? { fbc: input.context.fbc } : {}),
    },
    custom_data: { contact_channel: 'whatsapp', contact_status: 'first_inbound_message' },
  };
}
