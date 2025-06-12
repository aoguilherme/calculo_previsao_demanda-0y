'use server'

import { createClient } from '@/lib/supabase/server'
import { createFallbackClient, testConnection } from '@/lib/supabase/fallback-client'
import { testBasicConnection, clearTableBasic } from '@/lib/supabase/basic-client'
import { PostgrestError } from '@supabase/supabase-js'

export async function clearPrevisoesDemanda() {
  console.log('🗑️ Iniciando exclusão de todos os dados da tabela previsoes_demanda...')
  
  try {
    // Verificar variáveis de ambiente antes de criar o cliente
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    console.log('🔍 Verificando configuração:')
    console.log('- NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'Definida' : '❌ NÃO DEFINIDA')
    console.log('- SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'Definida' : '❌ NÃO DEFINIDA')
    console.log('- URL completa:', supabaseUrl)
    console.log('- Service Key (primeiros 20 chars):', supabaseServiceKey?.substring(0, 20) + '...')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      const missingVars = []
      if (!supabaseUrl) missingVars.push('NEXT_PUBLIC_SUPABASE_URL')
      if (!supabaseServiceKey) missingVars.push('SUPABASE_SERVICE_ROLE_KEY')
      
      return { 
        success: false, 
        error: `Variáveis de ambiente não configuradas: ${missingVars.join(', ')}. Crie um arquivo .env.local com suas credenciais do Supabase.` 
      }
    }
    
    let supabase
    let usingFallback = false
    
    try {
      console.log('🔧 Tentando cliente Supabase principal...')
      supabase = createClient()
      
      // Teste rápido de conectividade
      const { data: testData, error: testError } = await supabase
        .from('previsoes_demanda')
        .select('count', { count: 'exact', head: true })
      
      if (testError) {
        throw new Error(`Cliente principal falhou: ${testError.message}`)
      }
      
      console.log('✅ Cliente principal funcionando')
      console.log('📊 Registros na tabela:', testData || 0)
    } catch (error) {
      console.log('⚠️ Cliente principal falhou, tentando cliente fallback...')
      console.error('Erro do cliente principal:', error)
      
      try {
        // Tentar cliente fallback com diagnósticos detalhados
        console.log('🔍 Executando teste de conectividade detalhado...')
        const connectionTest = await testConnection()
        
        if (!connectionTest.success) {
          console.error('❌ Teste de conectividade falhou:', connectionTest)
          
          // Fornecer diagnóstico específico baseado no erro
          let errorMessage = connectionTest.error
          if (connectionTest.originalError) {
            if (connectionTest.originalError.includes('fetch failed')) {
              errorMessage = `❌ Erro de rede crítico: Não foi possível conectar ao Supabase.\n\n🔍 Possíveis causas:\n• Conexão de internet instável ou indisponível\n• Firewall ou proxy bloqueando a conexão\n• Serviço Supabase temporariamente indisponível\n• Configurações de DNS incorretas\n\n💡 Soluções:\n• Verifique sua conexão de internet\n• Tente desabilitar temporariamente firewall/antivírus\n• Verifique se consegue acessar ${process.env.NEXT_PUBLIC_SUPABASE_URL} no navegador\n• Aguarde alguns minutos e tente novamente\n\nDetalhes técnicos: ${connectionTest.originalError}`
            } else if (connectionTest.originalError.includes('timeout')) {
              errorMessage = `⏱️ Timeout de conexão: A conexão demorou muito para responder.\n\n💡 Soluções:\n• Verifique a estabilidade da sua conexão\n• Tente novamente em alguns momentos\n• Verifique se não há sobrecarga na rede\n\nDetalhes: ${connectionTest.originalError}`
            }
          }
          
          return {
            success: false,
            error: errorMessage,
            timestamp: connectionTest.timestamp,
            diagnostics: {
              originalError: connectionTest.originalError,
              testDetails: connectionTest.details
            }
          }
        }
        
        console.log(`✅ Teste de conectividade bem-sucedido (método: ${connectionTest.method})`)
        supabase = createFallbackClient()
        usingFallback = true
        console.log('✅ Cliente fallback funcionando')
        console.log('📊 Registros na tabela:', connectionTest.count || 0)
      } catch (fallbackError) {
         console.error('❌ Cliente fallback também falhou:', fallbackError)
         console.log('🔄 Tentando método HTTP básico como última opção...')
         
         try {
           // Última tentativa: HTTP básico
           const basicTest = await testBasicConnection()
           
           if (!basicTest.success) {
             return {
               success: false,
               error: `Todos os métodos falharam. Último erro: ${basicTest.error}`
             }
           }
           
           console.log('✅ HTTP básico funcionando, usando este método')
           
           // Usar método HTTP básico para limpar a tabela
           const basicResult = await clearTableBasic()
           
           if (!basicResult.success) {
             return {
               success: false,
               error: `Erro no método HTTP básico: ${basicResult.error}`
             }
           }
           
           return {
              success: true,
              message: `${basicResult.message} (método HTTP básico)`
            }
            
          } catch (basicError) {
            console.error('❌ Método HTTP básico também falhou:', basicError)
            return {
              success: false,
              error: `Erro de conectividade: Todos os métodos falharam. Verifique sua conexão com a internet, configurações de firewall/proxy, ou se o projeto Supabase está ativo.`
            }
          }
        }
      }
     
     // Se chegou até aqui, significa que temos um cliente Supabase funcionando
     // Usar DELETE direto em vez da função SQL problemática
    console.log('🧹 Executando limpeza da tabela com DELETE...')
    const { error: deleteError } = await supabase
      .from('previsoes_demanda')
      .delete()
      .neq('id', 0) // Deleta todos os registros (condição sempre verdadeira)
    
    if (deleteError) {
      console.error('❌ Erro ao limpar tabela:', deleteError)
      return { 
        success: false, 
        error: `Erro ao limpar tabela: ${deleteError.message}` 
      }
    }
    
    console.log('✅ Tabela limpa com sucesso!')
    
    // Verificar se a limpeza foi bem-sucedida
    const { data: finalCount, error: finalCountError } = await supabase
      .from('previsoes_demanda')
      .select('count', { count: 'exact', head: true })
    
    if (finalCountError) {
      console.log('⚠️ Não foi possível verificar o resultado final, mas a operação foi executada')
    } else {
      console.log('📊 Registros restantes na tabela:', finalCount || 0)
    }
    
    const clientType = usingFallback ? ' (usando cliente alternativo)' : ''
    return { 
      success: true, 
      message: `Tabela limpa com sucesso! Todos os registros foram removidos.${clientType}` 
    }
    
  } catch (error) {
    console.error('❌ Erro inesperado ao excluir dados:', error)
    return { 
      success: false, 
      error: `Erro inesperado: ${error instanceof Error ? error.message : 'Erro desconhecido'}` 
    }
  }
}