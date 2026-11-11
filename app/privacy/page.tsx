import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Privacy · Corner Table', description: 'What Corner Table collects and why.' };

export default function Privacy() {
  return (
    <div className="prose">
      <h1>Privacy</h1>
      <p className="muted small">Last updated: November 11, 2026</p>
      <p>Corner Table is a small community where people share ideas before building them. We collect as little as we can.</p>

      <h2>What we collect</h2>
      <ul>
        <li><b>When you sign in with GitHub or Google:</b> your account id from that service, your name, profile picture, and your verified email address. We never get your password, and we never ask for access to your repositories, files or contacts.</li>
        <li><b>What you post:</b> ideas, replies, project pages, cheers, votes, join requests and your profile text. Posts and project pages are public by design.</li>
        <li><b>A sign-in cookie</b> that keeps you signed in. We do not use advertising or tracking cookies.</li>
        <li><b>Anonymous visit statistics</b> (Vercel Web Analytics: page views, country, device type) without cookies, to see whether the site is useful.</li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To run your account and show your posts.</li>
        <li>To email you about replies, join requests and a weekly summary — only if you leave notifications on. You can turn them off any time in <Link href="/settings">Settings</Link>.</li>
        <li>To keep the community safe (reports, moderation, rate limits).</li>
      </ul>
      <p>Your email address is never shown to other people. We do not sell or share your data, and we do not use it for advertising.</p>

      <h2>Where it is stored</h2>
      <p>The site runs on Vercel and the database on Supabase. Email, if switched on, is sent through Resend. These providers process data only to run the service.</p>

      <h2>Your choices</h2>
      <ul>
        <li>Edit or delete your posts at any time.</li>
        <li>Delete your account in <Link href="/settings">Settings</Link>: you are signed out everywhere, your posts are hidden, and personal data is removed within 30 days.</li>
        <li>Questions or requests: <a href="mailto:env042@gmail.com">env042@gmail.com</a></li>
      </ul>
    </div>
  );
}
