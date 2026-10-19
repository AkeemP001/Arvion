import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import brandingLogo from '../../arvion-logo/arvion-logo.jpeg'
import { supabase } from '../lib/supabase'
import '../local.css'

const IMAGE_BUCKET = 'local-service-images'
const VERIFY_BUCKET = 'verifications'
const SERVICE_SELECT = 'id,provider_id,category_id,title,description,price_minor,currency,location_area,location_city,location_state,location_country,status,created_at,pricing_type,availability_days,availability_start,availability_end,is_remote,category:categories(name,slug),images:local_service_images(id,storage_path,sort_order)'
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const DAYS = [{k:'mon',l:'Mon'},{k:'tue',l:'Tue'},{k:'wed',l:'Wed'},{k:'thu',l:'Thu'},{k:'fri',l:'Fri'},{k:'sat',l:'Sat'},{k:'sun',l:'Sun'}]

const NAV_ITEMS = [
  { label: 'Home', path: '/' },
  { label: 'Market', path: '/market' },
  { label: 'Jobs', path: '/jobs' },
  { label: 'Stores', path: '/stores' },
  { label: 'Messages', path: '/market/messages' },
]

function getActive(pathname) {
  if (pathname.startsWith('/market/messages') || pathname.startsWith('/market/chat')) return 'Messages'
  if (pathname.startsWith('/market')) return 'Market'
  if (pathname.startsWith('/stores')) return 'Stores'
  if (pathname.startsWith('/jobs')) return 'Jobs'
  return 'Home'
}

function JobsHeader({ action }) {
  const location = useLocation()
  const active = getActive(location.pathname)
  const [unread, setUnread] = useState(0)
  useEffect(()=>{
    const fetchUnread = async()=>{
      try{
        const {data:{user}} = await supabase.auth.getUser()
        if(!user) return
        const {data:convs} = await supabase.from('market_conversations').select('id').or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        if(!convs) return
        const convIds = convs.map(c=>c.id)
        const {count} = await supabase.from('market_messages').select('id', {count:'exact', head:true}).in('conversation_id', convIds).neq('sender_id', user.id).eq('is_read', false)
        if(count!==null) setUnread(count)
      }catch(e){}
    }
    fetchUnread()
    const channel = supabase.channel('jobs-unread').on('postgres_changes',{event:'INSERT',schema:'public',table:'market_messages'}, fetchUnread).subscribe()
    return ()=>{ supabase.removeChannel(channel) }
  },[])
  return (
    <header className="local-header">
      <div className="local-header-inner">
        <Link to="/" className="local-brand"><img src={brandingLogo} alt="" /><span>Arvion</span></Link>
        <nav className="local-nav">
          {NAV_ITEMS.map(item=>(
            <Link key={item.label} to={item.path} className={active===item.label? 'active' : ''} style={{position:'relative'}}>
              {item.label}
              {item.label==='Messages' && unread>0 && <span style={{position:'absolute',top:'-8px',right:'-10px',background:'#ef4444',color:'#fff',fontSize:'10px',padding:'2px 6px',borderRadius:'999px',fontWeight:'800'}}>{unread>99?'99+':unread}</span>}
            </Link>
          ))}
        </nav>
        <Link className="local-header-action" to={action?.to || '/jobs/new-service'}>{action?.label || 'Offer Service'} ↗</Link>
      </div>
    </header>
  )
}

function parsePriceMinor(value) {
  const match = value.trim().match(/^(\d{1,17})(?:\.(\d{1,2}))?$/)
  if (!match) return null
  const minor = BigInt(match[1]) * 100n + BigInt((match[2] || '').padEnd(2, '0'))
  if (minor <= 0n || minor > 9223372036854775807n) return null
  return minor.toString()
}
function formatPrice(priceMinor, currency='NGN') {
  if(!priceMinor || priceMinor==='0') return 'Negotiable'
  const amount = Number(priceMinor)/100
  try { return new Intl.NumberFormat(undefined,{style:'currency',currency,maximumFractionDigits:2}).format(amount) } catch { return `${currency} ${amount.toLocaleString()}` }
}
function useLocalImageUrls(images=[]) {
  const pathsKey = JSON.stringify([...images].sort((a,b)=>(a.sort_order??0)-(b.sort_order??0)).map(i=>i.storage_path))
  const [imageUrls, setImageUrls] = useState([])
  useEffect(()=>{
    let isCurrent=true
    const load = async()=>{
      const paths=JSON.parse(pathsKey)
      if(!supabase || paths.length===0){ setImageUrls([]); return }
      const {data} = await supabase.storage.from(IMAGE_BUCKET).createSignedUrls(paths,3600)
      if(!isCurrent) return
      setImageUrls((data||[]).map(i=>i.signedUrl).filter(Boolean))
    }
    load()
    return ()=>{ isCurrent=false }
  },[pathsKey])
  return {imageUrls}
}
async function loadProviderIdentities(services) {
  if(!services.length) return {}
  const {data} = await supabase.rpc('get_local_service_provider_identities',{p_service_ids: services.map(s=>s.id)})
  return Object.fromEntries((data||[]).map(i=>[i.service_id,i]))
}
async function getVerification(userId) {
  const {data} = await supabase.from('verifications').select('*').eq('user_id', userId).maybeSingle()
  return data
}

export function JobsPage({ session }) {
  const [categories,setCategories]=useState([])
  const [services,setServices]=useState([])
  const [jobPosts,setJobPosts]=useState([])
  const [identities,setIdentities]=useState({})
  const [tab,setTab]=useState('services')
  const [categoryId,setCategoryId]=useState('')
  const [search,setSearch]=useState('')
  const [loading,setLoading]=useState(true)
  const [verification,setVerification]=useState(null)

  useEffect(()=>{
    const load=async()=>{
      const {data:cat}=await supabase.from('categories').select('id,name').eq('domain','LOCAL_JOB').eq('active',true).order('sort_order')
      setCategories(cat||[])
      const {data:srv}=await supabase.from('local_service_listings').select(SERVICE_SELECT).eq('status','ACTIVE').order('created_at',{ascending:false}).limit(100)
      setServices(srv||[])
      if(srv) setIdentities(await loadProviderIdentities(srv))
      const {data:jobs}=await supabase.from('job_posts').select('id,title,description,budget_minor,currency,location_type,created_at,status').eq('status','OPEN').order('created_at',{ascending:false}).limit(100)
      setJobPosts(jobs||[])
      if(session?.user?.id){
        const v=await getVerification(session.user.id)
        setVerification(v)
      }
      setLoading(false)
    }
    load()
  },[session])

  const visibleServices = useMemo(()=>{
    let list=services
    if(categoryId) list=list.filter(s=>s.category_id===categoryId)
    if(search.trim()){ const n=search.toLowerCase(); list=list.filter(s=>s.title.toLowerCase().includes(n)||s.description.toLowerCase().includes(n)) }
    return list
  },[services,categoryId,search])

  return (
    <div className="local-shell"><JobsHeader action={{to:'/jobs/new-service', label:'Post'}}/>
      <main className="local-main">
        <section className="local-hero"><div className="local-hero-copy"><span className="local-eyebrow">Hire or Be Hired</span><h1>Find work or<br/><em>offer your skill.</em></h1><p>Post a service with your portfolio, or post a job and get proposals. Escrow protected.</p>
          <div style={{display:'flex',gap:'12px',marginTop:'16px'}}>
            <Link to="/jobs/new-service" className="local-hero-action">Offer a Service ↗</Link>
            <Link to="/jobs/new-job" className="local-hero-action" style={{background:'#fff',color:'#0f172a',border:'1px solid #e2e8f0'}}>Post a Job ↗</Link>
          </div>
          {verification && verification.status!=='verified' && <div style={{marginTop:'16px',background:'#fef3c7',padding:'12px',borderRadius:'12px',fontSize:'13px'}}>Verification: {verification.status.toUpperCase()} — You must be verified to post. {verification.status==='rejected' && `Reason: ${verification.rejection_reason}`}</div>}
        </div></section>

        <section className="local-discovery">
          <div className="local-discovery-top"><div><span className="local-eyebrow">Arvion Jobs</span><h2>{tab==='services'? 'Services Offered' : 'Jobs Posted'}</h2></div>
            <div style={{display:'flex',gap:'8px'}}><button type="button" className={tab==='services'?'selected':''} onClick={()=>setTab('services')} style={{padding:'8px 14px',borderRadius:'999px',border:'1px solid #e2e8f0',background:tab==='services'?'#0f172a':'#fff',color:tab==='services'?'#fff':'#0f172a'}}>Services</button><button type="button" className={tab==='jobs'?'selected':''} onClick={()=>setTab('jobs')} style={{padding:'8px 14px',borderRadius:'999px',border:'1px solid #e2e8f0',background:tab==='jobs'?'#0f172a':'#fff',color:tab==='jobs'?'#fff':'#0f172a'}}>Job Posts</button></div>
          </div>
          <label className="local-search"><span>⌕</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={tab==='services'? 'Search web dev, mechanic, makeup...' : 'Search job posts...'}/></label>
          <div className="local-categories"><button className={!categoryId?'selected':''} onClick={()=>setCategoryId('')}>All</button>{categories.map(c=><button key={c.id} className={categoryId===c.id?'selected':''} onClick={()=>setCategoryId(c.id)}>{c.name}</button>)}</div>
        </section>

        <section className="local-results">
          {loading? <p>Loading...</p> : tab==='services'? (
            visibleServices.length? <div className="local-service-grid">{visibleServices.map(service=>{
              return <Link key={service.id} className="local-service-card" to={`/jobs/service/${service.id}`}><ServiceImage service={service}/><div className="local-service-card-copy"><div className="local-service-card-kicker"><span>{service.category?.name}</span><span>{service.is_remote?'Remote':'Local'}</span></div><h3>{service.title}</h3><div style={{fontSize:'12px',opacity:0.7}}>{service.availability_days?.join(', ')} • {service.availability_start}-{service.availability_end}</div><div className="local-card-bottom"><span>{service.location_area}</span><strong>{formatPrice(service.price_minor, service.currency)}</strong></div></div></Link>
            })}</div> : <div className="local-empty"><p>No services yet. Be first to offer.</p><Link to="/jobs/new-service">Offer Service</Link></div>
          ) : (
            jobPosts.length? <div style={{display:'grid',gap:'16px'}}>{jobPosts.map(j=>(
              <Link key={j.id} to={`/jobs/post/${j.id}`} style={{border:'1px solid #e2e8f0',borderRadius:'16px',padding:'20px',background:'#fff',textDecoration:'none',color:'inherit'}}><h3>{j.title}</h3><p style={{fontSize:'14px',opacity:0.8}}>{j.description.slice(0,120)}...</p><div style={{display:'flex',justifyContent:'space-between',marginTop:'12px'}}><span style={{fontSize:'12px',background:'#f1f5f9',padding:'4px 8px',borderRadius:'999px'}}>{j.location_type}</span><strong>{formatPrice(j.budget_minor, j.currency)}</strong></div></Link>
            ))}</div> : <div className="local-empty"><p>No job posts yet.</p><Link to="/jobs/new-job">Post a Job</Link></div>
          )}
        </section>
      </main>
    </div>
  )
}

function ServiceImage({service}){
  const {imageUrls}=useLocalImageUrls(service.images||[])
  return imageUrls[0]? <img className="local-service-image" src={imageUrls[0]} alt={service.title}/> : <div className="local-service-image local-image-placeholder">✳</div>
}
export function CreateJobServicePage({session}){
  const navigate=useNavigate()
  const [categories,setCategories]=useState([])
  const [categoryId,setCategoryId]=useState('')
  const [title,setTitle]=useState('')
  const [description,setDescription]=useState('')
  const [price,setPrice]=useState('')
  const [currency,setCurrency]=useState('NGN')
  const [pricingType,setPricingType]=useState('negotiable')
  const [isRemote,setIsRemote]=useState(false)
  const [area,setArea]=useState('')
  const [city,setCity]=useState('Lagos')
  const [days,setDays]=useState(['mon','tue','wed','thu','fri'])
  const [start,setStart]=useState('09:00')
  const [end,setEnd]=useState('17:00')
  const [files,setFiles]=useState([])
  const [error,setError]=useState('')
  const [submitting,setSubmitting]=useState(false)
  const [verification,setVerification]=useState(null)
  const [ninNumber,setNinNumber]=useState('')
  const [ninFile,setNinFile]=useState(null)
  const [faceFile,setFaceFile]=useState(null)

  useEffect(()=>{
    const load=async()=>{
      const {data:cat}=await supabase.from('categories').select('id,name').eq('domain','LOCAL_JOB').eq('active',true).order('sort_order')
      setCategories(cat||[])
      const v=await getVerification(session.user.id)
      setVerification(v)
    }
    load()
  },[session.user.id])

  const toggleDay=(k)=> setDays(prev=> prev.includes(k)? prev.filter(d=>d!==k) : [...prev,k])

  const handleVerificationSubmit=async(e)=>{
    e.preventDefault()
    if(!ninNumber.trim() ||!ninFile ||!faceFile){ setError('NIN number, NIN image and face selfie required'); return }
    setSubmitting(true)
    try{
      const ninPath=`${session.user.id}/${Date.now()}-nin-${ninFile.name}`
      const facePath=`${session.user.id}/${Date.now()}-face-${faceFile.name}`
      const {error:up1}=await supabase.storage.from(VERIFY_BUCKET).upload(ninPath, ninFile)
      if(up1) throw up1
      const {error:up2}=await supabase.storage.from(VERIFY_BUCKET).upload(facePath, faceFile)
      if(up2) throw up2
      const {error:ins}=await supabase.from('verifications').upsert({user_id:session.user.id, nin_number:ninNumber.trim(), nin_image_path:ninPath, face_image_path:facePath, status:'pending'}, {onConflict:'user_id'})
      if(ins) throw ins
      alert('Verification submitted - Pending review. You will be verified within 24h.')
      setVerification({status:'pending'})
    }catch(err){ setError(err.message) }
    setSubmitting(false)
  }

  const handleSubmit=async(e)=>{
    e.preventDefault()
    setError('')
    if(!verification || verification.status!=='verified'){ setError('You must be verified before offering service. Submit NIN first.'); return }
    if(title.trim().length<3) return setError('Title min 3 chars')
    if(description.trim().length<10) return setError('Description min 10 chars')
    if(!categoryId) return setError('Category required')
    const priceMinor= price.trim()? parsePriceMinor(price) : null
    if(price.trim() &&!priceMinor) return setError('Invalid price')
    const selectedFiles=Array.from(files)
    if(selectedFiles.length>2) return setError('Max 2 images only')
    if(selectedFiles.some(f=>!IMAGE_TYPES.includes(f.type)||f.size>5*1024*1024)) return setError('Images must be JPG/PNG/WebP <5MB')
    if(days.length===0) return setError('Select at least 1 available day')
    setSubmitting(true)
    try{
      const {data:service, error:insErr}=await supabase.from('local_service_listings').insert({
        provider_id:session.user.id, category_id:categoryId, title:title.trim(), description:description.trim(),
        price_minor: priceMinor || '0', currency, location_area: area.trim()||'Lagos', location_city:city.trim()||'Lagos',
        location_state:'Lagos', location_country:'Nigeria', status:'ACTIVE',
        pricing_type:pricingType, availability_days:days, availability_start:start, availability_end:end, is_remote:isRemote
      }).select('id').single()
      if(insErr) throw insErr
      for(const [idx,file] of selectedFiles.entries()){
        const path=`${service.id}/${crypto.randomUUID()}-${file.name}`
        const {error:upErr}=await supabase.storage.from(IMAGE_BUCKET).upload(path,file)
        if(upErr) throw upErr
        await supabase.from('local_service_images').insert({service_id:service.id, storage_path:path, sort_order:idx})
      }
      navigate(`/jobs/service/${service.id}`,{replace:true})
    }catch(err){ setError(err.message) }
    setSubmitting(false)
  }

  if(!verification || verification.status!=='verified'){
    return (
      <div className="local-shell"><JobsHeader action={{to:'/jobs', label:'Back to Jobs'}}/>
        <main className="local-main local-form-main"><h1>Verification Required</h1><p>You must be verified with NIN before offering services. This protects everyone.</p>
          <form className="local-form" onSubmit={handleVerificationSubmit}>
            <label className="local-field"><span>NIN Number *</span><input value={ninNumber} onChange={e=>setNinNumber(e.target.value)} placeholder="12345678901" required/></label>
            <label className="local-field"><span>NIN Slip/Card Photo * (must be clear)</span><input type="file" accept="image/*" onChange={e=>setNinFile(e.target.files?.[0])} required/></label>
            <label className="local-field"><span>Face Selfie Holding NIN *</span><input type="file" accept="image/*" onChange={e=>setFaceFile(e.target.files?.[0])} required/></label>
            {error && <div className="local-alert">{error}</div>}
            <button type="submit" className="local-primary-button" disabled={submitting}>{submitting?'Submitting...':'Submit for Verification'} ↗</button>
            {verification?.status==='pending' && <p style={{background:'#fef3c7',padding:'12px',borderRadius:'12px',marginTop:'12px'}}>Your verification is PENDING. Admin will review within 24h.</p>}
          </form>
        </main></div>
    )
  }

  return (
    <div className="local-shell"><JobsHeader action={{to:'/jobs', label:'Explore Jobs'}}/>
      <main className="local-main local-form-main"><Link to="/jobs" className="local-back-link">← Back to Jobs</Link>
        <section className="local-form-intro"><span className="local-eyebrow">Offer your skill</span><h1>Offer a Service</h1><p>Post what you can do, add 2 portfolio images, set availability. Verified badge shown.</p></section>
        <form className="local-form" onSubmit={handleSubmit}>
          <section className="local-form-section"><div className="local-form-section-heading"><span>01</span><h2>Service details</h2></div>
            <label className="local-field"><span>Title *</span><input value={title} onChange={e=>setTitle(e.target.value)} maxLength={120} placeholder="e.g. I will build responsive website in 3 days" required/></label>
            <label className="local-field"><span>Description *</span><textarea value={description} onChange={e=>setDescription(e.target.value)} maxLength={5000} rows={5} required placeholder="What you do, tools, delivery time..."/></label>
            <div className="local-field-grid"><label className="local-field"><span>Category *</span><select value={categoryId} onChange={e=>setCategoryId(e.target.value)} required><option value="">Select</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
              <label className="local-field"><span>Pricing Type *</span><select value={pricingType} onChange={e=>setPricingType(e.target.value)}><option value="negotiable">Negotiable</option><option value="fixed">Fixed</option><option value="hourly">Hourly</option></select></label></div>
            <div className="local-field-grid"><label className="local-field"><span>Starting Price (optional)</span><input value={price} onChange={e=>setPrice(e.target.value)} placeholder="e.g. 50000"/></label><label className="local-field"><span>Currency</span><input value={currency} onChange={e=>setCurrency(e.target.value)} maxLength={3}/></label></div>
            <label className="local-field"><span><input type="checkbox" checked={isRemote} onChange={e=>setIsRemote(e.target.checked)}/> Remote service</span></label>
          </section>
          <section className="local-form-section"><div className="local-form-section-heading"><span>02</span><h2>Availability *</h2></div>
            <div style={{display:'flex',flexWrap:'wrap',gap:'8px'}}>{DAYS.map(d=><button key={d.k} type="button" className={days.includes(d.k)?'selected':''} onClick={()=>toggleDay(d.k)} style={{padding:'6px 12px',borderRadius:'999px',border:'1px solid #e2e8f0',background:days.includes(d.k)?'#0f172a':'#fff',color:days.includes(d.k)?'#fff':'#0f172a'}}>{d.l}</button>)}</div>
            <div className="local-field-grid" style={{marginTop:'12px'}}><label className="local-field"><span>Start Time</span><input type="time" value={start} onChange={e=>setStart(e.target.value)}/></label><label className="local-field"><span>End Time</span><input type="time" value={end} onChange={e=>setEnd(e.target.value)}/></label></div>
            <div className="local-field-grid"><label className="local-field"><span>Area</span><input value={area} onChange={e=>setArea(e.target.value)} placeholder="Ikeja"/></label><label className="local-field"><span>City</span><input value={city} onChange={e=>setCity(e.target.value)}/></label></div>
          </section>
          <section className="local-form-section"><div className="local-form-section-heading"><span>03</span><h2>Portfolio (2 images max)</h2></div>
            <label className="local-upload"><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e=>setFiles(e.target.files||[])}/><span>＋</span><strong>{files.length? `${files.length} selected` : 'Add portfolio images'}</strong><span>Max 2, JPG/PNG/WebP, 5MB each</span></label>
          </section>
          {error && <div className="local-alert">{error}</div>}
          <div className="local-form-actions"><button type="submit" className="local-primary-button" disabled={submitting}>{submitting?'Publishing...':'Publish Service'} ↗</button><Link to="/jobs" className="local-cancel">Cancel</Link></div>
        </form>
      </main></div>
  )
}

export function CreateJobPostPage({session}){
  const navigate=useNavigate()
  const [categories,setCategories]=useState([])
  const [title,setTitle]=useState('')
  const [description,setDescription]=useState('')
  const [budget,setBudget]=useState('')
  const [locationType,setLocationType]=useState('remote')
  const [area,setArea]=useState('')
  const [categoryId,setCategoryId]=useState('')
  const [error,setError]=useState('')
  const [submitting,setSubmitting]=useState(false)
  const [verification,setVerification]=useState(null)
  useEffect(()=>{(async()=>{
    const {data:cat}=await supabase.from('categories').select('id,name').eq('domain','LOCAL_JOB').eq('active',true).order('sort_order')
    setCategories(cat||[])
    const v=await getVerification(session.user.id)
    setVerification(v)
  })()},[session.user.id])
  const handleSubmit=async(e)=>{
    e.preventDefault()
    if(!verification || verification.status!=='verified'){ setError('Must be verified to post jobs'); return }
    const budgetMinor=parsePriceMinor(budget)
    if(!budgetMinor) return setError('Invalid budget')
    setSubmitting(true)
    try{
      const {data,error:ins}=await supabase.from('job_posts').insert({client_id:session.user.id, category_id:categoryId||null, title:title.trim(), description:description.trim(), budget_minor:budgetMinor, currency:'NGN', location_type:locationType, location_area:area.trim()||null, status:'OPEN'}).select('id').single()
      if(ins) throw ins
      navigate(`/jobs/post/${data.id}`)
    }catch(err){ setError(err.message) }
    setSubmitting(false)
  }
  if(!verification || verification.status!=='verified'){
    return <div className="local-shell"><JobsHeader/><main className="local-main"><p style={{padding:'40px'}}>You must be verified to post jobs. Go to Offer Service page to verify with NIN.</p><Link to="/jobs/new-service">Verify Now</Link></main></div>
  }
  return (
    <div className="local-shell"><JobsHeader action={{to:'/jobs',label:'Explore Jobs'}}/>
      <main className="local-main local-form-main"><Link to="/jobs" className="local-back-link">← Back to Jobs</Link><h1>Post a Job — Hire Someone</h1>
        <form className="local-form" onSubmit={handleSubmit}>
          <label className="local-field"><span>What do you need? *</span><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Need website designer" required/></label>
          <label className="local-field"><span>Description *</span><textarea value={description} onChange={e=>setDescription(e.target.value)} rows={5} required/></label>
          <div className="local-field-grid"><label className="local-field"><span>Budget *</span><input value={budget} onChange={e=>setBudget(e.target.value)} placeholder="50000" required/></label><label className="local-field"><span>Category</span><select value={categoryId} onChange={e=>setCategoryId(e.target.value)}><option value="">Select</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label></div>
          <div className="local-field-grid"><label className="local-field"><span>Location Type</span><select value={locationType} onChange={e=>setLocationType(e.target.value)}><option value="remote">Remote</option><option value="physical">Physical</option></select></label><label className="local-field"><span>Area (if physical)</span><input value={area} onChange={e=>setArea(e.target.value)} placeholder="Lekki"/></label></div>
          {error && <div className="local-alert">{error}</div>}
          <button type="submit" className="local-primary-button" disabled={submitting}>{submitting?'Posting...':'Post Job'} ↗</button>
        </form>
      </main></div>
  )
}

export function JobServiceDetailPage({session}){
  const {serviceId}=useParams()
  const [service,setService]=useState(null)
  const [identity,setIdentity]=useState(null)
  const [reviews,setReviews]=useState([])
  const [bookings,setBookings]=useState([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [agreedPrice,setAgreedPrice]=useState('')
  const [timeDate,setTimeDate]=useState('')
  const [timeTime,setTimeTime]=useState('')
  const [bookingError,setBookingError]=useState('')
  const [isOwner,setIsOwner]=useState(false)
  const {imageUrls}=useLocalImageUrls(service?.images||[])

  useEffect(()=>{
    const load=async()=>{
      const {data,error:err}=await supabase.from('local_service_listings').select(SERVICE_SELECT).eq('id',serviceId).maybeSingle()
      if(err){ setError('Could not load'); setLoading(false); return }
      setService(data)
      setIsOwner(data?.provider_id===session?.user?.id)
      if(data){ const ids=await loadProviderIdentities([data]); setIdentity(ids[data.id]||null)
        const {data:rev}=await supabase.from('job_reviews').select('*').eq('reviewee_id',data.provider_id).order('created_at',{ascending:false}).limit(20)
        setReviews(rev||[])
        const {data:book}=await supabase.from('job_bookings').select('*').eq('service_id',data.id).order('created_at',{ascending:false})
        setBookings(book||[])
      }
      setLoading(false)
    }
    load()
  },[serviceId,session])

  const handleSetPrice=async()=>{
    const minor=parsePriceMinor(agreedPrice)
    if(!minor){ setBookingError('Invalid price'); return }
    const {data:{user}}=await supabase.auth.getUser()
    if(!user) return
    const {data,error}=await supabase.from('job_bookings').insert({service_id:service.id, client_id:service.provider_id===user.id? service.provider_id : user.id, provider_id:service.provider_id, agreed_price_minor:minor, currency:'NGN', status:'PENDING_PAYMENT', time_slot_date: timeDate||null, time_slot_time: timeTime||null}).select('id').single()
    if(error){ setBookingError(error.message); return }
    setBookingError('')
    alert('Price set! Client can now pay. Escrow flow started.')
  }

  const handlePay=async(booking)=>{
    const {error}=await supabase.from('job_bookings').update({status:'ESCROW_HELD', paid_at:new Date().toISOString()}).eq('id',booking.id)
    if(error) setBookingError(error.message); else { alert('Paid to escrow! Provider will start work.'); window.location.reload() }
  }

  const handleConfirm=async(booking)=>{
    if(!confirm('Confirm work done? Money will be released to provider minus 10% fee.')) return
    const {error}=await supabase.from('job_bookings').update({status:'COMPLETED', completed_at:new Date().toISOString()}).eq('id',booking.id)
    if(error) setBookingError(error.message); else { alert('Confirmed! Money released. Please leave a review.'); window.location.reload() }
  }

  if(loading) return <div className="local-shell"><JobsHeader/><main className="local-main"><p>Loading...</p></main></div>
  if(!service) return <div className="local-shell"><JobsHeader/><main className="local-main"><p>Service not found</p></main></div>

  return (
    <div className="local-shell"><JobsHeader action={{to:'/jobs',label:'Explore Jobs'}}/>
      <main className="local-main local-detail-main"><Link to="/jobs" className="local-back-link">← Back to Jobs</Link>
        <article className="local-detail">
          <div className="local-detail-gallery">{imageUrls.length? imageUrls.map(u=><img key={u} src={u} alt={service.title}/>) : <div className="local-detail-placeholder">✳</div>}</div>
          <div className="local-detail-copy">
            <span className="local-eyebrow">{service.category?.name} {service.is_remote?'• Remote':''}</span>
            <h1>{service.title} {identity?.arvion_id && <span style={{background:'#dbeafe',color:'#1e40af',fontSize:'12px',padding:'4px 8px',borderRadius:'999px',marginLeft:'8px'}}>✓ Verified</span>}</h1>
            <div className="local-detail-provider"><span>{identity?.display_name||'Provider'} {identity?.arvion_id? `@${identity.arvion_id}`:''}</span></div>
            <strong className="local-detail-price">{formatPrice(service.price_minor, service.currency)} • {service.pricing_type}</strong>
            <div className="local-detail-facts"><div><span>Available</span><strong>{service.availability_days?.join(', ')} {service.availability_start}-{service.availability_end}</strong></div><div><span>Location</span><strong>{service.location_area}, {service.location_city}</strong></div></div>
            <section className="local-description"><h2>About</h2><p>{service.description}</p></section>

            {!isOwner && (
              <div style={{border:'1px solid #e2e8f0',borderRadius:'16px',padding:'16px',marginTop:'20px'}}>
                <h3>Book this service</h3>
                <p style={{fontSize:'13px',opacity:0.7}}>Chat with provider to agree price, then pay to escrow.</p>
                <div className="local-field-grid"><label className="local-field"><span>Date</span><input type="date" value={timeDate} onChange={e=>setTimeDate(e.target.value)}/></label><label className="local-field"><span>Time</span><input type="time" value={timeTime} onChange={e=>setTimeTime(e.target.value)}/></label></div>
                <div style={{display:'flex',gap:'8px',marginTop:'12px'}}><Link to={`/market/chat/${service.provider_id}`} className="local-primary-button" style={{textDecoration:'none',textAlign:'center'}}>Chat Provider</Link><Link to="/market/messages" className="local-cancel" style={{border:'1px solid #e2e8f0',padding:'10px 16px',borderRadius:'999px'}}>Messages</Link></div>
              </div>
            )}

            {isOwner && (
              <div style={{border:'1px dashed #0f172a',borderRadius:'16px',padding:'16px',marginTop:'20px'}}>
                <h3>Provider Tools — Set Agreed Price</h3>
                <div className="local-field-grid"><label className="local-field"><span>Agreed Price *</span><input value={agreedPrice} onChange={e=>setAgreedPrice(e.target.value)} placeholder="50000"/></label><label className="local-field"><span>Date</span><input type="date" value={timeDate} onChange={e=>setTimeDate(e.target.value)}/></label></div>
                <label className="local-field"><span>Time</span><input type="time" value={timeTime} onChange={e=>setTimeTime(e.target.value)}/></label>
                {bookingError && <div className="local-alert">{bookingError}</div>}
                <button type="button" onClick={handleSetPrice} className="local-primary-button" style={{marginTop:'12px'}}>Set Price & Create Booking ↗</button>
              </div>
            )}

            <section style={{marginTop:'24px'}}><h3>Bookings / Escrow</h3>{bookings.length? bookings.map(b=>(
              <div key={b.id} style={{border:'1px solid #e2e8f0',borderRadius:'12px',padding:'12px',marginTop:'8px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div><div style={{fontSize:'13px'}}>{formatPrice(b.agreed_price_minor,b.currency)} • {b.status}</div><div style={{fontSize:'11px',opacity:0.6}}>{b.time_slot_date} {b.time_slot_time}</div></div>
                <div>{b.status==='PENDING_PAYMENT' &&!isOwner && <button onClick={()=>handlePay(b)} className="local-primary-button" style={{padding:'6px 12px',fontSize:'12px'}}>Pay to Escrow</button>}
                {b.status==='ESCROW_HELD' &&!isOwner && <button onClick={()=>handleConfirm(b)} className="local-primary-button" style={{padding:'6px 12px',fontSize:'12px',background:'#16a34a'}}>Confirm Done</button>}
                {b.status==='COMPLETED' && <span style={{fontSize:'12px',color:'#16a34a'}}>✓ Completed</span>}</div>
              </div>
            )) : <p style={{fontSize:'13px',opacity:0.6}}>No bookings yet.</p>}</section>

            <section style={{marginTop:'24px'}}><h3>Reviews ({reviews.length})</h3>{reviews.length? reviews.map(r=><div key={r.id} style={{borderBottom:'1px solid #f1f5f9',padding:'12px 0'}}><strong>{'★'.repeat(r.rating)}{'☆'.repeat(5-r.rating)}</strong><p style={{fontSize:'13px'}}>{r.comment}</p></div>) : <p style={{fontSize:'13px',opacity:0.6}}>No reviews yet.</p>}</section>
          </div>
        </article>
      </main></div>
  )
}

export function JobDetailPage({session}){
  const {jobId}=useParams()
  const [job,setJob]=useState(null)
  const [proposals,setProposals]=useState([])
  const [message,setMessage]=useState('')
  const [price,setPrice]=useState('')
  const [error,setError]=useState('')
  useEffect(()=>{(async()=>{
    const {data}=await supabase.from('job_posts').select('*').eq('id',jobId).maybeSingle()
    setJob(data)
    const {data:props}=await supabase.from('job_proposals').select('*').eq('job_id',jobId).order('created_at',{ascending:false})
    setProposals(props||[])
  })()},[jobId])
  const handlePropose=async(e)=>{
    e.preventDefault()
    const minor=price.trim()?parsePriceMinor(price):null
    if(!message.trim()){ setError('Message required'); return }
    const {error:ins}=await supabase.from('job_proposals').insert({job_id:jobId, freelancer_id:session.user.id, message:message.trim(), proposed_price_minor:minor||0})
    if(ins) setError(ins.message); else { setMessage(''); setPrice(''); window.location.reload() }
  }
  if(!job) return <div className="local-shell"><JobsHeader/><main className="local-main"><p>Loading job...</p></main></div>
  return (
    <div className="local-shell"><JobsHeader action={{to:'/jobs',label:'Explore Jobs'}}/>
      <main className="local-main local-detail-main"><Link to="/jobs" className="local-back-link">← Back</Link><h1>{job.title}</h1><p>{job.description}</p><strong>{formatPrice(job.budget_minor,job.currency)}</strong>
        <section style={{marginTop:'24px'}}><h3>Proposals ({proposals.length})</h3>{proposals.map(p=><div key={p.id} style={{border:'1px solid #e2e8f0',borderRadius:'12px',padding:'12px',marginTop:'8px'}}><p style={{fontSize:'13px'}}>{p.message}</p><strong style={{fontSize:'12px'}}>{formatPrice(p.proposed_price_minor,'NGN')}</strong></div>)}
          <form onSubmit={handlePropose} style={{marginTop:'20px',border:'1px solid #e2e8f0',borderRadius:'16px',padding:'16px'}}>
            <h4>Send Proposal</h4><label className="local-field"><span>Message *</span><textarea value={message} onChange={e=>setMessage(e.target.value)} rows={3} required/></label><label className="local-field"><span>Your Price (optional)</span><input value={price} onChange={e=>setPrice(e.target.value)} placeholder="40000"/></label>{error && <div className="local-alert">{error}</div>}<button type="submit" className="local-primary-button">Send Proposal ↗</button>
          </form>
        </section>
      </main></div>
  )
}