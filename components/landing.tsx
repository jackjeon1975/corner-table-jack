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
      <p className="trust small muted">Free to join · Only your public GitHub profile is read · Everything here is public by design</p>

      <h2 className="l-h">Why a table?</h2>
      <p className="l-p">
        With AI, one person can now build what used to take a whole team. So the hard part has moved:
        deciding <b>what</b> to build, and not giving up halfway. Most side projects start alone,
        skip the &ldquo;is this right?&rdquo; conversation, and quietly disappear.
        Corner Table is a small café table for that early stage — a place to think out loud,
        get honest questions, and keep going because people are watching.
      </p>

      <div className="example" aria-label="Example idea">
        <div className="ex-label">Example</div>
        <div className="meta"><span className="badge">Idea</span><b className="ex-who">@mina</b><span>· 2h</span></div>
        <p className="ex-body">
          A neighborhood map of small-shop coupons and pop-up events, so tourists find the places locals love.
          Looking for someone who knows maps and a shop owner to test it.
        </p>
        <div className="ex-replies">
          <div><span className="badge k-question">Question</span> Who updates the coupons — shops or volunteers?</div>
          <div><span className="badge k-risk">Risk</span> Shops may stop posting after the first month.</div>
          <div><span className="badge k-help">Help</span> I&apos;ve built Leaflet maps before. Happy to help.</div>
        </div>
        <div className="ex-foot small muted">♥ 12 cheers · 5 following · Recruiting: designer, tester</div>
      </div>

      <h2 className="l-h">How it works</h2>
      <div className="steps four">
        <div className="step">
          <span className="num">1</span>
          <b>Post an Idea</b>
          <p>Write it the way you&apos;d explain it over coffee. No pitch deck, no polish, no length limit.</p>
        </div>
        <div className="step">
          <span className="num">2</span>
          <b>Open a table</b>
          <p>Turn your Idea into a project with a concept and a first goal. You lead: you pick scope, team and roles.</p>
        </div>
        <div className="step">
          <span className="num">3</span>
          <b>Design in the open</b>
          <p>Post Questions to decide, Risks to watch and Help you need. List what you can&apos;t do alone.</p>
        </div>
        <div className="step">
          <span className="num">4</span>
          <b>Build and share</b>
          <p>Link the GitHub repo, post Updates as you go, and share the result with a short summary.</p>
        </div>
      </div>

      <ol className="stages" aria-label="Project stages">
        <li>Concept</li>
        <li>Design</li>
        <li>Building</li>
        <li>Shared</li>
      </ol>
      <p className="small muted stages-note">
        Every project moves through simple public stages. Moving to Design needs a Question, Building needs a repo,
        Shared needs a result. Go quiet for 14 days and the table shows it. Ending a project? Leave a short
        retrospective so the next person can pick it up.
      </p>

      <div className="two">
        <div className="side">
          <b>If you have an idea</b>
          <ul>
            <li>Get real questions before you spend months building</li>
            <li>Find teammates who ask to join with a role</li>
            <li>Stay accountable with public progress</li>
          </ul>
        </div>
        <div className="side">
          <b>If you want to help</b>
          <ul>
            <li>Join a team as a developer, designer, tester…</li>
            <li>Answer questions and flag risks early</li>
            <li>Follow and cheer projects you want to see shipped</li>
          </ul>
        </div>
      </div>

      <h2 className="l-h">Questions</h2>
      <div className="faq">
        <details>
          <summary>Do I need to be a developer?</summary>
          <p>No. Many ideas start with someone who isn&apos;t. Post the idea, say what you need, and people with the right skills can ask to join.</p>
        </details>
        <details>
          <summary>Who can see my idea?</summary>
          <p>Everyone. Corner Table is public by design — that&apos;s how ideas get feedback and fans. Don&apos;t post secrets or anyone&apos;s personal information.</p>
        </details>
        <details>
          <summary>Why sign in with GitHub?</summary>
          <p>Most building happens there, so projects link to real repos. We only read your public profile (name, handle, avatar).</p>
        </details>
        <details>
          <summary>What if my project stalls?</summary>
          <p>That&apos;s normal. Mark it Paused with a reason, or End it with a retrospective. Nothing is lost — someone else can learn from it.</p>
        </details>
        <details>
          <summary>Does it cost anything?</summary>
          <p>No. Corner Table is free to use.</p>
        </details>
      </div>

      <div className="final card">
        <b>Got an idea you&apos;ve been holding onto?</b>
        <p className="small muted">Give it a table. It takes a minute.</p>
        <Link className="btn" href="/login">Pull up a chair</Link>
      </div>

      <h2 className="l-h latest-h">Latest at the table</h2>
    </section>
  );
}
