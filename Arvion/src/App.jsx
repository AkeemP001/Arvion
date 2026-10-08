import { Suspense, lazy, useEffect, useState } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom'
import brandingLogo from '../arvion-logo/arvion-logo.jpeg'
import './App.css'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import { ForgotPasswordPage, LoginPage, ResetPasswordPage, SignupPage, WelcomePage } from './pages/AuthPages'

const MarketPage = lazy(() => import('./pages/MarketPages').then((module) => ({ default: module.MarketPage })))
const MarketListingDetailPage = lazy(() => import('./pages/MarketPages').then((module) => ({ default: module.MarketListingDetailPage })))
const CreateMarketListingPage = lazy(() => import('./pages/MarketPages').then((module) => ({ default: module.CreateMarketListingPage })))
const LocalPage = lazy(() => import('./pages/LocalPages').then((module) => ({ default: module.LocalPage })))
const LocalServiceDetailPage = lazy(() => import('./pages/LocalPages').then((module) => ({ default: module.LocalServiceDetailPage })))
const CreateLocalServicePage = lazy(() => import('./pages/LocalPages').then((module) => ({ default: module.CreateLocalServicePage })))

const navItems = ['Home', 'Market', 'Local', 'About']

const promptExamples = [
  'Find me a reliable plumber in Lekki',
  'I need a PS5 under ₦500,000',
  'Find a house in Abuja under ₦2m yearly',
  'I need someone to build my website',
  'Find a mechanic near me',
  'I want to sell my iPhone',
  'Find a tutor for my daughter',
  'I need a photographer this Saturday',
]

const capabilities = [
  {
    title: 'Market',
    description: 'Buy and discover products from people and businesses around you.',
  },
  {
    title: 'Local',
    description: 'Find trusted professionals and services for everyday needs.',
  },
  {
    title: 'Arvion AI',
    description: 'Tell Arvion what you need and let it help you find the right solution.',
  },
  {
    title: 'Wallet',
    description: 'Manage money and payments through Arvion.',
  },
  {
    title: 'Earn',
    description: 'Discover ways to earn and participate in the Arvion ecosystem.',
  },
  {
    title: 'More',
    description: 'Homes, delivery, travel, learn and more can grow into the platform over time.',
  },
]

const steps = [
  {
    number: '01',
    title: 'Tell Arvion',
    description: 'Describe what you need naturally, in your own words.',
  },
  {
    number: '02',
    title: 'Arvion Finds Options',
    description: 'Arvion helps you discover relevant products, services or solutions.',
  },
  {
    number: '03',
    title: 'Get It Done',
    description: 'Choose an option and take action with confidence.',
  },
]

const marketItems = ['Phones', 'Laptops', 'Furniture', 'Fashion', 'Electronics', 'Cars']
const localItems = ['Plumbers', 'Electricians', 'Mechanics', 'Cleaners', 'Barbers', 'Tutors', 'Photographers', 'Web developers']

const footerLinks = ['Market', 'Local', 'Arvion AI', 'About', 'Security', 'Contact', 'Privacy', 'Terms']

function Brand({ className = '' }) {
  return (
    <Link to="/" className={`brand ${className}`.trim()} aria-label="Arvion home">
      <img src={brandingLogo} alt="Arvion logo" className="brand-mark brand-logo" />
      <span className="brand-text">Arvion</span>
    </Link>
  )
}

function ProtectedRoute({ authReady, authError, session, children }) {
  if (!authReady) {
    return <div className="auth-shell" role="status">Checking your session...</div>
  }

  if (authError) {
    return <div className="auth-shell" role="alert">{authError}</div>
  }

  if (!isSupabaseConfigured() || !session) {
    return <Navigate to="/login" replace />
  }

  return children
}

function HomePage({ menuOpen, setMenuOpen }) {
  return (
    <div className="page-shell">
      <header className="topbar">
        <div className="container nav-wrap">
          <Brand />

          <nav className={`nav ${menuOpen ? 'open' : ''}`} aria-label="Main navigation">
            {navItems.map((item) => (
              <Link key={item} to={item === 'Home' ? '/' : item === 'Market' ? '/market' : item === 'Local' ? '/local' : '#'} className="nav-link">
                {item}
              </Link>
            ))}
          </nav>

          <div className="nav-actions">
            <Link to="/login" className="nav-ghost">
              Log In
            </Link>
            <Link to="/signup" className="nav-primary">
              Get Started
            </Link>
          </div>

          <button
            type="button"
            className="menu-toggle"
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? '×' : '☰'}
          </button>
        </div>
      </header>

      <main className="page-content">
        <section className="hero container">
          <div className="hero-copy">
            <span className="eyebrow">Built for trust. Designed for Africa.</span>
            <h1>What do you need today? Tell Arvion.</h1>
            <p className="hero-text">
              From finding a trusted professional to discovering products, managing your money,
              or getting everyday things done — Arvion brings it together.
            </p>

            <div className="hero-actions">
              <Link to="/signup" className="primary-button large-btn">
                Get Started
              </Link>
              <button type="button" className="secondary-button large-btn">
                Explore Arvion
              </button>
            </div>

            <div className="ai-search" aria-label="Arvion search input">
              <div className="search-icon">✦</div>
              <input type="text" placeholder="What do you need today?" readOnly />
              <button type="button" className="search-button">
                Search
              </button>
            </div>

            <div className="example-row" aria-label="Example prompts">
              {promptExamples.slice(0, 4).map((example) => (
                <span key={example} className="example-pill">
                  {example}
                </span>
              ))}
            </div>
          </div>

          <div className="hero-visual" aria-hidden="true">
            <div className="visual-panel main-card">
              <div className="panel-topline">AI Match</div>
              <h2>Trusted plumber</h2>
              <p>Lekki • 3 nearby • ₦18,000 starting</p>
            </div>

            <div className="visual-panel floating-card top-card">
              <span className="tiny-tag">Market</span>
              <strong>Phones & gadgets</strong>
              <small>From verified sellers</small>
            </div>

            <div className="visual-panel floating-card side-card">
              <span className="tiny-tag">Local</span>
              <strong>Experienced pros</strong>
              <small>Fastest matches near you</small>
            </div>

            <div className="mini-metrics">
              <div>
                <strong>3x</strong>
                <span>Faster discovery</span>
              </div>
              <div>
                <strong>1 place</strong>
                <span>For market & local</span>
              </div>
            </div>
          </div>
        </section>

        <section className="platform container">
          <div className="section-heading">
            <span className="section-kicker">One platform</span>
            <h2>Everything people need, in one place.</h2>
          </div>

          <div className="capability-grid">
            {capabilities.map((item) => (
              <article key={item.title} className="capability-card">
                <div className="card-badge">{item.title.slice(0, 1)}</div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="steps container">
          <div className="section-heading center-heading">
            <span className="section-kicker">How Arvion works</span>
            <h2>Simple steps. Smarter solutions.</h2>
          </div>

          <div className="step-grid">
            {steps.map((step) => (
              <article key={step.number} className="step-card">
                <span className="step-number">{step.number}</span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="preview container">
          <div className="section-heading center-heading">
            <span className="section-kicker">Market + Local</span>
            <h2>Two ways to get what you need.</h2>
          </div>

          <div className="preview-grid">
            <article className="preview-panel market-panel">
              <div className="panel-header">
                <span className="mini-dot"></span>
                <h3>Market</h3>
              </div>
              <p>Physical products people can discover from sellers and businesses.</p>
              <div className="item-row">
                {marketItems.map((item) => (
                  <span key={item} className="item-chip">
                    {item}
                  </span>
                ))}
              </div>
            </article>

            <article className="preview-panel local-panel">
              <div className="panel-header">
                <span className="mini-dot accent-dot"></span>
                <h3>Local</h3>
              </div>
              <p>Services and professionals people can hire for everyday tasks and projects.</p>
              <div className="item-row">
                {localItems.map((item) => (
                  <span key={item} className="item-chip">
                    {item}
                  </span>
                ))}
              </div>
            </article>
          </div>

          <div className="comparison-clarifier">
            <div>
              <strong>Market = things you buy</strong>
            </div>
            <div>
              <strong>Local = people/services you hire</strong>
            </div>
          </div>
        </section>

        <section className="trust container">
          <div className="trust-copy">
            <span className="section-kicker">Trust & security</span>
            <h2>Built for trust. Designed for Africa.</h2>
            <p>
              Arvion is being built with trust and security at the centre of the experience.
              From secure accounts and identity verification to protected communication and safer
              transactions, the platform is designed to help people feel confident when they
              discover and act on opportunities.
            </p>
          </div>

          <div className="trust-points">
            <div className="point">Secure accounts</div>
            <div className="point">Identity</div>
            <div className="point">Protected communication</div>
            <div className="point">Fraud awareness</div>
            <div className="point">Verified providers</div>
            <div className="point">Safer transactions</div>
          </div>
        </section>

        <section className="final-cta container">
          <div className="cta-box">
            <span className="section-kicker">Start with one question</span>
            <h2>Your next solution could start with one question.</h2>
            <p>Tell Arvion what you need and discover what&apos;s possible.</p>
            <div className="cta-actions">
              <Link to="/signup" className="primary-button large-btn">
                Get Started
              </Link>
              <Link to="/login" className="secondary-button large-btn">
                Log In
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container footer-grid">
          <div>
            <Brand className="footer-brand" />
            <p className="footer-copy">
              One place to discover products, services, and opportunities with confidence.
            </p>
          </div>

          <div className="footer-links">
            {footerLinks.map((link) => (
              <a key={link} href="#" className="footer-link">
                {link}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}

function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [session, setSession] = useState(null)
  const [passwordRecovery, setPasswordRecovery] = useState(false)
  const [authReady, setAuthReady] = useState(!supabase)
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    if (!supabase) {
      return
    }

    let isMounted = true

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (isMounted) {
        setSession(nextSession)
        setAuthError('')
        if (event === 'PASSWORD_RECOVERY') {
          setPasswordRecovery(true)
        } else if (event === 'SIGNED_OUT') {
          setPasswordRecovery(false)
        }
      }
    })

    supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) {
        return
      }

      if (error) {
        setAuthError('Unable to restore your session. Please reload the page and try again.')
      } else {
        setSession(data.session)
      }
      setAuthReady(true)
    }).catch(() => {
      if (isMounted) {
        setAuthError('Unable to restore your session. Please reload the page and try again.')
        setAuthReady(true)
      }
    })

    return () => {
      isMounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  return (
    <BrowserRouter>
      <Suspense fallback={<div className="auth-shell" role="status">Loading Arvion Market...</div>}>
        <Routes>
          <Route path="/" element={<HomePage menuOpen={menuOpen} setMenuOpen={setMenuOpen} />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route
            path="/reset-password"
            element={
              <ResetPasswordPage
                recoveryActive={passwordRecovery}
                onRecoveryComplete={() => setPasswordRecovery(false)}
              />
            }
          />
          <Route
            path="/welcome"
            element={
              <ProtectedRoute authReady={authReady} authError={authError} session={session}>
                <WelcomePage session={session} onLogout={() => setSession(null)} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/market"
            element={
              <ProtectedRoute authReady={authReady} authError={authError} session={session}>
                <MarketPage session={session} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/market/new"
            element={
              <ProtectedRoute authReady={authReady} authError={authError} session={session}>
                <CreateMarketListingPage session={session} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/market/:listingId"
            element={
              <ProtectedRoute authReady={authReady} authError={authError} session={session}>
                <MarketListingDetailPage session={session} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/local"
            element={<LocalPage />}
          />
          <Route
            path="/local/new"
            element={
              <ProtectedRoute authReady={authReady} authError={authError} session={session}>
                <CreateLocalServicePage session={session} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/local/:serviceId"
            element={<LocalServiceDetailPage session={session} />}
          />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
