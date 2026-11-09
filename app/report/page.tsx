import { Notice } from '@/components/ui';
import { rightsReport } from '@/app/actions';

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function RightsReport({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  return (
    <>
      <h1>Report a rights issue</h1>
      <p className="muted">
        If something on Corner Table uses material you own the rights to, tell us here. No account needed.
        We confirm receipt within one business day.
      </p>
      <Notice sp={sp} />
      <form action={rightsReport} className="card">
        <label htmlFor="target_url" style={{ marginTop: 0 }}>Link to the post or project</label>
        <input id="target_url" type="url" name="target_url" required placeholder="https://…" />
        <label htmlFor="contact_email">Your email</label>
        <input id="contact_email" type="email" name="contact_email" required autoComplete="email" />
        <label htmlFor="details">What is the work, who owns it, and what should change?</label>
        <textarea id="details" name="details" required />
        <div className="hint">Your contact details are visible only to the moderation team.</div>
        <div className="row" style={{ marginTop: 10 }}><button type="submit">Send report</button></div>
      </form>
    </>
  );
}
