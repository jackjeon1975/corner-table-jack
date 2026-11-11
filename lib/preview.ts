// Reads the title and description of a shared https link (Open Graph / <title>) so posts that
// point to an article, a Remember/LinkedIn post or a blog show a readable card.
// Guarded against SSRF: https only, public IP addresses only (checked on every redirect),
// short timeout and a small read limit. Never throws.
import { lookup } from 'node:dns/promises';
import net from 'node:net';

export type LinkPreview = { title: string | null; description: string | null; site: string | null };

function privateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  if (v.startsWith('::ffff:')) return privateIp(v.slice(7));
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80');
}

async function publicHost(url: URL): Promise<boolean> {
  if (url.protocol !== 'https:' || url.username || url.password) return false;
  if (url.port && url.port !== '443') return false;
  try {
    const addrs = await lookup(url.hostname, { all: true });
    return addrs.length > 0 && addrs.every((a) => !privateIp(a.address));
  } catch {
    return false;
  }
}

const decode = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/\s+/g, ' ').trim();

function meta(html: string, keys: string[]): string | null {
  for (const k of keys) {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${k}["'][^>]*>`, 'i');
    const tag = html.match(re)?.[0];
    const content = tag?.match(/content=["']([^"']*)["']/i)?.[1];
    if (content && content.trim()) return decode(content).slice(0, 300);
  }
  return null;
}

export async function fetchPreview(raw: string): Promise<LinkPreview | null> {
  try {
    let url = new URL(raw);
    for (let hop = 0; hop < 4; hop++) {
      if (!(await publicHost(url))) return null;
      const res = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(4000),
        headers: { 'User-Agent': 'CornerTableBot/1.0 (+link preview)', Accept: 'text/html' },
        cache: 'no-store',
      });
      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
        url = new URL(res.headers.get('location')!, url);
        continue;
      }
      if (!res.ok || !(res.headers.get('content-type') || '').includes('text/html') || !res.body) return null;
      const reader = res.body.getReader();
      let html = '';
      const dec = new TextDecoder();
      while (html.length < 300_000) {
        const { done, value } = await reader.read();
        if (done) break;
        html += dec.decode(value, { stream: true });
        if (/<\/head>/i.test(html)) break;
      }
      reader.cancel().catch(() => {});
      const title = meta(html, ['og:title', 'twitter:title']) ?? (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ? decode(html.match(/<title[^>]*>([^<]*)<\/title>/i)![1]).slice(0, 300) : null);
      const description = meta(html, ['og:description', 'twitter:description', 'description']);
      const site = meta(html, ['og:site_name']);
      if (!title && !description) return null;
      return { title, description, site };
    }
    return null;
  } catch {
    return null;
  }
}
