// Cliente Supabase alternativo para ambientes com restrições de rede
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Configuração simplificada para ambientes restritivos
export function createFallbackClient() {
  console.log('🔧 Criando cliente Supabase com configuração simplificada...')
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('❌ Credenciais do Supabase não encontradas. Verifique as variáveis de ambiente NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY')
  }
  
  console.log('🔍 URL:', supabaseUrl)
  console.log('🔑 Service Key configurada')
  
  try {
    // Cliente mais simples sem configurações avançadas
    const client = createSupabaseClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      },
      // Configurações mínimas para máxima compatibilidade
      global: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Connection': 'keep-alive'
        },
        // Usar fetch nativo sem customizações para máxima compatibilidade
        fetch: fetch
      },
      // Configurações de rede mais conservadoras
      db: {
        schema: 'public'
      },
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    })
    
    console.log('✅ Cliente fallback criado com sucesso')
    return client
  } catch (error) {
    console.error('❌ Erro ao criar cliente fallback:', error)
    throw new Error(`Falha ao criar cliente Supabase: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
  }
}

// Função de teste de conectividade básica com diagnósticos avançados
export async function testConnection() {
  console.log('🔍 Testando conectividade básica...')
  
  try {
    const client = createFallbackClient()
    
    // Primeiro teste: verificar se conseguimos fazer uma consulta simples
    console.log('📊 Teste 1: Verificando acesso à tabela previsoes_demanda...')
    const { data, error } = await client
      .from('previsoes_demanda')
      .select('count', { count: 'exact', head: true })
    
    if (error) {
      console.error('❌ Erro no teste de tabela:', error)
      
      // Teste alternativo: verificar conectividade básica com uma consulta mais simples
      console.log('🔄 Teste 2: Tentando consulta alternativa...')
      try {
        const { data: altData, error: altError } = await client
          .from('previsoes_demanda')
          .select('*')
          .limit(1)
        
        if (altError) {
          console.error('❌ Erro no teste alternativo:', altError)
          return { 
            success: false, 
            error: `Falha em ambos os testes. Erro principal: ${error.message}. Erro alternativo: ${altError.message}`,
            details: {
              primaryError: error,
              alternativeError: altError
            }
          }
        }
        
        console.log('✅ Teste alternativo bem-sucedido')
        return { success: true, count: altData?.length || 0, method: 'alternative' }
      } catch (altCatchError: any) {
        console.error('❌ Erro crítico no teste alternativo:', altCatchError)
        return { 
          success: false, 
          error: `Falha crítica na conectividade: ${altCatchError.message}`,
          details: {
            primaryError: error,
            criticalError: altCatchError
          }
        }
      }
    }
    
    console.log('✅ Teste de conectividade bem-sucedido')
    return { success: true, count: data || 0, method: 'primary' }
  } catch (error: any) {
    console.error('❌ Erro durante criação do cliente ou teste:', error)
    
    // Fornecer diagnóstico específico baseado no tipo de erro
    let diagnosticMessage = error.message
    
    if (error.message.includes('fetch failed')) {
      diagnosticMessage = 'Erro de rede: Não foi possível conectar ao Supabase. Verifique sua conexão de internet e configurações de firewall.'
    } else if (error.message.includes('timeout')) {
      diagnosticMessage = 'Timeout: A conexão demorou muito para responder. Tente novamente em alguns momentos.'
    } else if (error.message.includes('ENOTFOUND')) {
      diagnosticMessage = 'Erro de DNS: Não foi possível resolver o endereço do Supabase. Verifique sua conexão de internet.'
    } else if (error.message.includes('ECONNREFUSED')) {
      diagnosticMessage = 'Conexão recusada: O servidor Supabase não está aceitando conexões. Verifique se o serviço está disponível.'
    } else if (error.message.includes('Credenciais')) {
      diagnosticMessage = error.message // Já é uma mensagem específica sobre credenciais
    }
    
    return { 
      success: false, 
      error: diagnosticMessage,
      originalError: error.message,
      timestamp: new Date().toISOString()
    }
  }
}