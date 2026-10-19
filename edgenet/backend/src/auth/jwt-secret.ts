// The key that signs login tokens. Anyone who knows it can sign in as any user, so there is no fallback value.
const PLACEHOLDERS = ['dev-secret', 'change-me', 'secret'];

export function jwtSecret(value: string | undefined, nodeEnv = process.env.NODE_ENV): string {
  if (!value) throw new Error('JWT_SECRET is not set. Put a long random value in backend/.env (or the host\'s environment settings).');
  if (nodeEnv === 'production' && PLACEHOLDERS.includes(value)) {
    throw new Error('JWT_SECRET is still a placeholder. Set a long random value before running in production.');
  }
  return value;
}
