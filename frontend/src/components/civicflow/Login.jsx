import { useState } from "react";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!email || !password) {
      setError("Please enter your credentials.");
      return;
    }

    setError("");
    onLogin();
  };

  const handleForgotPassword = () => {
    if (!email) {
      setError("Enter your email address first.");
      return;
    }

    setError(`Password reset instructions sent to ${email}.`);
  };

  const handleSignUp = () => {
    alert("Sign-up portal will be connected to the government authentication service.");
  };

  return (
    <div className="cf-login-page">

      <div className="cf-grid"></div>
      <div className="cf-glow cf-glow-1"></div>
      <div className="cf-glow cf-glow-2"></div>

      {/* HEADER */}
      <header className="cf-login-header">

        <div className="cf-brand">

          <div className="cf-brand-icon">
            CF
          </div>

          <div>
            <div className="cf-brand-name">
              CivicFlow <span>AI</span>
            </div>

            <div className="cf-brand-caption">
              Government Operations Intelligence
            </div>
          </div>

        </div>

        <div className="cf-secure-badge">
          <span></span>
          SECURE GOVERNMENT SYSTEM
        </div>

      </header>


      {/* MAIN */}
      <main className="cf-login-main">

        {/* LEFT SIDE */}

        <div className="cf-login-content">

          <div className="cf-eyebrow">
            CIVICFLOW AI
          </div>

          <h1>
            Predictive intelligence
            <br />
            for <span>public services.</span>
          </h1>

          <p className="cf-login-description">
            Monitor government service delivery, predict operational
            bottlenecks and make faster data-driven decisions.
          </p>

          <div className="cf-feature-row">

            <div>
              <strong>01</strong>
              <span>Predict</span>
            </div>

            <div>
              <strong>02</strong>
              <span>Detect</span>
            </div>

            <div>
              <strong>03</strong>
              <span>Act</span>
            </div>

          </div>

        </div>


        {/* LOGIN CARD */}

        <div className="cf-login-card">

          <div className="cf-card-top">

            <div className="cf-card-icon">
              →
            </div>

            <div>
              <h2>Welcome back</h2>
              <p>Sign in to your operations centre</p>
            </div>

          </div>


          <form onSubmit={handleSubmit}>

            {/* EMAIL */}

            <div className="cf-input-group">

              <label>Email address</label>

              <div className="cf-input-wrapper">

                <span className="cf-input-icon">
                  @
                </span>

                <input
                  type="email"
                  placeholder="officer@gov.in"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError("");
                  }}
                />

              </div>

            </div>


            {/* PASSWORD */}

            <div className="cf-input-group">

              <div className="cf-password-label">

                <label>Password</label>

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword(!showPassword)
                  }
                >
                  {showPassword ? "HIDE" : "SHOW"}
                </button>

              </div>


              <div className="cf-input-wrapper">

                <span className="cf-input-icon">
                  •••
                </span>

                <input
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                />

              </div>

            </div>


            {/* FORGOT PASSWORD */}

            <div className="cf-forgot-row">

              <button
                type="button"
                onClick={handleForgotPassword}
                className="cf-forgot-button"
              >
                Forgot password?
              </button>

            </div>


            {/* ERROR / MESSAGE */}

            {error && (
              <div className="cf-login-error">
                {error}
              </div>
            )}


            {/* LOGIN */}

            <button
              type="submit"
              className="cf-login-button"
            >
              <span>
                Sign in to CivicFlow
              </span>

              <span className="cf-arrow">
                →
              </span>
            </button>

          </form>


          {/* SIGN UP */}

          <div className="cf-signup-section">

            <span>
              New to CivicFlow?
            </span>

            <button
              type="button"
              onClick={handleSignUp}
              className="cf-signup-button"
            >
              Create an account
              <span>→</span>
            </button>

          </div>


          {/* SECURITY */}

          <div className="cf-card-footer">

            <div className="cf-security">

              <div className="cf-security-icon">
                ✓
              </div>

              <div>
                <strong>
                  Secure access
                </strong>

                <span>
                  Protected government environment
                </span>
              </div>

            </div>

          </div>

        </div>

      </main>


      {/* FOOTER */}

      <footer className="cf-login-footer">

        <span>
          © 2026 CivicFlow AI
        </span>

        <span className="cf-footer-dot">
          •
        </span>

        <span>
          Government Service Intelligence Platform
        </span>

        <div className="cf-live-status">

          <span></span>

          SYSTEM OPERATIONAL

        </div>

      </footer>

    </div>
  );
}