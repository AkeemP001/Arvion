import { useEffect, useState } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import brandingLogo from '../arvion-logo/arvion-logo.jpeg'
import { supabase } from './lib/supabase'
import './App.css'

import * as MarketModule from './pages/MarketPages'
import * as JobsModule from './pages/JobsPages'
import * as StoresModule from './pages/StoresPages'
import * as AuthModule from './pages/AuthPages'
import * as AdminModule from './pages/AdminVerificationsPage'

function GetComp(mod, names) {
  if(!mod) return null
  return names.map(n => mod[n]).find(Boolean) || mod.default || null
}

// PROFESSIONAL ICONS - SVG, not emoji
const Icons = {
  search: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-3.5-3.5"/></svg>,
  market: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 7h12l-1 11H7L6 7z"/><path d="M9 7V5a3 3 0 016 0v2"/></svg>,
  jobs: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="7" width="20" height="13" rx="2"/><path d="M8 7V5a4 4 0 018 0v2"/></svg>,
  stores: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 9l9-6 9 6v11a1 1 0 01-1 1H4a1 1 0 01-1-1V9z"/><path d="M9 21V12h6v9"/></svg>,
  messages: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 11.5a8.5 8.5 0 01-12.5 7.5L3 21l2-5.5A8.5 8.5 0 0121 11.5z"/></svg>,
  ai: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2l2.4 5.6L20 10l-5.6 2.4L12 18l-2.4-5.6L4 10l5.6-2.4L12 2z"/><path d="M19 3v3M20.5 4.5H17.5"/><path d="M5 17v2M6 18H4"/></svg>,
  sell: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
}

function HomePage() {
  const [session, setSession] = useState(null)
  const [aiInput, setAiInput] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getUser().then(({data})=>setSession(data))
  }, [])

  const getGreeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 18) return 'Good afternoon'
    return 'Good evening'
  }

  const userName = session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || session?.user?.email?.split('@')[0] || 'Akeem Ademabayoje'

  const handleAI = (e) => {
    e.preventDefault()
    if(!aiInput.trim()) return
    navigate(`/market?search=${encodeURIComponent(aiInput)}`)
  }

  const boxes = [
    { title: 'Market', desc: 'Buy from verified sellers. Phones, electronics, fashion, vehicles and more with escrow.', Icon: Icons.market, link: '/market', color: '#eef2ff' },
    { title: 'Jobs', desc: 'Hire trusted professionals or offer your service. Plumbers, tutors, developers nearby.', Icon: Icons.jobs, link: '/jobs', color: '#f0fdf4' },
    { title: 'Stores', desc: 'Wholesale hubs and logistics. Phone villages, car dealers, bulk goods and rider fleets.', Icon: Icons.stores, link: '/stores', color: '#fffbeb' },
    { title: 'Messages', desc: 'Secure conversations, offers, and delivery tracking. Real unread count, no spam.', Icon: Icons.messages, link: '/market/messages', color: '#faf5ff' },
    { title: 'Arvion AI', desc: 'Describe what you need in plain English. AI finds matching products and services.', Icon: Icons.ai, link: '/market', color: '#eff6ff' },
    { title: 'Sell & Earn', desc: 'List products, open a store, set up payouts and start earning on Arvion.', Icon: Icons.sell, link: '/market/new', color: '#fff7ed' },
  ]

  return (
    <div style={{minHeight:'100vh', background:'#fbfcfe'}}>
      <header style={{background:'#fff', borderBottom:'1px solid #eef0f3', position:'sticky', top:0, zIndex:20}}>
        <div style={{maxWidth:'1200px', margin:'0 auto', padding:'14px 24px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <Link to="/" style={{display:'flex', alignItems:'center', gap:'10px', textDecoration:'none', color:'#0f172a', fontWeight:'900', fontSize:'18px'}}>
            <img src={brandingLogo} alt="" style={{width:'32px', height:'32px', borderRadius:'8px', objectFit:'cover'}}/>
            Arvion
          </Link>
          <nav style={{display:'flex', gap:'28px', fontSize:'14px', fontWeight:'600'}}>
            <Link to="/" style={{color:'#0f172a', textDecoration:'none', borderBottom:'2px solid #0f172a', paddingBottom:'4px'}}>Home</Link>
            <Link to="/market" style={{color:'#64748b', textDecoration:'none'}}>Market</Link>
            <Link to="/jobs" style={{color:'#64748b', textDecoration:'none'}}>Jobs</Link>
            <Link to="/stores" style={{color:'#64748b', textDecoration:'none'}}>Stores</Link>
            <Link to="/market/messages" style={{color:'#64748b', textDecoration:'none'}}>Messages</Link>
          </nav>
          <Link to="/market/new" style={{background:'#0f172a', color:'#fff', padding:'10px 18px', borderRadius:'999px', textDecoration:'none', fontSize:'13px', fontWeight:'700'}}>+ Sell on Arvion</Link>
        </div>
      </header>

      <main style={{maxWidth:'1100px', margin:'0 auto', padding:'0 24px'}}>
        <div style={{padding:'72px 0 32px 0'}}>
          <span style={{fontSize:'11px', letterSpacing:'0.22em', fontWeight:'800', color:'#6366f1'}}>DISCOVER SOMETHING GOOD</span>
          <h1 style={{fontSize:'56px', fontWeight:'900', lineHeight:'1.05', marginTop:'14px', letterSpacing:'-0.03em', color:'#0f172a'}}>
            {getGreeting()},<br/>
            <span style={{color:'#1e293b'}}>{userName}</span>
          </h1>
          <p style={{fontSize:'16px', color:'#64748b', marginTop:'16px', maxWidth:'500px', lineHeight:'1.5'}}>Buy what you need from people and businesses across Arvion. Tell us what you need today.</p>
        </div>

        <form onSubmit={handleAI} style={{background:'#fff', border:'1px solid #e2e8f0', borderRadius:'20px', padding:'8px', display:'flex', gap:'8px', maxWidth:'720px', boxShadow:'0 8px 30px rgba(0,0,0,0.04)'}}>
          <div style={{flex:1, display:'flex', alignItems:'center', gap:'12px', padding:'0 18px'}}>
            <Icons.search/>
            <input value={aiInput} onChange={e=>setAiInput(e.target.value)} placeholder="Search phones, laptops, furniture... Try 'iPhone 15 Pro' or 'office chair'" style={{flex:1, border:'none', outline:'none', fontSize:'15px', padding:'14px 0', background:'transparent'}}/>
          </div>
          <button type="submit" style={{background:'#0f172a', color:'#fff', border:'none', padding:'0 28px', borderRadius:'14px', fontWeight:'700', cursor:'pointer', letterSpacing:'0.01em'}}>Search</button>
        </form>

        <div style={{height:'100px'}}></div>

        <div style={{paddingBottom:'80px'}}>
          <div style={{marginBottom:'22px'}}>
            <span style={{fontSize:'11px', letterSpacing:'0.18em', fontWeight:'800', color:'#94a3b8'}}>BROWSE ARVION</span>
            <h2 style={{fontSize:'22px', fontWeight:'800', marginTop:'6px', color:'#0f172a'}}>Everything in one place</h2>
          </div>

          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:'18px'}}>
            {boxes.map(b=>(
              <Link key={b.title} to={b.link} style={{textDecoration:'none', background:'#fff', border:'1px solid #eef0f3', borderRadius:'20px', padding:'26px', display:'flex', flexDirection:'column', minHeight:'182px'}}>
                <div style={{width:'44px', height:'44px', borderRadius:'12px', background:b.color, display:'flex', alignItems:'center', justifyContent:'center', color:'#0f172a', marginBottom:'16px'}}>
                  <b.Icon/>
                </div>
                <h3 style={{fontSize:'16px', fontWeight:'800', color:'#0f172a', letterSpacing:'-0.01em'}}>{b.title}</h3>
                <p style={{fontSize:'13.5px', color:'#64748b', marginTop:'8px', lineHeight:'1.5', flex:1}}>{b.desc}</p>
                <div style={{display:'flex', alignItems:'center', gap:'6px', marginTop:'16px', fontSize:'13px', fontWeight:'700', color:'#0f172a'}}>
                  Explore <span style={{fontSize:'14px'}}>→</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session)).finally(()=> setLoading(false))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])
  if (loading) return <p style={{padding:20}}>Loading...</p>

  const MarketPage = GetComp(MarketModule, ['MarketPage','Market'])
  const MarketDetail = GetComp(MarketModule, ['MarketListingDetailPage','ListingDetailPage'])
  const CreateMarket = GetComp(MarketModule, ['CreateMarketListingPage','CreateListingPage'])
  const MarketChat = GetComp(MarketModule, ['MarketChatPage','ChatPage'])
  const MarketInbox = GetComp(MarketModule, ['MarketMessagesInboxPage','MessagesInboxPage'])
  const JobsPage = GetComp(JobsModule, ['JobsPage','Jobs'])
  const CreateJobService = GetComp(JobsModule, ['CreateJobServicePage','CreateServicePage'])
  const CreateJobPost = GetComp(JobsModule, ['CreateJobPostPage','CreateJobPage'])
  const JobServiceDetail = GetComp(JobsModule, ['JobServiceDetailPage','ServiceDetailPage'])
  const JobDetail = GetComp(JobsModule, ['JobDetailPage'])
  const StoresPage = GetComp(StoresModule, ['StoresPage','Stores'])
  const StoreDetail = GetComp(StoresModule, ['StoreDetailPage'])
  const CreateStore = GetComp(StoresModule, ['CreateStorePage'])
  const CreateStoreProduct = GetComp(StoresModule, ['CreateStoreProductPage'])
  const AuthPage = GetComp(AuthModule, ['LoginPage','SignupPage','AuthPages','default'])
  const AdminPage = GetComp(AdminModule, ['AdminVerificationsPage','AdminVerificationPage','default'])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/market" element={MarketPage? <MarketPage /> : <div style={{padding:20}}>MarketPage missing</div>} />
        <Route path="/market/new" element={CreateMarket? <CreateMarket session={session} /> : <Navigate to="/market" />} />
        <Route path="/market/:listingId" element={MarketDetail? <MarketDetail /> : <div>Detail missing</div>} />
        <Route path="/market/chat/:conversationId" element={MarketChat? <MarketChat /> : <div>Chat missing</div>} />
        <Route path="/market/messages" element={MarketInbox? <MarketInbox /> : <div>Inbox missing</div>} />
        <Route path="/jobs" element={JobsPage? <JobsPage session={session} /> : <div>JobsPage missing</div>} />
        <Route path="/jobs/new-service" element={CreateJobService? <CreateJobService session={session} /> : <Navigate to="/jobs" />} />
        <Route path="/jobs/new-job" element={CreateJobPost? <CreateJobPost session={session} /> : <Navigate to="/jobs" />} />
        <Route path="/jobs/service/:serviceId" element={JobServiceDetail? <JobServiceDetail session={session} /> : <div>Missing</div>} />
        <Route path="/jobs/post/:jobId" element={JobDetail? <JobDetail session={session} /> : <div>Missing</div>} />
        <Route path="/stores" element={StoresPage? <StoresPage /> : <div>StoresPage missing</div>} />
        <Route path="/stores/new" element={CreateStore? <CreateStore session={session} /> : <Navigate to="/stores" />} />
        <Route path="/stores/:storeId" element={StoreDetail? <StoreDetail /> : <div>Missing</div>} />
        <Route path="/stores/:storeId/add-product" element={CreateStoreProduct? <CreateStoreProduct session={session} /> : <Navigate to="/stores" />} />
        <Route path="/login" element={<AuthPage />} />
        <Route path="/signup" element={<AuthPage />} />
        <Route path="/admin/verifications" element={AdminPage? <AdminPage /> : <div>Admin missing</div>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
export default App