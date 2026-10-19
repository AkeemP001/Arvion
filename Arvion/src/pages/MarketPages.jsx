import { PayWithArvion, DeliveryManager } from '../components/PayWithArvion';
import { PayoutSetup } from '../components/PayoutSetup';
import { useEffect, useState, useRef } from 'react'
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom'
import brandingLogo from '../../arvion-logo/arvion-logo.jpeg'
import { supabase } from '../lib/supabase'
import '../market.css'

const IMAGE_BUCKET = 'market-listing-images'
const MIN_PRICE_MINOR = 200000n
const LISTING_SELECT = 'id,seller_id,title,description,price_minor,currency,category_id,location_area,location_city,location_state,location_country,condition,status,created_at,updated_at,category:categories(name,slug),images:market_listing_images(id,storage_path,sort_order)'

function ArvionToast({ toast, onClose }) {
  if(!toast) return null
  const bg = toast.type === 'error'? '#991b1b' : toast.type === 'success'? '#065f46' : '#0f172a'
  return (
    <div style={{position:'fixed', top:'20px', left:'50%', transform:'translateX(-50%)', zIndex:99999, background:bg, color:'#fff', padding:'14px 20px', borderRadius:'12px', display:'flex', gap:'12px', minWidth:'300px', boxShadow:'0 10px 30px rgba(0,0,0,0.2)'}}>
      <span>{toast.type === 'error'? '⚠️' : '✅'}</span>
      <span style={{flex:1, fontSize:'14px'}}>{toast.message}</span>
      <button onClick={onClose} style={{background:'rgba(255,255,255,0.2)', border:'none', color:'#fff', borderRadius:'6px', padding:'4px 8px', cursor:'pointer'}}>✕</button>
    </div>
  )
}
function useArvionToast() {
  const [toast, setToast] = useState(null)
  const showToast = (m,t='info') => { setToast({message:m,type:t}); setTimeout(()=>setToast(null),4000) }
  return { toast, showToast, setToast }
}
function Brand() { return (<Link to="/" className="market-brand"><img src={brandingLogo} alt="" /><span>Arvion</span></Link>) }

const NAV_ITEMS = [
  { label: 'Home', path: '/' },
  { label: 'Market', path: '/market' },
  { label: 'Jobs', path: '/jobs' },
  { label: 'Stores', path: '/stores' },
  { label: 'Messages', path: '/market/messages' },
]

function getActive(p) {
  if(p.startsWith('/market/messages')||p.startsWith('/market/chat')||p==='/messages') return 'Messages';
  if(p.startsWith('/market')) return 'Market';
  if(p.startsWith('/stores')) return 'Stores';
  if(p.startsWith('/jobs')||p.startsWith('/local')) return 'Jobs';
  return 'Home'
}

function MarketHeader() {
  const location = useLocation();
  const active = getActive(location.pathname)
  const [unread, setUnread] = useState(0)
  useEffect(()=>{
    let mounted = true
    const fetchUnread = async()=>{
      try{
        const {data:{user}} = await supabase.auth.getUser()
        if(!user ||!mounted) return
        const {data:convs} = await supabase.from('market_conversations').select('id').or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        if(!convs || convs.length===0){ if(mounted) setUnread(0); return }
        const convIds = convs.map(c=>c.id)
        const {count} = await supabase.from('market_messages').select('id', {count:'exact', head:true}).in('conversation_id', convIds).neq('sender_id', user.id).eq('is_read', false)
        if(mounted){
          if(count!== null) setUnread(count)
          else {
            const {count: fallbackCount} = await supabase.from('market_messages').select('id', {count:'exact', head:true}).in('conversation_id', convIds).neq('sender_id', user.id)
            setUnread(fallbackCount || 0)
          }
        }
      }catch(e){ console.log('unread', e.message) }
    }
    fetchUnread()
    const channel = supabase.channel('market-unread-badge').on('postgres_changes',{event:'INSERT',schema:'public',table:'market_messages'}, fetchUnread).subscribe()
    return ()=>{ mounted=false; supabase.removeChannel(channel) }
  },[])
  return (
    <header className="market-header">
      <div className="market-header-inner">
        <Brand />
        <nav className="market-nav">
          {NAV_ITEMS.map(i=>(
            <Link key={i.label} to={i.path} className={active===i.label?'active':''} style={{position:'relative'}}>
              {i.label}
              {i.label==='Messages' && unread>0 && (
                <span style={{
                  position:'absolute',
                  top:'-9px',
                  right:'-14px',
                  background:'#ef4444',
                  color:'#fff',
                  fontSize:'11px',
                  fontWeight:'800',
                  padding:'2px 6px',
                  borderRadius:'999px',
                  minWidth:'18px',
                  height:'18px',
                  display:'flex',
                  alignItems:'center',
                  justifyContent:'center'
                }}>{unread>99?'99+':unread}</span>
              )}
            </Link>
          ))}
        </nav>
        <Link className="market-sell-button" to="/market/new">Sell on Arvion ＋</Link>
      </div>
    </header>
  )
}

function formatPrice(pm,c='NGN'){ const a=Number(pm); if(!Number.isSafeInteger(a)||a<0) return `${c} —`; const w=Math.floor(a/100); const mi=String(a%100).padStart(2,'0'); try{return `${new Intl.NumberFormat('en-NG',{style:'currency',currency:c,minimumFractionDigits:0}).format(w)}.${mi}`}catch{return `${c} ${w.toLocaleString()}.${mi}`} }
function formatCondition(c=''){ return c.replace(/[_-]+/g,' ').replace(/\b\w/g,l=>l.toUpperCase()) }
function listingLocation(l){ return [l.location_area,l.location_city,l.location_state,l.location_country].filter(Boolean).join(', ') }
function useListingImages(images=[]){
  const pathsKey=JSON.stringify([...images].sort((a,b)=>(a.sort_order??0)-(b.sort_order??0)).map(i=>i.storage_path))
  const [urls,setUrls]=useState([])
  useEffect(()=>{ let cur=true; const load=async()=>{ const paths=JSON.parse(pathsKey); if(!supabase||paths.length===0){setUrls([]);return}; try{ const {data,error}=await supabase.storage.from(IMAGE_BUCKET).createSignedUrls(paths,3600); if(!cur) return; if(error){ setUrls([]) } else setUrls((data||[]).map(x=>x.signedUrl).filter(Boolean)) } catch(e){ setUrls([]) } }; load(); return()=>{cur=false} },[pathsKey]); return urls
}
function ListingImage({listing,className=''}){
  const images=useListingImages(listing.images||[])
  return images[0]?<img className={className} src={images[0]} alt={listing.title}/>:<div className={`${className} market-image-placeholder`}><span>▦</span></div>
}
function ListingCard({listing}){
  return (<Link className="market-listing-card" to={`/market/${listing.id}`}><ListingImage listing={listing} className="market-listing-image"/><div className="market-listing-copy"><div className="market-listing-meta"><span>{listing.category?.name||'Market'}</span>{listing.condition?<span>{formatCondition(listing.condition)}</span>:null}</div><h3>{listing.title}</h3><strong className="market-listing-price">{formatPrice(listing.price_minor,listing.currency)}</strong><span className="market-listing-location">{listingLocation(listing)||'Location not provided'}</span></div></Link>)
}
export function MarketPage(){
  const [listings,setListings]=useState([]); const [categoryId,setCategoryId]=useState(''); const [search,setSearch]=useState(''); const [loading,setLoading]=useState(true); const [error,setError]=useState('')
  useEffect(()=>{ const load=async()=>{ try{setLoading(true); let q=supabase.from('market_listings').select(LISTING_SELECT).eq('status','ACTIVE').order('created_at',{ascending:false}).limit(100); if(categoryId) q=q.eq('category_id',categoryId); if(search.trim()) q=q.ilike('title',`%${search.trim()}%`); const {data,error}=await q; if(error) throw error; setListings(data||[]) }catch(e){setError(e.message); setListings([])} finally{setLoading(false)} }; const t=setTimeout(load,200); return()=>clearTimeout(t) },[categoryId,search])
  return (<div className="market-shell"><MarketHeader/><main className="market-main"><section className="market-hero"><div><span className="market-eyebrow">Discover something good</span><h1>Market</h1></div></section>{error&&<div style={{background:'#fef2f2',padding:'12px',color:'#991b1b',margin:'12px',borderRadius:'8px'}}>Error: {error}</div>}{loading?<p className="market-status">Loading...</p>:(<div className="market-listing-grid">{listings.map(l=><ListingCard key={l.id} listing={l}/>)}</div>)}</main></div>)
}
export function MarketListingDetailPage(){
  const {listingId}=useParams(); const navigate=useNavigate()
  const [listing,setListing]=useState(null); const [loading,setLoading]=useState(true); const [error,setError]=useState(''); const [chatLoading,setChatLoading]=useState(false)
  const [offers,setOffers]=useState([]); const [offerAmount,setOfferAmount]=useState(''); const [dealRoomId,setDealRoomId]=useState(null); const [conversationId,setConversationId]=useState(null); const [acceptedOffer,setAcceptedOffer]=useState(null); const [currentUserId,setCurrentUserId]=useState(null)
  const imageUrls=useListingImages(listing?.images||[]); const {toast,showToast,setToast}=useArvionToast()
  useEffect(()=>{ supabase.auth.getUser().then(({data})=>setCurrentUserId(data.user?.id)) },[])
  useEffect(()=>{ let cur=true; const load=async()=>{ setLoading(true); setError(''); const {data,error:qe}=await supabase.from('market_listings').select(LISTING_SELECT).eq('id',listingId).maybeSingle(); if(!cur) return; if(qe) setError(qe.message); else setListing(data); setLoading(false) }; load(); return()=>{cur=false} },[listingId])
  useEffect(()=>{
    if(!listing||!currentUserId) return
    const loadRoom=async()=>{
      try{
        if(currentUserId===listing.seller_id){
          const {data:rooms}=await supabase.from('deal_rooms').select('id,conversation_id').eq('listing_id',listing.id).order('created_at',{ascending:false})
          if(rooms&&rooms.length>0){ const rIds=rooms.map(r=>r.id); setDealRoomId(rIds[0]); if(rooms[0].conversation_id) setConversationId(rooms[0].conversation_id); const {data:offersData}=await supabase.from('deal_offers').select('*').in('deal_room_id',rIds).order('created_at',{ascending:false}); if(offersData){setOffers(offersData); setAcceptedOffer(offersData.find(o=>['ACCEPTED','accepted','PAID','AGREED'].includes(o.status))||null)} }
        } else {
          const {data:conv}=await supabase.from('market_conversations').select('id').eq('listing_id',listing.id).eq('buyer_id',currentUserId).maybeSingle()
          if(conv){ setConversationId(conv.id); const {data:room}=await supabase.from('deal_rooms').select('id').eq('conversation_id',conv.id).maybeSingle(); if(room){ setDealRoomId(room.id); const {data:offersData}=await supabase.from('deal_offers').select('*').eq('deal_room_id',room.id).order('created_at',{ascending:false}); if(offersData){setOffers(offersData); setAcceptedOffer(offersData.find(o=>['ACCEPTED','accepted','PAID','AGREED'].includes(o.status))||null)} } }
        }
      }catch(e){console.error(e)}
    }; loadRoom()
  },[listing,currentUserId])
  const getOrCreateConversation=async(userId)=>{ const {data:existing}=await supabase.from('market_conversations').select('id').eq('listing_id',listing.id).eq('buyer_id',userId).maybeSingle(); if(existing) return existing.id; const {data,error}=await supabase.from('market_conversations').insert({listing_id:listing.id,buyer_id:userId,seller_id:listing.seller_id}).select('id').single(); if(error) throw error; return data.id }
  const handleMakeOffer=async()=>{
    if(!offerAmount) return showToast('Please enter an offer amount','error');
    if(Number(offerAmount) < 2000){ showToast('Minimum offer is ₦2,000','error'); return }
    const {data:{user}}=await supabase.auth.getUser(); if(!user){navigate('/login');return}; try{ const convId=await getOrCreateConversation(user.id); setConversationId(convId); let roomId=dealRoomId; if(!roomId){ const {data:existingRoom}=await supabase.from('deal_rooms').select('id').eq('conversation_id',convId).maybeSingle(); if(existingRoom) roomId=existingRoom.id; else { const payload={conversation_id:convId,listing_id:listing.id,buyer_id:user.id,seller_id:listing.seller_id,buyer_customer_id:user.id,seller_provider_id:listing.seller_id,currency:listing.currency||'NGN',status:'OPEN'}; const {data:newRoom, error}=await supabase.from('deal_rooms').insert(payload).select('id').single(); if(error) throw error; roomId=newRoom.id } setDealRoomId(roomId) } const {error}=await supabase.from('deal_offers').insert({deal_room_id:roomId,sender_id:user.id,amount_minor:Math.round(Number(offerAmount)*100),currency:listing.currency||'NGN',status:'PENDING',message:`Offer ${offerAmount}`}); if(error) throw error; showToast('Offer sent!','success'); setOfferAmount(''); const {data:offersData}=await supabase.from('deal_offers').select('*').eq('deal_room_id',roomId).order('created_at',{ascending:false}); setOffers(offersData||[]) }catch(e){showToast(e.message,'error')} }
  const handleChatSeller=async()=>{ if(!listing) return; setChatLoading(true); try{ const {data:{user}}=await supabase.auth.getUser(); if(!user){navigate('/login');return}; if(user.id===listing.seller_id){showToast('This is your listing','error');return}; const convId=await getOrCreateConversation(user.id); navigate(`/market/chat/${convId}`) }catch(e){showToast('Chat failed: '+e.message,'error')} finally{setChatLoading(false)} }
  const payAmount=acceptedOffer?Number(acceptedOffer.amount_minor)/100:Number(listing?.price_minor||0)/100;
  const isSeller=currentUserId===listing?.seller_id
  const hasDeal=!!dealRoomId
  return (
    <div className="market-shell"><ArvionToast toast={toast} onClose={()=>setToast(null)}/><MarketHeader/><main className="market-main market-detail-main"><Link to="/market" className="market-back-link">← Back to Market</Link>{loading?<p className="market-status">Loading…</p>:null}{error?<div className="market-alert">{error}</div>:null}
      {!loading&&listing?(
        <article className="market-detail"><div className="market-detail-gallery">{imageUrls.length?imageUrls.map(u=><img key={u} src={u} alt={listing.title}/>):<div className="market-detail-placeholder"><span>▦</span></div>}</div>
          <div className="market-detail-copy"><h1>{listing.title}</h1><strong className="market-detail-price">{formatPrice(listing.price_minor,listing.currency)}</strong><div style={{fontSize:'0.85rem',color:'#64748b',marginTop:'4px'}}>{listingLocation(listing)}</div><p style={{marginTop:'12px',whiteSpace:'pre-wrap'}}>{listing.description}</p>
            {listing.status==='SOLD'?<div style={{background:'#fee2e2',color:'#991b1b',padding:'8px',borderRadius:'8px',marginTop:'8px',fontWeight:700}}>⛔ SOLD — Check Messages</div>:null}
            {acceptedOffer&&<div style={{background:'#dcfce7',padding:'8px',borderRadius:'8px',marginTop:'8px',fontWeight:600}}>✅ Accepted: {formatPrice(acceptedOffer.amount_minor,acceptedOffer.currency)}</div>}
            <div style={{marginTop:'16px',border:'1px solid #e2e8f0',padding:'12px',borderRadius:'12px'}}><h3 style={{fontSize:'0.9rem',fontWeight:700}}>{isSeller?'Offers Received':'Make an Offer'}</h3>
              {!isSeller&&listing.status!=='SOLD'&&(<div style={{display:'flex',gap:'8px',marginTop:'8px'}}><input type="number" min="2000" placeholder="Min 2000" value={offerAmount} onChange={e=>setOfferAmount(e.target.value)} style={{flex:1,padding:'10px',borderRadius:'8px',border:'1px solid #cbd5e1'}}/><button onClick={handleMakeOffer} className="market-primary-button">Send Offer</button></div>)}
              {offers.length>0?(<div style={{marginTop:'10px'}}>{offers.map(o=>(<div key={o.id} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',fontSize:'0.85rem',borderBottom:'1px solid #f1f5f9',alignItems:'center'}}><span>{formatPrice(o.amount_minor,o.currency)} - <b>{o.status}</b></span>{isSeller&&(o.status==='PENDING'||o.status==='pending')&&(<button onClick={async()=>{ const {error}=await supabase.from('deal_offers').update({status:'ACCEPTED'}).eq('id',o.id); if(error){showToast(error.message,'error');return}; await supabase.from('deal_rooms').update({status:'AGREED'}).eq('id',dealRoomId); setAcceptedOffer({...o,status:'ACCEPTED'}); setOffers(prev=>prev.map(x=>x.id===o.id?{...x,status:'ACCEPTED'}:x)); showToast('Offer accepted!','success')}} style={{background:'#16a34a',color:'#fff',border:'none',padding:'6px 12px',borderRadius:'6px',fontWeight:'bold',cursor:'pointer'}}>Accept</button>)}</div>))}</div>):<p style={{fontSize:'0.8rem',color:'#94a3b8',marginTop:'8px'}}>{isSeller?'No offers yet':'Be first to offer (Min ₦2,000)'}</p>}
            </div>
            {!isSeller&&(<><button className="market-primary-button" style={{marginTop:'16px',width:'100%',padding:'14px'}} onClick={handleChatSeller} disabled={chatLoading}>{chatLoading?'Opening...':'💬 Chat Seller'}</button>{hasDeal&&acceptedOffer&&(<div style={{marginTop:'12px'}}><PayWithArvion amount={payAmount} productId={listing.id} sellerId={listing.seller_id} dealRoomId={dealRoomId} acceptedOfferId={acceptedOffer?.id} onPaid={()=>window.location.reload()}/><DeliveryManager dealRoomId={dealRoomId} isSeller={false} /></div>)}{hasDeal&&!acceptedOffer&&(<div style={{marginTop:'12px', background:'#fffbeb', padding:'10px', borderRadius:'8px', fontSize:'13px', textAlign:'center'}}>Waiting for seller to accept</div>)}</>)}
            {isSeller&&(<> {!hasDeal&&(<div style={{marginTop:'16px', background:'#f8fafc', border:'1px dashed #cbd5e1', padding:'14px', borderRadius:'12px', textAlign:'center'}}><div style={{fontSize:'14px', fontWeight:600}}>Your listing is live</div><div style={{fontSize:'13px', color:'#64748b', marginTop:'4px'}}>No buyer yet</div><button onClick={()=>navigate('/market/messages')} style={{marginTop:'10px', background:'#0f172a', color:'#fff', border:'none', padding:'8px 14px', borderRadius:'8px', fontSize:'13px', cursor:'pointer'}}>View Messages</button></div>)} {hasDeal&&(<div style={{marginTop:'12px'}}><DeliveryManager dealRoomId={dealRoomId} isSeller={true} /><button onClick={()=>navigate(`/market/chat/${conversationId}`)} style={{marginTop:'10px', width:'100%', background:'#fff', border:'1px solid #0f172a', color:'#0f172a', padding:'12px', borderRadius:'10px', fontWeight:700, cursor:'pointer'}}>Open Chat with Buyer</button></div>)}</>)}
          </div>
        </article>
      ):null}
    </main></div>
  )
}

function parsePriceMinor(v){ const m=v.trim().match(/^(\d{1,17})(?:\.(\d{1,2}))?$/); if(!m) return null; const minor=BigInt(m[1])*100n+BigInt((m[2]||'').padEnd(2,'0')); if(minor<=0n||minor>9223372036854775807n) return null; return minor.toString() }
function safeFileName(n){ return n.normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g,'-').replace(/-+/g,'-').slice(-100)||'image' }

export function CreateMarketListingPage({ session }){
  const navigate=useNavigate()
  const [categories,setCategories]=useState([]); const [currency,setCurrency]=useState('NGN')
  const [title,setTitle]=useState(''); const [description,setDescription]=useState(''); const [price,setPrice]=useState(''); const [categoryId,setCategoryId]=useState(''); const [condition,setCondition]=useState(''); const [area,setArea]=useState(''); const [city,setCity]=useState(''); const [state,setState]=useState(''); const [country,setCountry]=useState('Nigeria')
  const [files,setFiles]=useState([]); const [loadingCategories,setLoadingCategories]=useState(true); const [submitting,setSubmitting]=useState(false); const [error,setError]=useState(''); const [hasPayout,setHasPayout]=useState(null); const {toast,showToast,setToast}=useArvionToast()
  useEffect(()=>{
    let cur=true; const load=async()=>{
      try{
        const [{data:categoryData}, {data:profile}, {data:payout}] = await Promise.all([ supabase.from('categories').select('id,name,sort_order').eq('domain','MARKET').eq('active',true).order('sort_order'), supabase.from('profiles').select('currency').eq('auth_user_id',session.user.id).maybeSingle(), supabase.from('seller_payout_accounts').select('user_id').eq('user_id',session.user.id).maybeSingle() ])
        if(!cur) return; setCategories(categoryData||[]); if(profile?.currency) setCurrency(profile.currency); setHasPayout(!!payout); setLoadingCategories(false)
      } catch(e){ setLoadingCategories(false) }
    }; load(); return()=>{cur=false}
  },[session.user.id])
  const handleSubmit=async(e)=>{
    e.preventDefault(); setError('');
    if(!hasPayout){setError('Add payout bank first'); showToast('Add payout bank first','error'); return}
    const priceMinor=parsePriceMinor(price);
    if(priceMinor===null){ setError('Enter positive price'); return }
    if(BigInt(priceMinor) < MIN_PRICE_MINOR){
      setError('Minimum price is ₦2,000');
      showToast('Minimum price is ₦2,000','error');
      return;
    }
    if(title.trim().length<3){setError('Title >=3 chars'); return};
    if(description.trim().length<10){setError('Desc >=10'); return};
    if(!area.trim()){setError('Area required');return};
    if(!condition){setError('Choose condition');return};
    if(!categoryId){setError('Choose category');return};
    const selectedFiles = Array.from(files||[]);
    if(selectedFiles.length>5||selectedFiles.some(f=>!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>5*1024*1024)){setError('Up to 5 images JPG/PNG/WEBP <5MB');return}
    setSubmitting(true);
    let createdListingId = null;
    const normCurr = currency.trim().toUpperCase() || 'NGN'
    try{
      const {data:listing, error:insertError}=await supabase.from('market_listings').insert({seller_id:session.user.id,title:title.trim(),description:description.trim(),price_minor:priceMinor,currency:normCurr,category_id:categoryId,condition,location_area:area.trim(),location_city:city.trim()||null,location_state:state.trim()||null,location_country:country.trim(),status:'ACTIVE'}).select('id').single();
      if(insertError) throw new Error(insertError.message);
      if(!listing?.id) throw new Error('Listing blocked by RLS');
      createdListingId = listing.id;
      for(const [index,file] of selectedFiles.entries()){
        const path=`${createdListingId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
        const {error:uploadError}=await supabase.storage.from(IMAGE_BUCKET).upload(path,file,{contentType:file.type,upsert:false});
        if(uploadError) throw uploadError
        const {data:urlData} = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path);
        const publicUrl = urlData?.publicUrl || path;
        const { error: imgError } = await supabase.from('market_listing_images').insert({ listing_id: createdListingId, storage_path: path, url: publicUrl, sort_order: index });
        if(imgError) throw imgError
      }
      showToast('Listing created!','success');
      setTimeout(()=> navigate(`/market/${createdListingId}`,{replace:true}), 500)
    }catch(err){
      if(createdListingId){ await supabase.from('market_listings').delete().eq('id', createdListingId); }
      setError(err.message); showToast(err.message,'error')
    } finally{setSubmitting(false)}
  }
  return (
    <div className="market-shell"><ArvionToast toast={toast} onClose={()=>setToast(null)}/><MarketHeader/><main className="market-main market-form-main"><Link to="/market" className="market-back-link">← Back to Market</Link>
      {hasPayout===false&&(<div style={{marginBottom:'24px'}}><PayoutSetup required={true} onComplete={()=>setHasPayout(true)}/></div>)}
      {hasPayout&&(
        <form className="market-form" onSubmit={handleSubmit}>
          <div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',padding:'10px 14px',borderRadius:'10px',fontSize:'13px',color:'#166534',marginBottom:'16px'}}>✅ Payout verified</div>
          <div className="market-form-section"><h2>Item details</h2>
            <label className="market-field"><span>Title *</span><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. iPhone 13" required/></label>
            <label className="market-field"><span>Condition *</span><select value={condition} onChange={e=>setCondition(e.target.value)} required style={{width:'100%',padding:'12px',borderRadius:'8px',border:'1px solid #cbd5e1',background:'#fff'}}><option value="">-- Select Condition --</option><option value="new">New</option><option value="good">Good</option><option value="fair">Fair</option><option value="used">Used</option><option value="refurbished">Refurbished</option></select></label>
            <label className="market-field"><span>Category *</span>{loadingCategories?<p>Loading...</p>:(<select value={categoryId} onChange={e=>setCategoryId(e.target.value)} required style={{width:'100%',padding:'12px',borderRadius:'8px',border:'1px solid #cbd5e1',background:'#fff'}}><option value="">-- Select Category --</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>)}</label>
            <label className="market-field"><span>Description *</span><textarea value={description} onChange={e=>setDescription(e.target.value)} rows={5} required/></label>
          </div>
          <div className="market-form-section"><h2>Price & location</h2><div className="market-field-grid">
            <label className="market-field"><span>Price (NGN) *</span><input value={price} onChange={e=>setPrice(e.target.value)} placeholder="Minimum 2000" required style={{width:'100%',padding:'12px',borderRadius:'8px',border:'1px solid #cbd5e1'}}/><p style={{fontSize:'11px', color:'#64748b', marginTop:'4px'}}>Min ₦2,000</p></label>
            <label className="market-field"><span>Currency *</span><input value={currency} onChange={e=>setCurrency(e.target.value.toUpperCase())} required/></label>
            <label className="market-field"><span>Area *</span><input value={area} onChange={e=>setArea(e.target.value)} placeholder="Ikeja" required/></label>
            <label className="market-field"><span>City</span><input value={city} onChange={e=>setCity(e.target.value)}/></label>
            <label className="market-field"><span>State</span><input value={state} onChange={e=>setState(e.target.value)}/></label>
            <label className="market-field"><span>Country *</span><input value={country} onChange={e=>setCountry(e.target.value)} required/></label>
          </div></div>
          <div className="market-form-section"><h2>Images</h2><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e=>setFiles(e.target.files||[])}/><p style={{fontSize:'12px', color:'#64748b', marginTop:'6px'}}>Max 5 images, &lt;5MB each</p></div>
          {error?<div className="market-alert" style={{background:'#fee2e2',color:'#991b1b',padding:'12px',borderRadius:'8px',marginBottom:'12px'}}>{error}</div>:null}
          <div className="market-form-actions"><button className="market-primary-button" type="submit" disabled={submitting}>{submitting?'Creating…':'Create listing'}</button></div>
        </form>
      )}
      {hasPayout===null&&<p style={{textAlign:'center',color:'#64748b', marginTop:'20px'}}>Checking payout account...</p>}
    </main></div>
  )
}

function hasBlockedContact(text, canShareAfterPayment=false){
  if(canShareAfterPayment) return false
  const lower=text.toLowerCase();
  const blocked=['whatsapp','telegram','snapchat','instagram','facebook','bank account','account number','opay','palmpay','moniepoint','my number','call me','phone number','email me','gmail','yahoo','contact me','reach me','number is','my digit']
  if(blocked.some(w=>lower.includes(w))) return true;
  if(/@/.test(text)&&/\./.test(text)) return true;
  if(/\.com|\.ng|\.co|\.net|https?:\/\//i.test(lower)) return true;
  const digitsOnly=text.replace(/\D/g,'');
  if(digitsOnly.length >= 3) return true;
  const numberWords=['zero','one','two','three','four','five','six','seven','eight','nine','oh','o'];
  let wordCount=0; const words=lower.split(/[^a-z0-9]+/); words.forEach(w=>{ if(numberWords.includes(w)) wordCount++; });
  if(wordCount >= 3) return true;
  return false
}

export function MarketChatPage(){
  const {conversationId}=useParams(); const navigate=useNavigate()
  const [messages,setMessages]=useState([]); const [input,setInput]=useState(''); const [conversation,setConversation]=useState(null); const [currentUserId,setCurrentUserId]=useState(null); const [sending,setSending]=useState(false); const [acceptedOffer,setAcceptedOffer]=useState(null); const [dealRoomId,setDealRoomId]=useState(null); const [dealRoomStatus,setDealRoomStatus]=useState(null)
  const bottomRef=useRef(null); const messagesContainerRef=useRef(null); const [isNearBottom,setIsNearBottom]=useState(true); const [showScrollButton,setShowScrollButton]=useState(false)
  const {toast,showToast,setToast}=useArvionToast()
  useEffect(()=>{
    const load=async()=>{
      const {data:{user}}=await supabase.auth.getUser(); setCurrentUserId(user?.id||null)
      const {data:conv}=await supabase.from('market_conversations').select('*, listing:market_listings(id,title,price_minor,currency,seller_id)').eq('id',conversationId).single(); setConversation(conv)
      const {data:msgs}=await supabase.from('market_messages').select('*').eq('conversation_id',conversationId).order('created_at',{ascending:true}); setMessages(msgs||[])
      if(msgs){ try{ await supabase.from('market_messages').update({is_read:true}).eq('conversation_id',conversationId).neq('sender_id',user?.id) }catch(e){} }
      const {data:room}=await supabase.from('deal_rooms').select('id,status').eq('conversation_id',conversationId).maybeSingle()
      if(room){ setDealRoomId(room.id); setDealRoomStatus(room.status); const {data:offersData}=await supabase.from('deal_offers').select('*').eq('deal_room_id',room.id).order('created_at',{ascending:false}); if(offersData){ const accepted=offersData.find(o=>['ACCEPTED','accepted','PAID','AGREED'].includes(o.status)); if(accepted) setAcceptedOffer(accepted) } }
    }; load()
    const channel=supabase.channel(`chat-${conversationId}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'market_messages',filter:`conversation_id=eq.${conversationId}`},p=>{setMessages(prev=>[...prev,p.new])}).subscribe()
    return()=>{supabase.removeChannel(channel)}
  },[conversationId])
  useEffect(()=>{
    const container = messagesContainerRef.current
    if(!container) return
    const handleScroll = ()=>{
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
      const nearBottom = distanceFromBottom < 150
      setIsNearBottom(nearBottom)
      setShowScrollButton(!nearBottom && messages.length > 0)
    }
    container.addEventListener('scroll', handleScroll)
    return ()=> container.removeEventListener('scroll', handleScroll)
  },[messages.length])
  useEffect(()=>{
    if(isNearBottom){ bottomRef.current?.scrollIntoView({behavior:'auto'}) }
  },[messages, isNearBottom])
  const canShareContact = dealRoomStatus && ['PAID','SHIPPED','COMPLETED'].includes(dealRoomStatus)
  const send=async()=>{
    const text=input.trim(); if(!text||sending) return
    if(hasBlockedContact(text,canShareContact)){ showToast('🛡️ Sharing contacts blocked until buyer pays.','error'); return }
    setSending(true); const {data:{user}}=await supabase.auth.getUser(); const {error}=await supabase.from('market_messages').insert({conversation_id:conversationId,sender_id:user.id,content:text, is_read:false}); if(error) showToast('Failed to send','error'); else {setInput(''); await supabase.from('market_conversations').update({last_message_at:new Date().toISOString()}).eq('id',conversationId); setIsNearBottom(true)} setSending(false)
  }
  const listing=conversation?.listing; const basePrice=listing?Number(listing.price_minor)/100:0; const payAmount=acceptedOffer?Number(acceptedOffer.amount_minor)/100:basePrice; const isSeller=currentUserId===listing?.seller_id
  return (
    <div style={{height:'100vh',display:'flex',flexDirection:'column',background:'#f8fafc'}}>
      <ArvionToast toast={toast} onClose={()=>setToast(null)}/>
      <header style={{background:'#fff',borderBottom:'1px solid #e2e8f0',padding:'12px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}><div style={{display:'flex',gap:'12px',alignItems:'center'}}><Link to="/market/messages" style={{textDecoration:'none',fontSize:'22px',color:'#0f172a'}}>←</Link><div><div style={{fontWeight:700,fontSize:'15px'}}>{listing?.title||'Secure Chat'}</div><div style={{fontSize:'12px',color:'#64748b'}}>{acceptedOffer?`✅ Accepted: ${formatPrice(acceptedOffer.amount_minor,acceptedOffer.currency)}`:formatPrice(listing?.price_minor,listing?.currency)} • 🔒 Protected</div></div></div><button onClick={()=>navigate(`/market/${listing?.id}`)} style={{background:'#0f172a',color:'#fff',border:'none',padding:'8px 14px',borderRadius:'999px',fontSize:'13px',fontWeight:600, cursor:'pointer'}}>View Item</button></header>
      <div style={{background:canShareContact?'#dcfce7':'#fffbeb',borderBottom:'1px solid',borderColor:canShareContact?'#bbf7d0':'#fde68a',padding:'8px 16px',fontSize:'12px',color:canShareContact?'#166534':'#92400e',textAlign:'center'}}>{canShareContact?'✅ Payment confirmed — You can now share phone numbers with rider':(isSeller?'You are seller — Wait for buyer payment':(acceptedOffer?`✅ Offer Accepted: Pay ${formatPrice(acceptedOffer.amount_minor,acceptedOffer.currency)} below`:'Safe Trade: Pay only with Pay with Arvion below'))}</div>
      <div ref={messagesContainerRef} style={{flex:1,overflowY:'auto',padding:'20px 16px',display:'flex',flexDirection:'column',gap:'10px',background:'#eef2f7', position:'relative'}}>
        {messages.map(m=>{ const isMe=m.sender_id===currentUserId; return (<div key={m.id} style={{display:'flex',flexDirection:'column',alignItems:isMe?'flex-end':'flex-start'}}><div style={{maxWidth:'72%',padding:'11px 14px',borderRadius:isMe?'18px 18px 4px 18px':'18px 18px 18px 4px',background:isMe?'#0f172a':'#fff',color:isMe?'#fff':'#0f172a',border:isMe?'none':'1px solid #e2e8f0',fontSize:'14.5px'}}>{m.content}</div><span style={{fontSize:'11px',color:'#94a3b8',marginTop:'4px'}}>{new Date(m.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span></div>) })}
        {showScrollButton && (
          <button onClick={()=>{ bottomRef.current?.scrollIntoView({behavior:'smooth'}); setShowScrollButton(false); setIsNearBottom(true) }}
            style={{position:'fixed', bottom:'90px', right:'20px', background:'#0f172a', color:'#fff', border:'none', padding:'8px 14px', borderRadius:'999px', fontSize:'12px', fontWeight:'700', boxShadow:'0 4px 12px rgba(0,0,0,0.15)', cursor:'pointer', zIndex:10}}>
            ↓ New messages
          </button>
        )}
        <div ref={bottomRef}/>
      </div>
      <div style={{background:'#fff',borderTop:'1px solid #e2e8f0',padding:'12px 16px'}}>
        <div style={{display:'flex',gap:'10px',marginBottom:'12px',width:'100%'}}>{listing?(<div style={{flex:1}}>{!isSeller?(<><PayWithArvion amount={payAmount} productId={listing.id} sellerId={conversation?.listing?.seller_id||conversation?.seller_id} dealRoomId={dealRoomId} acceptedOfferId={acceptedOffer?.id} onPaid={async()=>{setDealRoomStatus('PAID'); window.location.reload()}}/><p style={{fontSize:'11px',color:'#64748b',textAlign:'center',marginTop:'6px'}}>{acceptedOffer?`🔒 Paying Accepted Offer: ${formatPrice(acceptedOffer.amount_minor,acceptedOffer.currency)}`:`🔒 Paying: ${formatPrice(listing.price_minor,listing.currency)}`}</p></>):(<div style={{background:'#f0fdf4',padding:'10px',borderRadius:'10px',fontSize:'12px',textAlign:'center',color:'#166534',fontWeight:600}}>Seller — Buyer will pay here. Confirm rider after payment.</div>)}{dealRoomId&&<DeliveryManager dealRoomId={dealRoomId} isSeller={isSeller}/>}</div>):<button style={{flex:1,background:'#e2e8f0',padding:'13px',borderRadius:'12px'}}>Loading...</button>}</div>
        <div style={{display:'flex',gap:'8px',alignItems:'center'}}><input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder={canShareContact?"You can now share phone numbers...":"Type a message..."} style={{flex:1,padding:'13px 18px',borderRadius:'999px',border:'1px solid #cbd5e1',outline:'none',fontSize:'14px'}}/><button onClick={send} disabled={sending} style={{background:'#0f172a',color:'#fff',border:'none',width:'48px',height:'48px',borderRadius:'50%',fontSize:'18px', cursor:'pointer'}}>{sending?'·':'➤'}</button></div>
      </div>
    </div>
  )
}

export function MarketMessagesInboxPage(){
  const [conversations,setConversations]=useState([]); const [loading,setLoading]=useState(true)
  useEffect(()=>{ const load=async()=>{ setLoading(true); const {data:{user}}=await supabase.auth.getUser(); if(!user){setLoading(false);return}; const {data:fullData}=await supabase.from('market_conversations').select('*, listing:market_listings(id,title)').or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`).order('last_message_at',{ascending:false}); setConversations(fullData||[]); setLoading(false) }; load() },[])
  return (<div className="market-shell"><MarketHeader/><main className="market-main"><Link to="/market" className="market-back-link">← Back to Market</Link><div style={{marginTop:'12px'}}><span className="market-eyebrow">Secure conversations</span><h1>My Messages</h1></div>{loading?<p className="market-status">Loading...</p>:null}<div style={{display:'grid',gap:'12px',marginTop:'20px'}}>{conversations.map(c=>(<Link key={c.id} to={`/market/chat/${c.id}`} style={{textDecoration:'none',background:'#fff',border:'1px solid #e2e8f0',borderRadius:'14px',padding:'14px 16px',display:'flex',justifyContent:'space-between'}}><div><strong style={{color:'#0f172a'}}>{c.listing?.title||'Arvion Listing'}</strong><span style={{fontSize:'0.85rem',color:'#64748b',display:'block'}}>{c.last_message_at?new Date(c.last_message_at).toLocaleString():'New'} • Protected</span></div><span style={{background:'#f1f5f9',padding:'6px 12px',borderRadius:'999px',fontSize:'0.85rem'}}>Open →</span></Link>))}</div></main></div>)
}