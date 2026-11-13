'use client';

import { useEffect } from 'react';

// Instant feedback for every tap on the site:
// - a pressed form button dims and shows a spinner until the page updates;
// - a tapped link starts a thin progress bar at the top until the next page renders.
// Server work can take a moment, and without this a tap looks like nothing happened.
export function PendingFeedback() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let observer: MutationObserver | undefined;
    const clear = () => {
      document.documentElement.classList.remove('nav-busy');
      document.querySelectorAll('.is-busy').forEach((el) => {
        el.classList.remove('is-busy');
        el.removeAttribute('aria-busy');
      });
      observer?.disconnect();
      observer = undefined;
      if (timer) clearTimeout(timer);
    };
    const onSubmit = (e: SubmitEvent) => {
      const btn = (e.submitter as HTMLElement | null) ?? (e.target as HTMLFormElement).querySelector('button[type=submit], button:not([type])');
      if (!btn || e.defaultPrevented) return;
      clear();
      btn.classList.add('is-busy');
      btn.setAttribute('aria-busy', 'true');
      // Clear once React updates the page (the action finished), or after 15 s at most.
      watch();
    };
    const watch = () => {
      requestAnimationFrame(() => {
        observer?.disconnect();
        observer = new MutationObserver((records) => {
          if (records.some((r) => !(r.target instanceof Element && r.target.classList.contains('is-busy')))) clear();
        });
        observer.observe(document.querySelector('main') ?? document.body, { childList: true, subtree: true, characterData: true });
      });
      if (timer) clearTimeout(timer);
      timer = setTimeout(clear, 15000);
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return; // same page or #hash
      clear();
      document.documentElement.classList.add('nav-busy');
      watch();
    };
    document.addEventListener('submit', onSubmit);
    document.addEventListener('click', onClick);
    window.addEventListener('pageshow', clear);
    return () => {
      document.removeEventListener('submit', onSubmit);
      document.removeEventListener('click', onClick);
      window.removeEventListener('pageshow', clear);
      clear();
    };
  }, []);
  return null;
}
