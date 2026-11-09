// SSL settings for Postgres connections.
// DATABASE_SSL=disable    → no TLS (local Postgres)
// DATABASE_SSL=no-verify  → TLS without certificate verification
// otherwise               → TLS for remote hosts, none for localhost
function sslOption(url) {
  const mode = process.env.DATABASE_SSL;
  if (mode === 'disable') return false;
  if (mode === 'no-verify') return { rejectUnauthorized: false };
  try {
    const host = new URL(url).hostname;
    if (host === 'localhost' || host === '127.0.0.1') return false;
  } catch {}
  return true;
}
module.exports = { sslOption };
