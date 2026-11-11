import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Terms · Corner Table', description: 'The simple rules for using Corner Table.' };

export default function Terms() {
  return (
    <div className="prose">
      <h1>Terms of use</h1>
      <p className="muted small">Last updated: November 11, 2026</p>
      <p>By using Corner Table you agree to these terms. They are short on purpose.</p>

      <h2>Sharing in public</h2>
      <ul>
        <li>Corner Table is built for sharing ideas in the open. Anything you post on an idea or project page is public. Do not post anything you need to keep secret.</li>
        <li>You keep the rights to what you post. You allow Corner Table to show it on the site and in share previews.</li>
        <li>Posting an idea does not give anyone exclusive rights to it, and it does not stop others from having similar ideas.</li>
      </ul>

      <h2>Working together</h2>
      <ul>
        <li>Teams form between members. Roles, credit, ownership and any future revenue sharing are agreements between the people on a project — Corner Table is not a party to them. Write down what you agree on early.</li>
        <li>Corner Table does not employ, pay or vouch for members.</li>
      </ul>

      <h2>Be decent</h2>
      <ul>
        <li>No spam, harassment, hateful content, scams, or content you do not have the right to share.</li>
        <li>We may hide content or suspend accounts that break these rules. You can <Link href="/report">report a rights issue</Link> or use the Report button on any post.</li>
      </ul>

      <h2>No guarantees</h2>
      <p>Corner Table is an early, free service provided as is. It may change or stop, and we are not liable for losses from using it or from projects started on it.</p>

      <p>Questions: <a href="mailto:env042@gmail.com">env042@gmail.com</a> · See also our <Link href="/privacy">Privacy</Link> page.</p>
    </div>
  );
}
