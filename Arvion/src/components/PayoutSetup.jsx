import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const BANKS_NG = [
  'Access Bank', 'GTBank', 'First Bank', 'UBA', 'Zenith Bank',
  'Fidelity Bank', 'Union Bank', 'Sterling Bank', 'Wema Bank',
  'FCMB', 'Ecobank', 'Stanbic IBTC', 'Polaris Bank', 'Keystone Bank',
  'Unity Bank', 'Jaiz Bank', 'Providus Bank', 'Opay', 'Palmpay', 'Moniepoint', 'Kuda', 'Other'
]

export function PayoutSetup({ onComplete, required = false }) {
  const [bankName, setBankName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountName, setAccountName] = useState('')
  const [existing, setExisting] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState(null)

  useEffect(()=>{
    const load = async()=>{
      setLoading(true)
      const { data: {user} } = await supabase.auth.getUser()
      if(!user){ setLoading(false); return }
      setUserId(user.id)
      const { data } = await supabase.from('seller_payout_accounts').select('*').eq('user_id', user.id).maybeSingle()
      if(data){
        setExisting(data)
        setBankName(data.bank_name)
        setAccountNumber(data.account_number)
        setAccountName(data.account_name)
      }
      setLoading(false)
    }
    load()
  },[])

  const handleSave = async()=>{
    if(!bankName.trim() || !accountNumber.trim() || !accountName.trim()){
      alert('Fill all bank details')
      return
    }
    if(accountNumber.replace(/\D/g,'').length < 10){
      alert('Invalid account number — must be 10 digits')
      return
    }
    setSaving(true)
    try {
      const { data: {user} } = await supabase.auth.getUser()
      const payload = {
        user_id: user.id,
        bank_name: bankName.trim(),
        account_number: accountNumber.trim().replace(/\s/g,''),
        account_name: accountName.trim(),
        updated_at: new Date().toISOString()
      }
      const { error } = await supabase.from('seller_payout_accounts').upsert(payload, { onConflict: 'user_id' })
      if(error) throw error
      setExisting(payload)
      alert('Bank account saved! You can now receive payouts.')
      if(onComplete) onComplete(payload)
    } catch(e){
      alert('Failed: '+ e.message)
    } finally {
      setSaving(false)
    }
  }

  if(loading) return <div style={{padding:'20px', textAlign:'center'}}>Loading payout account...</div>

  return (
    <div style={{background:'#fff', border:'1px solid #e2e8f0', borderRadius:'16px', padding:'20px', maxWidth:'500px', margin:'0 auto'}}>
      <h3 style={{fontSize:'18px', fontWeight:800, marginBottom:'6px'}}>
        {existing? '💳 Payout Account' : '🏦 Add Payout Bank — Required to Sell'}
      </h3>
      <p style={{fontSize:'13px', color:'#64748b', marginBottom:'16px'}}>
        {required && !existing? 'You must add bank details before you can sell. This is where buyers money goes after delivery.' : 'Where should we send your money after you sell?'}
      </p>

      <label style={{fontSize:'12px', fontWeight:600}}>Bank Name *</label>
      <select value={bankName} onChange={e=>setBankName(e.target.value)} style={{width:'100%', padding:'12px', borderRadius:'8px', border:'1px solid #cbd5e1', marginBottom:'12px', background:'#fff'}}>
        <option value="">-- Select Bank --</option>
        {BANKS_NG.map(b=> <option key={b} value={b}>{b}</option>)}
      </select>

      <label style={{fontSize:'12px', fontWeight:600}}>Account Number *</label>
      <input value={accountNumber} onChange={e=>setAccountNumber(e.target.value.replace(/\D/g,''))} placeholder="0123456789" maxLength={10} style={{width:'100%', padding:'12px', borderRadius:'8px', border:'1px solid #cbd5e1', marginBottom:'12px'}} />

      <label style={{fontSize:'12px', fontWeight:600}}>Account Name *</label>
      <input value={accountName} onChange={e=>setAccountName(e.target.value)} placeholder="Name as on account" style={{width:'100%', padding:'12px', borderRadius:'8px', border:'1px solid #cbd5e1', marginBottom:'16px'}} />

      <button onClick={handleSave} disabled={saving} style={{width:'100%', background:'#0f172a', color:'#fff', padding:'14px', borderRadius:'10px', fontWeight:700, border:'none', cursor:'pointer'}}>
        {saving? 'Saving...' : existing? 'Update Bank Details' : 'Save & Continue to Sell'}
      </button>

      {existing && (
        <div style={{marginTop:'12px', background:'#f0fdf4', padding:'10px', borderRadius:'8px', fontSize:'12px', color:'#166534', textAlign:'center'}}>
          ✅ Payout goes to {existing.bank_name} - {existing.account_number} ({existing.account_name})
        </div>
      )}
    </div>
  )
}

// Small widget to show in seller dashboard
export function SellerPayoutStatus({ dealRoomId }) {
  const [account, setAccount] = useState(null)
  useEffect(()=>{
    supabase.from('seller_payout_accounts').select('*').eq('user_id', (supabase.auth.getUser().then(u=>u.data.user?.id))).maybeSingle().then(()=>{})
    const load = async()=>{
      const { data: {user} } = await supabase.auth.getUser()
      if(!user) return
      const { data } = await supabase.from('seller_payout_accounts').select('*').eq('user_id', user.id).maybeSingle()
      setAccount(data)
    }
    load()
  },[])
  if(!account) return null
  return <div style={{fontSize:'11px', color:'#64748b'}}>Payout: {account.bank_name} {account.account_number}</div>
}