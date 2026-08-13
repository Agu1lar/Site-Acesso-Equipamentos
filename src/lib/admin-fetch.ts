type AdminJsonBody = {
  error?: string;
  deletedCount?: number;
  archivedCount?: number;
  primaryClientId?: number;
  ok?: boolean;
};

/** Parses admin API JSON without throwing when the body is HTML or empty. */
export async function parseAdminJsonResponse(response: Response): Promise<AdminJsonBody> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return {};
  }

  try {
    return (await response.json()) as AdminJsonBody;
  } catch {
    return {};
  }
}
