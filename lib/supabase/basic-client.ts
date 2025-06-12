// Cliente HTTP básico para Supabase sem dependências do SDK

// Função para fazer requisições HTTP básicas
export async function makeBasicRequest(endpoint: string, options: RequestInit = {}) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Credenciais do Supabase não encontradas')
  }
  
  const url = `${supabaseUrl}/rest/v1/${endpoint}`
  
  console.log('🌐 Fazendo requisição HTTP básica para:', url)
  
  const defaultOptions: RequestInit = {
    method: 'GET',
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    ...options
  }
  
  try {
    const response = await fetch(url, defaultOptions)
    
    console.log('📡 Status da resposta:', response.status)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Erro na resposta:', errorText)
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }
    
    const data = await response.text()
    console.log('✅ Resposta recebida com sucesso')
    
    return {
      ok: true,
      status: response.status,
      data: data ? JSON.parse(data) : null
    }
  } catch (error: any) {
    console.error('❌ Erro na requisição:', error)
    throw error
  }
}

// Função para testar conectividade básica
export async function testBasicConnection() {
  console.log('🔍 Testando conectividade HTTP básica...')
  
  try {
    const result = await makeBasicRequest('previsoes_demanda?select=count&head=true')
    console.log('✅ Teste de conectividade HTTP básica bem-sucedido')
    return { success: true, result }
  } catch (error: any) {
    console.error('❌ Teste de conectividade HTTP básica falhou:', error)
    return { success: false, error: error.message }
  }
}

// Função para limpar tabela usando HTTP básico
export async function clearTableBasic() {
  console.log('🗑️ Limpando tabela usando HTTP básico...')
  
  try {
    // Primeiro, verificar se há registros
    const countResult = await makeBasicRequest('previsoes_demanda?select=count')
    console.log('📊 Contagem atual:', countResult.data)
    
    // Deletar todos os registros
    const deleteResult = await makeBasicRequest('previsoes_demanda?id=neq.0', {
      method: 'DELETE'
    })
    
    console.log('🗑️ Resultado da exclusão:', deleteResult)
    
    // Verificar se a tabela está vazia
    const finalCountResult = await makeBasicRequest('previsoes_demanda?select=count')
    console.log('📊 Contagem final:', finalCountResult.data)
    
    return {
      success: true,
      message: 'Tabela limpa com sucesso usando HTTP básico!',
      details: {
        initialCount: countResult.data,
        finalCount: finalCountResult.data
      }
    }
  } catch (error: any) {
    console.error('❌ Erro ao limpar tabela:', error)
    return {
      success: false,
      error: error.message
    }
  }
}