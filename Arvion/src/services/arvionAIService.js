import { supabase } from '../lib/supabase'

const MARKET_KEYWORDS = ['phone','iphone','samsung','laptop','computer','furniture','chair','table','car','vehicle','fashion','cloth','shoe','electronics','tv','gadget','buy','product','market','sell','ps5','playstation','bag','watch']
const LOCAL_KEYWORDS = ['plumber','electrician','mechanic','photographer','tutor','cleaner','barber','hair','makeup','developer','website','web','designer','builder','painter','carpenter','cook','chef','driver','lesson','teach','repair','install','service','hire','find someone','someone who']

function normalize(text){ return text.toLowerCase().trim() }

function extractSearchTerms(text){
  const stop=['find','me','i','need','a','an','for','in','near','around','please','want','looking','someone','who','can','is','the','to','my']
  return normalize(text).split(/\s+/).filter(w=> w.length>2 && !stop.includes(w)).join(' ')
}

function classify(text){
  const t=normalize(text)
  const marketScore=MARKET_KEYWORDS.filter(k=> t.includes(k)).length
  const localScore=LOCAL_KEYWORDS.filter(k=> t.includes(k)).length
  if(marketScore>0 && localScore===0) return 'MARKET'
  if(localScore>0 && marketScore===0) return 'LOCAL'
  if(localScore>0 && marketScore>0) return localScore>=marketScore? 'LOCAL' : 'MARKET'
  if(t.includes('buy')||t.includes('price')||t.includes('under')||t.includes('₦')) return 'MARKET'
  if(t.includes('hire')||t.includes('need')) return 'LOCAL'
  return 'GENERAL'
}

async function searchMarket(terms){
  if(!supabase) return []
  let query=supabase.from('market_listings').select('id,title,description,price_minor,currency,location_area,location_city,condition,status,category:categories(name,slug)').eq('status','ACTIVE').order('created_at',{ascending:false}).limit(20)
  if(terms) query=query.or(`title.ilike.%${terms}%,description.ilike.%${terms}%`)
  const {data,error}=await query
  if(error) throw error
  return data||[]
}

async function searchLocal(terms){
  if(!supabase) return []
  let query=supabase.from('local_services').select('id,title,description,location_area,location_city,status,category:categories(name,slug)').eq('status','ACTIVE').order('created_at',{ascending:false}).limit(20)
  if(terms) query=query.or(`title.ilike.%${terms}%,description.ilike.%${terms}%`)
  let {data,error}=await query
  if(error){
    let q2=supabase.from('local_service_listings').select('id,title,description,location_area,location_city,status,category:categories(name,slug)').eq('status','ACTIVE').order('created_at',{ascending:false}).limit(20)
    if(terms) q2=q2.or(`title.ilike.%${terms}%,description.ilike.%${terms}%`)
    const r2=await q2
    if(r2.error) throw r2.error
    data=r2.data
  }
  return data||[]
}

export const arvionAIService={
  classify,
  async search(rawText){
    const text=rawText.trim()
    if(!text) return {source:'GENERAL', message:'Tell me what you need.', items:[], count:0}
    const terms=extractSearchTerms(text)
    const source=classify(text)
    if(source==='MARKET'){
      const items=await searchMarket(terms)
      if(items.length===0) return {source:'MARKET', message:"I couldn't find a matching result yet. Try describing what you need differently.", items:[], count:0, query:text, terms}
      return {source:'MARKET', message:`I found ${items.length} product${items.length>1?'s':''} in Market that match "${text}".`, items, count:items.length, query:text, terms}
    }
    if(source==='LOCAL'){
      const items=await searchLocal(terms)
      if(items.length===0) return {source:'LOCAL', message:"I couldn't find a matching result yet. Try describing what you need differently. Try adding your area, like 'plumber in Lekki'.", items:[], count:0, query:text, terms}
      return {source:'LOCAL', message:`I found some ${terms||'service'} options you can explore in Local.`, items, count:items.length, query:text, terms}
    }
    return {source:'GENERAL', message:"Thanks for telling me what you need. Arvion is still expanding. For now I can help you find products in Market (like phones, laptops, furniture) or services in Local (like plumbers, photographers, web developers). Try: 'Find me a plumber in Lagos' or 'iPhone 15 under ₦800,000'.", items:[], count:0, query:text, terms}
  }
}