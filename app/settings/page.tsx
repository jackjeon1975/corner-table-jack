import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { Notice } from '@/components/ui';
import { deleteAccount, logout, updateProfile } from '@/app/actions';

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
        <textarea id="bio" name="bio" maxLength={500} defaultValue={me.bio} placeholder="What are you into? What could you help with?" />
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
