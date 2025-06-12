import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { customFetch } from './network-config'

export function createClient() {
  console.log('🔧 Criando cliente Supabase...')
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  
  console.log('🔍 Verificando variáveis de ambiente:')
  console.log('URL:', supabaseUrl ? 'Definida' : 'Não definida')
  console.log('Service Key:', supabaseServiceKey ? 'Definida' : 'Não definida')
  console.log('URL completa:', supabaseUrl)
  console.log('Service Key (primeiros 20 chars):', supabaseServiceKey?.substring(0, 20) + '...')
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Variáveis de ambiente do Supabase não encontradas')
    throw new Error('Missing Supabase environment variables')
  }
  
  try {
    console.log('🔗 Tentando conectar com Supabase...')
    const client = createServerClient(supabaseUrl, supabaseServiceKey, {
      cookies: {
        getAll() {
          return []
        },
        setAll() {
          // No-op for server-side
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        fetch: (url, options = {}) => {
          console.log('🌐 Fazendo requisição customizada para:', url)
          const headers = options.headers || {}
          return customFetch(url, {
            ...options,
            headers: {
              ...headers,
              'Authorization': (headers as any)?.['Authorization'] || '',
              'apikey': (headers as any)?.['apikey'] || ''
            }
          })
        }
      }
    })
    
    console.log('✅ Cliente Supabase criado com sucesso')
    console.log('🔑 Configurando cliente para contornar RLS')
    return client
  } catch (error) {
    console.error('❌ Erro ao criar cliente Supabase:', error)
    throw error
  }
}
