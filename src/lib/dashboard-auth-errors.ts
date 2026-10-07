import {
  DASHBOARD_PASSWORD_MIN_LENGTH,
  validateDashboardPassword,
} from '@/lib/dashboard-password-policy';

type AuthErrorLabels = {
  invalidCredentials: string;
  invalidEmail: string;
  passwordTooShort: string;
  passwordTooLong: string;
  passwordMismatch: string;
  rateLimited: string;
  network: string;
  userNotFound: string;
  invalidCode: string;
  codeExpired: string;
  noActiveCode: string;
  tooManyAttempts: string;
  emailSendFailed: string;
  generic: string;
};

/**
 * Maps API auth error codes to user-visible messages.
 */
export function mapAuthApiError(code: string | undefined, labels: AuthErrorLabels) {
  switch (code) {
    case 'invalid_credentials': {
      return labels.invalidCredentials;
    }
    case 'invalid_email': {
      return labels.invalidEmail;
    }
    case 'password_too_short': {
      return labels.passwordTooShort;
    }
    case 'password_too_long': {
      return labels.passwordTooLong;
    }
    case 'rate_limited': {
      return labels.rateLimited;
    }
    case 'user_not_found': {
      return labels.userNotFound;
    }
    case 'invalid_code': {
      return labels.invalidCode;
    }
    case 'code_expired': {
      return labels.codeExpired;
    }
    case 'no_active_code': {
      return labels.noActiveCode;
    }
    case 'too_many_attempts': {
      return labels.tooManyAttempts;
    }
    case 'email_send_failed': {
      return labels.emailSendFailed;
    }
    default: {
      return labels.generic;
    }
  }
}

/**
 * Client-side password validation with field-level message.
 */
export function validatePasswordField(
  password: string,
  labels: Pick<AuthErrorLabels, 'passwordTooShort' | 'passwordTooLong'>,
) {
  const issue = validateDashboardPassword(password);
  if (issue === 'too_short') {
    return labels.passwordTooShort.replace('{min}', String(DASHBOARD_PASSWORD_MIN_LENGTH));
  }
  if (issue === 'too_long') {
    return labels.passwordTooLong;
  }
  return null;
}

export type { AuthErrorLabels };
