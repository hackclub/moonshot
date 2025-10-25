"use client";

import { signIn } from "next-auth/react";
import "./login.css";

// Client Side Login Option Modal
export default function LoginOptions() {

  const callback = "/launchpad/login/success";

  function loginWithSlack() {
    signIn("slack", { callbackUrl: callback });
  }

  function loginWithEmail(form: FormData) {
    const email = form.get("email");

    // If no email is entered in the form, return prematurily
    if (!email) return;
    try {
      // Persist last email for dev-magic-link auto verification on the verify screen
      if (typeof window !== "undefined") {
        window.localStorage.setItem("lastAuthEmail", String(email));
      }
    } catch {}

    signIn("email", { email, callbackUrl: callback });
  }

  async function loginWithHcIdentity() {
    const response = await fetch("/api/identity/url?redirect_uri=" + encodeURIComponent("launchpad/login"));
    const data = await response.json();
    window.open(data.url, '_blank');
  }

  return (
    <div className="login-standalone">
      {/* Dynamic stellar background */}
      <div className="stellar-background" aria-hidden="true">
        <div className="nebula-layer"></div>
        <div className="starfield-layer"></div>
        <div className="shooting-stars"></div>
      </div>

      <div className="container">
        <h1 className="title">🚀 Launchpad Login</h1>

        <div className="login-card">
          <p className="description">
            Enter your email to sign in.
          </p>

          <form action={loginWithEmail} className="email-form">
            <input
              className="email-input"
              name="email"
              placeholder="Enter your email address"
              type="email"
              required
            />
            <button type="submit" className="submit-button">
              Sign In with Email
            </button>
          </form>
        </div>

        {/* Floating astronaut icon */}
        <img
          src="/img/sticker-astronaut.png"
          alt="Astronaut"
          className="rocket-icon"
        />
      </div>
    </div>
  );
}


