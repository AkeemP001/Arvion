import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export function AdminDisputesPage(){
  const [isAdmin, setIsAdmin] = useState(null)
  const [disputes, setDisputes] = useState([])
  const [selectedDeal, setSelectedDeal] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef(null)

  useEffect(()=>{
    const check = async()=>{
      const {data:{user}} = await supabase.auth.getUser()
      if(!user){ setIsAdmin(false); setLoading(false); return }
      const {data:profile} = await supabase.from('profiles').select('is_admin').eq('auth_user_id', user.id).single()
      if(!profile?.is_admin){ setIsAdmin(false); setLoading(false); return }
      setIsAdmin(true)

      // Load all disputed
      const {data} = await supabase.from('deal_rooms').select('*, listing:market_listings(title)').eq('delivery_status','DISPUTED').order('disputed_at',{ascending:false})
      setDisputes(data||[])
      setLoading(false)
    }
    check()
  },[])

  useEffect(()=>{
    if(!selectedDeal) return
    const loadMsgs = async()=>{
      const {data} = await supabase.from('dispute_chats').select('*').eq('deal_room_id', selectedDeal.id).order('created_at',{ascending:true})
      setMessages(data||[])
    }
    loadMsgs()
    const channel = supabase.channel(`dispute-${selectedDeal.id}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'dispute_chats',filter:`deal_room_id=eq.${selectedDeal.id}`},p=>setMessages(prev=>[...prev,p.new])).subscribe()
    return ()=>supabase.removeChannel(channel)
  },[selectedDeal])

  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:'smooth'}) },[messages])

  const sendAsAdmin = async()=>{
    if(!input.trim()||!selectedDeal) return
    const {data:{user}} = await supabase.auth.getUser()
    const {error} = await supabase.from('dispute_chats').insert({
      deal_room_id: selectedDeal.id,
      sender_id: user.id,
      sender_role: 'admin',
      message: input.trim()
    })
    if(!error) setInput('')
  }

  const handleReleaseToSeller = async()=>{
    if(!confirm('Release money to seller?')) return
    await supabase.from('deal_rooms').update({delivery_status:'COMPLETED', status:'COMPLETED', payout_status:'RELEASED', completed_at: new Date().toISOString()}).eq('id', selectedDeal.id)
    await supabase.from('dispute_chats').insert({deal_room_id:selectedDeal.id, sender_id: (await supabase.auth.getUser()).data.user.id, sender_role:'admin', message:'✅ Admin Resolution: Delivery confirmed. Money released to seller.'})
    alert('Released to seller'); window.location.reload()
  }

  const handleRefundBuyer = async()=>{
    if(!confirm('Refund buyer?')) return
    await supabase.from('deal_rooms').update({delivery_status:'REFUNDED', status:'REFUNDED', payout_status:'REFUNDED'}).eq('id', selectedDeal.id)
    await supabase.from('dispute_chats').insert({deal_room_id:selectedDeal.id, sender_id: (await supabase.auth.getUser()).data.user.id, sender_role:'admin', message:'↩️ Admin Resolution: Refunded to buyer.'})
    alert('Refunded'); window.location.reload()
  }

  const handleBlockUser = async(userId, type)=>{
    if(!confirm(`Block this ${type}? They will not be able to sell.`)) return
    const reason = prompt('Reason for blocking?')
    await supabase.from('profiles').update({is_blocked:true, blocked_reason: reason}).eq('auth_user_id', userId)
    await supabase.from('dispute_chats').insert({deal_room_id:selectedDeal.id, sender_id: (await supabase.auth.getUser()).data.user.id, sender_role:'admin', message:`🚫 Admin blocked ${type}: ${reason}`})
    alert(`${type} blocked`)
  }

  if(loading) return <div style={{padding:'20px'}}>Checking admin...</div>
  if(isAdmin===false) return <div style={{padding:'40px', textAlign:'center'}}><h2>⛔ Not Admin</h2><p>Your account is not admin. Run: UPDATE profiles SET is_admin=true WHERE auth_user_id='YOUR_ID'</p></div>

  return (
    <div style={{display:'flex', height:'100vh', background:'#f8fafc'}}>
      {/* LEFT: Disputes list */}
      <div style={{width:'360px', background:'#fff', borderRight:'1px solid #e2e8f0', overflowY:'auto'}}>
        <div style={{padding:'16px', borderBottom:'1px solid #e2e8f0'}}><h2 style={{fontWeight:800}}>🛡️ Admin Disputes</h2><p style={{fontSize:'12px', color:'#64748b'}}>{disputes.length} active</p></div>
        {disputes.length===0? <p style={{padding:'20px', color:'#94a3b8'}}>No disputes — all good</p> :
          disputes.map(d=>(
            <div key={d.id} onClick={()=>setSelectedDeal(d)} style={{padding:'14px', borderBottom:'1px solid #f1f5f9', cursor:'pointer', background: selectedDeal?.id===d.id? '#f1f5f9':'#fff'}}>
              <div style={{fontWeight:700, fontSize:'14px'}}>{d.listing?.title||'Listing'} — ₦{Number(d.paid_amount_minor||0)/100}</div>
              <div style={{fontSize:'12px', color:'#64748b', marginTop:'4px'}}>Rider: {d.rider_name} ({d.rider_phone})</div>
              <div style={{fontSize:'11px', color:'#991b1b', marginTop:'4px'}}>Buyer: {d.buyer_id.slice(0,8)}... | Seller: {d.seller_id.slice(0,8)}...</div>
            </div>
          ))
        }
      </div>

      {/* RIGHT: Chat + Actions */}
      <div style={{flex:1, display:'flex', flexDirection:'column'}}>
        {!selectedDeal? <div style={{flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'#94a3b8'}}>Select a dispute to resolve</div> :
        <>
          <div style={{background:'#0f172a', color:'#fff', padding:'14px 16px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <div><div style={{fontWeight:700}}>{selectedDeal.listing?.title}</div><div style={{fontSize:'12px', opacity:0.8}}>Deal: {selectedDeal.id.slice(0,8)} • ₦{Number(selectedDeal.paid_amount_minor||0)/100/100}</div></div>
            <Link to={`/market/${selectedDeal.listing_id}`} style={{color:'#fff', fontSize:'12px'}}>View Item</Link>
          </div>

          <div style={{padding:'10px', background:'#fff', borderBottom:'1px solid #e2e8f0', display:'flex', gap:'8px', flexWrap:'wrap'}}>
            <button onClick={handleReleaseToSeller} style={{background:'#16a34a', color:'#fff', border:'none', padding:'8px 12px', borderRadius:'8px', fontWeight:700, cursor:'pointer'}}>✅ Release to Seller</button>
            <button onClick={handleRefundBuyer} style={{background:'#e11d48', color:'#fff', border:'none', padding:'8px 12px', borderRadius:'8px', fontWeight:700, cursor:'pointer'}}>↩️ Refund Buyer</button>
            <button onClick={()=>handleBlockUser(selectedDeal.buyer_id, 'Buyer')} style={{background:'#fff', color:'#991b1b', border:'1px solid #fecaca', padding:'8px 12px', borderRadius:'8px', fontWeight:700, cursor:'pointer'}}>🚫 Block Buyer</button>
            <button onClick={()=>handleBlockUser(selectedDeal.seller_id, 'Seller')} style={{background:'#fff', color:'#991b1b', border:'1px solid #fecaca', padding:'8px 12px', borderRadius:'8px', fontWeight:700, cursor:'pointer'}}>🚫 Block Seller</button>
          </div>

          <div style={{flex:1, overflowY:'auto', padding:'16px', display:'flex', flexDirection:'column', gap:'10px'}}>
            {messages.map(m=>(
              <div key={m.id} style={{alignSelf: m.sender_role==='admin'?'flex-end':'flex-start', maxWidth:'70%', padding:'10px 14px', borderRadius:'12px', background: m.sender_role==='admin'? '#0f172a' : m.sender_role==='buyer'? '#e0f2fe' : '#fef9c3', color: m.sender_role==='admin'? '#fff':'#0f172a', fontSize:'14px'}}>
                <div style={{fontSize:'10px', fontWeight:700, opacity:0.7, marginBottom:'2px'}}>{m.sender_role.toUpperCase()}</div>{m.message}
              </div>
            ))}
            <div ref={bottomRef}/>
          </div>

          <div style={{padding:'12px', background:'#fff', borderTop:'1px solid #e2e8f0', display:'flex', gap:'8px'}}>
            <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendAsAdmin()} placeholder="Chat as Admin — both will see..." style={{flex:1, padding:'12px 16px', borderRadius:'999px', border:'1px solid #cbd5e1'}}/>
            <button onClick={sendAsAdmin} style={{background:'#0f172a', color:'#fff', border:'none', width:'44px', height:'44px', borderRadius:'50%', cursor:'pointer'}}>➤</button>
          </div>
        </>
        }
      </div>
    </div>
  )
}