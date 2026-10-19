import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const ROLES = [
  { value:'super_admin', label:'Super Admin - Full Access' },
  { value:'disputes_admin', label:'Disputes Admin - Resolve disputes' },
  { value:'support', label:'Support - Chat only' },
  { value:'finance', label:'Finance - View payouts only' },
]

export function AdminManage(){
  const [isSuper, setIsSuper] = useState(false)
  const [admins, setAdmins] = useState([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('disputes_admin')
  const [loading, setLoading] = useState(true)

  useEffect(()=>{
    const init = async()=>{
      const {data:{user}} = await supabase.auth.getUser()
      if(!user){ setLoading(false); return }
      const {data:me} = await supabase.from('profiles').select('is_admin, admin_role').eq('auth_user_id', user.id).single()
      if(me?.admin_role !== 'super_admin'){ setIsSuper(false); setLoading(false); return }
      setIsSuper(true)
      const {data} = await supabase.from('profiles').select('auth_user_id, email, is_admin, admin_role').eq('is_admin', true)
      setAdmins(data||[])
      setLoading(false)
    }
    init()
  },[])

  const addAdmin = async()=>{
    if(!email.trim()) return alert('Enter email')
    const {data:target, error} = await supabase.from('profiles').select('auth_user_id').ilike('email', email.trim()).single()
    if(error || !target){ alert('User not found — they must sign up first'); return }
    const {error:upErr} = await supabase.from('profiles').update({is_admin:true, admin_role: role}).eq('auth_user_id', target.auth_user_id)
    if(upErr) alert(upErr.message)
    else { alert(`${email} added as ${role}`); window.location.reload() }
  }

  const removeAdmin = async(authUserId)=>{
    if(!confirm('Remove admin?')) return
    await supabase.from('profiles').update({is_admin:false, admin_role:null}).eq('auth_user_id', authUserId)
    window.location.reload()
  }

  if(loading) return <div style={{padding:'20px'}}>Loading...</div>
  if(!isSuper) return <div style={{padding:'40px', textAlign:'center'}}><h2>⛔ Super Admin Only</h2><p>Only super_admin can add admins.</p></div>

  return (
    <div style={{padding:'20px', maxWidth:'800px', margin:'0 auto'}}>
      <h1 style={{fontWeight:800, fontSize:'22px'}}>👑 Admin Management</h1>
      <div style={{background:'#fff', border:'1px solid #e2e8f0', padding:'16px', borderRadius:'12px', marginTop:'16px'}}>
        <h3 style={{fontWeight:700}}>Add New Admin</h3>
        <div style={{display:'flex', gap:'8px', marginTop:'10px', flexWrap:'wrap'}}>
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="user email (must have account)" style={{flex:1, padding:'10px', borderRadius:'8px', border:'1px solid #cbd5e1', minWidth:'200px'}}/>
          <select value={role} onChange={e=>setRole(e.target.value)} style={{padding:'10px', borderRadius:'8px', border:'1px solid #cbd5e1'}}>
            {ROLES.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <button onClick={addAdmin} style={{background:'#0f172a', color:'#fff', padding:'10px 16px', borderRadius:'8px', fontWeight:700, border:'none', cursor:'pointer'}}>Add Admin</button>
        </div>
      </div>

      <div style={{marginTop:'20px'}}>
        <h3 style={{fontWeight:700, marginBottom:'10px'}}>Current Admins ({admins.length})</h3>
        {admins.map(a=>(
          <div key={a.auth_user_id} style={{background:'#fff', border:'1px solid #e2e8f0', padding:'12px 16px', borderRadius:'10px', display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px'}}>
            <div><div style={{fontWeight:600}}>{a.email||a.auth_user_id.slice(0,8)}</div><div style={{fontSize:'12px', color:'#64748b'}}>{a.admin_role}</div></div>
            <button onClick={()=>removeAdmin(a.auth_user_id)} style={{background:'#fee2e2', color:'#991b1b', border:'none', padding:'6px 10px', borderRadius:'6px', fontWeight:600, cursor:'pointer'}}>Remove</button>
          </div>
        ))}
      </div>
    </div>
  )
}