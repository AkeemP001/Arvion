import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export function AuthCallbackPage(){
  const navigate = useNavigate()
  const [status, setStatus] = useState('Confirming your email...')

  useEffect(()=>{
    const confirm = async()=>{
      try{
        const url = new URL(window.location.href)
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const queryParams = url.searchParams

        const code = queryParams.get('code')
        const token_hash = queryParams.get('token_hash') || hashParams.get('token_hash') || queryParams.get('token')
        const type = queryParams.get('type') || hashParams.get('type') || 'signup'
        const access_token = hashParams.get('access_token')

        console.log('Auth callback:', { code:!!code, token_hash:!!token_hash, type })

        // FLOW 1: PKCE code flow (new Supabase)
        if(code){
          const { data, error } = await supabase.auth.exchangeCodeForSession(window.location.href)
          if(error) throw error
          if(data.session){
            setStatus('✅ Email confirmed! Redirecting to Arvion...')
            setTimeout(()=> navigate('/welcome', {replace:true}), 800)
            return
          }
        }

        // FLOW 2: token_hash flow — THIS IS WHAT YOUR EMAIL USES
        if(token_hash){
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash,
            type: type
          })
          if(error) throw error

          if(type === 'recovery'){
            setStatus('✅ Recovery verified! Redirecting to reset...')
            setTimeout(()=> navigate('/reset-password', {replace:true}), 800)
            return
          }

          if(data.session){
            setStatus('✅ Email confirmed! Welcome to Arvion...')
            setTimeout(()=> navigate('/welcome', {replace:true}), 800)
          } else {
            setStatus('✅ Email confirmed! Please login now.')
            setTimeout(()=> navigate('/login', {replace:true}), 1200)
          }
          return
        }

        // FLOW 3: access_token in hash
        if(access_token){
          setStatus('✅ Email confirmed! Redirecting...')
          setTimeout(()=> navigate('/welcome', {replace:true}), 800)
          return
        }

        // Fallback
        const { data: sessionData } = await supabase.auth.getSession()
        if(sessionData.session){
          navigate('/welcome', {replace:true})
        } else {
          setStatus('✅ Confirmed! Please login.')
          setTimeout(()=> navigate('/login', {replace:true}), 1200)
        }

      } catch(e){
        console.error('Auth error:', e)
        const { data } = await supabase.auth.getSession()
        if(data.session){
          navigate('/welcome', {replace:true})
        } else {
          setStatus(`Error: ${e.message}`)
          setTimeout(()=> navigate('/login', {replace:true}), 2500)
        }
      }
    }
    confirm()
  },[navigate])

  return (
    <div style={{minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f8fafc', padding:'20px'}}>
      <div style={{background:'#fff', padding:'32px', borderRadius:'20px', maxWidth:'400px', width:'100%', textAlign:'center', boxShadow:'0 10px 30px rgba(0,0,0,0.08)'}}>
        <div style={{width:'56px', height:'56px', borderRadius:'50%', background:'#f1f5f9', margin:'0 auto 16px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'22px'}}>✉️</div>
        <h2 style={{fontSize:'16px', fontWeight:700, color:'#0f172a'}}>{status}</h2>
        <p style={{fontSize:'13px', color:'#64748b', marginTop:'12px'}}>Arvion is verifying your email — please wait</p>
      </div>
    </div>
  )
}