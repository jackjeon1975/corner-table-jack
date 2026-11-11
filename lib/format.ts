export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '';
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d`;
  return new Date(iso).toISOString().slice(0, 10);
}

export const daysSince = (iso: string | null | undefined) =>
  iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000) : null;

/** Returns a normalized https URL or null. No other schemes are accepted. */
export function safeHttpsUrl(raw: unknown): string | null {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:' || !u.hostname.includes('.') || u.username || u.password) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** Accepts https://github.com/{owner}/{repo} only. */
export function githubRepoUrl(raw: unknown): string | null {
  const u = safeHttpsUrl(raw);
  if (!u) return null;
  const m = new URL(u);
  const parts = m.pathname.split('/').filter(Boolean);
  if (m.hostname !== 'github.com' || parts.length < 2) return null;
  const ok = /^[A-Za-z0-9-]{1,39}$/.test(parts[0]) && /^[A-Za-z0-9._-]{1,100}$/.test(parts[1]);
  return ok ? `https://github.com/${parts[0]}/${parts[1].replace(/\.git$/, '')}` : null;
}

export const STAGES = ['concept', 'design', 'building', 'shared', 'paused', 'ended'] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABEL: Record<string, string> = {
  concept: 'Concept',
  design: 'Design',
  building: 'Building',
  shared: 'Shared',
  paused: 'Paused',
  ended: 'Ended',
};

export const KIND_LABEL: Record<string, string> = {
  note: 'Note',
  idea: 'Idea',
  partner: 'Looking for a partner',
  ask: 'Ask',
  question: 'Question',
  risk: 'Risk',
  update: 'Update',
  help: 'Help',
  retro: 'Retrospective',
};

export const QUIET_DAYS = 14;
export const MAX_TEXT = 50_000;
