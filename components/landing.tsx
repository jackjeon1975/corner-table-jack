import Link from 'next/link';

// Shown on the home page to visitors who are not signed in.
export function Landing() {
  return (
    <section className="landing" aria-labelledby="landing-title">
      <p className="eyebrow">For solo founders and side-project builders</p>
      <h1 id="landing-title">Ideas get a table before they get built.</h1>
      <p className="lead">
        Share an idea <b>before</b> you build it. Shape it in the open with people who care,
        find teammates, and let fans watch it grow — from first sketch to shipped.
      </p>
      <div className="row cta">
        <Link className="btn" href="/login">Pull up a chair — sign in with GitHub</Link>
        <Link className="btn ghost" href="/explore">Look around first</Link>
      </div>

      <div className="steps">
        <div className="step">
          <span className="num">1</span>
          <b>Share the idea</b>
          <p>Post the idea you have been holding onto. No pitch deck, no polish.</p>
        </div>
        <div className="step">
          <span className="num">2</span>
          <b>Design it together</b>
          <p>Open questions, risks and help-wanted. Others weigh in before a line of code.</p>
        </div>
        <div className="step">
          <span className="num">3</span>
          <b>Build in public</b>
          <p>Pick a team, link the repo, post progress. Fans follow and cheer you on.</p>
        </div>
      </div>

      <ol className="stages" aria-label="Project stages">
        <li>Concept</li>
        <li>Design</li>
        <li>Building</li>
        <li>Shared</li>
      </ol>
      <p className="small muted stages-note">
        Every project moves through simple, public stages. Go quiet for 14 days and the table notices.
      </p>
    </section>
  );
}
