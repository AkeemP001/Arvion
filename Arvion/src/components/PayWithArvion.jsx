import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

function loadPaystackScript(){
  return new Promise((resolve, reject)=>{
    if(window.PaystackPop) return resolve(true)
    const script = document.createElement('script')
    script.src = 'https://js.paystack.co/v1/inline.js'
    script.onload = ()=> resolve(true)
    script.onerror = ()=> reject(new Error('Paystack failed to load'))
    document.body.appendChild(script)
  })
}

function ArvionPopup({ popup, onClose }){
  if(!popup) return null
  const isError = popup.type === 'error'
  return (
    <div style={{position:'fixed', inset:0, zIndex:100000, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.45)', padding:'20px'}}>
      <div style={{background:'#fff', borderRadius:'16px', padding:'24px', width:'100%', maxWidth:'380px', boxShadow:'0 20px 40px rgba(0,0,0,0.2)', textAlign:'center'}}>
        <div style={{width:'56px', height:'56px', borderRadius:'50%', background:isError?'#fee2e2':'#dcfce7', color:isError?'#991b1b':'#166534', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'26px', margin:'0 auto 12px'}}>
          {isError? '!' : '✓'}
        </div>
        <h3 style={{fontSize:'16px', fontWeight:700, color:'#0f172a', marginBottom:'8px'}}>{isError? 'Oops' : 'Success'}</h3>
        <p style={{fontSize:'14px', color:'#475569', lineHeight:'1.5'}}>{popup.message}</p>
        <button onClick={onClose} style={{marginTop:'18px', width:'100%', background:'#0f172a', color:'#fff', border:'none', padding:'12px', borderRadius:'10px', fontWeight:700, cursor:'pointer'}}>
          {isError? 'Try Again' : 'Continue'}
        </button>
      </div>
    </div>
  )
}

function Toast({ toast, onClose }){
  if(!toast) return null
  const bg = toast.type === 'error'? '#991b1b' : toast.type === 'success'? '#065f46' : '#0f172a'
  return (
    <div style={{position:'fixed', top:'20px', left:'50%', transform:'translateX(-50%)', zIndex:99999, background:bg, color:'#fff', padding:'14px 20px', borderRadius:'12px', display:'flex', gap:'12px', minWidth:'300px', boxShadow:'0 10px 20px rgba(0,0,0,0.2)'}}>
      <span style={{fontSize:'16px'}}>{toast.type === 'error'? '⚠️' : '✅'}</span>
      <span style={{flex:1, fontSize:'14px'}}>{toast.message}</span>
      <button onClick={onClose} style={{background:'rgba(255,255,255,0.2)', border:'none', color:'#fff', borderRadius:'6px', padding:'4px 8px', cursor:'pointer'}}>✕</button>
    </div>
  )
}

export function PayWithArvion({ amount, productId, sellerId, dealRoomId, acceptedOfferId, onPaid }) {
  const [currentUserId, setCurrentUserId] = useState(null)
  const [userEmail, setUserEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [isPaid, setIsPaid] = useState(false)
  const [toast, setToast] = useState(null)
  const [popup, setPopup] = useState(null)

  const showToast = (message, type='info')=>{
    setToast({message, type})
    setTimeout(()=>setToast(null), 4000)
  }
  const showPopup = (message, type='success')=> setPopup({message, type})

  useEffect(()=>{
    supabase.auth.getUser().then(({data})=> {
      setCurrentUserId(data.user?.id)
      setUserEmail(data.user?.email || '')
    })
  },[])

  useEffect(()=>{
    if(!dealRoomId) return
    const check = async()=>{
      const { data } = await supabase.from('deal_rooms').select('status,payment_reference').eq('id', dealRoomId).single()
      if(data && data.payment_reference && ['PAID','SHIPPED','COMPLETED'].includes(data.status)){
        setIsPaid(true)
      }
    }
    check()
  },[dealRoomId])

  if (currentUserId && sellerId && currentUserId === sellerId) {
    return (
      <>
        <Toast toast={toast} onClose={()=>setToast(null)} />
        <div style={{background:'#f1f5f9', border:'1px dashed #cbd5e1', padding:'12px', borderRadius:'12px', textAlign:'center', fontSize:'13px'}}>Seller view — buyer pays here</div>
      </>
    )
  }

  if (isPaid) {
    return (
      <>
        <Toast toast={toast} onClose={()=>setToast(null)} />
        <ArvionPopup popup={popup} onClose={()=>setPopup(null)} />
        <div style={{background:'#dcfce7', border:'1px solid #bbf7d0', padding:'14px', borderRadius:'12px', textAlign:'center', fontSize:'13px', color:'#166534', fontWeight:700}}>✅ Payment Received — Escrow Held</div>
      </>
    )
  }

  const handlePay = async()=>{
    if(loading) return
    if(!amount || Number(amount) <=0){ showToast('Invalid amount', 'error'); return }
    if(!dealRoomId){ showToast('Please chat seller first to create a deal', 'error'); return }

    setLoading(true)
    try{
      await loadPaystackScript()

      const { data: {user} } = await supabase.auth.getUser()
      if(!user){ showPopup('Please login to continue', 'error'); setLoading(false); return }
      if(user.id === sellerId){ showPopup('You cannot pay for your own listing', 'error'); setLoading(false); return }

      const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY
      if(!publicKey){ showPopup('Payment not configured. Contact support.', 'error'); setLoading(false); return }

      const reference = `ARV-${dealRoomId}-${Date.now()}`
      const amountKobo = Math.round(Number(amount)*100)

      const paystack = window.PaystackPop.setup({
        key: publicKey,
        email: user.email || userEmail || `${user.id}@arvion.com`,
        amount: amountKobo,
        currency: 'NGN',
        ref: reference,
        metadata: {
          deal_room_id: dealRoomId,
          product_id: productId || '',
          buyer_id: user.id,
          seller_id: sellerId
        },
        callback: function(response){
          (async()=>{
            try{
              const { error } = await supabase.from('deal_rooms').update({
                status: 'PAID',
                payment_reference: response.reference,
                paid_at: new Date().toISOString(),
                paid_amount_minor: amountKobo,
                payout_status: 'HELD_IN_ESCROW'
              }).eq('id', dealRoomId)
              if(error) throw error

              if(acceptedOfferId){
                await supabase.from('deal_offers').update({status:'PAID'}).eq('id', acceptedOfferId)
              }
              if(productId){
                await supabase.from('market_listings').update({status:'SOLD'}).eq('id', productId)
              }

              setIsPaid(true)
              showPopup(`Payment successful! Reference: ${response.reference}`, 'success')
              if(onPaid) onPaid()
            } catch(e){
              showPopup(`Payment succeeded but Arvion update failed. Ref: ${response.reference}. ${e.message}`, 'error')
            }
            setLoading(false)
          })()
        },
        onClose: function(){
          showToast('Payment cancelled', 'error')
          setLoading(false)
        }
      })

      paystack.openIframe()

    } catch(e){
      showPopup(e.message, 'error')
      setLoading(false)
    }
  }

  return (
    <>
      <Toast toast={toast} onClose={()=>setToast(null)} />
      <ArvionPopup popup={popup} onClose={()=>setPopup(null)} />
      <button onClick={handlePay} disabled={loading} style={{width:'100%', background: '#0f172a', color:'#fff', border:'none', padding:'14px', borderRadius:'12px', fontWeight:700, fontSize:'14px', cursor:'pointer', opacity: loading?0.6:1}}>
        {loading? 'Opening Paystack...' : `🔒 Pay with Arvion — ₦${Number(amount).toLocaleString()}`}
      </button>
    </>
  )
}

function DisputeChatBox({ dealRoomId }){
  const [msgs, setMsgs] = useState([])
  const [input, setInput] = useState('')
  const bottomRef = useRef(null)

  useEffect(()=>{
    if(!dealRoomId) return
    const load = async()=>{
      const {data} = await supabase.from('dispute_chats').select('*').eq('deal_room_id', dealRoomId).order('created_at',{ascending:true})
      setMsgs(data||[])
    }
    load()
    const ch = supabase.channel(`dispute-user-${dealRoomId}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'dispute_chats',filter:`deal_room_id=eq.${dealRoomId}`},p=>setMsgs(m=>[...m, p.new])).subscribe()
    return ()=>supabase.removeChannel(ch)
  },[dealRoomId])

  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:'smooth'}) },[msgs])

  const send = async()=>{
    if(!input.trim()) return
    const {data:{user}} = await supabase.auth.getUser()
    const {data:room} = await supabase.from('deal_rooms').select('buyer_id, seller_id').eq('id', dealRoomId).single()
    let role = 'buyer'
    if(room && user.id === room.seller_id) role = 'seller'
    await supabase.from('dispute_chats').insert({deal_room_id: dealRoomId, sender_id: user.id, sender_role: role, message: input.trim()})
    setInput('')
  }

  if(msgs.length===0) return null

  return (
    <div style={{marginTop:'14px', border:'1px solid #e2e8f0', borderRadius:'12px', overflow:'hidden'}}>
      <div style={{background:'#0f172a', color:'#fff', padding:'8px 12px', fontSize:'12px', fontWeight:700}}>🛡️ Admin Resolution Chat</div>
      <div style={{maxHeight:'220px', overflowY:'auto', padding:'10px', display:'flex', flexDirection:'column', gap:'8px', background:'#f8fafc'}}>
        {msgs.map(m=>(
          <div key={m.id} style={{alignSelf: m.sender_role==='admin'?'flex-start':'flex-end', maxWidth:'80%', padding:'8px 12px', borderRadius:'10px', background: m.sender_role==='admin'? '#fffbeb' : '#fff', border:'1px solid #e2e8f0', fontSize:'13px'}}>
            <div style={{fontSize:'10px', fontWeight:800, color: m.sender_role==='admin'? '#92400e':'#64748b'}}>{m.sender_role.toUpperCase()}</div>{m.message}
          </div>
        ))}
        <div ref={bottomRef}/>
      </div>
      <div style={{display:'flex', gap:'6px', padding:'8px', background:'#fff'}}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder="Reply to admin..." style={{flex:1, padding:'10px 12px', borderRadius:'999px', border:'1px solid #cbd5e1', fontSize:'13px'}}/>
        <button onClick={send} style={{background:'#0f172a', color:'#fff', border:'none', padding:'0 14px', borderRadius:'999px', fontWeight:700, cursor:'pointer'}}>Send</button>
      </div>
    </div>
  )
}

export function DeliveryManager({ dealRoomId, isSeller }) {
  const [room, setRoom] = useState(null)
  const [loading, setLoading] = useState(true)
  const [riderName, setRiderName] = useState('')
  const [riderPhone, setRiderPhone] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [toast, setToast] = useState(null)
  const [popup, setPopup] = useState(null)
  const [timeLeft, setTimeLeft] = useState('')

  const showToast = (message, type='info')=>{
    setToast({message, type})
    setTimeout(()=>setToast(null), 4000)
  }
  const showPopup = (message, type='success')=> setPopup({message, type})

  useEffect(()=>{
    if(!dealRoomId) return
    const load = async()=>{
      setLoading(true)
      const { data } = await supabase.from('deal_rooms').select('*').eq('id', dealRoomId).single()
      setRoom(data)

      if(data?.delivery_status === 'SHIPPED' && data?.shipped_at){
        const shippedTime = new Date(data.shipped_at).getTime()
        const now = Date.now()
        const diff = now - shippedTime
        const fortyEightHours = 48*60*60*1000
        if(diff >= fortyEightHours && data?.status!== 'COMPLETED' && data?.delivery_status!== 'DISPUTED'){
          await supabase.from('deal_rooms').update({
            status: 'COMPLETED',
            delivery_status: 'COMPLETED',
            payout_status: 'RELEASED',
            completed_at: new Date().toISOString()
          }).eq('id', dealRoomId)
          setRoom(prev=>({...prev, status:'COMPLETED', delivery_status:'COMPLETED'}))
          showPopup('48h elapsed — money auto-released to seller', 'success')
        }
      }

      if(data?.delivery_status === 'SHIPPED' || data?.rider_name){
        setShowForm(false)
      } else if(data?.status === 'PAID' && isSeller){
        setShowForm(true)
      } else {
        setShowForm(false)
      }
      setLoading(false)
    }
    load()
  },[dealRoomId, isSeller])

  useEffect(()=>{
    if(!room?.shipped_at || room?.delivery_status!== 'SHIPPED') return
    const interval = setInterval(()=>{
      const shipped = new Date(room.shipped_at).getTime()
      const end = shipped + 48*60*60*1000
      const remaining = end - Date.now()
      if(remaining <= 0){
        setTimeLeft('00:00:00 - Auto-releasing...')
      } else {
        const h = Math.floor(remaining/3600000)
        const m = Math.floor((remaining%3600000)/60000)
        const s = Math.floor((remaining%60000)/1000)
        setTimeLeft(`${h}h ${m}m ${s}s left to confirm`)
      }
    },1000)
    return ()=>clearInterval(interval)
  },[room])

  const confirmShipment = async()=>{
    if(!riderName.trim() ||!riderPhone.trim()){ showToast('Enter rider name and phone', 'error'); return }
    setConfirming(true)
    const { error } = await supabase.from('deal_rooms').update({
      rider_name: riderName.trim(),
      rider_phone: riderPhone.trim(),
      shipment_carrier: riderName.trim(),
      shipment_dropoff: riderPhone.trim(),
      delivery_status: 'SHIPPED',
      shipped_at: new Date().toISOString(),
      status: 'SHIPPED'
    }).eq('id', dealRoomId)
    setConfirming(false)
    if(error){ showPopup(error.message, 'error'); return }
    setRoom(prev=>({...prev, rider_name: riderName, rider_phone: riderPhone, delivery_status:'SHIPPED', status:'SHIPPED', shipped_at: new Date().toISOString()}))
    setShowForm(false)
    showPopup(`Rider ${riderName} assigned. Waiting for buyer confirmation.`, 'success')
  }

  const handleBuyerConfirm = async()=>{
    setConfirming(true)
    const { error } = await supabase.from('deal_rooms').update({
      delivery_status: 'COMPLETED',
      status: 'COMPLETED',
      payout_status: 'RELEASED',
      completed_at: new Date().toISOString()
    }).eq('id', dealRoomId)
    setConfirming(false)
    if(error){ showPopup(error.message,'error'); return }
    setRoom(prev=>({...prev, delivery_status:'COMPLETED', status:'COMPLETED'}))
    showPopup('Confirmed! Money released to seller.', 'success')
  }

  const handleReport = async()=>{
    setConfirming(true)
    try{
      const {data:{user}} = await supabase.auth.getUser()
      const { error } = await supabase.from('deal_rooms').update({
        delivery_status: 'DISPUTED',
        status: 'DISPUTED',
        disputed_at: new Date().toISOString()
      }).eq('id', dealRoomId)
      if(error) throw error
      await supabase.from('dispute_chats').insert({
        deal_room_id: dealRoomId,
        sender_id: user.id,
        sender_role: 'buyer',
        message: `🚨 Buyer reported issue for rider ${room?.rider_name||''} (${room?.rider_phone||''}). Waiting for admin resolution.`
      })
      setRoom(prev=>({...prev, delivery_status:'DISPUTED', status:'DISPUTED'}))
      showPopup('Report sent. Arvion admin will chat with you shortly to resolve.', 'success')
    } catch(e){
      showPopup(e.message,'error')
    } finally{
      setConfirming(false)
    }
  }

  if(loading ||!room) return null

  if(isSeller){
    if(room.delivery_status === 'SHIPPED'){
      return (
        <>
          <Toast toast={toast} onClose={()=>setToast(null)} />
          <ArvionPopup popup={popup} onClose={()=>setPopup(null)} />
          <div style={{marginTop:'12px', background:'#fffbeb', border:'1px solid #fde68a', padding:'12px', borderRadius:'12px'}}>
            <div style={{fontWeight:700, fontSize:'13px', color:'#92400e'}}>🚚 Rider Assigned — Waiting for buyer</div>
            <div style={{fontSize:'13px', marginTop:'6px'}}>Rider: <b>{room.rider_name}</b> — {room.rider_phone}</div>
            <div style={{fontSize:'12px', color:'#92400e', marginTop:'8px'}}>{timeLeft || 'Buyer has 48h to confirm.'}</div>
          </div>
          {room.delivery_status === 'DISPUTED' || true? <DisputeChatBox dealRoomId={dealRoomId} /> : null}
        </>
      )
    }
    if(room.delivery_status === 'COMPLETED'){
      return (
        <div style={{marginTop:'12px', background:'#dcfce7', border:'1px solid #bbf7d0', padding:'12px', borderRadius:'12px', textAlign:'center', fontSize:'13px', color:'#166534', fontWeight:700}}>
          ✅ Completed — Money released to your bank
        </div>
      )
    }
    if(room.delivery_status === 'DISPUTED'){
      return (
        <>
          <div style={{marginTop:'12px', background:'#fee2e2', border:'1px solid #fecaca', padding:'12px', borderRadius:'12px', textAlign:'center', fontSize:'13px', color:'#991b1b'}}>
            ⚠️ Disputed — Admin will contact you
          </div>
          <DisputeChatBox dealRoomId={dealRoomId} />
        </>
      )
    }
    if(showForm){
      return (
        <>
          <Toast toast={toast} onClose={()=>setToast(null)} />
          <ArvionPopup popup={popup} onClose={()=>setPopup(null)} />
          <div style={{marginTop:'12px', background:'#fff', border:'1px solid #e2e8f0', padding:'14px', borderRadius:'12px'}}>
            <h4 style={{fontSize:'14px', fontWeight:700}}>Assign Rider</h4>
            <p style={{fontSize:'12px', color:'#64748b', marginBottom:'10px'}}>Enter rider details. Buyer will be notified.</p>
            <input value={riderName} onChange={e=>setRiderName(e.target.value)} placeholder="Rider Name" style={{width:'100%', padding:'10px', borderRadius:'8px', border:'1px solid #cbd5e1', marginBottom:'10px'}}/>
            <input value={riderPhone} onChange={e=>setRiderPhone(e.target.value.replace(/\D/g,''))} placeholder="080..." style={{width:'100%', padding:'10px', borderRadius:'8px', border:'1px solid #cbd5e1', marginBottom:'12px'}}/>
            <button onClick={confirmShipment} disabled={confirming} style={{width:'100%', background:'#0f172a', color:'#fff', padding:'12px', borderRadius:'8px', fontWeight:700, border:'none', cursor:'pointer'}}>{confirming? 'Confirming...' : 'Confirm Rider'}</button>
          </div>
        </>
      )
    }
    return null
  }

  if(!isSeller){
    if(room.delivery_status === 'COMPLETED'){
      return <div style={{marginTop:'12px', background:'#dcfce7', padding:'12px', borderRadius:'12px', textAlign:'center', fontSize:'13px', color:'#166534', fontWeight:700}}>✅ You confirmed delivery — Seller paid</div>
    }
    if(room.delivery_status === 'DISPUTED'){
      return (
        <>
          <div style={{marginTop:'12px', background:'#fee2e2', border:'1px solid #fecaca', padding:'12px', borderRadius:'12px', textAlign:'center', fontSize:'13px', color:'#991b1b'}}>⚠️ Report sent — Admin is reviewing</div>
          <DisputeChatBox dealRoomId={dealRoomId} />
        </>
      )
    }
    if(room.delivery_status === 'SHIPPED'){
      return (
        <>
          <Toast toast={toast} onClose={()=>setToast(null)} />
          <ArvionPopup popup={popup} onClose={()=>setPopup(null)} />
          <div style={{marginTop:'12px', background:'#fff', border:'1px solid #e2e8f0', padding:'14px', borderRadius:'12px'}}>
            <div style={{fontWeight:700, fontSize:'14px'}}>Rider on the way</div>
            <div style={{fontSize:'13px', marginTop:'6px'}}>Rider: <b>{room.rider_name}</b> — {room.rider_phone}</div>
            <div style={{fontSize:'12px', color:'#92400e', marginTop:'6px', background:'#fffbeb', padding:'6px', borderRadius:'6px'}}>{timeLeft}</div>

            <button onClick={handleBuyerConfirm} disabled={confirming} style={{width:'100%', marginTop:'12px', background:'#16a34a', color:'#fff', padding:'14px', borderRadius:'10px', fontWeight:800, border:'none', cursor:'pointer'}}>
              {confirming? 'Confirming...' : '✅ Confirm Delivery — Release Money'}
            </button>
            <button onClick={handleReport} disabled={confirming} style={{width:'100%', marginTop:'8px', background:'#fff', color:'#991b1b', padding:'12px', borderRadius:'10px', fontWeight:700, border:'1px solid #fecaca', cursor:'pointer'}}>
              ❌ Report Issue — Chat with Admin
            </button>
            <p style={{fontSize:'11px', color:'#64748b', textAlign:'center', marginTop:'8px'}}>If you don't act, money auto-releases in 48h</p>
          </div>
          <DisputeChatBox dealRoomId={dealRoomId} />
        </>
      )
    }
    if(room.status === 'PAID'){
      return <div style={{marginTop:'12px', background:'#f8fafc', border:'1px dashed #cbd5e1', padding:'12px', borderRadius:'12px', textAlign:'center', fontSize:'13px', color:'#64748b'}}>Waiting for seller to assign rider...</div>
    }
  }

  return null
}