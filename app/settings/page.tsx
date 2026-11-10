import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { Notice } from '@/components/ui';
import { deleteAccount, logout, updateNotifications, updateProfile } from '@/app/actions';
import { mailConfigured } from '@/lib/mail';

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function Settings({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const me = await currentUser();
  if (!me) redirect('/login?next=/settings');

  return (
    <>
      <h1>Settings</h1>
      <Notice sp={sp} />
      <form action={updateProfile} className="card">
        <label htmlFor="bio" style={{ marginTop: 0 }}>Short intro</label>
        <textarea id="bio" name="bio" maxLength={500} defaultValue={me.bio} placeholder="What are you into? What are you building?" />
        <label htmlFor="can_help">Can help with</label>
        <input id="can_help" type="text" name="can_help" maxLength={200} defaultValue={me.can_help} placeholder="e.g. React, game design, IP law, Korean market, user interviews" />
        <div className="hint">Shown on your profile so project leaders can find you.</div>
        <div className="row" style={{ marginTop: 8 }}><button type="submit">Save</button></div>
      </form>

      <form action={updateNotifications} className="card" id="notifications">
        <label htmlFor="email" style={{ marginTop: 0 }}>Email for notifications</label>
        <input id="email" type="email" name="email" maxLength={254} defaultValue={me.email ?? ''} autoComplete="email" placeholder="you@example.com" />
        <label style={{ fontWeight: 500 }}>
          <input type="checkbox" name="notify_email" value="1" defaultChecked={me.notify_email} /> Email me about replies to my posts, join requests, approvals, and a weekly summary
        </label>
        <div className="hint">
          Only used for these notifications. Never shown to anyone.
          {!mailConfigured() && ' Email sending is not switched on yet — your setting is saved for when it is.'}
        </div>
        <div className="row" style={{ marginTop: 8 }}><button type="submit">Save</button></div>
      </form>

      <form action={logout} className="card row">
        <span className="grow">Signed in as <b>@{me.handle}</b>{me.is_dev ? ' (dev login)' : ''}</span>
        <button className="ghost" type="submit">Sign out</button>
      </form>

      <details className="card">
        <summary>Delete account</summary>
        <p className="small">
          This signs you out everywhere, hides your posts and replies, takes you off every table, and ends the projects you lead.
          Personal data is removed within 30 days.
        </p>
        <form action={deleteAccount} className="row">
          <input className="grow" type="text" name="confirm" required placeholder={`Type ${me.handle} to confirm`} aria-label="Confirm handle" />
          <button className="danger" type="submit">Delete my account</button>
        </form>
      </details>
    </>
  );
}
