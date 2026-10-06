/**
 * Fails application boot immediately with a clear error message if a
 * required environment variable is missing, instead of the previous
 * behaviour of starting anyway and failing confusingly later (e.g. every
 * request 500ing because JWT_ACCESS_SECRET was undefined, or emails
 * silently never sending because MAIL settings were missing).
 */

const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
] as const;

const MIN_SECRET_LENGTH = 32;

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const missing: string[] = [];

  for (const key of REQUIRED_ENV_VARS) {
    const value = config[key];
    if (value === undefined || value === null || value === '') {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. ` +
        'Copy backend/.env.example to backend/.env and fill in real values before starting the server.',
    );
  }

  const isProduction = config.NODE_ENV === 'production';

  for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const) {
    const value = String(config[key] ?? '');
    if (value.length < MIN_SECRET_LENGTH) {
      const msg = `${key} is only ${value.length} characters long; use a random string of at least ${MIN_SECRET_LENGTH} characters (e.g. \`openssl rand -base64 48\`).`;
      if (isProduction) {
        throw new Error(msg);
      }
      // In development, warn instead of blocking local work.
      // eslint-disable-next-line no-console
      console.warn(`[env] Warning: ${msg}`);
    }
  }

  if (
    config.JWT_ACCESS_SECRET &&
    config.JWT_REFRESH_SECRET &&
    config.JWT_ACCESS_SECRET === config.JWT_REFRESH_SECRET
  ) {
    throw new Error(
      'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different values — reusing one secret for both ' +
        'means a leaked access token secret also compromises refresh tokens.',
    );
  }

  if (isProduction && (!config.CLIENT_URL || config.CLIENT_URL === '*')) {
    throw new Error(
      'CLIENT_URL must be set to your real frontend origin (or ALLOWED_ORIGINS to a comma-separated list) in production — CORS cannot be wide open.',
    );
  }

  return config;
}
