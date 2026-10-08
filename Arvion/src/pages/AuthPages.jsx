import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import brandingLogo from '../../arvion-logo/arvion-logo.jpeg'
import { supabase } from '../lib/supabase'
import '../auth.css'

const normalizeArvionId = (value) => value.trim().replace(/\s+/g, '')

const getGreeting = (now = new Date()) => {
  const hour = now.getHours()
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
}

function Brand({ className = '' }) {
  return (
    <Link to="/" className={`brand ${className}`.trim()} aria-label="Arvion home">
      <img src={brandingLogo} alt="Arvion logo" className="brand-mark brand-logo" />
      <span className="brand-text">Arvion</span>
    </Link>
  )
}

function AuthLayout({ title, subtitle, children, footerText, footerLink, footerLinkText }) {
  return (
    <div className="auth-shell">
      <div className="auth-panel">
        <div className="auth-header">
          <Brand className="auth-brand" />
        </div>

        <div className="auth-card">
          <div className="auth-title-group">
            <span className="auth-kicker">Welcome</span>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>

          {children}
        </div>

        <p className="auth-footer">
          {footerText}{' '}
          <Link to={footerLink}>{footerLinkText}</Link>
        </p>
      </div>
    </div>
  )
}

export function SignupPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    arvionId: '',
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const updateField = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const handleSignup = async (event) => {
    event.preventDefault()

    if (!supabase) {
      setError('Supabase is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to continue.')
      return
    }

    setError('')
    setSuccess('')

    const fullName = form.fullName.trim()
    const email = form.email
    const password = form.password
    const arvionId = normalizeArvionId(form.arvionId)

    if (!fullName || !email || !password || !arvionId) {
      setError('Please complete every field before creating your account.')
      return
    }

    if (password.length < 8) {
      setError('Your password must be at least 8 characters long.')
      return
    }

    if (password !== form.confirmPassword) {
      setError('The passwords do not match.')
      return
    }

    if (!/^[A-Za-z0-9_]{3,20}$/.test(arvionId)) {
      setError('Arvion ID must be 3–20 characters and can only contain letters, numbers, and underscores.')
      return
    }

    setSubmitting(true)

    try {
      const { data: isAvailable, error: availabilityError } = await supabase.rpc(
        'is_arvion_id_available',
        { candidate_arvion_id: arvionId },
      )

      if (availabilityError) {
        throw new Error('Arvion ID availability is temporarily unavailable. Please try again.')
      }

      if (!isAvailable) {
        setError('This Arvion ID is already taken. Please choose another one.')
        return
      }

      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            arvion_id: arvionId,
          },
          emailRedirectTo: `${window.location.origin}/welcome`,
        },
      })

      if (authError) {
        throw authError
      }

      const user = data.user
      if (!user) {
        throw new Error('The account could not be created. Please try again.')
      }

      setSuccess('Account created successfully. Please check your email to confirm your registration.')

      if (data.session) {
        navigate('/welcome', { replace: true })
        return
      }

      setForm({
        fullName: '',
        email: '',
        password: '',
        confirmPassword: '',
        arvionId: '',
      })
    } catch (caughtError) {
      if (caughtError.code === '23505') {
        setError('This Arvion ID is already taken. Please choose another one.')
      } else {
        setError(caughtError.message || 'Unable to create your account right now. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start with a name, your email, and the Arvion ID you want to use."
      footerText="Already have an account?"
      footerLink="/login"
      footerLinkText="Log in"
    >
      <form className="auth-form" onSubmit={handleSignup}>
        <div className="field-grid">
          <label className="field">
            <span>Full name</span>
            <input name="fullName" type="text" autoComplete="name" value={form.fullName} onChange={updateField} placeholder="Lekan Adebayo" />
          </label>

          <label className="field">
            <span>Email</span>
            <input name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck="false" required value={form.email} onChange={updateField} placeholder="name@example.com" />
          </label>

          <label className="field">
            <span>Arvion ID</span>
            <input name="arvionId" type="text" autoComplete="username" value={form.arvionId} onChange={updateField} placeholder="Lekan419" />
          </label>

          <label className="field">
            <span>Password</span>
            <input name="password" type="password" autoComplete="new-password" value={form.password} onChange={updateField} placeholder="••••••••" />
          </label>

          <label className="field">
            <span>Confirm password</span>
            <input name="confirmPassword" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={updateField} placeholder="••••••••" />
          </label>
        </div>

        <div className="input-note">
          Your Arvion ID can contain letters, numbers, and underscores. No spaces.
        </div>

        {error ? <div className="message error">{error}</div> : null}
        {success ? <div className="message success">{success}</div> : null}

        <button type="submit" className="primary-button auth-submit" disabled={submitting}>
          {submitting ? 'Creating account...' : 'Create Account'}
        </button>
      </form>
    </AuthLayout>
  )
}

export function LoginPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const updateField = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const handleLogin = async (event) => {
    event.preventDefault()

    if (!supabase) {
      setError('Supabase is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to continue.')
      return
    }

    setError('')
    setSubmitting(true)

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: form.email.trim(),
        password: form.password,
      })

      if (authError) {
        throw authError
      }

      if (data.session) {
        navigate('/welcome', { replace: true })
      }
    } catch (caughtError) {
      setError(caughtError.message || 'Unable to log in with those credentials. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Log in"
      subtitle="Access your Arvion account and continue from where you left off."
      footerText="Need an account?"
      footerLink="/signup"
      footerLinkText="Sign up"
    >
      <form className="auth-form" onSubmit={handleLogin}>
        <div className="field-grid single">
          <label className="field">
            <span>Email</span>
            <input name="email" type="email" autoComplete="email" value={form.email} onChange={updateField} placeholder="name@example.com" />
          </label>

          <label className="field">
            <span>Password</span>
            <input name="password" type="password" autoComplete="current-password" value={form.password} onChange={updateField} placeholder="••••••••" />
          </label>
        </div>

        <div className="inline-row">
          <Link to="/forgot-password">Forgot password?</Link>
        </div>

        {error ? <div className="message error">{error}</div> : null}

        <button type="submit" className="primary-button auth-submit" disabled={submitting}>
          {submitting ? 'Logging in...' : 'Log In'}
        </button>
      </form>
    </AuthLayout>
  )
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleResetRequest = async (event) => {
    event.preventDefault()

    if (!supabase) {
      setError('Supabase is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to continue.')
      return
    }

    setError('')
    setMessage('')

    if (!email.trim()) {
      setError('Please enter the email you used to register.')
      return
    }

    setSubmitting(true)

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (resetError) {
        throw resetError
      }

      setMessage('A password reset link has been sent to your email.')
    } catch (caughtError) {
      setError(caughtError.message || 'Unable to send a password reset email.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your email and we will send you a secure reset link."
      footerText="Remember your password?"
      footerLink="/login"
      footerLinkText="Log in"
    >
      <form className="auth-form" onSubmit={handleResetRequest}>
        <label className="field">
          <span>Email</span>
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" />
        </label>

        {error ? <div className="message error">{error}</div> : null}
        {message ? <div className="message success">{message}</div> : null}

        <button type="submit" className="primary-button auth-submit" disabled={submitting}>
          {submitting ? 'Sending link...' : 'Send reset link'}
        </button>
      </form>
    </AuthLayout>
  )
}

export function ResetPasswordPage({ recoveryActive, onRecoveryComplete }) {
  const [form, setForm] = useState({ password: '', confirmPassword: '' })
  const [recoverySession, setRecoverySession] = useState(recoveryActive)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!supabase) {
      return undefined
    }

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setRecoverySession(true)
      } else if (event === 'SIGNED_OUT') {
        setRecoverySession(false)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const updateField = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const handlePasswordUpdate = async (event) => {
    event.preventDefault()

    if (!supabase) {
      setError('Password reset is unavailable because Supabase is not configured.')
      return
    }

    setError('')

    if (form.password.length < 8) {
      setError('Your password must be at least 8 characters long.')
      return
    }

    if (form.password !== form.confirmPassword) {
      setError('The passwords do not match.')
      return
    }

    setSubmitting(true)

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) {
        throw sessionError
      }
      if (!recoverySession || !sessionData.session) {
        throw new Error('This password reset link is invalid or expired. Request a new link and try again.')
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: form.password })
      if (updateError) {
        throw updateError
      }

      setSuccess(true)
      setForm({ password: '', confirmPassword: '' })
      onRecoveryComplete()
    } catch (caughtError) {
      setError(caughtError.message || 'Unable to update your password. Request a new reset link and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle="Enter and confirm a new password for your Arvion account."
      footerText="Remembered your password?"
      footerLink="/login"
      footerLinkText="Log in"
    >
      {success ? (
        <div className="auth-form">
          <div className="message success" role="status">Your password has been updated. You can now log in with your new password.</div>
          <Link to="/login" className="primary-button auth-submit">Continue to log in</Link>
        </div>
      ) : !recoverySession ? (
        <div className="auth-form">
          <div className="message error" role="alert">This password reset link is invalid or expired. Request a new reset link to continue.</div>
          <Link to="/forgot-password" className="primary-button auth-submit">Request a new link</Link>
        </div>
      ) : (
        <form className="auth-form" onSubmit={handlePasswordUpdate}>
          <label className="field">
            <span>New password</span>
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={form.password}
              onChange={updateField}
            />
          </label>

          <label className="field">
            <span>Confirm new password</span>
            <input
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={form.confirmPassword}
              onChange={updateField}
            />
          </label>

          <div className="input-note">Your password must be at least 8 characters long.</div>
          {error ? <div className="message error" role="alert">{error}</div> : null}

          <button type="submit" className="primary-button auth-submit" disabled={submitting}>
            {submitting ? 'Updating password...' : 'Update password'}
          </button>
        </form>
      )}
    </AuthLayout>
  )
}

export function UserHomePage({ session, onLogout }) {
  const navigate = useNavigate()
  const [greeting] = useState(() => getGreeting())
  const [loadedProfile, setLoadedProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileError, setProfileError] = useState('')
  const [logoutError, setLogoutError] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)
  const userId = session?.user?.id
  const userEmail = session?.user?.email
  const userFullName = session?.user?.user_metadata?.full_name
  const userArvionId = session?.user?.user_metadata?.arvion_id

  useEffect(() => {
    let isMounted = true

    const loadProfile = async () => {
      if (!supabase || !userId) {
        setProfileError('Your profile could not be loaded.')
        setProfileLoading(false)
        return
      }

      setProfileLoading(true)
      setProfileError('')

      try {
        const { data, error: queryError } = await supabase
          .from('profiles')
          .select('id, auth_user_id, full_name, email, arvion_id, created_at, updated_at')
          .eq('auth_user_id', userId)
          .maybeSingle()

        if (queryError) {
          throw queryError
        }

        let currentProfile = data
        if (!currentProfile) {
          if (!userFullName || !userArvionId || !userEmail) {
            throw new Error('Your profile record is missing required account details.')
          }

          const { data: insertedProfile, error: insertError } = await supabase
            .from('profiles')
            .insert({
              auth_user_id: userId,
              full_name: userFullName,
              email: userEmail,
              arvion_id: userArvionId,
            })
            .select('id, auth_user_id, full_name, email, arvion_id, created_at, updated_at')
            .single()

          if (insertError) {
            throw insertError
          }

          currentProfile = insertedProfile
        }

        if (isMounted) {
          setLoadedProfile(currentProfile)
        }
      } catch (caughtError) {
        if (isMounted) {
          setProfileError(caughtError.message || 'Unable to load your profile.')
        }
      } finally {
        if (isMounted) {
          setProfileLoading(false)
        }
      }
    }

    loadProfile()
    return () => {
      isMounted = false
    }
  }, [userId, userEmail, userFullName, userArvionId])

  const handleLogout = async () => {
    if (!supabase) {
      navigate('/login', { replace: true })
      return
    }

    setLoggingOut(true)
    setLogoutError('')
    const { error } = await supabase.auth.signOut()

    if (error) {
      setLogoutError(error.message || 'Unable to log out. Please try again.')
      setLoggingOut(false)
      return
    }

    onLogout()
    navigate('/', { replace: true })
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  const displayName = loadedProfile?.full_name || session.user?.user_metadata?.full_name || 'there'
  const arvionId = loadedProfile?.arvion_id || session.user?.user_metadata?.arvion_id || 'your-id'
  const suggestions = [
    'Find me a plumber near me',
    'I need a laptop under ₦500,000',
    'Help me find a tutor',
    'Find a house in Abuja',
    'I want to sell my phone',
  ]

  return (
    <div className="user-home-shell">
      <header className="user-home-header">
        <Brand className="user-brand" />

        <nav className="user-home-nav" aria-label="Arvion areas">
          <a href="#arvion-ai" className="active">Arvion AI</a>
          <Link to="/market">Market</Link>
          <Link to="/local">Local</Link>
          <a href="#wallet">Wallet</a>
        </nav>

        <div className="user-home-actions">
          <div className="user-identity" aria-label={`Your Arvion ID is @${arvionId}`}>
            <span>Your Arvion ID</span>
            <strong>@{arvionId}</strong>
          </div>
          <button type="button" className="secondary-button" onClick={handleLogout} disabled={loggingOut}>
            {loggingOut ? 'Logging out...' : 'Log out'}
          </button>
        </div>
      </header>

      <main className="user-home-main">
        {profileLoading ? <span className="sr-only" role="status">Loading your profile...</span> : null}
        {profileError ? <div className="message error user-home-message" role="alert">{profileError}</div> : null}
        {logoutError ? <div className="message error user-home-message" role="alert">{logoutError}</div> : null}

        <section className="user-home-intro" aria-label="Welcome">
          <div className="user-avatar" aria-hidden="true">{displayName.slice(0, 1).toUpperCase()}</div>
          <div>
            <span className="user-home-overline">Your Arvion space</span>
            <p>{greeting}, {displayName}</p>
          </div>
        </section>

        <section className="ai-hero" id="arvion-ai" aria-labelledby="ai-hero-title">
          <div className="ai-hero-glow" aria-hidden="true" />
          <div className="ai-hero-content">
            <span className="ai-hero-kicker"><span aria-hidden="true">✦</span> Arvion AI</span>
            <h1 id="ai-hero-title">What can Arvion help you with today?</h1>
            <p>Tell us what you need. We’ll help you find the right way forward.</p>

            <div className="ai-prompt-box" aria-label="Arvion AI prompt preview">
              <span className="ai-prompt-sparkle" aria-hidden="true">✦</span>
              <input type="text" placeholder="Describe what you’re looking for..." readOnly aria-label="Describe what you are looking for" />
              <span className="ai-prompt-status">Coming soon</span>
            </div>

            <div className="suggestions">
              <span className="suggestions-label">A few ideas to get started</span>
              <div className="suggestion-list">
                {suggestions.map((suggestion) => (
                  <span className="suggestion-chip" key={suggestion}>{suggestion}</span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="product-areas" aria-labelledby="product-areas-title">
          <div className="product-areas-heading">
            <div>
              <span className="user-home-overline">Explore Arvion</span>
              <h2 id="product-areas-title">One place. More ways forward.</h2>
            </div>
          </div>

          <div className="product-area-grid">
            <article className="product-area-card market-area" id="market">
              <div className="product-area-top">
                <span className="product-area-icon" aria-hidden="true">▦</span>
                <span className="product-area-label">Buy & discover</span>
              </div>
              <h3>Market</h3>
              <p>Find products from people and businesses.</p>
              <div className="product-tags" aria-label="Market categories">
                <span>Phones</span><span>Laptops</span><span>Fashion</span><span>More</span>
              </div>
            </article>

            <Link to="/local" className="product-area-card local-area" id="local">
              <div className="product-area-top">
                <span className="product-area-icon" aria-hidden="true">⌖</span>
                <span className="product-area-label">Find trusted help</span>
              </div>
              <h3>Local</h3>
              <p>Connect with people who can get the job done.</p>
              <div className="product-tags" aria-label="Local services">
                <span>Plumbers</span><span>Mechanics</span><span>Tutors</span><span>More</span>
              </div>
            </Link>

            <article className="product-area-card ai-area">
              <div className="product-area-top">
                <span className="product-area-icon" aria-hidden="true">✦</span>
                <span className="product-area-label">Start with a request</span>
              </div>
              <h3>Arvion AI</h3>
              <p>Describe what you need and discover your next step.</p>
              <div className="product-tags"><span>Search naturally</span><span>Find solutions</span></div>
            </article>

            <article className="product-area-card wallet-area" id="wallet">
              <div className="product-area-top">
                <span className="product-area-icon" aria-hidden="true">₦</span>
                <span className="product-area-label">Your money, in view</span>
              </div>
              <h3>Wallet</h3>
              <p>A dedicated place for your Arvion wallet experience.</p>
              <div className="product-tags"><span>Simple</span><span>Secure</span></div>
            </article>
          </div>
        </section>
      </main>
    </div>
  )
}

export function WelcomePage({ session, onLogout }) {
  if (!session) {
    return <Navigate to="/login" replace />
  }

  return <UserHomePage session={session} onLogout={onLogout} />
}
