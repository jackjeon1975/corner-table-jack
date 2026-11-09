import Link from 'next/link';

export default function About() {
  return (
    <>
      <h1>Ideas get a table before they get built.</h1>
      <div className="prose">
        {`One person with an idea and AI can now do what used to take a whole company. That makes the early plan matter more than ever — and it means countless projects start and quietly disappear.

Corner Table is a small café table for those projects.

• Share an idea before you build it.
• Design it together, in the open. Ask questions, flag risks.
• The person who started it leads: they pick the scope, the team and the roles.
• Work happens on GitHub and whatever tools the team likes. Progress is posted here, publicly.
• Fans follow along, cheer, and keep the table honest when it goes quiet.
• When a project ends, it leaves a retrospective so the next person can pick it up.`}
      </div>

      <div className="section-title">House rules</div>
      <ul className="small">
        <li>Be kind. Disagree with ideas, not people.</li>
        <li>Don&apos;t post other people&apos;s rights-protected material — logos, art, music, code, ROMs, leaks, or download links you don&apos;t have the right to share.</li>
        <li>Don&apos;t pretend to be an official team or brand.</li>
        <li>Projects are public by design. Don&apos;t post secrets or anyone&apos;s personal information.</li>
      </ul>
      <p className="small">Rights holders can <Link href="/report">report an issue here</Link> without an account.</p>
      <p className="small muted">Contact: <a href="mailto:env042@gmail.com">env042@gmail.com</a></p>
    </>
  );
}
