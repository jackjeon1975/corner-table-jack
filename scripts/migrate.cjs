// Applies db/schema.sql to DATABASE_URL. Usage: npm run db:migrate
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const { sslOption } = require('../lib/ssl.cjs');

(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }
  const client = new Client({ connectionString: url, ssl: sslOption(url) });
  await client.connect();
  await client.query(fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8'));
  await client.end();
  console.log('Schema is up to date.');
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
