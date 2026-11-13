// End-to-end test of the core journey. Run after `npm run build`:
//   npm run test:e2e
// Starts `next start` on a free port with a throwaway database, drives a real
// browser through the main flows, then shuts everything down.
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PORT = Number(process.env.E2E_PORT || 3100);
const B = `http://localhost:${PORT}`;
const S = process.env.E2E_OUT || fs.mkdtempSync(path.join(os.tmpdir(), 'ct-e2e-'));
fs.mkdirSync(S, { recursive: true });
// A dedicated, throwaway database: it is wiped at the start of every run.
const DB = process.env.TEST_DATABASE_URL || 'postgres://ct:ct@localhost:5432/corner_table_test';
const log = (...a) => console.log('✓', ...a);
function check(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); log(msg); }

async function waitForServer(url, ms = 60000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { const r = await fetch(url); if (r.ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('server did not start');
}

async function resetDatabase() {
  const { Client } = require('pg');
  const client = new Client({ connectionString: DB });
  await client.connect();
  await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await client.query(fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8'));
  await client.end();
}

// Pages update after a short server round trip; wait until tap feedback (spinner / progress bar) clears.
function settled(page) {
  const goto = page.goto.bind(page);
  page.goto = async (...args) => {
    const res = await goto(...args);
    await page.waitForSelector('.page-loading', { state: 'detached', timeout: 15000 }).catch(() => {});
    return res;
  };
  const click = page.click.bind(page);
  page.click = async (...args) => {
    const res = await click(...args);
    await page.waitForTimeout(150);
    await page.waitForFunction(() => !document.querySelector('.page-loading, .is-busy'), null, { timeout: 15000 }).catch(() => {});
    return res;
  };
  return page;
}

async function main(browser) {
  const ctxA = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  const A = settled(await ctxA.newPage());
  // Anonymous read
  await A.goto(B + '/');
  check(await A.getByText('The table is empty.').isVisible(), 'empty state shown to visitor');

  // Founder signs in via dev login, returning to /
  await A.goto(B + '/login?next=/');
  await A.fill('input[name=handle]', 'founder');
  await A.click('button:has-text("Sign in")');
  await A.waitForURL(B + '/');
  check(await A.getByText('@founder').first().isVisible(), 'founder signed in');

  // Long idea post (no character limit)
  const longIdea = 'Re-launch a game that failed before AI.\n' + 'We analyse why it failed, fix the problems, and relaunch it in the open. '.repeat(40);
  await A.fill('textarea[name=body]', longIdea);
  await A.selectOption('select[name=kind]', 'idea');
  await A.click('button:has-text("Post")');
  await A.waitForTimeout(400); await A.waitForLoadState('networkidle');
  check(longIdea.length > 2000 && await A.getByText('Show more').isVisible(), `long post (${longIdea.length} chars) accepted and clamped`);

  // Start project
  await A.click('text=Start a project →');
  await A.fill('input[name=title]', 'Second Life for a Lost Game');
  await A.fill('textarea[name=first_goal]', 'A written failure analysis and a 1-level playable prototype.');
  await A.click('button:has-text("Start the project")');
  await A.waitForURL(/\/projects\//);
  const projectUrl = A.url();
  check(await A.getByRole('heading', { name: 'Second Life for a Lost Game' }).isVisible(), 'project created');

  // Design gate: needs a question first
  await A.click('summary:has-text("Change stage")');
  await A.selectOption('select[name=stage]', 'design');
  await A.click('button:has-text("Change stage")');
  await A.waitForTimeout(400); await A.waitForLoadState('networkidle');
  check(await A.getByText('Post at least one design Question').isVisible(), 'design requires a question');

  await A.fill('textarea[name=body]', 'Which failed game should we start with, and how do we handle its IP?');
  await A.selectOption('select[name=kind]', 'question');
  await A.click('form.composer button:has-text("Post")');
  await A.waitForTimeout(400); await A.waitForLoadState('networkidle');
  await A.click('summary:has-text("Change stage")');
  await A.selectOption('select[name=stage]', 'design');
  await A.click('button:has-text("Change stage")');
  await A.waitForTimeout(400); await A.waitForLoadState('networkidle');
  check(await A.locator('.badge.s-design').first().isVisible(), 'moved to Design');

  // Help wanted + recruiting
  await A.fill('input[name=label]', 'IP licensing advice');
  await A.click('button:has-text("Add")');
  await A.waitForTimeout(400); await A.waitForLoadState('networkidle');
  await A.fill('input[name=label]', 'Server credits / AI tokens');
  await A.click('button:has-text("Add")');
  await A.waitForTimeout(400); await A.waitForLoadState('networkidle');
  await A.click('button:has-text("Open recruiting")');
  await A.waitForTimeout(400); await A.waitForLoadState('networkidle');
  check(await A.getByText('Recruiting is open.').isVisible(), 'recruiting opened with 2 needs');

  // Second user: fan who follows and applies
  const ctxB = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const Bp = settled(await ctxB.newPage());
  await Bp.goto(projectUrl);
  check(await Bp.getByText('Sign in to ask to join').isVisible(), 'visitor can read project, prompted to sign in');
  await Bp.goto(B + '/login?next=' + encodeURIComponent(new URL(projectUrl).pathname));
  await Bp.fill('input[name=handle]', 'mina');
  await Bp.click('button:has-text("Sign in")');
  await Bp.waitForURL(projectUrl);
  check(true, 'login returned to project page');
  await Bp.click('button:has-text("Follow")');
  await Bp.waitForTimeout(400); await Bp.waitForLoadState('networkidle');
  await Bp.click('summary:has-text("Ask to join")');
  await Bp.fill('input[name=role]', 'Game designer');
  await Bp.fill('textarea[name=intro]', 'I played it a lot and have notes on why players left.');
  await Bp.click('button:has-text("Send request")');
  await Bp.waitForTimeout(400); await Bp.waitForLoadState('networkidle');
  check(await Bp.getByText('Waiting for the leader').isVisible(), 'join request pending');
  // duplicate request blocked: the form is gone while pending
  check(await Bp.locator('summary:has-text("Ask to join")').count() === 0, 'no duplicate request form while pending');
  // Fan posts a risk
  await Bp.fill('textarea[name=body]', 'Risk: the original publisher still owns the name and characters.');
  await Bp.selectOption('select[name=kind]', 'risk');
  await Bp.click('form.composer button:has-text("Post")');
  await Bp.waitForTimeout(400); await Bp.waitForLoadState('networkidle');
  // Non-members cannot post updates (option not offered)
  check(await Bp.locator('select[name=kind] option[value=update]').count() === 0, 'fan cannot post Update');

  // Founder approves
  await A.reload();
  check(await A.getByText('Requests to join · 1').isVisible(), 'leader sees pending request');
  await A.click('button:has-text("Approve")');
  await A.waitForTimeout(400); await A.waitForLoadState('networkidle');
  check(await A.locator('ul.list >> text=@mina').first().isVisible(), 'mina approved and at the table');

  // Mina posts an update
  await Bp.reload();
  check(await Bp.locator('select[name=kind] option[value=update]').count() === 1, 'member can post Update');
  await Bp.fill('textarea[name=body]', 'Update: finished the first pass of the failure analysis.');
  await Bp.selectOption('select[name=kind]', 'update');
  await Bp.click('form.composer button:has-text("Post")');
  await Bp.waitForTimeout(400); await Bp.waitForLoadState('networkidle');

  // Building requires GitHub repo
  await A.reload();
  await A.click('summary:has-text("Change stage")');
  await A.selectOption('select[name=stage]', 'building');
  await A.fill('input[name=repo_url]', 'https://example.com/not-github');
  await A.click('button:has-text("Change stage")');
  await A.waitForTimeout(400); await A.waitForLoadState('networkidle');
  check(await A.getByText('Building needs a GitHub repository').isVisible(), 'building rejects non-GitHub repo');
  await A.click('summary:has-text("Change stage")');
  await A.selectOption('select[name=stage]', 'building');
  await A.fill('input[name=repo_url]', 'https://github.com/corner-table/second-life');
  await A.click('button:has-text("Change stage")');
  await A.waitForTimeout(400); await A.waitForLoadState('networkidle');
  check(await A.locator('.badge.s-building').first().isVisible(), 'moved to Building');

  // Following feed for mina
  await Bp.goto(B + '/?tab=following');
  check(await Bp.getByText('Moved to Building.').first().isVisible(), 'following feed shows project progress');
  await Bp.screenshot({ path: S + '/shot-mobile-following.png', fullPage: false });

  // Report + moderation
  const firstPost = await A.locator('article.post a[href^="/p/"]').first().getAttribute('href');
  await Bp.goto(B + '/');
  const riskLink = await Bp.locator('article.post:has-text("Risk: the original publisher") a[href^="/p/"]').first().getAttribute('href');
  await A.goto(B + riskLink);
  await A.click('summary:has-text("Report")');
  await A.selectOption('select[name=reason]', 'spam');
  await A.click('button:has-text("Send")');
  await A.waitForTimeout(400); await A.waitForLoadState('networkidle');
  check(await A.getByText('report was received').isVisible(), 'report submitted');
  await A.goto(B + '/ops');
  await A.click('button:has-text("Hide")');
  await A.waitForTimeout(400); await A.waitForLoadState('networkidle');
  const res = await Bp.goto(B + riskLink);
  check(res.status() === 404, 'hidden post returns 404 on direct link');
  await Bp.goto(B + '/');
  check(await Bp.getByText('Risk: the original publisher').count() === 0, 'hidden post removed from feed');

  // XSS: script is rendered as text
  await A.goto(B + '/');
  await A.fill('textarea[name=body]', '<script>window.__x=1</script><img src=x onerror="window.__x=2">');
  await A.click('button:has-text("Post")');
  await A.waitForTimeout(400); await A.waitForLoadState('networkidle');
  check(await A.evaluate(() => window.__x === undefined), 'user HTML rendered as plain text');

  // Bad link scheme rejected
  await A.fill('textarea[name=body]', 'link test');
  await A.fill('input[name=link_url]', 'javascript:alert(1)');
  await A.evaluate(() => document.querySelector('input[name=link_url]').type = 'text');
  await A.click('button:has-text("Post")');
  await A.waitForTimeout(400); await A.waitForLoadState('networkidle');
  check(await A.getByText('Links must start with https://').isVisible(), 'non-https link rejected');

  // "I'd use this" — the author cannot vote, another person can, and it shows on Explore
  await A.goto(B + '/');
  check(await A.locator('button:has-text("I\'d use this")').first().isDisabled(), 'author cannot vote on own idea');
  await Bp.goto(B + '/');
  await Bp.locator('button:has-text("I\'d use this")').first().click();
  await Bp.waitForTimeout(400); await Bp.waitForLoadState('networkidle');
  check(await Bp.getByText("I'd use this · 1").first().isVisible(), 'interest vote counted');
  await Bp.goto(B + '/explore');
  check(await Bp.getByText('Ideas people want').isVisible(), 'explore shows most wanted ideas');

  // Can help with + notification settings
  await A.goto(B + '/settings');
  await A.fill('input[name=can_help]', 'Game design, Unity');
  await A.click('form:has(input[name=can_help]) button:has-text("Save")');
  await A.waitForTimeout(400); await A.waitForLoadState('networkidle');
  await A.fill('input[name=email]', 'founder@example.com');
  await A.click('form#notifications button:has-text("Save")');
  await A.waitForTimeout(400); await A.waitForLoadState('networkidle');
  check(await A.getByText('Notification settings saved.').isVisible(), 'notification settings saved');
  await A.goto(B + '/u/founder');
  check(await A.getByText('Game design, Unity').isVisible(), 'profile shows can help with');

  // "Looking for a partner" post with what I can do / who I'm looking for, listed on Explore, with share links
  await Bp.goto(B + '/');
  await Bp.fill('textarea[name=body]', 'I can build anything but have no idea how to market it.');
  await Bp.selectOption('select[name=kind]', 'partner');
  await Bp.fill('input[name=offer]', 'Full-stack web apps');
  await Bp.fill('input[name=seek]', 'A marketer for launch');
  await Bp.click('form.composer button:has-text("Post")');
  await Bp.waitForTimeout(400); await Bp.waitForLoadState('networkidle');
  await Bp.goto(B + '/explore?kind=partner');
  check(await Bp.getByText('A marketer for launch').first().isVisible(), 'partner post listed with what they are looking for');
  await Bp.locator('article.post a:has-text("Share")').first().click();
  await Bp.waitForLoadState('networkidle');
  check(await Bp.locator('#share a:has-text("LinkedIn")').isVisible(), 'share bar on post page');

  // Explore
  await A.goto(B + '/explore?help=1');
  check(await A.getByText('Needs help · 2').isVisible(), 'explore shows project needing help');

  // Screenshots
  await A.goto(projectUrl);
  await A.screenshot({ path: S + '/shot-desktop-project.png', fullPage: true });
  await A.goto(B + '/');
  await A.screenshot({ path: S + '/shot-desktop-home.png' });
  const w = await Bp.evaluate(() => document.documentElement.scrollWidth);
  check(w <= 390, `no horizontal scroll on 390px (${w})`);
  await Bp.goto(projectUrl);
  await Bp.screenshot({ path: S + '/shot-mobile-project.png' });
}

(async () => {
  await resetDatabase();
  const server = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'start', '-p', String(PORT)], {
    env: { ...process.env, DATABASE_URL: DB, ALLOW_DEV_LOGIN: '1', ADMIN_HANDLES: 'founder', NODE_OPTIONS: '--no-warnings' },
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  let browser;
  let code = 0;
  try {
    await waitForServer(B + '/');
    browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
    await main(browser);
    console.log('ALL PASSED · screenshots in ' + S);
  } catch (e) {
    console.error(e.message);
    code = 1;
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
  process.exit(code);
})();
