"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";
import { KeyRound } from "lucide-react";

type GateState = "checking" | "locked" | "open";

async function exchangeToken(token: string) {
  const response = await fetch("/api/session", {
    method: "POST",
    headers: { Authorization: `Bearer ${token.trim()}` },
    cache: "no-store",
  });
  if (response.status === 429) throw new Error("Too many attempts. Wait a minute and try again.");
  if (!response.ok) throw new Error("That access token is not valid.");
}

/**
 * Renders the dashboard only after the browser holds a session cookie. The
 * launcher opens `/#token=…`; the fragment never reaches the server or logs and
 * is removed from the address bar as soon as it has been exchanged.
 */
export function AccessGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>("checking");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const fragmentToken = new URLSearchParams(window.location.hash.slice(1)).get("token");
      if (fragmentToken) {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
        try {
          await exchangeToken(fragmentToken);
          if (!cancelled) setState("open");
          return;
        } catch (exchangeError) {
          if (!cancelled) setError(exchangeError instanceof Error ? exchangeError.message : "Sign-in failed.");
        }
      }
      try {
        const response = await fetch("/api/session", { cache: "no-store" });
        const payload = (await response.json()) as { authenticated?: boolean };
        if (!cancelled) setState(payload.authenticated ? "open" : "locked");
      } catch {
        if (!cancelled) setState("locked");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await exchangeToken(token);
      setToken("");
      setState("open");
    } catch (exchangeError) {
      setError(exchangeError instanceof Error ? exchangeError.message : "Sign-in failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (state === "open") return <>{children}</>;
  if (state === "checking") return <main className="access-gate" aria-busy="true" />;
  return (
    <main className="access-gate">
      <form className="access-gate-card" onSubmit={submit}>
        <span className="access-gate-icon"><KeyRound size={20} aria-hidden /></span>
        <h1>Control Center is locked</h1>
        <p>
          Paste the access token for this installation. <code>npm run launch</code> signs you in
          automatically; otherwise run <code>npm run token</code> (or{" "}
          <code>docker compose exec control-center node scripts/token.mjs</code>) to print it.
        </p>
        <label>
          <span>Access token</span>
          <input
            type="password"
            autoComplete="current-password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            required
            autoFocus
          />
        </label>
        {error ? <p className="access-gate-error" role="alert">{error}</p> : null}
        <button className="button button-primary" type="submit" disabled={submitting || !token.trim()}>
          {submitting ? "Checking…" : "Unlock"}
        </button>
      </form>
    </main>
  );
}
