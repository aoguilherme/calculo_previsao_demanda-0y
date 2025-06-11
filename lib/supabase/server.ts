import { createServerClient } from '@supabase/ssr'

export function createClient() {
  console.log('🔧 Criando cliente Supabase...')
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  
  console.log('🔍 Verificando variáveis de ambiente:')
  console.log('URL:', supabaseUrl ? 'Definida' : 'Não definida')
  console.log('Service Key:', supabaseServiceKey ? 'Definida' : 'Não definida')
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Variáveis de ambiente do Supabase não encontradas')
    throw new Error('Missing Supabase environment variables')
  }
  
  try {
    console.log('✅ Criando cliente Supabase com sucesso')
    return createServerClient(supabaseUrl, supabaseServiceKey, {
      cookies: {
        getAll() {
          return []
        },
        setAll() {
          // No-op for server-side
        },
      },
    })
  } catch (error) {
    console.error('❌ Erro ao criar cliente Supabase:', error)
    throw error
  }
}
