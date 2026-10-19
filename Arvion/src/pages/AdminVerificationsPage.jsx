import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'

export function AdminVerificationsPage(){
  const [items,setItems]=useState([])
  const [loading,setLoading]=useState(true)
  const [filter,setFilter]=useState('pending')

  const load=async()=>{
    setLoading(true)
    let q=supabase.from('verifications').select('*').order('created_at',{ascending:false})
    if(filter!=='all') q=q.eq('status',filter)
    const {data}=await q
    setItems(data||[])
    setLoading(false)
  }
  useEffect(()=>{ load() },[filter])

  const getSignedUrl=async(path)=>{
    const {data}=await supabase.storage.from('verifications').createSignedUrl(path, 3600)
    return data?.signedUrl
  }

  const handleAction=async(id, status)=>{
    const reason = status==='rejected'? prompt('Reason for rejection?') : null
    if(status==='rejected' &&!reason) return
    const update={status}
    if(reason) update.rejection_reason=reason
    const {error}=await supabase.from('verifications').update(update).eq('id',id)
    if(error) alert(error.message)
    else load()
  }

  return (
    <div style={{padding:'20px',maxWidth:'1200px',margin:'0 auto'}}>
      <Link to="/welcome">← Home</Link>
      <h1 style={{marginTop:'12px'}}>Admin — Verifications</h1>
      <div style={{display:'flex',gap:'8px',marginTop:'12px'}}>
        {['pending','verified','rejected','all'].map(f=>(
          <button key={f} onClick={()=>setFilter(f)} style={{padding:'6px 12px',borderRadius:'999px',border:'1px solid #e2e8f0',background:filter===f?'#0f172a':'#fff',color:filter===f?'#fff':'#000',textTransform:'capitalize'}}>{f}</button>
        ))}
      </div>
      {loading? <p>Loading...</p> : items.length===0? <p>No {filter} verifications</p> :
        <div style={{display:'grid',gap:'16px',marginTop:'20px'}}>
          {items.map(v=>(
            <VerificationCard key={v.id} v={v} onAction={handleAction} getUrl={getSignedUrl}/>
          ))}
        </div>
      }
    </div>
  )
}

function VerificationCard({v,onAction,getUrl}){
  const [ninUrl,setNinUrl]=useState('')
  const [faceUrl,setFaceUrl]=useState('')
  useEffect(()=>{(async()=>{
    if(v.nin_image_path) setNinUrl(await getUrl(v.nin_image_path))
    if(v.face_image_path) setFaceUrl(await getUrl(v.face_image_path))
  })()},[v])
  return (
    <div style={{border:'1px solid #e2e8f0',borderRadius:'16px',padding:'16px',display:'flex',gap:'16px',background:'#fff'}}>
      <div style={{flex:1}}>
        <div style={{fontWeight:'700'}}>User: {v.user_id.slice(0,8)}... • NIN: {v.nin_number}</div>
        <div style={{fontSize:'12px',opacity:0.6}}>{new Date(v.created_at).toLocaleString()} • {v.status}</div>
        {v.rejection_reason && <div style={{background:'#fee2e2',padding:'8px',borderRadius:'8px',marginTop:'8px',fontSize:'13px'}}>Reason: {v.rejection_reason}</div>}
        <div style={{marginTop:'12px',display:'flex',gap:'8px'}}>
          {v.status==='pending' && <><button onClick={()=>onAction(v.id,'verified')} style={{background:'#16a34a',color:'#fff',border:'none',padding:'8px 14px',borderRadius:'8px',fontWeight:'700',cursor:'pointer'}}>✓ Approve</button><button onClick={()=>onAction(v.id,'rejected')} style={{background:'#ef4444',color:'#fff',border:'none',padding:'8px 14px',borderRadius:'8px',fontWeight:'700',cursor:'pointer'}}>✕ Reject</button></>}
          {v.status!=='pending' && <button onClick={()=>onAction(v.id,'pending')} style={{background:'#f1f5f9',border:'1px solid #e2e8f0',padding:'8px 14px',borderRadius:'8px',cursor:'pointer'}}>Reset to pending</button>}
        </div>
      </div>
      <div style={{display:'flex',gap:'12px'}}>
        {ninUrl && <div><div style={{fontSize:'11px',fontWeight:'700'}}>NIN Image</div><img src={ninUrl} alt="NIN" style={{width:'120px',height:'120px',objectFit:'cover',borderRadius:'12px',border:'1px solid #e2e8f0'}}/></div>}
        {faceUrl && <div><div style={{fontSize:'11px',fontWeight:'700'}}>Face + NIN</div><img src={faceUrl} alt="Face" style={{width:'120px',height:'120px',objectFit:'cover',borderRadius:'12px',border:'1px solid #e2e8f0'}}/></div>}
      </div>
    </div>
  )
}