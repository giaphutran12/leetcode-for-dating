// Unknown-route state (plan: "Error and failure behavior" — "Unknown route:
// Render a real not-found state"). Not a stub: a proper Taste-voice dead end with
// a way back home and into practice.

import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <main className="taste-page taste-stage">
      <div className="taste-stage__wrap taste-notfound">
        <p className="taste-kicker">404 · Dead end</p>
        <h1>This one didn’t land.</h1>
        <p className="taste-notfound__lede">
          There’s nothing at this address. No shame — happens to the best
          openers. Let’s get you back to something real.
        </p>
        <div className="taste-notfound__actions">
          <Link className="taste-button taste-button--lime" to="/">
            Back home
          </Link>
          <Link className="taste-button taste-button--ghost" to="/practice">
            Go to the curriculum
          </Link>
        </div>
      </div>
    </main>
  );
}
