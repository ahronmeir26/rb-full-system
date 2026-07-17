"use client";

import Image from "next/image";
import { KeyRound, LoaderCircle, LockKeyhole, MailCheck } from "lucide-react";
import { FormEvent, useState } from "react";

type Mode = "signin" | "access" | "forgot";

export function LoginForm() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function changeMode(nextMode: Mode) {
    setMode(nextMode);
    setCodeSent(false);
    setCode("");
    setPassword("");
    setError("");
  }

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => null);
      setError(result?.error || "Unable to sign in.");
      setLoading(false);
      return;
    }
    window.location.reload();
  }

  async function requestCode(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch("/api/auth/request-code", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, purpose: mode }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      setError(result?.error || "Unable to send a verification code.");
      setLoading(false);
      return;
    }
    setCodeSent(true);
    setLoading(false);
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch("/api/auth/verify-code", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, code, password }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      setError(result?.error || "Unable to verify the code.");
      setLoading(false);
      return;
    }
    window.location.reload();
  }

  const heading = mode === "signin" ? "Sign in" : mode === "access" ? "Create your password" : "Reset your password";
  const description = mode === "signin"
    ? "Use your managing administrator or school administrator account."
    : codeSent
      ? `Enter the verification code sent to ${email}.`
      : "Enter an administrator email already listed in the system.";

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="login-brand"><Image src="/wordmark.png" alt="A.I.STONE" width={210} height={60} priority /><span>Appreciation Initiative</span></div>
        <div className="login-icon">{mode === "signin" ? <LockKeyhole size={23} /> : codeSent ? <MailCheck size={23} /> : <KeyRound size={23} />}</div>
        <p className="eyebrow">Secure portal</p>
        <h1>{heading}</h1>
        <p>{description}</p>

        {mode === "signin" && <form onSubmit={signIn}>
          <label>Email<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          {error && <div className="login-error" role="alert">{error}</div>}
          <button className="primary-button" disabled={loading}>{loading ? <><LoaderCircle className="spin" size={16} /> Signing in…</> : "Sign in"}</button>
        </form>}

        {mode !== "signin" && !codeSent && <form onSubmit={requestCode}>
          <label>Administrator email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          {error && <div className="login-error" role="alert">{error}</div>}
          <button className="primary-button" disabled={loading}>{loading ? <><LoaderCircle className="spin" size={16} /> Requesting…</> : "Send verification code"}</button>
        </form>}

        {mode !== "signin" && codeSent && <form onSubmit={verifyCode}>
          <label>Verification code<input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} required /></label>
          <label>{mode === "access" ? "Create password" : "New password"}<input type="password" autoComplete="new-password" minLength={10} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          <small className="password-hint">At least 10 characters. Supabase stores only the secure password hash.</small>
          {error && <div className="login-error" role="alert">{error}</div>}
          <button className="primary-button" disabled={loading}>{loading ? <><LoaderCircle className="spin" size={16} /> Verifying…</> : "Verify and continue"}</button>
        </form>}

        <div className="login-links">
          {mode !== "signin" ? <button onClick={() => changeMode("signin")}>Back to sign in</button> : <>
            <button onClick={() => changeMode("access")}>First-time access</button>
            <button onClick={() => changeMode("forgot")}>Forgot password?</button>
          </>}
        </div>
      </section>
    </main>
  );
}
