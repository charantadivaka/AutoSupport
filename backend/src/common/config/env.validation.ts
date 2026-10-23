/**
 * env.validation.ts
 * -----------------
 * Fail-fast startup validation for required environment variables.
 *
 * Architecture note for interviews:
 *   We intentionally use a lightweight custom validator rather than a full
 *   Joi schema here to avoid adding a heavy dependency for a simple check.
 *   The principle is "fail loudly on startup" - if JWT_SECRET is missing,
 *   we want the process to crash with a clear error message BEFORE it binds
 *   to a port and starts accepting requests with broken auth.
 *
 *   This mirrors the Twelve-Factor App methodology (Config as Environment).
 */

interface EnvSpec {
  key: string;
  description: string;
  required: boolean;
  defaultValue?: string;
}

const ENV_SPECS: EnvSpec[] = [
  {
    key: 'DATABASE_URL',
    description: 'PostgreSQL connection string (required for Prisma ORM)',
    required: true,
  },
  {
    key: 'JWT_SECRET',
    description: 'HS256 signing secret for JWT session tokens',
    required: true,
  },
  {
    key: 'NODE_ENV',
    description: 'Runtime environment (development | production | test)',
    required: false,
    defaultValue: 'development',
  },
  {
    key: 'LLM_PROVIDER',
    description: 'Active AI provider (gemini | openai | mock)',
    required: false,
    defaultValue: 'mock',
  },
  {
    key: 'PORT',
    description: 'HTTP port the NestJS server binds to',
    required: false,
    defaultValue: '4000',
  },
];

/**
 * Validates required environment variables at application startup.
 * Throws an error and exits the process if any required variable is absent.
 * Logs warnings for optional variables using fallback defaults.
 */
export function validateEnvironment(): void {
  if (process.env.NODE_ENV === 'test' || process.env.SKIP_ENV_VALIDATION === 'true') {
    return;
  }

  const missing: string[] = [];
  const warnings: string[] = [];

  for (const spec of ENV_SPECS) {
    const value = process.env[spec.key];

    if (!value) {
      if (spec.required) {
        missing.push(`  - ${spec.key}: ${spec.description}`);
      } else {
        warnings.push(
          `  - ${spec.key} not set; defaulting to "${spec.defaultValue}" (${spec.description})`,
        );
      }
    }
  }

  if (warnings.length > 0) {
    console.warn('\n[ENV] Optional environment variables missing (using defaults):');
    warnings.forEach((w) => console.warn(w));
  }

  if (missing.length > 0) {
    console.error('\n[ENV] FATAL: Required environment variables are not set:');
    missing.forEach((m) => console.error(m));
    console.error(
      '\n[ENV] Copy .env.example to .env.local and fill in the required values.\n',
    );
    process.exit(1);
  }

  const jwtSecret = process.env.JWT_SECRET || '';
  // Bug #16 fix: Catch known insecure dev-secret patterns in production
  const INSECURE_JWT_PATTERNS = [
    'replace-with',
    'dev-insecure',
    'dev-secret',
    'insecure-secret',
    'your-secret',
    'change-me',
    'example',
    'default',
    'placeholder',
  ];
  const isInsecureJwt =
    jwtSecret.length < 32 ||
    INSECURE_JWT_PATTERNS.some((p) => jwtSecret.toLowerCase().includes(p));

  if (process.env.NODE_ENV === 'production') {
    if (isInsecureJwt) {
      console.error(
        '\n[ENV] FATAL: JWT_SECRET in production must be a random string of at least 32 characters that does not contain common insecure patterns.\n',
      );
      process.exit(1);
    }
  } else if (isInsecureJwt) {
    console.warn(
      '\n[ENV] WARNING: JWT_SECRET appears insecure (too short or a known placeholder). Set a strong random secret before deploying to production.\n',
    );
  }
}
