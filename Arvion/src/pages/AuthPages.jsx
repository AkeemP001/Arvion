import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import brandingLogo from '../../arvion-logo/arvion-logo.jpeg'
import { supabase } from '../lib/supabase'
import '../auth.css'

const AFRICAN_COUNTRIES = ["Algeria","Angola","Benin","Botswana","Burkina Faso","Burundi","Cabo Verde","Cameroon","Central African Republic","Chad","Comoros","DR Congo","Congo","Ivory Coast","Djibouti","Egypt","Equatorial Guinea","Eritrea","Eswatini","Ethiopia","Gabon","Gambia","Ghana","Guinea","Guinea-Bissau","Kenya","Lesotho","Liberia","Libya","Madagascar","Malawi","Mali","Mauritania","Mauritius","Morocco","Mozambique","Namibia","Niger","Nigeria","Rwanda","Sao Tome","Senegal","Seychelles","Sierra Leone","Somalia","South Africa","South Sudan","Sudan","Tanzania","Togo","Tunisia","Uganda","Zambia","Zimbabwe"]

const compressImage = (file, maxWidth = 400, quality = 0.7) => {
  return new Promise((resolve) => {
    const img = new Image()
    img.src = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      let width = img.width
      let height = img.height
      if (width > maxWidth) {
        height = (height * maxWidth) / width
        width = maxWidth
      }
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob((blob) => {
        resolve(new File([blob], file.name.replace(/\.\w+$/, '.webp'), { type: 'image/webp' }))
      }, 'image/webp', quality)
    }
  })
}

function ArvionToast({ toast, onClose }){
  if(!toast) return null
  const bg = toast.type==='error'?'#991b1b':toast.type==='success'?'#065f46':'#0f172a'
  return (
    <div style={{position:'fixed', top:'20px', left:'50%', transform:'translateX(-50%)', zIndex:99999, background:bg, color:'#fff', padding:'14px 20px', borderRadius:'12px', display:'flex', gap:'12px', minWidth:'300px', boxShadow:'0 10px 30px rgba(0,0,0,0.2)'}}>
      <span>{toast.type==='error'?'⚠️':'✅'}</span>
      <span style={{flex:1, fontSize:'14px'}}>{toast.message}</span>
      <button onClick={onClose} style={{background:'rgba(255,255,255,0.2)', border:'none', color:'#fff', borderRadius:'6px', padding:'4px 8px', cursor:'pointer'}}>✕</button>
    </div>
  )
}

function ConfirmEmailPopup({ show, email, onClose }){
  if(!show) return null
  return (
    <div style={{position:'fixed', inset:0, zIndex:100000, background:'rgba(0,0,0,0.55)', display:'flex', alignItems:'center', justifyContent:'center', padding:'20px'}}>
      <div style={{background:'#fff', borderRadius:'20px', padding:'28px', maxWidth:'400px', width:'100%', textAlign:'center', boxShadow:'0 20px 50px rgba(0,0,0,0.3)'}}>
        <div style={{width:'64px', height:'64px', background:'#dcfce7', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', fontSize:'28px'}}>✉️</div>
        <h2 style={{fontSize:'20px', fontWeight:700, marginBottom:'8px', color:'#0f172a'}}>Check your email</h2>
        <p style={{fontSize:'14px', color:'#475569', lineHeight:'1.6'}}>
          We've sent a confirmation link to<br/>
          <b style={{color:'#0f172a'}}>{email}</b><br/><br/>
          Click the link to verify your email and activate your Arvion account. The link expires in 1 hour.
        </p>
        <p style={{fontSize:'12px', color:'#94a3b8', marginTop:'16px'}}>Didn't see it? Check your spam folder.</p>
        <button onClick={onClose} style={{marginTop:'20px', width:'100%', background:'#0f172a', color:'#fff', border:'none', padding:'14px', borderRadius:'12px', fontWeight:700, cursor:'pointer'}}>Go to Login</button>
      </div>
    </div>
  )
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
        <div className="auth-header"><Brand className="auth-brand" /></div>
        <div className="auth-card">
          <div className="auth-title-group"><span className="auth-kicker">Welcome</span><h1>{title}</h1><p>{subtitle}</p></div>
          {children}
        </div>
        <p className="auth-footer">{footerText} <Link to={footerLink}>{footerLinkText}</Link></p>
      </div>
    </div>
  )
}

export function SignupPage() {
  const navigate = useNavigate()
  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate('/welcome', { replace: true })
    })
  }, [navigate])
  const [form, setForm] = useState({ fullName:'', email:'', password:'', confirmPassword:'', arvionId:'', phone:'', country:'', gender:'' })
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState('')
  const [errors, setErrors] = useState({})
  const [generalError, setGeneralError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [confirmEmail, setConfirmEmail] = useState('')

  const showToast = (message, type='info')=>{
    setToast({message, type})
    setTimeout(()=>setToast(null),4000)
  }

  const updateField = (e) => {
    const { name, value } = e.target
    setForm(c=>({...c, [name]: value }))
    setErrors(c=>({...c, [name]: undefined }))
  }
  const handleAvatar = async (e)=>{
    const file = e.target.files?.[0]
    if(!file) return
    if(file.size > 10*1024*1024){ setErrors(p=>({...p, avatar:'Max 10MB before compression'})); return }
    const compressed = await compressImage(file, 400, 0.7)
    if(compressed.size > 300*1024){
      const extraCompressed = await compressImage(file, 300, 0.5)
      setAvatarFile(extraCompressed)
      setAvatarPreview(URL.createObjectURL(extraCompressed))
    } else {
      setAvatarFile(compressed)
      setAvatarPreview(URL.createObjectURL(compressed))
    }
    setErrors(p=>({...p, avatar:undefined}))
  }
  const validate = async () => {
    const ne = {}
    if(!form.fullName.trim()) ne.fullName='Full Name is required'
    if(!form.email.trim()) ne.email='Email is required'
    if(!form.password) ne.password='Password is required'
    else if(form.password.length<8) ne.password='Password must be at least 8 characters'
    if(!form.confirmPassword) ne.confirmPassword='Confirm your password'
    else if(form.password!==form.confirmPassword) ne.confirmPassword='Passwords do not match'
    if(!form.arvionId.trim()) ne.arvionId='Arvion ID is required'
    if(!form.phone.trim()) ne.phone='Phone is required'
    if(!form.country) ne.country='Country is required'
    if(!form.gender) ne.gender='Gender is required'
    if(!avatarFile) ne.avatar='Avatar is required'
    setErrors(ne)
    return Object.keys(ne).length===0
  }
  const handleSignup = async (e)=>{
    e.preventDefault()
    setGeneralError('')
    if(!supabase){ setGeneralError('Supabase not configured'); return }
    const ok = await validate()
    if(!ok) return
    setSubmitting(true)
    try{
      const exactEmail = form.email.trim()
      const {data,error}=await supabase.auth.signUp({
        email:exactEmail,
        password:form.password,
        options:{
          data:{ full_name:form.fullName.trim(), arvion_id:form.arvionId.trim(), phone:form.phone.trim(), country:form.country, gender:form.gender },
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      })
      if(error) throw error
      const user=data.user
      if(!user){
        setConfirmEmail(exactEmail)
        setShowConfirm(true)
        return
      }
      try{
        if(avatarFile){
          const ext=avatarFile.name.split('.').pop()||'webp'
          const path=`${user.id}/avatar-${Date.now()}.${ext}`
          const {error:upErr}=await supabase.storage.from('profile-avatars').upload(path, avatarFile,{upsert:true})
          if(!upErr){
            const {data:urlData}=supabase.storage.from('profile-avatars').getPublicUrl(path)
            const avatarUrl=urlData?.publicUrl||path
            await supabase.from('profiles').update({ phone:form.phone.trim(), country:form.country, gender:form.gender, avatar_url:avatarUrl, full_name:form.fullName.trim(), arvion_id:form.arvionId.trim() }).eq('auth_user_id', user.id)
          }
        }
      } catch(profileErr){
        console.warn('Profile avatar will be completed after email confirmation:', profileErr.message)
      }
      setConfirmEmail(exactEmail)
      setShowConfirm(true)
    }catch(err){
      setGeneralError(err.message||'Signup failed')
      showToast(err.message||'Signup failed','error')
    }finally{ setSubmitting(false) }
  }
  const fieldError = (name) => errors[name]? { borderColor:'#ef4444', background:'#fff7f7' } : {}
  return (
    <AuthLayout title="Create account" subtitle="All fields required." footerText="Already have an account?" footerLink="/login" footerLinkText="Log in">
      <ArvionToast toast={toast} onClose={()=>setToast(null)} />
      <ConfirmEmailPopup show={showConfirm} email={confirmEmail} onClose={()=>{ setShowConfirm(false); navigate('/login') }} />
      {generalError && <div className="message error">{generalError}</div>}
      <form className="auth-form" onSubmit={handleSignup} noValidate>
        <div className="field-grid single">
          <label className="field"><span>Full Name *</span><input name="fullName" value={form.fullName} onChange={updateField} placeholder="Akeem Balogun" style={fieldError('fullName')} />{errors.fullName && <span className="input-note" style={{color:'#b42318'}}>{errors.fullName}</span>}</label>
        </div>
        <div className="field-grid single">
          <label className="field"><span>Email *</span><input name="email" type="email" value={form.email} onChange={updateField} placeholder="you@example.com" style={fieldError('email')} /></label>
        </div>
        <div className="field-grid">
          <label className="field"><span>Password *</span><input name="password" type="password" value={form.password} onChange={updateField} placeholder="Min 8 chars" style={fieldError('password')} /></label>
          <label className="field"><span>Confirm Password *</span><input name="confirmPassword" type="password" value={form.confirmPassword} onChange={updateField} placeholder="Repeat" style={fieldError('confirmPassword')} /></label>
        </div>
        <div className="field-grid">
          <label className="field"><span>Arvion ID *</span><input name="arvionId" value={form.arvionId} onChange={updateField} placeholder="john_doe_123" style={fieldError('arvionId')} /></label>
          <label className="field"><span>Phone *</span><input name="phone" type="tel" value={form.phone} onChange={updateField} placeholder="+234 800 000 0000" style={fieldError('phone')} /></label>
        </div>
        <div className="field-grid">
          <label className="field"><span>Country *</span><select name="country" value={form.country} onChange={updateField} style={{width:'100%', minHeight:'52px', border:'1px solid rgba(15,23,42,0.12)', background:'#f8fbff', borderRadius:'14px', padding:'0.9rem 1rem'}}><option value="">Select country</option>{AFRICAN_COUNTRIES.map(c=><option key={c} value={c}>{c}</option>)}</select></label>
          <div className="field"><span>Gender *</span><div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px'}}>{['Male','Female'].map(g=><label key={g} style={{display:'flex', alignItems:'center', justifyContent:'center', minHeight:'52px', borderRadius:'14px', border: form.gender===g? '1px solid #1d4ed8' : '1px solid rgba(15,23,42,0.12)', background: form.gender===g? '#1d4ed8' : '#f8fbff', color: form.gender===g? '#fff' : '#10233d', fontWeight:600, cursor:'pointer'}}><input type="radio" name="gender" value={g} checked={form.gender===g} onChange={updateField} style={{display:'none'}} />{g}</label>)}</div></div>
        </div>
        <div className="field-grid single">
          <div className="field">
            <span>Avatar *</span>
            <div style={{border: errors.avatar? '1px dashed #ef4444' : '1px dashed rgba(15,23,42,0.18)', borderRadius:'14px', padding:'16px', background:'#f8fbff', textAlign:'center'}}>
              {avatarPreview? (
                <div style={{display:'grid', gap:'10px', placeItems:'center'}}>
                  <img src={avatarPreview} alt="avatar preview" style={{width:'88px', height:'88px', borderRadius:'50%', objectFit:'cover'}} />
                  <button type="button" onClick={()=>{setAvatarFile(null); setAvatarPreview('')}} style={{color:'#1d4ed8', background:'none', border:0, cursor:'pointer'}}>Remove</button>
                </div>
              ) : (
                <label style={{cursor:'pointer', display:'block'}}>
                  <span style={{fontWeight:600}}>Click to select avatar (required)</span>
                  <input type="file" accept="image/*" style={{display:'none'}} onChange={handleAvatar} />
                  <div style={{marginTop:'10px'}}><span style={{display:'inline-flex', padding:'8px 14px', borderRadius:'999px', background:'#0a1832', color:'#fff', fontSize:'0.85rem'}}>Choose File</span></div>
                </label>
              )}
            </div>
          </div>
        </div>
        <button type="submit" disabled={submitting} className="primary-button auth-submit"> {submitting? 'Creating...' : 'Create account'} </button>
      </form>
    </AuthLayout>
  )
}

export function LoginPage(){
  const navigate=useNavigate()
  const [form,setForm]=useState({email:'',password:''})
  const [error,setError]=useState('')
  const [submitting,setSubmitting]=useState(false)
  const [toast,setToast]=useState(null)
  const showToast=(m,t='info')=>{ setToast({message:m,type:t}); setTimeout(()=>setToast(null),4000) }
  const handleLogin=async(e)=>{
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try{
      const {error}=await supabase.auth.signInWithPassword({email:form.email.trim(), password:form.password})
      if(error) throw error
      navigate('/welcome')
    }catch(err){
      setError(err.message)
      if(err.message.toLowerCase().includes('email not confirmed')){
        showToast('Please check your email to confirm before logging in','error')
      }
    }finally{ setSubmitting(false) }
  }
  return (
    <AuthLayout title="Welcome back" subtitle="Log in to continue" footerText="No account?" footerLink="/signup" footerLinkText="Create account">
      <ArvionToast toast={toast} onClose={()=>setToast(null)} />
      <form className="auth-form" onSubmit={handleLogin}>
        <div className="field-grid single"><label className="field"><span>Email</span><input value={form.email} onChange={e=>setForm(c=>({...c,email:e.target.value}))} placeholder="you@example.com" type="email" /></label></div>
        <div className="field-grid single"><label className="field"><span>Password</span><input value={form.password} onChange={e=>setForm(c=>({...c,password:e.target.value}))} placeholder="Password" type="password" /></label></div>
        {error && <div className="message error">{error}</div>}
        <button disabled={submitting} className="primary-button auth-submit">{submitting?'Logging in...':'Log in'}</button>
        <div className="inline-row"><Link to="/forgot-password">Forgot password?</Link></div>
      </form>
    </AuthLayout>
  )
}

export function ForgotPasswordPage(){
  const [email,setEmail]=useState('')
  const [msg,setMsg]=useState('')
  const [err,setErr]=useState('')
  const [toast,setToast]=useState(null)
  const showToast=(m,t='info')=>{ setToast({message:m,type:t}); setTimeout(()=>setToast(null),4000) }
  const handle=async(e)=>{
    e.preventDefault()
    setErr('')
    setMsg('')
    try{
      const {error}=await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/auth/callback` })
      if(error) throw error
      setMsg('Reset link sent')
      showToast('Reset link sent to '+email,'success')
    }catch(e){ setErr(e.message); showToast(e.message,'error') }
  }
  return (
    <AuthLayout title="Forgot password" subtitle="We will send you a reset link" footerText="Remember?" footerLink="/login" footerLinkText="Log in">
      <ArvionToast toast={toast} onClose={()=>setToast(null)} />
      <form className="auth-form" onSubmit={handle}><div className="field-grid single"><label className="field"><span>Email</span><input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" /></label></div>{err && <div className="message error">{err}</div>}{msg && <div className="message success">{msg}</div>}<button className="primary-button auth-submit">Send reset link</button></form>
    </AuthLayout>
  )
}

export function ResetPasswordPage({recoveryActive}){
  const navigate=useNavigate()
  const [pwd,setPwd]=useState('')
  const [cpwd,setCpwd]=useState('')
  const [err,setErr]=useState('')
  const [msg,setMsg]=useState('')
  const handle=async(e)=>{
    e.preventDefault()
    setErr('')
    if(pwd.length<8){ setErr('Min 8 chars'); return }
    if(pwd!==cpwd){ setErr('Mismatch'); return }
    try{ const {error}=await supabase.auth.updateUser({password:pwd}); if(error) throw error; setMsg('Password updated'); setTimeout(()=>navigate('/login'),1000) }catch(e){ setErr(e.message) }
  }
  if(!recoveryActive) return <Navigate to="/login" replace />
  return (
    <AuthLayout title="Reset password" subtitle="Enter new password" footerText="Back to" footerLink="/login" footerLinkText="Log in">
      <form className="auth-form" onSubmit={handle}><div className="field-grid single"><label className="field"><span>New password</span><input type="password" value={pwd} onChange={e=>setPwd(e.target.value)} /></label><label className="field"><span>Confirm</span><input type="password" value={cpwd} onChange={e=>setCpwd(e.target.value)} /></label></div>{err && <div className="message error">{err}</div>}{msg && <div className="message success">{msg}</div>}<button className="primary-button auth-submit">Update</button></form>
    </AuthLayout>
  )
}

export function WelcomePage({ session, onLogout }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileName, setProfileName] = useState('')
  const [chatLog, setChatLog] = useState([])

  // OPTION C: Auto-logout if user was deleted in Supabase
  useEffect(()=>{
    if(!supabase) return
    let mounted = true
    const checkUserExists = async()=>{
      try{
        const { data, error } = await supabase.auth.getUser()
        if(error ||!data?.user){
          console.log('User no longer exists, logging out')
          await supabase.auth.signOut()
          if(onLogout) onLogout()
          navigate('/login', {replace:true})
          return
        }
        const meta = data?.user?.user_metadata
        if(mounted && meta?.full_name) setProfileName(meta.full_name)
      } catch(e){
        console.log('User check failed, logging out', e.message)
        await supabase.auth.signOut()
        if(onLogout) onLogout()
        navigate('/login', {replace:true})
      }
    }
    checkUserExists()
    return ()=>{ mounted = false }
  },[navigate, onLogout])

  const hour = new Date().getHours()
  const timeGreeting = hour < 12? 'Good morning' : hour < 18? 'Good afternoon' : 'Good evening'
  const suggestions = ['I need a laptop','Find a phone','Find a plumber in Lagos','Shoes under 20k','Show me market']

  const extractKeywords = (q) => {
    const stop = ['i','need','want','find','a','an','the','me','please','for','in','is','are','my','can','you','get','show','looking','search']
    return q.toLowerCase().split(/\s+/).filter(w=> w.length>2 &&!stop.includes(w))
  }

  const handleLogout = async()=>{
    if(supabase) await supabase.auth.signOut()
    if(onLogout) onLogout()
    navigate('/login')
  }

  const handleSearch = async (customQuery) => {
    const raw = (customQuery || query).trim()
    if (!raw) return
    const q = raw.toLowerCase()
    setChatLog(prev=>[...prev, {role:'user', text: raw}])
    setQuery('')
    setLoading(true)
    setResults(null)
    const blocked = ['generate image','draw','code','python','poem','joke','weather','news','president','bible']
    if(blocked.some(b=>q.includes(b))){
      const reply = "I am Arvion assistant — I only help with things inside Arvion: Market, Local services, and your account. Try 'I need a laptop' or 'Find a plumber in Lagos'"
      setResults({type:'chat', message: reply})
      setChatLog(prev=>[...prev, {role:'arvion', text: reply}])
      setLoading(false)
      return
    }
    const keywords = extractKeywords(raw)
    const searchTerms = keywords.length? keywords : [raw]
    const mainKeyword = searchTerms[0] || raw
    try{
      let marketItems = []
      let localItems = []
      for(let term of searchTerms){
        const m = await supabase.from('market_listings').select('*').ilike('title', `%${term}%`).limit(6)
        const l = await supabase.from('local_services').select('*').ilike('title', `%${term}%`).limit(6)
        if(m.data) marketItems = [...marketItems,...m.data]
        if(l.data) localItems = [...localItems,...l.data]
        if(marketItems.length + localItems.length >= 3) break
      }
      marketItems = [...new Map(marketItems.map(i=>[i.id,i])).values()].slice(0,6)
      localItems = [...new Map(localItems.map(i=>[i.id,i])).values()].slice(0,6)
      if(marketItems.length===0 && localItems.length===0){
        const reply = `I checked Arvion Market and Local for "${mainKeyword}" but I didn't find an exact match yet.`
        setResults({type:'empty', message: reply, keyword: mainKeyword})
        setChatLog(prev=>[...prev, {role:'arvion', text: reply}])
      } else {
        let reply = `Got it — you said "${raw}". I found ${marketItems.length} products in Market and ${localItems.length} pros in Local.`
        setResults({type:'mixed', market: marketItems, local: localItems, query: mainKeyword, intro: reply})
        setChatLog(prev=>[...prev, {role:'arvion', text: reply}])
      }
    }catch(e){
      const err = "Arvion is connecting. Please try again in a second."
      setResults({type:'error', message: err})
      setChatLog(prev=>[...prev, {role:'arvion', text: err}])
    }finally{ setLoading(false) }
  }

  return (
    <div className="page-shell">
      <header className="topbar">
        <div className="container nav-wrap">
          <Link to="/welcome" className="brand"><img src={brandingLogo} alt="Arvion logo" className="brand-mark brand-logo" /><span className="brand-text">Arvion</span></Link>
          <nav className={`nav ${menuOpen? 'open' : ''}`}>
            <Link to="/welcome" className="nav-link">Home</Link>
            <Link to="/market" className="nav-link">Market</Link>
            <Link to="/market/messages" className="nav-link">Messages</Link>
            <Link to="/local" className="nav-link">Local</Link>
          </nav>
          <div className="nav-actions" style={{display:'flex', alignItems:'center', gap:'10px'}}>
            {profileName && <span style={{fontSize:'0.9rem', fontWeight:600}}>{profileName}</span>}
            <button onClick={handleLogout} style={{height:'36px', padding:'0 14px', fontSize:'0.85rem', fontWeight:600, borderRadius:'999px', border:'1px solid rgba(15,23,42,0.12)', background:'#fff', cursor:'pointer'}}>Log Out</button>
          </div>
          <button type="button" className="menu-toggle" onClick={()=>setMenuOpen(o=>!o)}>{menuOpen?'×':'☰'}</button>
        </div>
      </header>

      <main className="page-content">
        <section className="hero container" style={{paddingTop:'30px'}}>
          <div className="hero-copy">
            <h1 style={{fontSize:'2.2rem'}}>{timeGreeting}{profileName? `, ${profileName}` : ''}</h1>
            <p className="hero-text">I am Arvion assistant. Tell me what you need.</p>
            <div className="ai-search">
              <div className="search-icon">+</div>
              <input type="text" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==='Enter' && handleSearch()} placeholder="e.g. I need a laptop..." />
              <button onClick={()=>handleSearch()} className="search-button">{loading?'...':'Ask'}</button>
            </div>
            <div className="example-row">
              {suggestions.map(s=><button key={s} onClick={()=>handleSearch(s)} className="example-pill" style={{cursor:'pointer', border:'1px solid rgba(15,23,42,0.12)'}}>{s}</button>)}
            </div>
            {results && (
              <div style={{marginTop:'20px', background:'#fff', border:'1px solid rgba(15,23,42,0.1)', borderRadius:'16px', padding:'16px', whiteSpace:'pre-line'}}>
                {results.intro && <p style={{fontWeight:600, marginBottom:'12px', color:'#10233d'}}>{results.intro}</p>}
                {results.type!=='mixed'? (
                  <div style={{color: results.type==='error'?'#b42318':'#10233d'}}>{results.message}</div>
                ) : (
                  <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px,1fr))', gap:'12px'}}>
                    {results.market.map(item=><div key={'m-'+item.id} onClick={()=>navigate('/market')} style={{cursor:'pointer', border:'1px solid #e2e8f0', borderRadius:'12px', padding:'12px', background:'#f8fbff'}}><p style={{fontWeight:600, margin:'0 0 4px'}}>{item.title}</p></div>)}
                    {results.local.map(item=><div key={'l-'+item.id} onClick={()=>navigate('/local')} style={{cursor:'pointer', border:'1px solid #e2e8f0', borderRadius:'12px', padding:'12px'}}><p style={{fontWeight:600, margin:'0 0 4px'}}>{item.title}</p></div>)}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="hero-visual">
            <div className="visual-panel main-card"><div className="panel-topline">Arvion AI</div><h2>Customer Care</h2><p>{chatLog.length? `${chatLog.length} messages` : 'Ask me anything about Market & Local'}</p></div>
            <div className="visual-panel floating-card top-card" onClick={()=>navigate('/market/messages')} style={{cursor:'pointer'}}><span className="tiny-tag">Messages</span><strong>Protected Chat</strong><small>Tap to open inbox</small></div>
            <div className="visual-panel floating-card side-card"><span className="tiny-tag">Local</span><strong>Trusted pros</strong></div>
          </div>
        </section>
        <section className="platform container">
          <div className="section-heading"><h2>Everything in one place.</h2></div>
          <div className="capability-grid">
            {[
              {title:'Market', description:'Buy and discover products.', path:'/market'},
              {title:'Messages', description:'Your secure Arvion chats — no phone needed.', path:'/market/messages'},
              {title:'Local', description:'Find trusted professionals.', path:'/local'},
              {title:'Wallet', description:'Manage money.', path:'#'},
              {title:'Earn', description:'Earn in ecosystem.', path:'#'},
              {title:'Support', description:'Protected by Arvion.', path:'#'},
            ].map((item) => (
              <article key={item.title} className="capability-card" onClick={()=>item.path.startsWith('/') && navigate(item.path)} style={{cursor: item.path.startsWith('/')?'pointer':'default'}}>
                <div className="card-badge">{item.title.slice(0,1)}</div><h3>{item.title}</h3><p>{item.description}</p>
                {item.title==='Messages' && <span style={{marginTop:'8px', display:'inline-flex', padding:'6px 12px', borderRadius:'999px', background:'#0a1832', color:'#fff', fontSize:'0.8rem'}}>Open Inbox →</span>}
              </article>
            ))}
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <div className="container footer-grid">
          <div><Link to="/" className="brand footer-brand"><img src={brandingLogo} alt="Arvion logo" className="brand-mark brand-logo" /><span className="brand-text">Arvion</span></Link><p className="footer-copy">One place to discover products, services, and opportunities.</p></div>
          <div style={{color:'#5b6b84', fontSize:'0.9rem'}}>© 2026 Arvion. Built for trust.</div>
        </div>
      </footer>
    </div>
  )
}