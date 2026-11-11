'use client';

import { useEffect, useState } from 'react';

/** Share a post or project to other networks. Plain intent links, plus copy / the phone's share sheet (KakaoTalk etc.). */
export function ShareBar({ url, text }: { url: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(text);
  const links: [string, string][] = [
    ['X', `https://x.com/intent/post?text=${t}&url=${u}`],
    ['LinkedIn', `https://www.linkedin.com/sharing/share-offsite/?url=${u}`],
    ['Threads', `https://www.threads.net/intent/post?text=${encodeURIComponent(`${text} ${url}`)}`],
    ['Facebook', `https://www.facebook.com/sharer/sharer.php?u=${u}`],
    ['Reddit', `https://www.reddit.com/submit?url=${u}&title=${t}`],
  ];
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare(typeof navigator.share === 'function'), []);
  return (
    <div className="share" id="share">
      <span className="small muted">Share</span>
      {links.map(([name, href]) => (
        <a key={name} className="share-btn" href={href} target="_blank" rel="noopener noreferrer">{name}</a>
      ))}
      <button
        type="button"
        className="share-btn"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          } catch {}
        }}
      >
        {copied ? 'Copied ✓' : 'Copy link'}
      </button>
      {canShare && (
        <button type="button" className="share-btn" onClick={() => navigator.share({ title: text, url }).catch(() => {})}>
          More…
        </button>
      )}
    </div>
  );
}
