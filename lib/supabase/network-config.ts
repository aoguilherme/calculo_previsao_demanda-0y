// Configurações de rede para contornar problemas de conectividade

export const networkConfig = {
  // Configurações de fetch customizadas para problemas de rede
  fetchOptions: {
    // Timeout mais longo para conexões lentas (aumentado para 120 segundos)
    timeout: 120000, // 120 segundos
    
    // Headers para melhor compatibilidade
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Connection': 'keep-alive'
    },
    
    // Configurações de retry (aumentado para 5 tentativas)
    retries: 5,
    retryDelay: 2000 // Aumentado para 2 segundos
  }
}

// Função de fetch customizada com retry automático e backoff exponencial
export async function customFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const { retries, retryDelay, timeout, headers } = networkConfig.fetchOptions
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`🌐 Tentativa ${attempt}/${retries} para: ${url}`)
      
      const controller = new AbortController()
      const timeoutId = setTimeout(() => {
        controller.abort()
        console.log(`⏰ Timeout após ${timeout}ms na tentativa ${attempt}`)
      }, timeout)
      
      const response = await fetch(url, {
        ...options,
        headers: {
          ...headers,
          ...options.headers
        },
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      if (response.ok) {
        console.log(`✅ Sucesso na tentativa ${attempt} - Status: ${response.status}`)
        return response
      } else {
        const errorMsg = `HTTP ${response.status}: ${response.statusText}`
        console.log(`⚠️ Resposta não OK na tentativa ${attempt}: ${errorMsg}`)
        lastError = new Error(errorMsg)
        
        // Para erros 4xx (cliente), não tentar novamente
        if (response.status >= 400 && response.status < 500) {
          throw lastError
        }
      }
    } catch (error: any) {
      lastError = error
      console.error(`❌ Erro na tentativa ${attempt}:`, error.message)
      
      // Para erros de cliente (4xx), não tentar novamente
      if (error.message.includes('4')) {
        throw error
      }
      
      if (attempt === retries) {
        // Última tentativa falhou - fornecer erro específico
        if (error.name === 'AbortError') {
          throw new Error(`Timeout: A conexão para ${url} demorou mais de ${timeout/1000} segundos para responder. Verifique sua conexão de internet.`)
        } else if (error.message.includes('fetch failed')) {
          throw new Error(`Erro de rede: Não foi possível conectar ao Supabase (${url}). Verifique:\n- Sua conexão com a internet\n- Configurações de firewall/proxy\n- Se o serviço Supabase está disponível`)
        } else if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
          throw new Error(`Erro de DNS/Conexão: Não foi possível resolver ou conectar ao servidor ${url}. Verifique sua conexão de internet.`)
        } else {
          throw new Error(`Erro de conectividade: ${error.message}`)
        }
      }
      
      // Aguardar antes da próxima tentativa com backoff exponencial
      if (attempt < retries) {
        const delay = retryDelay * Math.pow(2, attempt - 1) // Backoff exponencial
        console.log(`⏳ Aguardando ${delay}ms antes da próxima tentativa (backoff exponencial)...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  throw lastError || new Error('Todas as tentativas de conexão falharam')
}