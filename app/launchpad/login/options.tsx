"use client";

import { signIn } from "next-auth/react";
import { useEffect } from "react";

// Client Side Login Option Modal
export default function LoginOptions() {
  const callback = "/launchpad/login/success";

    async function hcIdvLogin() {
        window.location.href = '/api/identity/start';
    }

  function loginWithSlack() {
    signIn("slack", { callbackUrl: callback });
  }

  function loginWithEmail(form: FormData) {
    const email = form.get("email");

    // If no email is entered in the form, return prematurily
    if (!email) return;
    try {
      // Persist last email for dev-magic-link auto verification on the verify screen
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('lastAuthEmail', String(email));
      }
    } catch {}

    signIn("email", { email, callbackUrl: callback });
  }

  return (
    <>
      <div className="flex justify-center flex-col items-center my-4 rounded-lg bg-[#0f1623] text-[var(--foreground)] p-2 border border-white/10">
        <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--foreground)' }}>Login to the Launchpad</h2>
        <p className="text-base mb-2 max-w-xs text-center break-words" style={{ color: 'var(--foreground)' }}>Use the same email / slack account on your Hackatime account to sign in! You do not need to have a Moonshot account to begin.</p>
        <button className="my-2 cursor-pointer" onClick={loginWithSlack}>
          <img
            src="https://platform.slack-edge.com/img/sign_in_with_slack.png"
            srcSet="https://platform.slack-edge.com/img/sign_in_with_slack.png 1x, https://platform.slack-edge.com/img/sign_in_with_slack@2x.png 2x"
          />
        </button>

        <p className="mb-.5 mt-2 text-lg" style={{ color: 'var(--foreground)' }}> or </p>

        <button onClick={() => hcIdvLogin()}>
            Hack Club Identity Login
        </button>

        <form action={loginWithEmail} className="flex flex-row items-center gap-2 w-full flex-nowrap" style={{ minWidth: 0 }}>
            <input
            className="flex-grow min-w-0 px-4 py-3 rounded-lg border border-white/20 bg-[#0b1220] text-[var(--foreground)] placeholder-white/50 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              name="email"
              placeholder="Email"
              type="email"
            required
            />
          <button
            type="submit"
            className="flex-shrink-0 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium whitespace-nowrap cursor-pointer"
            style={{ minWidth: 80 }}
          >
              Sign In
            </button>
        </form>
      </div>
    </>
  );
}
