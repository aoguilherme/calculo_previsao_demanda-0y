"use server"

import { createClient } from "@/lib/supabase/server"

// Interfaces para tipagem
interface VendaData {
  data: string
  sku: string
  vendas: number
}

interface SkuDataPoint {
  ds: Date
  y: number
}

interface Holiday {
  holiday: string
  ds: Date
  lower_window?: number
  upper_window?: number
  prior_scale?: number
}

interface EventoRecorrente {
  mes: number
  dia: number
  impacto: number
  tipo: 'aumento_preco' | 'evento_sazonal'
}

interface ResultadoPrevisao {
  sku: string
  previsao_total: number
  media: number
  categoria: string
  ajuste_validacao: number
  familia?: string
}

interface ForecastResult {
  success: boolean
  processedSkus?: number
  error?: string
  downloadUrl?: string
  filename?: string
  resultados?: ResultadoPrevisao[]
  dataCalculo?: Date

  details?: {
    totalRecords: number
    dateRange: string
    statistics?: {
      mediaDiariaVendas: number
      intervaloAnos: number
      skusUnicos: number
    }
    melhorias?: {
      categorizacao: {
        alto_volume: number
        medio_volume: number
        baixo_volume: number
        sazonal: number
      }
      validacaoCruzada: {
        skusComValidacao: number
        mediaAjuste: number
        percentualValidados: number
      }
      datasAtipicas: number
      deteccaoEventos: {
        ativo: boolean
        sazonalidadeAnual: boolean
        tratamentoOutliers: boolean
      }
    }
  }
}

export async function calculateDemandForecast(
  prevState: ForecastResult | null,
  formData: FormData,
): Promise<ForecastResult> {
  console.log('🚀 Iniciando calculateDemandForecast')
  try {
    console.log('📊 Criando cliente Supabase')
    const supabase = createClient()
    console.log('✅ Cliente Supabase criado com sucesso')

    const dataInicioStr = formData.get("dataInicio") as string
    const dataFimStr = formData.get("dataFim") as string
    
    // Converter datas do formato mm/aaaa para Date objects (primeiro dia do mês)
    const parseDate = (dateStr: string): Date => {
      const [month, year] = dateStr.split('/')
      return new Date(parseInt(year), parseInt(month) - 1, 1)
    }
    
    // Converter número do mês para nome do mês (para compatibilidade com CSV)
    const convertMonthNumberToName = (monthNumber: number, year: number): string => {
      const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
      const anoAbreviado = year.toString().slice(-2)
      return `${meses[monthNumber]}/${anoAbreviado}`
    }
    
    const dataInicio = parseDate(dataInicioStr)
    const dataFim = parseDate(dataFimStr)
    const diasPrevisao = Number.parseInt(formData.get("diasPrevisao") as string)
    const csvFile = formData.get("csvFile") as File

    
    // Obter datas atípicas do formulário
    const datasAtipicasJson = formData.get("datasAtipicas") as string
    let datasAtipicasForm: any[] = []
    if (datasAtipicasJson) {
      try {
        datasAtipicasForm = JSON.parse(datasAtipicasJson)
        console.log("Datas atípicas recebidas do formulário:", datasAtipicasForm)
      } catch (error) {
        console.error("Erro ao processar datas atípicas:", error)
      }
    }

    // Parâmetros do script original (sem requisito mínimo de registros)
    const minRegistros = 1  // Permitir qualquer SKU com pelo menos 1 registro

    // Validar parâmetros
    
    if (!dataInicio || !dataFim || !diasPrevisao || !csvFile || csvFile.size === 0) {
      return { success: false, error: "Todos os campos são obrigatórios. Por favor, anexe um arquivo CSV." }
    }

    if (dataInicio >= dataFim) {
      return { success: false, error: "Data início deve ser anterior à data fim" }
    }



    // Ler e processar o arquivo CSV
    const csvText = await csvFile.text()
    const vendasData = parseCSV(csvText)
    console.log('📊 Dados processados do CSV:', vendasData.length, 'registros')
    
    if (vendasData.length === 0) {
      return { success: false, error: "Nenhum dado válido encontrado no arquivo CSV" }
    }

    // Criar mapeamento SKU -> Família
    const skuFamiliaMap = new Map<string, string>()
    vendasData.forEach(venda => {
      if (venda.sku && venda.familia) {
        skuFamiliaMap.set(venda.sku, venda.familia)
      }
    })
    console.log(`📊 Mapeamento de famílias criado para ${skuFamiliaMap.size} SKUs únicos`)

    // Filtrar dados pelo período (adaptado para dados mensais)
    const dataInicioDate = dataInicio
    const dataFimDate = dataFim

    const dadosFiltrados = vendasData.filter((venda) => {
      const dataVenda = new Date(venda.data)
      // Para dados mensais, comparar apenas ano e mês
      const anoMesVenda = dataVenda.getFullYear() * 12 + dataVenda.getMonth()
      const anoMesInicio = dataInicioDate.getFullYear() * 12 + dataInicioDate.getMonth()
      const anoMesFim = dataFimDate.getFullYear() * 12 + dataFimDate.getMonth()
      
      return anoMesVenda >= anoMesInicio && anoMesVenda <= anoMesFim
    })
    
    // Converter datas para formato mm/aaaa para exibição
    const formatarDataNumerico = (data: Date): string => {
      const mes = (data.getMonth() + 1).toString().padStart(2, '0')
      const ano = data.getFullYear()
      return `${mes}/${ano}`
    }
    
    console.log(`📅 Período de análise: ${formatarDataNumerico(dataInicioDate)} até ${formatarDataNumerico(dataFimDate)}`);
    console.log(`📊 Dados filtrados: ${dadosFiltrados.length} registros mensais`);

    if (dadosFiltrados.length === 0) {
      return { success: false, error: "Nenhum dado encontrado no período especificado" }
    }

    // Calcular o intervalo de tempo em anos (baseado em dados mensais)
    const mesesTotais = (dataFimDate.getFullYear() - dataInicioDate.getFullYear()) * 12 + 
                       (dataFimDate.getMonth() - dataInicioDate.getMonth()) + 1
    const intervaloAnos = mesesTotais / 12

    // Estatísticas básicas (adaptadas para dados mensais)
    const mediaMensalVendas = dadosFiltrados.reduce((sum, v) => sum + v.vendas, 0) / dadosFiltrados.length
    const skusUnicos = Array.from(new Set(dadosFiltrados.map((v) => v.sku))).length
    const mesesUnicosPorSku = dadosFiltrados.length / skusUnicos

    console.log("📊 Estatísticas dos dados mensais:")
    console.log("- Número total de registros:", dadosFiltrados.length)
    console.log("- Média mensal de vendas por registro:", mediaMensalVendas.toFixed(2))
    console.log("- Intervalo de dados em anos:", intervaloAnos.toFixed(2))
    console.log("- Número de SKUs únicos:", skusUnicos)
    console.log("- Meses totais no período:", mesesTotais)
    console.log("- Média de meses por SKU:", mesesUnicosPorSku.toFixed(1))

    // Agrupar dados por SKU
    const skuData = new Map<string, SkuDataPoint[]>()
    dadosFiltrados.forEach((venda) => {
      if (!skuData.has(venda.sku)) {
        skuData.set(venda.sku, [])
      }
      skuData.get(venda.sku)!.push({
        ds: new Date(venda.data),
        y: venda.vendas,
      })
    })
    
    // Processar datas atípicas para o cálculo Prophet
    const holidays: Holiday[] = [];
    
    // Processar datas atípicas do formulário
    if (datasAtipicasForm && datasAtipicasForm.length > 0) {
      console.log('Processando datas atípicas do formulário para o cálculo Prophet');
      console.log('Dados recebidos:', JSON.stringify(datasAtipicasForm, null, 2));
      
      datasAtipicasForm.forEach((periodo, index) => {
        console.log(`Processando período ${index + 1}:`, periodo);
        
        // Converter datas do formato mm/aaaa para Date objects
        const dataInicial = parseDate(periodo.dataInicial);
        const dataFinal = parseDate(periodo.dataFinal);
        const descricao = periodo.descricao || 'periodo_atipico';
        
        console.log(`Data inicial convertida: ${formatarDataNumerico(dataInicial)} (${dataInicial.toISOString()})`);
        console.log(`Data final convertida: ${formatarDataNumerico(dataFinal)} (${dataFinal.toISOString()})`);
        console.log(`Processando período atípico: ${formatarDataNumerico(dataInicial)} a ${formatarDataNumerico(dataFinal)} - ${descricao}`);
        
        // Adiciona cada dia do período como um holiday
        const tempDate = new Date(dataInicial);
        let diasAdicionados = 0;
        while (tempDate <= dataFinal) {
          holidays.push({
            holiday: descricao,
            ds: new Date(tempDate),
            // Adicionar metadados sobre o tipo de impacto esperado
            lower_window: 0,
            upper_window: 0,
            prior_scale: detectarTipoImpacto(descricao, dadosFiltrados, dataInicial, dataFinal)
          });
          console.log(`Adicionado dia atípico: ${tempDate.toISOString().split('T')[0]} - Tipo: ${descricao}`);
          tempDate.setDate(tempDate.getDate() + 1);
          diasAdicionados++;
        }
        console.log(`Total de dias adicionados para este período: ${diasAdicionados}`);
      });
      
      console.log(`Total de dias atípicos processados: ${holidays.length}`);
      console.log('Lista completa de holidays:', holidays.map(h => ({ holiday: h.holiday, ds: h.ds.toISOString().split('T')[0] })));
    } else {
      // Fallback: buscar do banco de dados se não houver datas no formulário
      console.log('Nenhuma data atípica encontrada no formulário, buscando do banco de dados...');
      const { data: datasAtipicas } = await supabase
        .from('datas_atipicas')
        .select('data_inicial, data_final');

      if (datasAtipicas && datasAtipicas.length > 0) {
        datasAtipicas.forEach(periodo => {
          const dataInicial = new Date(periodo.data_inicial);
          const dataFinal = new Date(periodo.data_final);
          
          // Adiciona cada dia do período como um holiday
          const tempDate = new Date(dataInicial);
          while (tempDate <= dataFinal) {
            holidays.push({
              holiday: 'periodo_atipico',
              ds: new Date(tempDate)
            });
            tempDate.setDate(tempDate.getDate() + 1);
          }
        });
      }
    }

    const resultados: ResultadoPrevisao[] = []
    
    // Segmentação por categoria baseada no padrão de vendas
    const categoriasSku = new Map<string, {
      skus: string[],
      mediaVendas: number,
      volatilidade: number,
      tipo: 'alto_volume' | 'medio_volume' | 'baixo_volume' | 'sazonal'
    }>()
    
    // Analisar padrões de cada SKU para segmentação
    Array.from(skuData.entries()).forEach(([sku, dadosSku]: [string, SkuDataPoint[]]) => {
      if (dadosSku.length < minRegistros) return
      
      const vendas = dadosSku.map((d: SkuDataPoint) => d.y)
      const mediaVendas = vendas.reduce((sum: number, v: number) => sum + v, 0) / vendas.length
      const variancia = vendas.reduce((sum: number, v: number) => sum + Math.pow(v - mediaVendas, 2), 0) / vendas.length
      const volatilidade = Math.sqrt(variancia) / mediaVendas
      
      // Classificar SKU por categoria
      let categoria: 'alto_volume' | 'medio_volume' | 'baixo_volume' | 'sazonal'
      if (mediaVendas > 50) {
        categoria = volatilidade > 0.8 ? 'sazonal' : 'alto_volume'
      } else if (mediaVendas > 10) {
        categoria = volatilidade > 0.8 ? 'sazonal' : 'medio_volume'
      } else {
        categoria = 'baixo_volume'
      }
      
      if (!categoriasSku.has(categoria)) {
        categoriasSku.set(categoria, { skus: [], mediaVendas: 0, volatilidade: 0, tipo: categoria })
      }
      categoriasSku.get(categoria)!.skus.push(sku)
    })
    
    console.log('Segmentação de SKUs por categoria:')
     Array.from(categoriasSku.entries()).forEach(([categoria, info]) => {
       console.log(`${categoria}: ${info.skus.length} SKUs`)
     })

    // Loop para cada SKU com melhorias por categoria
    Array.from(skuData.entries()).forEach(([sku, dadosSku]: [string, SkuDataPoint[]]) => {
      if (dadosSku.length < minRegistros) {
        console.log(
          `Ignorando SKU ${sku} com poucos dados (${dadosSku.length} registros, mínimo ${minRegistros} requerido).`,
        )
        return
      }
      
      // Identificar categoria do SKU
      let categoriaSku: string = 'medio_volume'
      Array.from(categoriasSku.entries()).forEach(([categoria, info]) => {
        if (info.skus.includes(sku)) {
          categoriaSku = categoria
        }
      })

      // Validação cruzada simples (holdout validation)
      const tamanhoTeste = Math.min(Math.floor(dadosSku.length * 0.2), 30) // 20% dos dados ou máximo 30 dias
      const dadosTreinamento = dadosSku.slice(0, -tamanhoTeste)
      const dadosTeste = dadosSku.slice(-tamanhoTeste)
      
      let ajusteValidacao = 1.0
      if (dadosTeste.length > 7) {
        // Calcular previsão híbrida para período de teste
        const previsaoTeste = calculateHybridForecast(dadosTreinamento, dadosTeste.length, 0, holidays)
        const vendaRealTeste = dadosTeste.reduce((sum: number, d: SkuDataPoint) => sum + d.y, 0)
        
        if (vendaRealTeste > 0) {
          const acuracia = Math.min(previsaoTeste / vendaRealTeste, vendaRealTeste / previsaoTeste)
          ajusteValidacao = Math.max(0.7, Math.min(1.3, acuracia)) // Limitar ajuste entre 70% e 130%
          console.log(`SKU ${sku}: Acurácia da validação = ${(acuracia * 100).toFixed(1)}%`)
        }
      }

      // Calcular a média dos últimos meses com ajuste por categoria
      const ultimaData = Math.max(...dadosSku.map((d: SkuDataPoint) => d.ds.getTime()))
      const mesesParaMedia = categoriaSku === 'alto_volume' ? 6 : categoriaSku === 'baixo_volume' ? 12 : 9
      const dadosRecentes = dadosSku.slice(-mesesParaMedia)
      const mediaRecente =
        dadosRecentes.length > 0
          ? (dadosRecentes.reduce((sum: number, d: SkuDataPoint) => sum + d.y, 0) / dadosRecentes.length) * diasPrevisao
          : 0

      // Calcular previsão híbrida (Prophet + SARIMA) com datas atípicas e ajustes por categoria (diasPrevisao agora representa meses)
      let previsaoTotal = calculateHybridForecast(dadosSku, diasPrevisao, mediaRecente, holidays)
      
      // Aplicar ajuste de validação cruzada
      previsaoTotal *= ajusteValidacao
      
      // Ajustes específicos por categoria (mais suaves)
      switch (categoriaSku) {
        case 'alto_volume':
          // SKUs de alto volume: ajuste mínimo para manter precisão
          previsaoTotal *= 0.98
          break
        case 'baixo_volume':
          // SKUs de baixo volume: mais otimista para evitar falta de estoque
          previsaoTotal *= 1.05
          break
        case 'sazonal':
          // SKUs sazonais: manter previsão base mas com limite superior mais flexível
          previsaoTotal = Math.min(previsaoTotal, mediaRecente * 2.2)
          break
        default:
          // Médio volume: manter previsão base
          break
      }
      
      console.log(`Previsão híbrida (Prophet+SARIMA) calculada para SKU ${sku} (${categoriaSku}) com ${holidays.length} datas atípicas - Ajuste validação: ${(ajusteValidacao * 100).toFixed(1)}%`)

      // Arredondar apenas para número inteiro, mantendo o valor real da previsão
      const media = Math.round(previsaoTotal)

      resultados.push({
        sku: sku,
        previsao_total: Math.round(previsaoTotal * 100) / 100,
        media: media,
        categoria: categoriaSku,
        ajuste_validacao: Math.round(ajusteValidacao * 100) / 100,
        familia: skuFamiliaMap.get(sku) || ''
      })
    })

    if (resultados.length === 0) {
      return { success: false, error: "Nenhum SKU com dados suficientes para previsão" }
    }

    const dataCalculo = new Date()
    
    console.log(`Processamento concluído para ${resultados.length} SKUs`)

    // Gerar planilha Excel com nome personalizado
    const dataFormatada = dataCalculo.toLocaleDateString("pt-BR")
    const filename = `previsao_calculada_${dataFormatada.replace(/\//g, "-")}.csv`
    const excelBuffer = generateExcel(resultados, dataFormatada)
    
    // Converter buffer para base64 para enviar ao cliente
    const base64Data = Buffer.from(excelBuffer).toString('base64')

    // Calcular estatísticas das melhorias implementadas
    const estatisticasCategorias = {
      alto_volume: resultados.filter(r => r.categoria === 'alto_volume').length,
      medio_volume: resultados.filter(r => r.categoria === 'medio_volume').length,
      baixo_volume: resultados.filter(r => r.categoria === 'baixo_volume').length,
      sazonal: resultados.filter(r => r.categoria === 'sazonal').length
    }
    
    const ajustesValidacao = resultados.map((r: ResultadoPrevisao) => r.ajuste_validacao || 1.0)
    const mediaAjuste = ajustesValidacao.reduce((sum: number, adj: number) => sum + adj, 0) / ajustesValidacao.length
    const skusComValidacao = resultados.filter((r: ResultadoPrevisao) => r.ajuste_validacao && r.ajuste_validacao !== 1.0).length
    
    return {
      success: true,
      processedSkus: resultados.length,
      downloadUrl: `data:text/csv;base64,${base64Data}`,
      filename,
      resultados: resultados,
      dataCalculo: dataCalculo,

      details: {
        totalRecords: dadosFiltrados.length,
        dateRange: `${dataInicio} a ${dataFim}`,
        statistics: {
          mediaDiariaVendas: Math.round(mediaMensalVendas * 100) / 100,
          intervaloAnos: Math.round(intervaloAnos * 100) / 100,
          skusUnicos,
        },
        melhorias: {
          categorizacao: estatisticasCategorias,
          validacaoCruzada: {
            skusComValidacao,
            mediaAjuste: Math.round(mediaAjuste * 100) / 100,
            percentualValidados: Math.round((skusComValidacao / resultados.length) * 100)
          },
          datasAtipicas: holidays.length,
          deteccaoEventos: {
            ativo: true,
            sazonalidadeAnual: true,
            tratamentoOutliers: true
          }
        }
      },
    }
  } catch (error) {
    console.error('❌ ERRO CAPTURADO em calculateDemandForecast:', error)
    console.error('❌ Stack trace:', error instanceof Error ? error.stack : 'Sem stack trace')
    console.error('❌ Tipo do erro:', typeof error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro interno do servidor",
    }
  }
}

// Função para fazer parse do CSV
function parseCSV(csvText: string) {
  console.log('🔍 Iniciando parseCSV');
  console.log('📄 Conteúdo do CSV (primeiros 500 caracteres):', csvText.substring(0, 500));
  
  const lines = csvText.trim().split("\n")
  console.log('📄 Total de linhas:', lines.length);
  
  // Log das primeiras linhas para debug
  console.log('📄 Primeiras 5 linhas do CSV:');
  lines.slice(0, 5).forEach((line, index) => {
    console.log(`Linha ${index + 1}: "${line}"`);
  });
  
  const vendasArray = []

  // Pular cabeçalho se existir
  const startIndex = lines[0].toLowerCase().includes("data") || lines[0].toLowerCase().includes("sku") ? 1 : 0
  console.log('📄 Processando', lines.length - startIndex, 'linhas de dados');
  console.log('📄 Índice de início:', startIndex);

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    
    // Detectar separador (vírgula ou ponto e vírgula)
    const separator = line.includes(',') ? ',' : ';'
    const parts = line.split(separator)
    const [dataStr, sku, familia, vendasStr] = parts
    
    // Log para debug do formato
    if (i < startIndex + 5) {
      console.log(`📊 Linha ${i + 1} dividida:`, parts);
    }

    if (dataStr && sku && familia && vendasStr) {
      try {
        // Converter data do formato "mar/25" para Date
        const dataVenda = parseDataMensal(dataStr.trim())
        const vendas = Number.parseInt(vendasStr.trim())

        if (!isNaN(dataVenda.getTime()) && !isNaN(vendas)) {
          const registro = {
            data: dataVenda,
            sku: sku.trim(),
            familia: familia.trim(),
            vendas: vendas,
          }
          vendasArray.push(registro)
          
          // Log detalhado para SKUs específicos ou primeiros registros
          if (i < startIndex + 10 || sku.trim().includes('R-006') || sku.trim().includes('PRODUTO001')) {
            console.log(`📊 Registro processado [linha ${i + 1}]:`, {
              dataOriginal: dataStr.trim(),
              dataConvertida: dataVenda.toISOString(),
              sku: sku.trim(),
              familia: familia.trim(),
              vendas: vendas
            });
          }
        } else {
          console.warn(`⚠️ Dados inválidos na linha ${i + 1}: data=${dataVenda}, vendas=${vendas}`);
        }
      } catch (error) {
        console.warn(`❌ Erro ao processar linha ${i + 1}: ${line}`, error)
      }
    } else {
      console.warn(`⚠️ Linha ${i + 1} com formato inválido: "${line}"`);
    }
  }

  console.log(`📊 Processados ${vendasArray.length} registros de vendas mensais`);
  
  // Log de resumo dos SKUs processados
  const skusUnicos = Array.from(new Set(vendasArray.map(v => v.sku)));
  console.log(`📊 SKUs únicos encontrados (${skusUnicos.length}):`, skusUnicos.slice(0, 10));
  
  // Log específico para SKUs mencionados pelo usuário
  const skuR006 = vendasArray.filter(v => v.sku.includes('R-006'));
  if (skuR006.length > 0) {
    console.log('🎯 Dados encontrados para SKU R-006:', skuR006);
  }
  
  return vendasArray
}

// Função para processar CSV de médias atuais


// Função para detectar outliers usando método IQR
function detectOutliers(dados: number[]): { outliers: boolean[], q1: number, q3: number, iqr: number } {
  const sorted = [...dados].sort((a, b) => a - b)
  const q1Index = Math.floor(sorted.length * 0.25)
  const q3Index = Math.floor(sorted.length * 0.75)
  const q1 = sorted[q1Index]
  const q3 = sorted[q3Index]
  const iqr = q3 - q1
  const lowerBound = q1 - 1.5 * iqr
  const upperBound = q3 + 1.5 * iqr
  
  const outliers = dados.map(valor => valor < lowerBound || valor > upperBound)
  return { outliers, q1, q3, iqr }
}

// Função para converter data no formato "jan/25" para objeto Date
function parseDataMensal(dataMensal: string): Date {
  const meses = {
    'jan': 0, 'fev': 1, 'mar': 2, 'abr': 3, 'mai': 4, 'jun': 5,
    'jul': 6, 'ago': 7, 'set': 8, 'out': 9, 'nov': 10, 'dez': 11
  };
  
  const [mes, ano] = dataMensal.toLowerCase().split('/');
  
  // Para anos de 2 dígitos, assumir que são do século 21 (2000-2099)
  const anoCompleto = ano.length === 2 ? 2000 + parseInt(ano) : parseInt(ano);
  const mesNumero = meses[mes as keyof typeof meses];
  
  if (mesNumero === undefined) {
    throw new Error(`Mês inválido: ${mes}`);
  }
  
  return new Date(anoCompleto, mesNumero, 1);
}

// Função para converter Date para formato "jan/25"
function formatarDataMensal(data: Date): string {
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const mes = meses[data.getMonth()];
  const ano = data.getFullYear().toString().slice(-2);
  return `${mes}/${ano}`;
}

// Função para detectar o tipo de impacto baseado na análise histórica dos dados mensais
function detectarTipoImpacto(descricao: string, dadosVendas: any[], dataInicio: Date, dataFim: Date): number {
  console.log(`🔍 Analisando impacto histórico mensal para: ${descricao}`);
  
  // Usar formatarDataNumerico para exibir datas no formato mm/aaaa
  const formatarDataNumerico = (data: Date): string => {
    const mes = (data.getMonth() + 1).toString().padStart(2, '0')
    const ano = data.getFullYear()
    return `${mes}/${ano}`
  }
  
  console.log(`📅 Período: ${formatarDataNumerico(dataInicio)} até ${formatarDataNumerico(dataFim)}`);
  
  // Converte as datas para o formato mensal usado nos dados
  const mesInicioAtipico = dataInicio.getMonth();
  const anoInicioAtipico = dataInicio.getFullYear();
  const mesFimAtipico = dataFim.getMonth();
  const anoFimAtipico = dataFim.getFullYear();
  
  // Filtra vendas durante o período atípico (por mês/ano)
  const vendasPeriodoAtipico = dadosVendas.filter(venda => {
    const dataVenda = venda.Data || venda.data || venda.date;
    if (!dataVenda) return false;
    
    try {
      const dataVendaObj = parseDataMensal(dataVenda);
      const mesVenda = dataVendaObj.getMonth();
      const anoVenda = dataVendaObj.getFullYear();
      
      // Verifica se está dentro do período atípico
      if (anoVenda < anoInicioAtipico || anoVenda > anoFimAtipico) return false;
      if (anoVenda === anoInicioAtipico && mesVenda < mesInicioAtipico) return false;
      if (anoVenda === anoFimAtipico && mesVenda > mesFimAtipico) return false;
      
      return true;
    } catch (error) {
      console.warn(`Erro ao processar data: ${dataVenda}`);
      return false;
    }
  });
  
  console.log(`📊 Registros encontrados no período atípico: ${vendasPeriodoAtipico.length}`);
  
  if (vendasPeriodoAtipico.length === 0) {
    console.log(`⚠️ Nenhuma venda encontrada no período. Retornando impacto neutro.`);
    return 0;
  }
  
  // Agrupa vendas por SKU e calcula média mensal por SKU no período atípico
  const vendasPorSkuAtipico = new Map<string, number[]>();
  vendasPeriodoAtipico.forEach(venda => {
    const sku = venda.SKU || venda.sku || 'UNKNOWN';
    const quantidade = venda.Vendas || venda.vendas || venda.quantity || 0;
    
    if (!vendasPorSkuAtipico.has(sku)) {
      vendasPorSkuAtipico.set(sku, []);
    }
    vendasPorSkuAtipico.get(sku)!.push(quantidade);
  });
  
  // Calcula média por SKU no período atípico
  const mediasSkuAtipico = new Map<string, number>();
  vendasPorSkuAtipico.forEach((vendas, sku) => {
    const media = vendas.reduce((sum, v) => sum + v, 0) / vendas.length;
    mediasSkuAtipico.set(sku, media);
  });
  
  console.log(`📈 SKUs analisados no período atípico: ${mediasSkuAtipico.size}`);
  
  // Calcula período de comparação (mesmo número de meses antes do período atípico)
  const mesesPeriodo = (anoFimAtipico - anoInicioAtipico) * 12 + (mesFimAtipico - mesInicioAtipico) + 1;
  const dataComparacaoFim = new Date(anoInicioAtipico, mesInicioAtipico - 1, 1);
  const dataComparacaoInicio = new Date(anoInicioAtipico, mesInicioAtipico - mesesPeriodo, 1);
  
  console.log(`📅 Período de comparação: ${formatarDataMensal(dataComparacaoInicio)} até ${formatarDataMensal(dataComparacaoFim)}`);
  
  // Filtra vendas durante o período de comparação
  const vendasPeriodoComparacao = dadosVendas.filter(venda => {
    const dataVenda = venda.Data || venda.data || venda.date;
    if (!dataVenda) return false;
    
    try {
      const dataVendaObj = parseDataMensal(dataVenda);
      const mesVenda = dataVendaObj.getMonth();
      const anoVenda = dataVendaObj.getFullYear();
      
      const anoComparacaoInicio = dataComparacaoInicio.getFullYear();
      const mesComparacaoInicio = dataComparacaoInicio.getMonth();
      const anoComparacaoFim = dataComparacaoFim.getFullYear();
      const mesComparacaoFim = dataComparacaoFim.getMonth();
      
      // Verifica se está dentro do período de comparação
      if (anoVenda < anoComparacaoInicio || anoVenda > anoComparacaoFim) return false;
      if (anoVenda === anoComparacaoInicio && mesVenda < mesComparacaoInicio) return false;
      if (anoVenda === anoComparacaoFim && mesVenda > mesComparacaoFim) return false;
      
      return true;
    } catch (error) {
      return false;
    }
  });
  
  console.log(`📊 Registros encontrados no período de comparação: ${vendasPeriodoComparacao.length}`);
  
  if (vendasPeriodoComparacao.length === 0) {
    console.log(`⚠️ Nenhuma venda encontrada no período de comparação. Retornando impacto neutro.`);
    return 0;
  }
  
  // Agrupa vendas por SKU no período de comparação
  const vendasPorSkuComparacao = new Map<string, number[]>();
  vendasPeriodoComparacao.forEach(venda => {
    const sku = venda.SKU || venda.sku || 'UNKNOWN';
    const quantidade = venda.Vendas || venda.vendas || venda.quantity || 0;
    
    if (!vendasPorSkuComparacao.has(sku)) {
      vendasPorSkuComparacao.set(sku, []);
    }
    vendasPorSkuComparacao.get(sku)!.push(quantidade);
  });
  
  // Calcula média por SKU no período de comparação
  const mediasSkuComparacao = new Map<string, number>();
  vendasPorSkuComparacao.forEach((vendas, sku) => {
    const media = vendas.reduce((sum, v) => sum + v, 0) / vendas.length;
    mediasSkuComparacao.set(sku, media);
  });
  
  console.log(`📈 SKUs analisados no período de comparação: ${mediasSkuComparacao.size}`);
  
  // Calcula impacto médio considerando apenas SKUs presentes em ambos os períodos
  const skusComuns = Array.from(mediasSkuAtipico.keys()).filter(sku => mediasSkuComparacao.has(sku));
  
  if (skusComuns.length === 0) {
    console.log(`⚠️ Nenhum SKU comum encontrado entre os períodos. Retornando impacto neutro.`);
    return 0;
  }
  
  console.log(`🔗 SKUs comuns analisados: ${skusComuns.length}`);
  
  // Calcula diferença percentual média entre os períodos
  let somaImpactos = 0;
  let contadorValidos = 0;
  
  skusComuns.forEach(sku => {
    const mediaAtipico = mediasSkuAtipico.get(sku)!;
    const mediaComparacao = mediasSkuComparacao.get(sku)!;
    
    if (mediaComparacao > 0) {
      const impactoSku = (mediaAtipico - mediaComparacao) / mediaComparacao;
      somaImpactos += impactoSku;
      contadorValidos++;
      
      console.log(`📊 SKU ${sku}: Atípico=${mediaAtipico.toFixed(2)}, Comparação=${mediaComparacao.toFixed(2)}, Impacto=${(impactoSku * 100).toFixed(2)}%`);
    }
  });
  
  if (contadorValidos === 0) {
    console.log(`⚠️ Nenhum SKU válido para cálculo. Retornando impacto neutro.`);
    return 0;
  }
  
  const impactoMedio = somaImpactos / contadorValidos;
  
  console.log(`📊 Impacto médio calculado: ${(impactoMedio * 100).toFixed(2)}%`);
  
  // Limita o impacto entre -0.5 e 0.5 para evitar ajustes extremos
  const impactoLimitado = Math.max(-0.5, Math.min(0.5, impactoMedio));
  
  console.log(`🎯 Impacto final aplicado: ${(impactoLimitado * 100).toFixed(2)}%`);
  
  return impactoLimitado;
}

// Função para calcular impacto histórico de datas atípicas (dados mensais)
function calcularImpactoHistoricoDataAtipica(dadosVendas: any[], dataFutura: Date, priorScale: number): number {
  console.log(`🔍 Calculando impacto histórico mensal para: ${formatarDataMensal(dataFutura)}`);
  
  // Se já temos um prior_scale calculado, usar diretamente
  if (priorScale !== 0) {
    console.log(`🎯 Usando impacto pré-calculado: ${(priorScale * 100).toFixed(2)}%`);
    return 1 + priorScale; // Converter de diferença percentual para fator multiplicativo
  }
  
  // Buscar dados históricos para o mesmo mês em anos anteriores
  const mesAtual = dataFutura.getMonth();
  const anoAtual = dataFutura.getFullYear();
  
  const vendasMesmoMes: number[] = [];
  const vendasMesesNormais: number[] = [];
  
  dadosVendas.forEach(venda => {
    const dataVenda = venda.Data || venda.data || venda.date;
    if (!dataVenda) return;
    
    try {
      const dataVendaObj = parseDataMensal(dataVenda);
      const mesVenda = dataVendaObj.getMonth();
      const anoVenda = dataVendaObj.getFullYear();
      
      // Verificar se é o mesmo mês (mas anos diferentes)
      if (mesVenda === mesAtual && anoVenda !== anoAtual) {
        const quantidade = venda.Vendas || venda.vendas || venda.quantity || 0;
        vendasMesmoMes.push(quantidade);
      } else if (Math.abs(mesVenda - mesAtual) === 1 || Math.abs(mesVenda - mesAtual) === 11) {
        // Meses adjacentes para comparação (anterior/posterior)
        const quantidade = venda.Vendas || venda.vendas || venda.quantity || 0;
        vendasMesesNormais.push(quantidade);
      }
    } catch (error) {
      console.warn(`Erro ao processar data: ${dataVenda}`);
    }
  });
  
  if (vendasMesmoMes.length === 0 || vendasMesesNormais.length === 0) {
    console.log(`⚠️ Dados insuficientes para calcular impacto histórico. Retornando neutro.`);
    return 1.0;
  }
  
  // Calcular médias
  const mediaMesmoMes = vendasMesmoMes.reduce((sum, v) => sum + v, 0) / vendasMesmoMes.length;
  const mediaMesesNormais = vendasMesesNormais.reduce((sum, v) => sum + v, 0) / vendasMesesNormais.length;
  
  // Calcular fator de impacto
  const fatorImpacto = mediaMesesNormais > 0 ? mediaMesmoMes / mediaMesesNormais : 1.0;
  
  // Limitar o impacto para evitar ajustes extremos
  const fatorLimitado = Math.max(0.3, Math.min(3.0, fatorImpacto));
  
  console.log(`📊 Impacto mensal calculado:`);
  console.log(`- Média mesmo mês (anos anteriores): ${mediaMesmoMes.toFixed(2)} (${vendasMesmoMes.length} amostras)`);
  console.log(`- Média meses normais: ${mediaMesesNormais.toFixed(2)} (${vendasMesesNormais.length} amostras)`);
  console.log(`- Fator de impacto: ${fatorImpacto.toFixed(3)} (limitado: ${fatorLimitado.toFixed(3)})`);
  
  return fatorLimitado;
}

// Função para calcular impacto histórico de datas atípicas (versão para SKU específico)
function calcularImpactoHistoricoDataAtipicaSku(dadosSku: SkuDataPoint[], holidays: Holiday[], dataFutura: Date): number {
  // Encontrar o holiday correspondente à data futura
  const holidayAtual = holidays.find(h => {
    const holidayDate = new Date(h.ds)
    return holidayDate.getFullYear() === dataFutura.getFullYear() && 
           holidayDate.getMonth() === dataFutura.getMonth() && 
           holidayDate.getDate() === dataFutura.getDate()
  })
  
  if (!holidayAtual) return 1.0 // Sem ajuste se não encontrar o holiday
  
  // Se já temos um prior_scale calculado, usar diretamente
  if (holidayAtual.prior_scale !== undefined && holidayAtual.prior_scale !== 0) {
    console.log(`🎯 Usando impacto pré-calculado para ${holidayAtual.holiday}: ${((holidayAtual.prior_scale) * 100).toFixed(2)}%`)
    return 1 + holidayAtual.prior_scale // Converter de diferença percentual para fator multiplicativo
  }
  
  // Buscar períodos históricos similares (mesmo tipo de evento)
  const periodosHistoricos = holidays.filter(h => h.holiday === holidayAtual.holiday)
  
  if (periodosHistoricos.length === 0) {
    console.log(`Nenhum período histórico encontrado para ${holidayAtual.holiday}, aplicando ajuste neutro`)
    return 1.0 // Sem dados históricos, mantém previsão original
  }
  
  // Calcular média das vendas durante períodos atípicos vs períodos normais
  const vendasDuranteEventos: number[] = []
  const vendasPeriodosNormais: number[] = []
  
  periodosHistoricos.forEach(holiday => {
    const dataEvento = new Date(holiday.ds)
    
    // Encontrar vendas no dia do evento
    const vendaEvento = dadosSku.find(d => {
      return d.ds.getFullYear() === dataEvento.getFullYear() &&
             d.ds.getMonth() === dataEvento.getMonth() &&
             d.ds.getDate() === dataEvento.getDate()
    })
    
    if (vendaEvento) {
      vendasDuranteEventos.push(vendaEvento.y)
      
      // Buscar vendas em dias normais próximos (±7 dias, excluindo outros eventos)
      for (let offset = -7; offset <= 7; offset++) {
        if (offset === 0) continue // Pular o dia do evento
        
        const dataComparacao = new Date(dataEvento)
        dataComparacao.setDate(dataComparacao.getDate() + offset)
        
        // Verificar se não é outro evento atípico
        const isOutroEvento = holidays.some(h => {
          const hDate = new Date(h.ds)
          return hDate.getFullYear() === dataComparacao.getFullYear() &&
                 hDate.getMonth() === dataComparacao.getMonth() &&
                 hDate.getDate() === dataComparacao.getDate()
        })
        
        if (!isOutroEvento) {
          const vendaNormal = dadosSku.find(d => {
            return d.ds.getFullYear() === dataComparacao.getFullYear() &&
                   d.ds.getMonth() === dataComparacao.getMonth() &&
                   d.ds.getDate() === dataComparacao.getDate()
          })
          
          if (vendaNormal) {
            vendasPeriodosNormais.push(vendaNormal.y)
          }
        }
      }
    }
  })
  
  if (vendasDuranteEventos.length === 0 || vendasPeriodosNormais.length === 0) {
    console.log(`Dados insuficientes para calcular impacto de ${holidayAtual.holiday}, aplicando ajuste neutro`)
    return 1.0
  }
  
  // Calcular médias
  const mediaEventos = vendasDuranteEventos.reduce((sum, v) => sum + v, 0) / vendasDuranteEventos.length
  const mediaNormal = vendasPeriodosNormais.reduce((sum, v) => sum + v, 0) / vendasPeriodosNormais.length
  
  // Calcular fator de impacto histórico
  const fatorHistorico = mediaEventos / mediaNormal
  
  // Aplicar limites para evitar ajustes extremos
  const fatorLimitado = Math.max(0.2, Math.min(5.0, fatorHistorico))
  
  console.log(`Impacto calculado para ${holidayAtual.holiday}:`)
  console.log(`- Média durante eventos: ${mediaEventos.toFixed(2)}`)
  console.log(`- Média períodos normais: ${mediaNormal.toFixed(2)}`)
  console.log(`- Fator histórico: ${fatorHistorico.toFixed(3)} (limitado: ${fatorLimitado.toFixed(3)})`)
  console.log(`- Amostras eventos: ${vendasDuranteEventos.length}, Amostras normais: ${vendasPeriodosNormais.length}`)
  
  return fatorLimitado
}

// Função para detectar padrões anuais e eventos recorrentes
function detectAnnualPatterns(dadosSku: any[]): { 
  sazonalidadeAnual: number[], 
  eventosRecorrentes: Array<{mes: number, dia: number, tipo: string, impacto: number}> 
} {
  const sazonalidadeAnual = new Array(12).fill(0)
  const contadoresMensais = new Array(12).fill(0)
  const vendasPorMes = new Map<string, number[]>()
  
  // Agrupar vendas por mês
  dadosSku.forEach((d) => {
    const mes = d.ds.getMonth()
    const chaveAnoMes = `${d.ds.getFullYear()}-${mes}`    
    sazonalidadeAnual[mes] += d.y
    contadoresMensais[mes]++
    
    if (!vendasPorMes.has(chaveAnoMes)) {
      vendasPorMes.set(chaveAnoMes, [])
    }
    vendasPorMes.get(chaveAnoMes)!.push(d.y)
  })
  
  // Calcular média mensal
  const mediaGeral = dadosSku.reduce((sum, d) => sum + d.y, 0) / dadosSku.length
  for (let i = 0; i < 12; i++) {
    if (contadoresMensais[i] > 0) {
      sazonalidadeAnual[i] = (sazonalidadeAnual[i] / contadoresMensais[i]) / mediaGeral
    } else {
      sazonalidadeAnual[i] = 1
    }
  }
  
  // Detectar eventos recorrentes (picos de vendas)
  const eventosRecorrentes: Array<{mes: number, dia: number, tipo: string, impacto: number}> = []
  const limiarPico = mediaGeral * 1.5
  
  dadosSku.forEach((d) => {
    if (d.y > limiarPico) {
      const mes = d.ds.getMonth()
      const dia = d.ds.getDate()
      
      // Verificar se é um padrão recorrente
      const eventosNoMesmoPeriodo = dadosSku.filter(item => {
        const diffMes = Math.abs(item.ds.getMonth() - mes)
        const diffDia = Math.abs(item.ds.getDate() - dia)
        return diffMes <= 1 && diffDia <= 7 && item.y > limiarPico
      })
      
      if (eventosNoMesmoPeriodo.length >= 2) {
        const impacto = d.y / mediaGeral
        eventosRecorrentes.push({
          mes,
          dia,
          tipo: impacto > 2 ? 'aumento_preco' : 'evento_sazonal',
          impacto
        })
      }
    }
  })
  
  return { sazonalidadeAnual, eventosRecorrentes }
}

// Função SARIMA simplificada para complementar Prophet
function calculateSARIMAForecast(dadosSku: any[], mesesPrevisao: number): number {
  const vendas = dadosSku.map((d) => d.y)
  const n = vendas.length
  
  if (n < 12) {
    // Para dados insuficientes, usar média simples
    const media = vendas.reduce((sum, v) => sum + v, 0) / n
    return media * mesesPrevisao
  }
  
  // Calcular diferenças sazonais (lag 12 para dados mensais)
  const diferencasSazonais = []
  for (let i = 12; i < n; i++) {
    diferencasSazonais.push(vendas[i] - vendas[i - 12])
  }
  
  // Calcular diferenças de primeira ordem nas diferenças sazonais
  const diferencasOrdem1 = []
  for (let i = 1; i < diferencasSazonais.length; i++) {
    diferencasOrdem1.push(diferencasSazonais[i] - diferencasSazonais[i - 1])
  }
  
  // Modelo AR(1) simples nas diferenças
  let phi = 0
  if (diferencasOrdem1.length > 1) {
    let numerador = 0
    let denominador = 0
    
    for (let i = 1; i < diferencasOrdem1.length; i++) {
      numerador += diferencasOrdem1[i] * diferencasOrdem1[i - 1]
      denominador += diferencasOrdem1[i - 1] * diferencasOrdem1[i - 1]
    }
    
    phi = denominador > 0 ? numerador / denominador : 0
    phi = Math.max(-0.8, Math.min(0.8, phi)) // Limitar para estabilidade
  }
  
  // Gerar previsões
  let previsaoTotal = 0
  const ultimaVenda = vendas[n - 1]
  const ultimaVendaSazonal = n >= 12 ? vendas[n - 12] : ultimaVenda
  const ultimaDiferenca = diferencasSazonais.length > 0 ? diferencasSazonais[diferencasSazonais.length - 1] : 0
  
  for (let h = 1; h <= mesesPrevisao; h++) {
    // Previsão baseada no componente sazonal + tendência AR
    const componenteSazonal = ultimaVendaSazonal
    const componenteTendencia = ultimaDiferenca * Math.pow(phi, h)
    const previsaoMes = Math.max(0, componenteSazonal + componenteTendencia)
    
    previsaoTotal += previsaoMes
  }
  
  return previsaoTotal
}

// Função híbrida Prophet + SARIMA
function calculateHybridForecast(dadosSku: any[], mesesPrevisao: number, mediaRecente: number, holidays: any[] = []): number {
  // Calcular previsão Prophet
  const previsaoProphet = calculateProphetForecast(dadosSku, mesesPrevisao, mediaRecente, holidays)
  
  // Calcular previsão SARIMA
  const previsaoSARIMA = calculateSARIMAForecast(dadosSku, mesesPrevisao)
  
  // Determinar pesos baseados na qualidade e quantidade dos dados
  const n = dadosSku.length
  let pesoProphet = 0.7 // Peso padrão para Prophet (melhor para tendências e sazonalidade)
  let pesoSARIMA = 0.3   // Peso padrão para SARIMA (melhor para autocorrelação)
  
  // Ajustar pesos baseado na quantidade de dados
  if (n >= 24) {
    // Com 2+ anos de dados, dar mais peso ao SARIMA
    pesoProphet = 0.6
    pesoSARIMA = 0.4
  } else if (n < 12) {
    // Com menos de 1 ano, dar mais peso ao Prophet
    pesoProphet = 0.8
    pesoSARIMA = 0.2
  }
  
  // Calcular variabilidade dos dados para ajustar pesos
  const vendas = dadosSku.map((d) => d.y)
  const media = vendas.reduce((sum, v) => sum + v, 0) / vendas.length
  const variancia = vendas.reduce((sum, v) => sum + Math.pow(v - media, 2), 0) / vendas.length
  const coefVariacao = media > 0 ? Math.sqrt(variancia) / media : 0
  
  // Para dados muito voláteis, dar mais peso ao Prophet (melhor para outliers)
  if (coefVariacao > 1.0) {
    pesoProphet = Math.min(0.85, pesoProphet + 0.15)
    pesoSARIMA = 1 - pesoProphet
  }
  
  // Combinar previsões
  const previsaoHibrida = (previsaoProphet * pesoProphet) + (previsaoSARIMA * pesoSARIMA)
  
  console.log(`Previsão Híbrida - Prophet: ${previsaoProphet.toFixed(2)} (peso: ${(pesoProphet*100).toFixed(1)}%), SARIMA: ${previsaoSARIMA.toFixed(2)} (peso: ${(pesoSARIMA*100).toFixed(1)}%), Final: ${previsaoHibrida.toFixed(2)}`)
  
  return previsaoHibrida
}

// Função Prophet aprimorada
function calculateProphetForecast(dadosSku: any[], mesesPrevisao: number, mediaRecente: number, holidays: any[] = []): number {
  dadosSku.sort((a, b) => a.ds.getTime() - b.ds.getTime())

  const vendas = dadosSku.map((d) => d.y)
  const mediaGeral = vendas.reduce((sum, v) => sum + v, 0) / vendas.length
  
  // Detectar e tratar outliers
  const { outliers } = detectOutliers(vendas)
  const vendasLimpas = vendas.map((v, i) => outliers[i] ? mediaGeral : v)
  
  // Detectar padrões anuais e eventos recorrentes
  const { sazonalidadeAnual, eventosRecorrentes } = detectAnnualPatterns(dadosSku)

  // Calcular tendência linear com dados limpos
  const n = vendasLimpas.length
  let somaX = 0,
    somaY = 0,
    somaXY = 0,
    somaX2 = 0

  for (let i = 0; i < n; i++) {
    somaX += i
    somaY += vendasLimpas[i]
    somaXY += i * vendasLimpas[i]
    somaX2 += i * i
  }

  const denominador = n * somaX2 - somaX * somaX
  const tendencia = denominador !== 0 ? (n * somaXY - somaX * somaY) / denominador : 0
  const intercepto = (somaY - tendencia * somaX) / n

  // Sazonalidade mensal (12 meses)
  const sazonalidade = new Array(12).fill(0)
  const contadores = new Array(12).fill(0)

  dadosSku.forEach((d, index) => {
    if (!outliers[index]) { // Ignorar outliers no cálculo da sazonalidade
      const mes = d.ds.getMonth()
      sazonalidade[mes] += d.y
      contadores[mes]++
    }
  })

  for (let i = 0; i < 12; i++) {
    if (contadores[i] > 0) {
      sazonalidade[i] = sazonalidade[i] / contadores[i] - mediaGeral
    }
  }

  // Gerar previsão aprimorada para dados mensais
  let previsaoTotal = 0
  const dataBase = new Date(Math.max(...dadosSku.map((d) => d.ds.getTime())))
  
  // Calcular peso da tendência baseado na qualidade dos dados (agora em meses)
  const pesoTendencia = Math.min(1, n / 12) // Reduzir peso da tendência para dados com menos de 12 meses

  for (let i = 1; i <= mesesPrevisao; i++) {
    // Adicionar meses ao invés de dias
    const dataFutura = new Date(dataBase.getFullYear(), dataBase.getMonth() + i, 1)
    const mesFuturo = dataFutura.getMonth()
    const diaFuturo = dataFutura.getDate()

    // Verificar se a data é atípica (holidays)
    const isHoliday = holidays.some(h => {
      const holidayDate = new Date(h.ds)
      const isMatch = holidayDate.getFullYear() === dataFutura.getFullYear() && 
             holidayDate.getMonth() === dataFutura.getMonth() && 
             holidayDate.getDate() === dataFutura.getDate()
      if (isMatch) {
        console.log(`MATCH encontrado! Data futura: ${dataFutura.toISOString().split('T')[0]}, Holiday: ${holidayDate.toISOString().split('T')[0]} (${h.holiday})`)
      }
      return isMatch
    })
    
    if (holidays.length > 0) {
      console.log(`Verificando data ${dataFutura.toISOString().split('T')[0]} contra ${holidays.length} holidays. IsHoliday: ${isHoliday}`)
    }
    
    // Verificar eventos recorrentes detectados automaticamente
    const eventoRecorrente = eventosRecorrentes.find(evento => {
      const diffMes = Math.abs(evento.mes - mesFuturo)
      const diffDia = Math.abs(evento.dia - diaFuturo)
      return diffMes <= 1 && diffDia <= 7
    })

    // Componentes da previsão
    const valorTendencia = intercepto + (tendencia * pesoTendencia) * (n + i)
    const valorSazonalMensal = sazonalidade[mesFuturo]
    const valorSazonalAnual = (sazonalidadeAnual[mesFuturo] - 1) * mediaGeral
    
    // Previsão base para o mês
    let previsaoMes = Math.max(0, valorTendencia + valorSazonalMensal + valorSazonalAnual)
    
    // Aplicar ajustes para eventos especiais
    if (isHoliday) {
      // Calcular impacto histórico das datas atípicas
      const impactoHistorico = calcularImpactoHistoricoDataAtipicaSku(dadosSku, holidays, dataFutura)
      previsaoMes = previsaoMes * impactoHistorico
      console.log(`Data atípica encontrada: ${dataFutura.toISOString().split('T')[0]} - Ajuste de ${((impactoHistorico - 1) * 100).toFixed(1)}%`)
    } else if (eventoRecorrente) {
      if (eventoRecorrente.tipo === 'aumento_preco') {
        // Aumento significativo antes de aumentos de preço
        previsaoMes = previsaoMes * Math.min(eventoRecorrente.impacto * 0.8, 2.5)
        console.log(`Evento de aumento de preço detectado: ${dataFutura.toISOString().split('T')[0]} - Aumento de ${((eventoRecorrente.impacto * 0.8 - 1) * 100).toFixed(1)}%`)
      } else {
        // Evento sazonal
        previsaoMes = previsaoMes * Math.min(eventoRecorrente.impacto * 0.6, 1.8)
        console.log(`Evento sazonal detectado: ${dataFutura.toISOString().split('T')[0]} - Aumento de ${((eventoRecorrente.impacto * 0.6 - 1) * 100).toFixed(1)}%`)
      }
    }
    
    previsaoTotal += previsaoMes
  }

  // Validação e ajuste final para dados mensais
  const mediaUltimos12Meses = dadosSku.slice(-12).reduce((sum, d) => sum + d.y, 0) / Math.min(12, dadosSku.length)
  const mediaUltimos3Meses = dadosSku.slice(-3).reduce((sum, d) => sum + d.y, 0) / Math.min(3, dadosSku.length)
  
  // Detectar tendência recente
  const tendenciaRecente = mediaUltimos3Meses / mediaUltimos12Meses
  
  // Ajustar baseado na tendência recente e qualidade dos dados
  if (tendenciaRecente < 0.6) {
    // Tendência de queda recente - ser mais conservador
    previsaoTotal = previsaoTotal * 0.95
    console.log('Tendência de queda detectada - ajuste conservador aplicado')
  } else if (tendenciaRecente > 1.4 && n > 12) {
    // Tendência de alta recente com dados suficientes (mais de 12 meses)
    previsaoTotal = previsaoTotal * 1.05
    console.log('Tendência de alta detectada - ajuste otimista aplicado')
  }
  
  // Limite máximo baseado em múltiplos da média recente (para dados mensais)
  const limiteMaximo = mediaRecente > 0 ? mediaRecente * 2.0 : mediaGeral * mesesPrevisao * 1.5
  if (previsaoTotal > limiteMaximo) {
    console.log(`Previsão muito alta (${previsaoTotal.toFixed(2)}), limitando a ${limiteMaximo.toFixed(2)}`)
    previsaoTotal = limiteMaximo
  }
  
  // Limite mínimo mais realista para dados mensais
  const limiteMinimo = Math.max(mediaGeral * mesesPrevisao * 0.5, mediaUltimos12Meses * mesesPrevisao * 0.6)
  previsaoTotal = Math.max(previsaoTotal, limiteMinimo)
  
  console.log(`SKU: Previsão calculada: ${previsaoTotal.toFixed(2)}, Média geral: ${mediaGeral.toFixed(2)}, Média 12 meses: ${mediaUltimos12Meses.toFixed(2)}, Limite mínimo: ${limiteMinimo.toFixed(2)}`)

  return Math.round(previsaoTotal * 100) / 100 // Arredondar para 2 casas decimais
}

// Função para gerar Excel com nome personalizado e informações aprimoradas
function generateExcel(resultados: ResultadoPrevisao[], dataCalculo: string): ArrayBuffer {
  let csvContent = "SKU;Previsao Total;Media;Categoria;Ajuste Validacao (%)\n"

  resultados.forEach((resultado: ResultadoPrevisao) => {
    // Formatar Previsao Total com 1 casa decimal e vírgula
    const previsaoFormatada = resultado.previsao_total.toFixed(1).replace(".", ",")
    const categoria = resultado.categoria || 'medio_volume'
    const ajusteValidacao = resultado.ajuste_validacao ? (resultado.ajuste_validacao * 100).toFixed(1) : '100,0'
    
    csvContent += `${resultado.sku};${previsaoFormatada};${resultado.media};${categoria};${ajusteValidacao.replace(".", ",")}\n`
  })

  const encoder = new TextEncoder()
  return encoder.encode(csvContent).buffer as ArrayBuffer
}