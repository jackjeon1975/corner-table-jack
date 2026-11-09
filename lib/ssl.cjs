// SSL settings for Postgres connections.
// DATABASE_SSL=disable    → no TLS (local Postgres)
// DATABASE_SSL=no-verify  → TLS without certificate verification
// DATABASE_CA_CERT=<PEM>  → TLS verified against this CA (Supabase root CA)
// otherwise               → TLS for remote hosts, none for localhost
function caCert() {
  const raw = (process.env.DATABASE_CA_CERT || '').trim();
  if (!raw) return undefined;
  const text = raw.startsWith('-----BEGIN') ? raw : Buffer.from(raw, 'base64').toString('utf8');
  return text.replace(/\\n/g, '\n').trim();
}

function sslOption(url) {
  const mode = process.env.DATABASE_SSL;
  if (mode === 'disable') return false;
  if (mode === 'no-verify') return { rejectUnauthorized: false };
  const ca = caCert();
  if (ca) return { ca, rejectUnauthorized: true };
  try {
    const host = new URL(url).hostname;
    if (host === 'localhost' || host === '127.0.0.1') return false;
  } catch {}
  return true;
}
module.exports = { sslOption };
