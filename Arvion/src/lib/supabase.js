import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://yylxyfjymeengsuzzdur.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5bHh5Zmp5bWVlbmdzdXp6ZHVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3NjAzMjcsImV4cCI6MjEwMTMzNjMyN30.m8Al-8lYievVG4P3mBfN6yjxEo2vWhXN1ZDHauUAGMM'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
})

export function isSupabaseConfigured() {
  return true
}