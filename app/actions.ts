"use server"

import { createClient } from "@/lib/supabase/server"

interface ForecastResult {
  success: boolean
  processedSkus?: number
  error?: string
  downloadUrl?: string
  filename?: string
  details?: {
    totalRecords: number
    dateRange: string
    statistics?: {
      mediaDiariaVendas: number
      intervaloAnos: number
      skusUnicos: number
    }
  }
}

export async function calculateDemandForecast(
  prevState: ForecastResult | null,
  formData: FormData,
): Promise<ForecastResult> {
  try {
    const supabase = createClient()

    const dataInicio = formData.get("dataInicio") as string
    const dataFim = formData.get("dataFim") as string
    const diasPrevisao = Number.parseInt(formData.get("diasPrevisao") as string)
    const csvFile = formData.get("csvFile") as File

    // Parâmetros do script original
    const minRegistros = 30

    // Validar parâmetros
    if (!dataInicio || !dataFim || !diasPrevisao || !csvFile) {
      return { success: false, error: "Todos os campos são obrigatórios" }
    }

    if (new Date(dataInicio) >= new Date(dataFim)) {
      return { success: false, error: "Data início deve ser anterior à data fim" }
    }

    // Ler e processar o arquivo CSV
    const csvText = await csvFile.text()
    const vendasData = parseCSV(csvText)

    if (vendasData.length === 0) {
      return { success: false, error: "Nenhum dado válido encontrado no arquivo CSV" }
    }

    // Filtrar dados pelo período
    const dataInicioDate = new Date(dataInicio)
    const dataFimDate = new Date(dataFim)

    const dadosFiltrados = vendasData.filter((venda) => {
      const dataVenda = new Date(venda.data)
      return dataVenda >= dataInicioDate && dataVenda <= dataFimDate
    })

    if (dadosFiltrados.length === 0) {
      return { success: false, error: "Nenhum dado encontrado no período especificado" }
    }

    // Calcular o intervalo de tempo em anos
    const intervaloAnos =
      dataFimDate.getFullYear() -
      dataInicioDate.getFullYear() +
      (dataFimDate.getMonth() - dataInicioDate.getMonth()) / 12

    // Estatísticas básicas
    const mediaDiariaVendas = dadosFiltrados.reduce((sum, v) => sum + v.vendas, 0) / dadosFiltrados.length
    const skusUnicos = [...new Set(dadosFiltrados.map((v) => v.sku))].length

    console.log("Estatísticas dos dados filtrados:")
    console.log("Número total de registros:", dadosFiltrados.length)
    console.log("Média diária de vendas:", mediaDiariaVendas)
    console.log("Intervalo de dados em anos:", intervaloAnos)
    console.log("Número de SKUs únicos:", skusUnicos)

    // Agrupar dados por SKU
    const skuData = new Map()
    dadosFiltrados.forEach((venda) => {
      if (!skuData.has(venda.sku)) {
        skuData.set(venda.sku, [])
      }
      skuData.get(venda.sku).push({
        ds: new Date(venda.data),
        y: venda.vendas,
      })
    })

    const resultados = []

    // Loop para cada SKU
    for (const [sku, dadosSku] of skuData) {
      if (dadosSku.length < minRegistros) {
        console.log(
          `Ignorando SKU ${sku} com poucos dados (${dadosSku.length} registros, mínimo ${minRegistros} requerido).`,
        )
        continue
      }

      // Calcular a média dos últimos 90 dias
      const ultimoDia = Math.max(...dadosSku.map((d) => d.ds.getTime()))
      const dataInicioUltimos90 = new Date(ultimoDia - 90 * 24 * 60 * 60 * 1000)
      const dadosRecentes = dadosSku.filter((d) => d.ds >= dataInicioUltimos90)
      const mediaRecente =
        dadosRecentes.length > 0
          ? (dadosRecentes.reduce((sum, d) => sum + d.y, 0) / dadosRecentes.length) * diasPrevisao
          : 0

      // Calcular previsão
      const previsaoTotal = calculateProphetForecast(dadosSku, diasPrevisao, mediaRecente)

      // Arredondar para múltiplos de 100
      const media = Math.ceil(previsaoTotal / 100) * 100

      resultados.push({
        sku: sku,
        previsao_total: Math.round(previsaoTotal * 100) / 100,
        media: media,
      })
    }

    if (resultados.length === 0) {
      return { success: false, error: "Nenhum SKU com dados suficientes para previsão" }
    }

    // Salvar no Supabase
    const dataCalculo = new Date()
    const previsoes = resultados.map((r) => ({
      sku: r.sku,
      media_prevista: r.media,
      data_calculo: dataCalculo.toISOString(),
    }))

    const { error: insertError } = await supabase.from("previsoes_demanda").insert(previsoes)

    if (insertError) {
      console.error("Erro ao salvar no Supabase:", insertError)
      // Continuar mesmo com erro no Supabase
    }

    // Gerar planilha Excel com nome personalizado
    const dataFormatada = dataCalculo.toLocaleDateString("pt-BR")
    const filename = `previsao_calculada_${dataFormatada.replace(/\//g, "-")}.csv`
    const excelBuffer = generateExcel(resultados, dataFormatada)
    const downloadUrl = await saveExcelFile(excelBuffer, filename)

    return {
      success: true,
      processedSkus: resultados.length,
      downloadUrl,
      filename,
      details: {
        totalRecords: dadosFiltrados.length,
        dateRange: `${dataInicio} a ${dataFim}`,
        statistics: {
          mediaDiariaVendas: Math.round(mediaDiariaVendas * 100) / 100,
          intervaloAnos: Math.round(intervaloAnos * 100) / 100,
          skusUnicos,
        },
      },
    }
  } catch (error) {
    console.error("Erro no cálculo de previsão:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro interno do servidor",
    }
  }
}

// Função para fazer parse do CSV
function parseCSV(csvText: string) {
  const lines = csvText.trim().split("\n")
  const vendasArray = []

  // Pular cabeçalho se existir
  const startIndex = lines[0].toLowerCase().includes("data") ? 1 : 0

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const [dataStr, sku, vendasStr] = line.split(";")

    if (dataStr && sku && vendasStr) {
      try {
        // Converter data do formato dd/mm/yyyy para Date
        const [dia, mes, ano] = dataStr.split("/")
        const dataVenda = new Date(Number.parseInt(ano), Number.parseInt(mes) - 1, Number.parseInt(dia))
        const vendas = Number.parseInt(vendasStr)

        if (!isNaN(dataVenda.getTime()) && !isNaN(vendas)) {
          vendasArray.push({
            data: dataVenda,
            sku: sku.trim(),
            vendas: vendas,
          })
        }
      } catch (error) {
        console.warn(`Erro ao processar linha ${i + 1}: ${line}`)
      }
    }
  }

  return vendasArray
}

// Função Prophet simplificada
function calculateProphetForecast(dadosSku: any[], diasPrevisao: number, mediaRecente: number): number {
  dadosSku.sort((a, b) => a.ds.getTime() - b.ds.getTime())

  const vendas = dadosSku.map((d) => d.y)
  const mediaGeral = vendas.reduce((sum, v) => sum + v, 0) / vendas.length

  // Calcular tendência linear
  const n = vendas.length
  let somaX = 0,
    somaY = 0,
    somaXY = 0,
    somaX2 = 0

  for (let i = 0; i < n; i++) {
    somaX += i
    somaY += vendas[i]
    somaXY += i * vendas[i]
    somaX2 += i * i
  }

  const denominador = n * somaX2 - somaX * somaX
  const tendencia = denominador !== 0 ? (n * somaXY - somaX * somaY) / denominador : 0
  const intercepto = (somaY - tendencia * somaX) / n

  // Sazonalidade semanal
  const sazonalidade = new Array(7).fill(0)
  const contadores = new Array(7).fill(0)

  dadosSku.forEach((d) => {
    const diaSemana = d.ds.getDay()
    sazonalidade[diaSemana] += d.y
    contadores[diaSemana]++
  })

  for (let i = 0; i < 7; i++) {
    if (contadores[i] > 0) {
      sazonalidade[i] = sazonalidade[i] / contadores[i] - mediaGeral
    }
  }

  // Gerar previsão
  let previsaoTotal = 0
  const dataBase = new Date(Math.max(...dadosSku.map((d) => d.ds.getTime())))

  for (let i = 1; i <= diasPrevisao; i++) {
    const dataFutura = new Date(dataBase.getTime() + i * 24 * 60 * 60 * 1000)
    const diaSemana = dataFutura.getDay()

    const valorTendencia = intercepto + tendencia * (n + i)
    const valorSazonal = sazonalidade[diaSemana]
    const previsaoDia = Math.max(0, valorTendencia + valorSazonal)
    previsaoTotal += previsaoDia
  }

  // Ajustar se muito elevada
  if (mediaRecente > 0 && previsaoTotal > mediaRecente * 1.5) {
    previsaoTotal = mediaRecente * 1.2
  }

  return Math.max(previsaoTotal, 0)
}

// Função para gerar Excel com nome personalizado
function generateExcel(resultados: any[], dataCalculo: string): ArrayBuffer {
  let csvContent = "SKU;Previsao Total;Media\n"

  resultados.forEach((resultado) => {
    // Formatar Previsao Total com 1 casa decimal e vírgula
    const previsaoFormatada = resultado.previsao_total.toFixed(1).replace(".", ",")
    csvContent += `${resultado.sku};${previsaoFormatada};${resultado.media}\n`
  })

  const encoder = new TextEncoder()
  return encoder.encode(csvContent).buffer
}

// Função para salvar arquivo Excel
async function saveExcelFile(buffer: ArrayBuffer, filename: string): Promise<string> {
  const blob = new Blob([buffer], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  return url
}
