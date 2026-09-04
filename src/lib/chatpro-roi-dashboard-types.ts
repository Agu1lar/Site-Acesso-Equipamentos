import type { ChatProRoiEvaluation } from '@/validations/chatpro-roi';

export type ChatProRoiDashboardEvaluation = {
  id: number;
  leadId: number;
  leadName: string;
  leadStatus: string;
  utmCampaign: string | null;
  evaluatedAt: Date;
  messageCount: number;
  trigger: string;
  stage: ChatProRoiEvaluation['stage'];
  dealLikelihood: number;
  followUpPriority: ChatProRoiEvaluation['followUpPriority'];
  suggestedStatus: ChatProRoiEvaluation['suggestedStatus'];
  divertedToPhone: string | null;
  contractDetected: boolean;
  estimatedMonthlyValueBrl: number | null;
  summary: string;
};
