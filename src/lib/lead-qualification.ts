export const LEAD_QUALIFICATIONS = ['pending', 'qualified', 'unqualified'] as const;

export type LeadQualification = (typeof LEAD_QUALIFICATIONS)[number];

/**
 * Returns true when value is a valid lead qualification.
 * @param value - Candidate qualification value.
 * @returns Whether the value belongs to the supported qualification set.
 */
export function isLeadQualification(value: string): value is LeadQualification {
  return LEAD_QUALIFICATIONS.includes(value as LeadQualification);
}
