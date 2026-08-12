/** Pure helpers for ChatPro ROI worker eligibility — no DB or server-only imports. */

export type CampaignLeadSnapshot = {
  id: number;
  status: string;
  gclid: string | null;
  gbraid: string | null;
  wbraid: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  whatsappRepliedAt: Date | null;
  lastActivityAt: Date | null;
  createdAt: Date;
};

export type ChatProRoiWorkerOptions = {
  /** Stop tracking leads inactive longer than this (days). */
  maxInactiveDays?: number;
  /** Only leads created within this window (days). */
  maxLeadAgeDays?: number;
};

const DEFAULT_MAX_INACTIVE_DAYS = 60;
const DEFAULT_MAX_LEAD_AGE_DAYS = 90;

/** True when lead has paid-search click ids or paid-medium attribution. */
export function leadHasCampaignAttribution(lead: CampaignLeadSnapshot) {
  if (lead.gclid?.trim() || lead.gbraid?.trim() || lead.wbraid?.trim()) {
    return true;
  }
  const medium = lead.utmMedium?.trim().toLowerCase();
  const source = lead.utmSource?.trim().toLowerCase();
  if (medium === 'cpc' || medium === 'ppc' || medium === 'paid') {
    return true;
  }
  if (source?.includes('google') && medium) {
    return true;
  }
  return false;
}

/** True when lead entered ChatPro (replied or has stored messages). */
export function leadHasChatProActivity(lead: CampaignLeadSnapshot, messageCount: number) {
  return Boolean(lead.whatsappRepliedAt) || messageCount > 0;
}

/** Terminal statuses — worker stops daily re-evaluation after these. */
export function isTerminalLeadStatus(status: string) {
  return status === 'won' || status === 'lost';
}

/**
 * Returns true when the local ROI worker should keep evaluating this lead.
 * @param lead Lead snapshot with attribution fields.
 * @param messageCount Total ChatPro messages linked to the lead.
 * @param hasNewMessagesSinceLastEval Whether new messages arrived since last Claude run.
 * @param options Worker tuning options.
 */
export function shouldEvaluateLeadForRoi(
  lead: CampaignLeadSnapshot,
  messageCount: number,
  hasNewMessagesSinceLastEval: boolean,
  options: ChatProRoiWorkerOptions = {},
) {
  const maxInactiveDays = options.maxInactiveDays ?? DEFAULT_MAX_INACTIVE_DAYS;
  const maxLeadAgeDays = options.maxLeadAgeDays ?? DEFAULT_MAX_LEAD_AGE_DAYS;

  if (!leadHasCampaignAttribution(lead)) {
    return false;
  }
  if (!leadHasChatProActivity(lead, messageCount)) {
    return false;
  }
  if (isTerminalLeadStatus(lead.status) && !hasNewMessagesSinceLastEval) {
    return false;
  }

  const now = Date.now();
  const lastTouch = lead.lastActivityAt ?? lead.whatsappRepliedAt ?? lead.createdAt;
  const inactiveDays = (now - lastTouch.getTime()) / (1000 * 60 * 60 * 24);
  if (inactiveDays > maxInactiveDays && !hasNewMessagesSinceLastEval) {
    return false;
  }

  const leadAgeDays = (now - lead.createdAt.getTime()) / (1000 * 60 * 60 * 24);
  if (leadAgeDays > maxLeadAgeDays && !hasNewMessagesSinceLastEval) {
    return false;
  }

  return hasNewMessagesSinceLastEval || !isTerminalLeadStatus(lead.status);
}
