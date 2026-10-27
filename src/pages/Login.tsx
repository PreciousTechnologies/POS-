import { useEffect, useRef, useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import LiquidGlass from "simple-liquid-glass";
import { LiquidGlassScene } from "simple-liquid-glass/backdrop";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Boxes,
  Eye,
  EyeOff,
  LockKeyhole,
  Printer,
  ScanBarcode,
  ShieldCheck,
  Sparkles,
  Store,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ThemeToggle, useTheme } from "@/lib/theme";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { BootScreen } from "@/components/ui/States";

const demoAccounts = [
  { username: "admin", password: "admin123", name: "Amina", role: "Administrator" },
  { username: "cashier", password: "cashier123", name: "Joseph", role: "Cashier" },
];

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);
  const signInRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!showLogin) return;
    const timer = window.setTimeout(() => {
      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      pageRef.current?.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
      usernameRef.current?.focus({ preventScroll: true });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [showLogin]);

  if (loading) return <BootScreen label="Preparing your counter" />;

  if (user) {
    const destination = (location.state as { from?: string } | null)?.from ?? "/dashboard";
    return <Navigate to={destination} replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!username.trim() || !password) {
      setError("Enter your username and password.");
      return;
    }
    setSubmitting(true);
    try {
      await login(username.trim(), password);
      const destination = (location.state as { from?: string } | null)?.from ?? "/dashboard";
      navigate(destination, { replace: true });
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Could not sign in right now. Check the server and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemo = (account: (typeof demoAccounts)[number]) => {
    setUsername(account.username);
    setPassword(account.password);
    setError(null);
  };

  const handleShowLogin = () => setShowLogin(true);

  const handleShowLanding = () => {
    setShowLogin(false);
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    pageRef.current?.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    window.setTimeout(() => signInRef.current?.focus(), 80);
  };

  return (
    <div className={`login-page${showLogin ? " is-login-step" : ""}`} ref={pageRef}>
      <LiquidGlassScene className="login-scene" aria-hidden="true">
        <div className="login-aurora login-aurora-a animate-drift" />
        <div className="login-aurora login-aurora-b animate-float" />
        <div className="login-aurora login-aurora-c animate-drift" />
        <div className="login-grid" />
      </LiquidGlassScene>

      <div className="login-content">
        <section className="login-art">
          <div className="login-brand">
            <div className="brand-mark">
              <Store size={25} strokeWidth={1.6} />
            </div>
            <div>
              <div className="login-brand-name">Kariakoo POS</div>
              <div className="login-brand-meta">Kariakoo Mini Market · Tanzania</div>
            </div>
          </div>

          <h1 className="login-headline">
            The calm counter for a busy <em>Kariakoo</em> day.
          </h1>
          <p className="login-copy">
            Sell faster, keep stock honest, and close the day with numbers you can trust. One
            workspace for the counter, the shelves, and the back office.
          </p>

          <div className="login-mobile-cta">
            <Button
              ref={signInRef}
              size="lg"
              onClick={handleShowLogin}
              rightIcon={<ArrowRight size={15} />}
            >
              Sign in to the counter
            </Button>
            <p className="login-mobile-note">One-tap demo accounts are on the next screen.</p>
          </div>

          <div className="login-preview">
            <div className="login-preview-head">
              <span className="login-mini-label">Counter preview</span>
              <span className="badge badge-neutral">Sample sale</span>
            </div>
            <div className="login-preview-lines">
              <div className="login-preview-line">
                <span>
                  Jasmine rice 5kg <small>× 1</small>
                </span>
                <strong>TZS 14,500</strong>
              </div>
              <div className="login-preview-line">
                <span>
                  Sunflower oil 1L <small>× 2</small>
                </span>
                <strong>TZS 7,000</strong>
              </div>
              <div className="login-preview-line">
                <span>
                  Fresh bread <small>× 3</small>
                </span>
                <strong>TZS 3,600</strong>
              </div>
            </div>
            <div className="login-preview-total">
              <span>
                Total <small>3 lines · 6 units</small>
              </span>
              <strong>TZS 25,100</strong>
            </div>
            <div className="login-preview-pay" role="group" aria-label="Sample payment options">
              <span className="is-active">Cash</span>
              <span>Mobile money</span>
              <span>Card</span>
            </div>
            <div className="login-preview-foot">
              <span>
                <ScanBarcode size={11} /> Barcode ready
              </span>
              <span>
                <Printer size={11} /> 80mm receipt
              </span>
              <span>
                <ShieldCheck size={11} /> Stock updated
              </span>
            </div>
          </div>

          <div className="login-section-label">What&rsquo;s inside</div>
          <div className="login-features">
            <div className="login-feature">
              <div className="login-feature-icon">
                <ScanBarcode size={14} />
              </div>
              <div>
                <div className="login-feature-title">Scan or search</div>
                <p>Barcode, name, or SKU. Keep the queue moving.</p>
              </div>
            </div>
            <div className="login-feature">
              <div className="login-feature-icon">
                <Wallet size={14} />
              </div>
              <div>
                <div className="login-feature-title">Take any payment</div>
                <p>Cash, mobile money, and card in one flow.</p>
              </div>
            </div>
            <div className="login-feature">
              <div className="login-feature-icon">
                <Boxes size={14} />
              </div>
              <div>
                <div className="login-feature-title">Stock that stays true</div>
                <p>Live levels and low-stock flags on every sale.</p>
              </div>
            </div>
            <div className="login-feature">
              <div className="login-feature-icon">
                <BarChart3 size={14} />
              </div>
              <div>
                <div className="login-feature-title">Close with clarity</div>
                <p>Shift totals, margin, and a clean audit trail.</p>
              </div>
            </div>
          </div>

          <div className="login-role-card">
            <div className="login-role-head">
              <span className="login-mini-label">One workspace, two views</span>
              <span className="badge badge-neutral">2 roles</span>
            </div>
            <div className="login-role-grid">
              <div>
                <div className="login-role-title">
                  <ShieldCheck size={12} /> Admin
                </div>
                <ul className="login-role-list">
                  <li>Sales, profit, and reports</li>
                  <li>Refunds, voids, and audit</li>
                  <li>Team, products, settings</li>
                </ul>
              </div>
              <div>
                <div className="login-role-title">
                  <Users size={12} /> Cashier
                </div>
                <ul className="login-role-list">
                  <li>Fast counter checkout</li>
                  <li>Own sales and shift totals</li>
                  <li>Guided discount limits</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="login-trust">
            <span>
              <ShieldCheck size={12} /> Role-aware sessions
            </span>
            <span>
              <Printer size={12} /> Thermal receipts
            </span>
            <span>
              <Sparkles size={12} /> Demo data
            </span>
          </div>
          <p className="login-landing-note">
            Kariakoo Mini Market · Dar es Salaam · Demo environment, no real money moves.
          </p>

          <div className="login-mobile-cta login-mobile-cta-end">
            <Button size="lg" onClick={handleShowLogin} rightIcon={<ArrowRight size={15} />}>
              Sign in to the counter
            </Button>
            <p className="login-mobile-note">Admin and cashier demo accounts are included.</p>
          </div>
        </section>

        <div className="login-card-wrap">
          <LiquidGlass
            className="login-glass"
            material="frosted"
            radius={32}
            blur={18}
            saturation={160}
            frost={0.22}
            dispersion={30}
            displace={6}
            lightness={theme === "dark" ? 27 : 92}
            alpha={0.58}
            border={0.04}
            glassColor={theme === "dark" ? "rgba(25, 20, 35, 0.5)" : "rgba(255, 255, 255, 0.44)"}
            borderColor={theme === "dark" ? "rgba(255, 255, 255, 0.15)" : "rgba(255, 255, 255, 0.72)"}
            autoTextColor={false}
            reveal="immediate"
            quality="standard"
          >
            <div className="login-card">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="login-mobile-back"
                    onClick={handleShowLanding}
                    aria-label="Back to overview"
                  >
                    <ArrowLeft size={15} />
                  </Button>
                  <span className="login-kicker">
                    <ShieldCheck size={12} />
                    Secure workspace
                  </span>
                </div>
                <ThemeToggle />
              </div>

              <div className="mt-5 flex items-center gap-2 lg:hidden">
                <div className="brand-mark" style={{ width: 34, height: 34, borderRadius: 11 }}>
                  <Store size={17} />
                </div>
                <div>
                  <div className="brand-name">Kariakoo POS</div>
                  <div className="brand-meta">Point of sale</div>
                </div>
              </div>

              <h2 className="login-title">Welcome back.</h2>
              <p className="login-subtitle">Sign in to open the counter and pick up where the day left off.</p>

              <form className="login-form" onSubmit={handleSubmit}>
                <Field label="Username" htmlFor="username">
                  <div className="input-icon-wrap">
                    <UserRound size={15} />
                    <Input
                      ref={usernameRef}
                      id="username"
                      name="username"
                      placeholder="e.g. admin"
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck={false}
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      aria-invalid={Boolean(error)}
                    />
                  </div>
                </Field>

                <Field label="Password" htmlFor="password">
                  <div className="input-icon-wrap">
                    <LockKeyhole size={15} />
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="pr-10"
                      aria-invalid={Boolean(error)}
                    />
                    <button
                      type="button"
                      className="login-password-toggle"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </Field>

                {error && (
                  <div className="login-error" role="alert">
                    <ShieldCheck size={14} className="mt-0.5 shrink-0" />
                    {error}
                  </div>
                )}

                <Button type="submit" loading={submitting} className="login-submit" size="lg">
                  Open the counter
                </Button>
              </form>

              <div className="login-demo">
                <div className="flex items-center justify-between gap-3">
                  <div className="login-demo-label">Demo access</div>
                  <span className="badge badge-neutral">Simulated</span>
                </div>
                <div className="login-demo-grid">
                  {demoAccounts.map((account) => (
                    <button
                      key={account.username}
                      type="button"
                      className="demo-account"
                      onClick={() => fillDemo(account)}
                    >
                      <Avatar name={account.name} size="sm" />
                      <span>
                        <strong>{account.name}</strong>
                        <span>
                          {account.role} · {account.username}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <p className="login-footnote">
                <Sparkles size={10} className="mr-1 inline" />
                Demo environment · mobile money and card payments are simulated. No real money moves.
              </p>
            </div>
          </LiquidGlass>
        </div>
      </div>
    </div>
  );
}
