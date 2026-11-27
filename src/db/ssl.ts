/**
 * TLS for the Postgres connection, from SQL_SSL:
 * - unset / "false": no TLS (local or private network only)
 * - "true": TLS with certificate checks (Supabase, Neon and most hosted Postgres)
 * - "no-verify": TLS without checking the certificate (Cloud SQL public IP
 *   unless you supply its CA; still encrypted)
 * Set it whenever the database is reached over the internet, e.g. from Netlify.
 */
export function sqlSsl(): false | { rejectUnauthorized: boolean } {
  const v = (process.env.SQL_SSL || '').trim().toLowerCase();
  if (v === 'true' || v === 'require' || v === '1') return { rejectUnauthorized: true };
  if (v === 'no-verify') return { rejectUnauthorized: false };
  return false;
}
