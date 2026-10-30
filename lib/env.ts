/**
 * Returns the value or throws a clear error naming the missing variable.
 * Pass process.env.NEXT_PUBLIC_* directly so Next.js can inline it.
 */
export function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing environment variable ${name}. See .env.example.`);
  }
  return value;
}
