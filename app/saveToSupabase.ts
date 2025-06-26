import { createBrowserClient } from '@supabase/ssr'

interface ResultadoPrevisao {
  sku: string
  previsao_total: number
  media: number
  categoria: string
  ajuste_validacao: number
  familia?: string
}

interface SaveResult {
  success: boolean
  skusInseridos: number
  skusAtualizados: number
  erros: number
  error?: string
}

// Criar cliente Supabase com as credenciais corretas
function createSupabaseClient() {
  const supabaseUrl = 'https://yzlndoqrldmljrfvmnnx.supabase.co'
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6bG5kb3FybGRtbGpyZnZtbm54Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgzNDM0MzksImV4cCI6MjA2MzkxOTQzOX0.NYCGUdi3uN1XTOY58mGLY0mm146tlEhN3ID8LYncGdc'
  
  return createBrowserClient(supabaseUrl, supabaseKey)
}

export async function saveToSupabase(
  resultados: ResultadoPrevisao[],
  dataCalculo: Date
): Promise<SaveResult> {
  console.log('🚀 Iniciando salvamento no Supabase')
  
  try {
    const supabase = createSupabaseClient()
    console.log('✅ Cliente Supabase criado')
    
    // Verificar se temos dados válidos
    if (!resultados || resultados.length === 0) {
      throw new Error('Nenhum resultado fornecido para salvamento')
    }
    
    console.log(`📊 Processando ${resultados.length} SKUs...`)
    
    // Preparar dados para salvamento
    const dadosParaSalvar = resultados.map(resultado => ({
      sku: resultado.sku,
      media_prevista: Number(resultado.media) || 0,
      data_calculo: dataCalculo.toISOString().split('T')[0],
      fml_item: resultado.familia || ''
    }))
    
    // Filtrar dados válidos
    const dadosValidos = dadosParaSalvar.filter(item => 
      item.sku && 
      typeof item.media_prevista === 'number' && 
      !isNaN(item.media_prevista)
    )
    
    console.log(`✅ ${dadosValidos.length} registros válidos preparados`)
    
    if (dadosValidos.length === 0) {
      throw new Error('Nenhum dado válido encontrado')
    }
    
    // Testar conectividade
    console.log('🔍 Testando conectividade...')
    const { error: testError } = await supabase
      .from('previsoes_demanda')
      .select('sku')
      .limit(1)
    
    if (testError) {
      console.error('❌ Erro de conectividade:', testError)
      throw new Error(`Falha na conectividade: ${testError.message}`)
    }
    
    console.log('✅ Conectividade confirmada')
    
    // Processar em lotes pequenos
    const BATCH_SIZE = 50
    let skusProcessados = 0
    let erros = 0
    
    for (let i = 0; i < dadosValidos.length; i += BATCH_SIZE) {
      const batch = dadosValidos.slice(i, i + BATCH_SIZE)
      console.log(`Processando lote ${Math.floor(i/BATCH_SIZE) + 1} (${batch.length} SKUs)...`)
      
      try {
        // Processar lote com upsert
        const { error: batchError } = await supabase
          .from('previsoes_demanda')
          .upsert(batch, { onConflict: 'sku' })
        
        if (batchError) {
          console.error(`❌ Erro no lote ${Math.floor(i/BATCH_SIZE) + 1}:`, batchError.message)
          erros += batch.length
        } else {
          skusProcessados += batch.length
          console.log(`✅ Lote ${Math.floor(i/BATCH_SIZE) + 1} salvo com sucesso (${batch.length} SKUs)`)
        }
      } catch (error) {
        console.error(`❌ Erro inesperado no lote:`, error)
        erros += batch.length
      }
      
      // Pausa entre lotes
      if (i + BATCH_SIZE < dadosValidos.length) {
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    }
    
    console.log(`✅ Salvamento concluído: ${skusProcessados} processados, ${erros} erros`)
    
    return {
      success: true,
      skusInseridos: 0, // Não diferenciamos inserção de atualização no upsert
      skusAtualizados: skusProcessados,
      erros
    }
    
  } catch (error) {
    console.error('❌ ERRO em saveToSupabase:', error)
    return {
      success: false,
      skusInseridos: 0,
      skusAtualizados: 0,
      erros: 1,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }
  }
}

// Nova função para sincronizar SKUs entre planilha e Supabase
export async function syncSkusWithSupabase(
  resultados: ResultadoPrevisao[],
  dataCalculo: Date
): Promise<SaveResult> {
  console.log('🔄 Iniciando sincronização de SKUs com Supabase')
  
  try {
    const supabase = createSupabaseClient()
    console.log('✅ Cliente Supabase criado')
    
    // 1. Buscar todos os SKUs existentes no Supabase
    console.log('📋 Buscando SKUs existentes no Supabase...')
    const { data: skusExistentes, error: fetchError } = await supabase
      .from('previsoes_demanda')
      .select('id, sku')
    
    if (fetchError) {
      throw new Error(`Erro ao buscar SKUs existentes: ${fetchError.message}`)
    }
    
    const skusSupabase = new Set(skusExistentes?.map(item => item.sku) || [])
    const skusPlanilha = new Set(resultados.map(item => item.sku))
    
    console.log(`📊 SKUs no Supabase: ${skusSupabase.size}, SKUs na planilha: ${skusPlanilha.size}`)
    
    // 2. Identificar SKUs para excluir (existem no Supabase mas não na planilha)
    const skusParaExcluir = [...skusSupabase].filter(sku => !skusPlanilha.has(sku))
    console.log(`🗑️ SKUs para excluir: ${skusParaExcluir.length}`)
    
    // 3. Identificar SKUs para adicionar (existem na planilha mas não no Supabase)
    const skusParaAdicionar = resultados.filter(item => !skusSupabase.has(item.sku))
    console.log(`➕ SKUs para adicionar: ${skusParaAdicionar.length}`)
    
    // 4. Identificar SKUs para atualizar (existem em ambos)
    const skusParaAtualizar = resultados.filter(item => skusSupabase.has(item.sku))
    console.log(`🔄 SKUs para atualizar: ${skusParaAtualizar.length}`)
    
    let skusProcessados = 0
    let erros = 0
    
    // 5. Excluir SKUs que não estão na planilha
    if (skusParaExcluir.length > 0) {
      console.log('🗑️ Excluindo SKUs não presentes na planilha...')
      const { error: deleteError } = await supabase
        .from('previsoes_demanda')
        .delete()
        .in('sku', skusParaExcluir)
      
      if (deleteError) {
        console.error('❌ Erro ao excluir SKUs:', deleteError.message)
        erros += skusParaExcluir.length
      } else {
        console.log(`✅ ${skusParaExcluir.length} SKUs excluídos com sucesso`)
      }
    }
    
    // 6. Adicionar novos SKUs
    if (skusParaAdicionar.length > 0) {
      console.log('➕ Adicionando novos SKUs...')
      const novosSkus = skusParaAdicionar.map(resultado => ({
        sku: resultado.sku,
        media_prevista: Number(resultado.media) || 0,
        data_calculo: dataCalculo.toISOString().split('T')[0],
        fml_item: resultado.familia || ''
      }))
      
      const { error: insertError } = await supabase
        .from('previsoes_demanda')
        .insert(novosSkus)
      
      if (insertError) {
        console.error('❌ Erro ao inserir novos SKUs:', insertError.message)
        erros += skusParaAdicionar.length
      } else {
        console.log(`✅ ${skusParaAdicionar.length} novos SKUs adicionados`)
        skusProcessados += skusParaAdicionar.length
      }
    }
    
    // 7. Atualizar SKUs existentes
    if (skusParaAtualizar.length > 0) {
      console.log('🔄 Atualizando SKUs existentes...')
      const BATCH_SIZE = 50
      
      for (let i = 0; i < skusParaAtualizar.length; i += BATCH_SIZE) {
        const batch = skusParaAtualizar.slice(i, i + BATCH_SIZE)
        
        for (const resultado of batch) {
          const { error: updateError } = await supabase
            .from('previsoes_demanda')
            .update({
              media_prevista: Number(resultado.media) || 0,
              data_calculo: dataCalculo.toISOString().split('T')[0],
              fml_item: resultado.familia || ''
            })
            .eq('sku', resultado.sku)
          
          if (updateError) {
            console.error(`❌ Erro ao atualizar SKU ${resultado.sku}:`, updateError.message)
            erros++
          } else {
            skusProcessados++
          }
        }
        
        // Pausa entre lotes
        if (i + BATCH_SIZE < skusParaAtualizar.length) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }
      
      console.log(`✅ ${skusParaAtualizar.length} SKUs atualizados`)
    }
    
    // 8. Reformular IDs para serem sequenciais
    console.log('🔢 Reformulando IDs sequenciais...')
    const { data: todosRegistros, error: fetchAllError } = await supabase
      .from('previsoes_demanda')
      .select('id, sku')
      .order('sku')
    
    if (fetchAllError) {
      console.warn('⚠️ Erro ao buscar registros para reformular IDs:', fetchAllError.message)
    } else if (todosRegistros) {
      // Atualizar IDs sequencialmente
      for (let i = 0; i < todosRegistros.length; i++) {
        const novoId = i + 1
        if (todosRegistros[i].id !== novoId) {
          const { error: updateIdError } = await supabase
            .from('previsoes_demanda')
            .update({ id: novoId })
            .eq('sku', todosRegistros[i].sku)
          
          if (updateIdError) {
            console.warn(`⚠️ Erro ao atualizar ID do SKU ${todosRegistros[i].sku}:`, updateIdError.message)
          }
        }
      }
      console.log('✅ IDs reformulados sequencialmente')
    }
    
    console.log(`✅ Sincronização concluída: ${skusProcessados} processados, ${erros} erros`)
    
    return {
      success: true,
      skusInseridos: skusParaAdicionar.length,
      skusAtualizados: skusParaAtualizar.length,
      erros
    }
    
  } catch (error) {
    console.error('❌ ERRO em syncSkusWithSupabase:', error)
    return {
      success: false,
      skusInseridos: 0,
      skusAtualizados: 0,
      erros: 1,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }
  }
}