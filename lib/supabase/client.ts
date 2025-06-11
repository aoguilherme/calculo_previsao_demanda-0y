import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // Usar as credenciais fornecidas diretamente
  const supabaseUrl = 'https://yzlndoqrldmljrfvmnnx.supabase.co'
  const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6bG5kb3FybGRtbGpyZnZtbm54Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgzNDM0MzksImV4cCI6MjA2MzkxOTQzOX0.NYCGUdi3uN1XTOY58mGLY0mm146tlEhN3ID8LYncGdc'
  
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
