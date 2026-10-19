// @ts-nocheck
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import brandingLogo from '../../arvion-logo/arvion-logo.jpeg'
import { supabase } from '../lib/supabase'
import '../local.css'

const CATEGORIES = [
  {k:'', l:'All Stores'},
  {k:'phones', l:'Phones'},
  {k:'cars', l:'Cars'},
  {k:'electronics', l:'Electronics'},
  {k:'fashion', l:'Fashion'},
  {k:'grocery', l:'Grocery'},
  {k:'logistics', l:'Delivery / Riders'},
  {k:'other', l:'Other'},
]

const NAV_ITEMS = [
  { label: 'Home', path: '/' },
  { label: 'Market', path: '/market' },
  { label: 'Jobs', path: '/jobs' },
  { label: 'Stores', path: '/stores' },
  { label: 'Messages', path: '/market/messages' },
]

function getActive(p){
  if(p.startsWith('/market/messages')||p.startsWith('/market/chat')) return 'Messages'
  if(p.startsWith('/market')) return 'Market'
  if(p.startsWith('/stores')) return 'Stores'
  if(p.startsWith('/jobs')) return 'Jobs'
  return 'Home'
}

function StoresHeader(){
  const location=useLocation()
  const active=getActive(location.pathname)
  const [unread,setUnread]=useState(0)
  useEffect(()=>{
    const fetchUnread=async()=>{
      try{
        const {data:{user}}=await supabase.auth.getUser()
        if(!user) return
        const {data:convs}=await supabase.from('market_conversations').select('id').or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        if(!convs) return
        const convIds=convs.map(c=>c.id)
        const {count}=await supabase.from('market_messages').select('id', {count:'exact', head:true}).in('conversation_id', convIds).neq('sender_id', user.id).eq('is_read', false)
        if(count!==null) setUnread(count)
      }catch(e){}
    }
    fetchUnread()
  },[])
  return (
    <header className="local-header">
      <div className="local-header-inner">
        <Link to="/" className="local-brand"><img src={brandingLogo} alt=""/><span>Arvion</span></Link>
        <nav className="local-nav">
          {NAV_ITEMS.map(item=>(
            <Link key={item.label} to={item.path} className={active===item.label?'active':''} style={{position:'relative'}}>
              {item.label}
              {item.label==='Messages' && unread>0 && <span style={{position:'absolute',top:'-8px',right:'-10px',background:'#ef4444',color:'#fff',fontSize:'10px',padding:'2px 6px',borderRadius:'999px',fontWeight:'800'}}>{unread>99?'99+':unread}</span>}
            </Link>
          ))}
        </nav>
        <Link className="local-header-action" to="/stores/new">Open Store ↗</Link>
      </div>
    </header>
  )
}

function formatPrice(pm,c='NGN'){
  const a=Number(pm)/100
  try{ return new Intl.NumberFormat('en-NG',{style:'currency',currency:c}).format(a) }catch{ return `${c} ${a}` }
}

export function StoresPage(){
  const [stores,setStores]=useState([])
  const [cat,setCat]=useState('')
  const [search,setSearch]=useState('')
  const [loading,setLoading]=useState(true)
  useEffect(()=>{
    const load=async()=>{
      setLoading(true)
      let q=supabase.from('stores').select('*').order('created_at',{ascending:false}).limit(100)
      if(cat) q=q.eq('category',cat)
      if(search.trim()) q=q.ilike('business_name', `%${search.trim()}%`)
      const {data}=await q
      setStores(data||[])
      setLoading(false)
    }
    const t=setTimeout(load,200)
    return ()=>clearTimeout(t)
  },[cat,search])
  return (
    <div className="local-shell"><StoresHeader/>
      <main className="local-main">
        <section className="local-hero"><div className="local-hero-copy"><span className="local-eyebrow">Wholesale + Logistics</span><h1>Arvion <em>Stores</em></h1><p>Big businesses with huge stock, car dealers, phone villages. Rider companies also here for delivery.</p><Link to="/stores/new" className="local-hero-action">Open Your Store ↗</Link></div></section>
        <section className="local-discovery"><label className="local-search"><span>⌕</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search stores, e.g. iPhone village, Gokada, car dealer..."/></label><div className="local-categories">{CATEGORIES.map(c=><button key={c.l} className={cat===c.k?'selected':''} onClick={()=>setCat(c.k)}>{c.l}</button>)}</div></section>
        <section className="local-results">
          {loading? <p>Loading stores...</p> : stores.length? <div className="local-service-grid">{stores.map(s=>(
            <Link key={s.id} to={`/stores/${s.id}`} className="local-service-card" style={{textDecoration:'none',color:'inherit'}}>
              <div className="local-service-image local-image-placeholder" style={{background:'#0f172a',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'24px',fontWeight:'800'}}>{s.business_name.slice(0,2).toUpperCase()}</div>
              <div className="local-service-card-copy"><div className="local-service-card-kicker"><span>{s.category}</span><span>{s.is_verified?'✓ Verified':'Unverified'}</span></div><h3>{s.business_name}</h3><p style={{fontSize:'13px',opacity:0.7}}>{s.description?.slice(0,80)}...</p><div className="local-card-bottom"><span>{s.city} • {s.address?.slice(0,20)}</span><strong>{s.category==='logistics'?'Hire Riders':'View Stock'}</strong></div></div>
            </Link>
          ))}</div> : <div className="local-empty"><p>No stores yet in this category. Be first to open.</p><Link to="/stores/new">Open Store</Link></div>}
        </section>
      </main></div>
  )
}

export function StoreDetailPage(){
  const {storeId}=useParams()
  const [store,setStore]=useState(null)
  const [products,setProducts]=useState([])
  const [loading,setLoading]=useState(true)
  const [currentUserId, setCurrentUserId]=useState(null)
  const [selected,setSelected]=useState(null)
  const [qty,setQty]=useState(1)
  const [showOffer,setShowOffer]=useState(false)
  const [offerPrice,setOfferPrice]=useState('')
  const [offerMsg,setOfferMsg]=useState('')

  useEffect(()=>{(async()=>{
    const {data:{user}} = await supabase.auth.getUser()
    setCurrentUserId(user?.id || null)
    const {data:s}=await supabase.from('stores').select('*').eq('id',storeId).maybeSingle()
    setStore(s)
    const {data:p}=await supabase.from('store_products').select('*').eq('store_id',storeId).eq('status','ACTIVE').order('created_at',{ascending:false})
    setProducts(p||[])
    setLoading(false)
  })()},[storeId])

  if(loading) return <div className="local-shell"><StoresHeader/><main className="local-main"><p>Loading...</p></main></div>
  if(!store) return <div className="local-shell"><StoresHeader/><main className="local-main"><p>Store not found</p></main></div>

  return (
    <div className="local-shell"><StoresHeader/><main className="local-main local-detail-main"><Link to="/stores" className="local-back-link">← Back to Stores</Link>
      <div style={{background:'#0f172a',color:'#fff',borderRadius:'24px',padding:'32px',marginBottom:'24px'}}>
        <h1 style={{fontSize:'32px'}}>{store.business_name} {store.is_verified && <span style={{background:'#fff',color:'#0f172a',fontSize:'12px',padding:'4px 10px',borderRadius:'999px',marginLeft:'8px'}}>✓ Verified Business</span>}</h1>
        <p style={{opacity:0.8,marginTop:'8px'}}>{store.description}</p>
        <div style={{marginTop:'16px',fontSize:'13px',opacity:0.7}}>{store.address} • {store.city} • {store.category.toUpperCase()}</div>
        <div style={{marginTop:'16px',display:'flex',gap:'12px'}}><Link to={`/market/chat/${store.owner_id}`} style={{background:'#fff',color:'#0f172a',padding:'10px 18px',borderRadius:'999px',textDecoration:'none',fontWeight:'700'}}>Chat Business 💬</Link>{store.category==='logistics' && <span style={{background:'#fde68a',color:'#92400e',padding:'10px 18px',borderRadius:'999px',fontSize:'13px',fontWeight:'700'}}>🚚 Available for Delivery</span>}</div>
      </div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
        <h2>{store.category==='logistics'? 'Delivery Services' : `Stock (${products.length}) — Bulk Available`}</h2>
        {currentUserId === store.owner_id && (
          <Link to={`/stores/${storeId}/add-product`} style={{background:'#0f172a',color:'#fff',padding:'10px 18px',borderRadius:'999px',textDecoration:'none',fontWeight:'700',fontSize:'13px'}}>+ Add Product</Link>
        )}
      </div>
      {products.length? <div className="local-service-grid">{products.map(pr=>(
        <div key={pr.id} className="local-service-card" style={{cursor:'pointer'}} onClick={()=>{ setSelected(pr); setQty(1); setOfferPrice((Number(pr.price_minor)/100).toString()); setShowOffer(false) }}>
          <div className="local-service-image local-image-placeholder">{pr.title.slice(0,2)}</div>
          <div className="local-service-card-copy"><h3>{pr.title}</h3><p style={{fontSize:'12px',opacity:0.7}}>Qty: {pr.quantity} in stock — tap to buy</p><div className="local-card-bottom"><span>{pr.description?.slice(0,30)}</span><strong>{formatPrice(pr.price_minor, pr.currency)}</strong></div></div>
        </div>
      ))}</div> : <div className="local-empty"><p>No products yet. Owner will add bulk stock.</p>{currentUserId === store.owner_id && <Link to={`/stores/${storeId}/add-product`} style={{marginTop:'12px',display:'inline-block',background:'#0f172a',color:'#fff',padding:'10px 18px',borderRadius:'999px',textDecoration:'none',fontWeight:'700'}}>Add Your First Product ↗</Link>}</div>}

      {selected && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:999,display:'flex',alignItems:'center',justifyContent:'center',padding:'16px'}} onClick={()=>setSelected(null)}>
          <div style={{background:'#fff',width:'100%',maxWidth:'400px',borderRadius:'20px',padding:'16px'}} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:'12px'}}><b>{selected.title}</b><button onClick={()=>setSelected(null)} style={{border:'none',background:'#f1f5f9',width:'32px',height:'32px',borderRadius:'50%'}}>✕</button></div>
            <p style={{fontSize:'13px',color:'#64748b',marginBottom:'8px'}}>{selected.description}</p>
            <p style={{fontWeight:'800',fontSize:'18px',marginBottom:'12px'}}>{formatPrice(selected.price_minor, selected.currency)}</p>
            <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'14px'}}>
              <span style={{fontSize:'13px',fontWeight:'700'}}>Qty:</span>
              <button onClick={()=>setQty(Math.max(1,qty-1))} style={{width:'32px',height:'32px',borderRadius:'50%',border:'1px solid #ddd',background:'#fff'}}>−</button>
              <span style={{width:'30px',textAlign:'center',fontWeight:'800'}}>{qty}</span>
              <button onClick={()=>setQty(Math.min(selected.quantity, qty+1))} style={{width:'32px',height:'32px',borderRadius:'50%',border:'1px solid #ddd',background:'#fff'}}>+</button>
            </div>
            {!showOffer? (
              <>
                <button onClick={()=>{ const k=`cart_${currentUserId}`; const ex=JSON.parse(localStorage.getItem(k)||"[]"); ex.push({...selected,buyQty:qty}); localStorage.setItem(k,JSON.stringify(ex)); alert('Added '+qty+' to cart'); setSelected(null) }} style={{width:'100%',background:'#0f172a',color:'#fff',padding:'12px',borderRadius:'999px',border:'none',fontWeight:'700',marginBottom:'8px',cursor:'pointer'}}>Add {qty} to Cart 🛒</button>
                <button onClick={()=>setShowOffer(true)} style={{width:'100%',background:'#fef3c7',padding:'12px',borderRadius:'999px',border:'none',fontWeight:'700',marginBottom:'8px',cursor:'pointer'}}>Make Offer (Bid) 💰</button>
                <Link to={`/market/chat/${store.owner_id}`} style={{display:'block',textAlign:'center',background:'#f1f5f9',padding:'12px',borderRadius:'999px',textDecoration:'none',color:'#0f172a',fontWeight:'700'}}>Chat Seller 💬</Link>
              </>
            ) : (
              <div style={{background:'#f8fafc',padding:'12px',borderRadius:'12px',border:'1px solid #e2e8f0'}}>
                <input type="number" value={offerPrice} onChange={e=>setOfferPrice(e.target.value)} placeholder="Your offer price" style={{width:'100%',padding:'10px',borderRadius:'8px',border:'1px solid #cbd5e1',marginBottom:'8px'}}/>
                <textarea value={offerMsg} onChange={e=>setOfferMsg(e.target.value)} placeholder="Message (optional)" rows={2} style={{width:'100%',padding:'10px',borderRadius:'8px',border:'1px solid #cbd5e1',marginBottom:'8px'}}/>
                <button onClick={async()=>{ if(!offerPrice){ alert('Enter price'); return } const {error}=await supabase.from('store_offers').insert({store_id:storeId,product_id:selected.id,buyer_id:currentUserId,seller_id:store.owner_id,offered_price:Number(offerPrice),quantity:qty,message:offerMsg}); if(error) alert(error.message); else { alert('Offer sent'); setSelected(null) } }} style={{width:'100%',background:'#0f172a',color:'#fff',padding:'10px',borderRadius:'999px',border:'none',fontWeight:'700'}}>Send Offer for {qty}</button>
                <button onClick={()=>setShowOffer(false)} style={{width:'100%',marginTop:'6px',background:'transparent',border:'none',cursor:'pointer'}}>Cancel</button>
              </div>
            )}
          </div>
        </div>
      )}
    </main></div>
  )
}

export function CreateStorePage({session}){
  const navigate=useNavigate()
  const [businessName,setBusinessName]=useState('')
  const [description,setDescription]=useState('')
  const [category,setCategory]=useState('phones')
  const [address,setAddress]=useState('')
  const [city,setCity]=useState('Lagos')
  const [cac,setCac]=useState('')
  const [error,setError]=useState('')
  const [submitting,setSubmitting]=useState(false)
  const handleSubmit=async(e)=>{
    e.preventDefault()
    if(businessName.trim().length<3) return setError('Business name min 3 chars')
    if(description.trim().length<10) return setError('Description min 10')
    if(!address.trim()) return setError('Address required')
    setSubmitting(true)
    try{
      const {data,error:ins}=await supabase.from('stores').insert({owner_id:session.user.id, business_name:businessName.trim(), description:description.trim(), category, address:address.trim(), city:city.trim(), cac_number:cac.trim()||null}).select('id').single()
      if(ins) throw ins
      navigate(`/stores/${data.id}`)
    }catch(err){ setError(err.message) }
    setSubmitting(false)
  }
  return (
    <div className="local-shell"><StoresHeader/>
      <main className="local-main local-form-main"><Link to="/stores" className="local-back-link">← Back to Stores</Link><section className="local-form-intro"><span className="local-eyebrow">For big businesses</span><h1>Open Your Store</h1><p>Sell phones, cars, bulk goods or register as rider/delivery company. Customers will chat you directly.</p></section>
        <form className="local-form" onSubmit={handleSubmit}>
          <label className="local-field"><span>Business Name *</span><input value={businessName} onChange={e=>setBusinessName(e.target.value)} placeholder="e.g. Computer Village Phones Ltd" required/></label>
          <label className="local-field"><span>Description *</span><textarea value={description} onChange={e=>setDescription(e.target.value)} rows={4} placeholder="What do you sell? How many in stock? Delivery areas?" required/></label>
          <div className="local-field-grid"><label className="local-field"><span>Category *</span><select value={category} onChange={e=>setCategory(e.target.value)}><option value="phones">Phones</option><option value="cars">Cars</option><option value="electronics">Electronics</option><option value="fashion">Fashion</option><option value="grocery">Grocery</option><option value="logistics">Logistics / Rider Company</option><option value="other">Other</option></select></label><label className="local-field"><span>City *</span><input value={city} onChange={e=>setCity(e.target.value)} required/></label></div>
          <label className="local-field"><span>Business Address *</span><input value={address} onChange={e=>setAddress(e.target.value)} placeholder="Shop 12, Ikeja" required/></label>
          <label className="local-field"><span>CAC Number (optional but for verification)</span><input value={cac} onChange={e=>setCac(e.target.value)} placeholder="RC123456"/></label>
          {error && <div className="local-alert">{error}</div>}
          <button type="submit" className="local-primary-button" disabled={submitting}>{submitting?'Creating...':'Create Store'} ↗</button>
        </form>
      </main></div>
  )
}

export function CreateStoreProductPage({session}){
  const {storeId}=useParams()
  const navigate=useNavigate()
  const [title,setTitle]=useState('')
  const [desc,setDesc]=useState('')
  const [price,setPrice]=useState('')
  const [qty,setQty]=useState('10')
  const [images,setImages]=useState([])
  const [previews,setPreviews]=useState([])
  const [error,setError]=useState('')
  const [submitting,setSubmitting]=useState(false)

  const handleImageChange=(e)=>{
    const files=Array.from(e.target.files).slice(0,2)
    if(files.length>2) return setError('Max 2 images')
    setImages(files)
    setPreviews(files.map(f=>URL.createObjectURL(f)))
  }

  const handleSubmit=async(e)=>{
    e.preventDefault()
    if(!title.trim()||!price.trim()) return setError('Title and price required')
    if(images.length===0) return setError('Add at least 1 image')
    const minor = BigInt(Math.round(Number(price)*100))
    setSubmitting(true)
    try{
      const uploadedUrls=[]
      for(let i=0;i<images.length;i++){
        const file=images[i]
        const fileName=`${storeId}/${Date.now()}_${i}_${file.name}`
        const {error:upErr}=await supabase.storage.from('product-images').upload(fileName, file)
        if(upErr) throw upErr
        const {data}=supabase.storage.from('product-images').getPublicUrl(fileName)
        uploadedUrls.push(data.publicUrl)
      }
      const {error:ins}=await supabase.from('store_products').insert({
        store_id:storeId,
        title:title.trim(),
        description:desc.trim(),
        price_minor:minor.toString(),
        quantity: parseInt(qty)||1,
        images: uploadedUrls,
        image_url: uploadedUrls[0]
      })
      if(ins) throw ins
      navigate(`/stores/${storeId}`)
    }catch(err){ setError(err.message) }
    setSubmitting(false)
  }
  return (
    <div className="local-shell"><StoresHeader/><main className="local-main local-form-main"><Link to={`/stores/${storeId}`} className="local-back-link">← Back to Store</Link><h1>Add Bulk Product</h1>
      <form className="local-form" onSubmit={handleSubmit}>
        <label className="local-field"><span>Product Title *</span><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="iPhone 15 Pro Max 256GB" required/></label>
        <label className="local-field"><span>Description</span><textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={3} placeholder="Condition, warranty..."/></label>
        <div className="local-field-grid"><label className="local-field"><span>Price (NGN) *</span><input value={price} onChange={e=>setPrice(e.target.value)} placeholder="1200000" required/></label><label className="local-field"><span>Quantity in stock *</span><input type="number" value={qty} onChange={e=>setQty(e.target.value)} min="1" required/></label></div>
        <label className="local-field"><span>Product Images * (1-2 images)</span><input type="file" accept="image/*" multiple onChange={handleImageChange} required/></label>
        {previews.length>0 && <div style={{display:'flex',gap:'8px',marginTop:'8px'}}>{previews.map((src,i)=><img key={i} src={src} style={{width:'80px',height:'80px',objectFit:'cover',borderRadius:'8px'}}/> )}</div>}
        {error && <div className="local-alert">{error}</div>}
        <button type="submit" className="local-primary-button" disabled={submitting}>{submitting?'Adding...':'Add Product'} ↗</button>
      </form>
    </main></div>
  )
}