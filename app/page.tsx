"use client"
import { useState, useEffect, useActionState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { X, FileText, BarChart3, Upload, CheckCircle, Calendar, Plus, Edit2, Trash2, Calculator, ArrowRight, AlertTriangle, AlertCircle, Download, HelpCircle, Home, BarChart, Loader2 } from "lucide-react"
import { calculateDemandForecast } from "./actions"
import { clearPrevisoesDemanda } from "./clearTableAction"
import { createClient } from "@/lib/supabase/client"
import * as XLSX from 'xlsx'
import SharedLayout from '@/components/shared-layout'

export default function DemandForecastPage() {
  // Mova todos os estados para dentro do componente
  const [state, action, isPending] = useActionState(calculateDemandForecast, null)
  const router = useRouter()
  
  // Log para debug
  console.log('🔄 Estado atual:', { state, isPending })
  const [datasAtipicas, setDatasAtipicas] = useState<Array<{
    dataInicial: string;
    dataFinal: string;
    descricao?: string;
  }>>([]) // Inicialize com array vazio

  const [novaDataAtipica, setNovaDataAtipica] = useState({
    data: '',
    descricao: ''
  })
  
  const [dataAtipicaError, setDataAtipicaError] = useState('')

  // Removido estado today para evitar hidratação mismatch

  // Função para converter data ISO para formato mm/aaaa
  const formatDateToBR = (isoDate: string) => {
    if (!isoDate) return ''
    const date = new Date(isoDate)
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const year = date.getFullYear()
    return `${month}/${year}`
  }

  // Função para converter data mm/aaaa para formato ISO (primeiro dia do mês)
  const formatDateToISO = (brDate: string) => {
    if (!brDate) return ''
    const [month, year] = brDate.split('/')
    if (!month || !year) return ''
    return `${year}-${month.padStart(2, '0')}-01`
  }

  // Valores padrão - inicializados sem valores para evitar hidratação (formato mm/aaaa)
  const defaultValues = 
  {
    dataInicio: "",
    dataFim: "",
    diasPrevisao: "1"
  }

  // Estados para controlar os valores dos campos
  const [fieldValues, setFieldValues] = useState(defaultValues)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedMediaFile, setSelectedMediaFile] = useState<File | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [importMessage, setImportMessage] = useState('')
  const [showImportConfirmModal, setShowImportConfirmModal] = useState(false)
  const [showImportSuccessPopup, setShowImportSuccessPopup] = useState(false)
  const [importSuccessData, setImportSuccessData] = useState<{recordCount: number} | null>(null)
  const [showMediaFormatHelp, setShowMediaFormatHelp] = useState(false)

  const [showAttachments, setShowAttachments] = useState(false)
  const [showAnalysisPeriod, setShowAnalysisPeriod] = useState(false)
  const [showAtypicalDates, setShowAtypicalDates] = useState(false)

  const [csvData, setCsvData] = useState<Array<{data: Date, sku: string, familia: string, vendas: number}>>([]) // Dados do CSV processados

  const [showResultPopup, setShowResultPopup] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState('')
  const [isClearingTable, setIsClearingTable] = useState(false)
  const [clearTableMessage, setClearTableMessage] = useState('')

  // Controlar popup de resultados
  useEffect(() => {
    if (state) {
      setShowResultPopup(true)
    }
  }, [state])

  // Função para formatar data de forma consistente
  const formatDate = (dateString: string) => {
    // Se já está no formato mm/aaaa, retorna como está
    if (dateString.includes('/')) {
      return dateString
    }
    // Caso contrário, converte de ISO para mm/aaaa
    return formatDateToBR(dateString)
  }

  // Função para excluir todos os dados da tabela
  const handleClearTable = async () => {
    if (!confirm('Tem certeza que deseja excluir TODOS os dados da tabela previsoes_demanda? Esta ação não pode ser desfeita!')) {
      return
    }

    setIsClearingTable(true)
    setClearTableMessage('')

    try {
      const result = await clearPrevisoesDemanda()
      
      if (result.success) {
        setClearTableMessage(result.message || 'Dados excluídos com sucesso!')
        setTimeout(() => setClearTableMessage(''), 3000)
      } else {
        setClearTableMessage(`Erro: ${result.error}`)
        setTimeout(() => setClearTableMessage(''), 5000)
      }
    } catch (error) {
      setClearTableMessage(`Erro inesperado: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
      setTimeout(() => setClearTableMessage(''), 5000)
    } finally {
      setIsClearingTable(false)
    }
  }

  // Função para exportar planilha de resultados dos cálculos Prophet+ARIMA
  const handleExportResults = async () => {
    try {
      // Verificar se existem resultados no state atual
      if (!state || !state.resultados || !Array.isArray(state.resultados) || state.resultados.length === 0) {
        alert('Nenhum resultado de cálculo encontrado. Execute o cálculo primeiro.')
        return
      }

      const resultados = state.resultados

      // Preparar dados para o Excel
      const excelData = resultados.map((item: any) => ({
        'SKU': item.sku || '',
        'Previsão': item.media || 0,
        'Média': item.media || 0,
        'Categoria': item.categoria || '',
        'Ajuste Validação (%)': 100
      }))

      // Criar planilha Excel usando SheetJS
      const worksheet = XLSX.utils.json_to_sheet(excelData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Resultados Prophet+ARIMA')

      // Gerar arquivo Excel
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

      // Baixar arquivo
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `resultados_prophet_arima_${new Date().toISOString().split('T')[0]}.xlsx`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      console.log('✅ Planilha exportada com sucesso!')
    } catch (error) {
      console.error('Erro ao exportar planilha:', error)
      alert('Erro ao exportar planilha. Tente novamente.')
    }
  }

  // Adicione estas funções para gerenciar as datas atípicas
  const adicionarDataAtipica = () => {
    // Limpar erro anterior
    setDataAtipicaError('');
    
    // 1. Verificar se existe anexo no campo "Anexar histórico de vendas"
    if (!selectedFile) {
      setDataAtipicaError('É necessário anexar o histórico de vendas antes de adicionar datas atípicas!');
      return;
    }
    
    if (!novaDataAtipica.data) {
      setDataAtipicaError('Formato e/ou valor de data incorreto!');
      return;
    }

    // 2. Validar formato mm/aaaa
    const formatoRegex = /^(0[1-9]|1[0-2])\/\d{4}$/;
    if (!formatoRegex.test(novaDataAtipica.data)) {
      setDataAtipicaError('Formato e/ou valor de data incorreto!');
      return;
    }

    // Extrair mês e ano
    const [mes, ano] = novaDataAtipica.data.split('/');
    const mesNum = parseInt(mes, 10);
    const anoNum = parseInt(ano, 10);

    // Validar valores
    if (mesNum < 1 || mesNum > 12) {
      setDataAtipicaError('Formato e/ou valor de data incorreto!');
      return;
    }

    if (anoNum < 1900 || anoNum > 2100) {
      setDataAtipicaError('Formato e/ou valor de data incorreto!');
      return;
    }

    // Verificar se a data já existe na lista
    const dataJaExiste = datasAtipicas.some(item => item.dataInicial === novaDataAtipica.data);
    if (dataJaExiste) {
      setDataAtipicaError('Formato e/ou valor de data incorreto!');
      return;
    }

    // 3. Verificar se a data existe no arquivo de vendas anexado
    if (csvData.length > 0) {
      const [mes, ano] = novaDataAtipica.data.split('/');
      const mesNum = parseInt(mes, 10);
      const anoNum = parseInt(ano, 10);
      
      const dataExisteNaPlanilha = csvData.some(registro => {
        const dataRegistro = registro.data;
        return dataRegistro.getMonth() + 1 === mesNum && dataRegistro.getFullYear() === anoNum;
      });
      
      if (!dataExisteNaPlanilha) {
        setDataAtipicaError('Data inexistente na planilha de vendas!');
        return;
      }
    } else {
      // Se não há dados CSV processados, mas há arquivo selecionado, significa que houve erro no processamento
      setDataAtipicaError('Erro ao processar o arquivo de vendas. Verifique o formato do arquivo.');
      return;
    }

    // Converter data para validação adicional
    const dataISO = formatDateToISO(novaDataAtipica.data);
    
    if (!dataISO) {
      setDataAtipicaError('Formato e/ou valor de data incorreto!');
      return;
    }

    setDatasAtipicas([...datasAtipicas, {
      dataInicial: novaDataAtipica.data,
      dataFinal: novaDataAtipica.data,
      descricao: novaDataAtipica.descricao
    }]);
    setNovaDataAtipica({ data: '', descricao: '' });
  };

  const removerDataAtipica = (index: number) => {
    const novasDatas = datasAtipicas.filter((_, i) => i !== index);
    setDatasAtipicas(novasDatas);
  };

  const handleFieldChange = (field: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [field]: value }))
  }

  const resetField = (field: string) => {
    const defaultValue = defaultValues[field as keyof typeof defaultValues]
    setFieldValues((prev) => ({ ...prev, [field]: defaultValue }))
  }

  // Função para resetar todos os campos e anexos
  const resetAllFields = () => {
    // Resetar valores dos campos
    setFieldValues(defaultValues)
    
    // Resetar arquivos anexados
    setSelectedFile(null)
    setSelectedMediaFile(null)
    
    // Resetar dados CSV processados
    setCsvData([])
    
    // Resetar datas atípicas
    setDatasAtipicas([])
    setNovaDataAtipica({ data: '', descricao: '' })
    setDataAtipicaError('')
    
    // NÃO resetar estados de exibição para manter seções abertas
    // setShowAttachments(false)
    // setShowAnalysisPeriod(false)
    // setShowAtypicalDates(false)
    
    // Resetar mensagens de importação
    setImportMessage('')
    setImportSuccessData(null)
    
    // Limpar inputs de arquivo
    const fileInputs = document.querySelectorAll('input[type="file"]') as NodeListOf<HTMLInputElement>
    fileInputs.forEach(input => {
      input.value = ''
    })
  }

  const isFieldEdited = (field: string) => {
    const currentValue = fieldValues[field as keyof typeof fieldValues]
    // Para campos de data, verificar se é diferente de hoje
    if (field === 'dataInicio' || field === 'dataFim') {
      return currentValue !== defaultValues[field as keyof typeof defaultValues]
    }
    // Para outros campos, verificar se é diferente do valor padrão
    return currentValue !== defaultValues[field as keyof typeof defaultValues]
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type === "text/csv") {
      setSelectedFile(file)
      // Processar o arquivo CSV para extrair as datas
      await processarCSV(file)
    } else {
      alert("Por favor, selecione um arquivo CSV válido.")
      event.target.value = ""
    }
  }

  // Função para processar o CSV e extrair as datas
  const processarCSV = async (file: File) => {
    try {
      const csvText = await file.text()
      const lines = csvText.trim().split("\n")
      const dados: Array<{data: Date, sku: string, familia: string, vendas: number}> = []
      
      // Mapeamento de meses em português para números
      const mesesPt: {[key: string]: number} = {
        'jan': 1, 'fev': 2, 'mar': 3, 'abr': 4, 'mai': 5, 'jun': 6,
        'jul': 7, 'ago': 8, 'set': 9, 'out': 10, 'nov': 11, 'dez': 12
      }
      
      // Pular cabeçalho (primeira linha)
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue
        
        const parts = line.split(';').map(part => part.trim())
        if (parts.length >= 4) {
          const [dataStr, sku, familia, vendasStr] = parts
          
          // Converter data do formato brasileiro (ex: "fev/25") para objeto Date
          let dataVenda: Date | null = null
          
          // Primeiro, tentar formato brasileiro "mmm/aa" ou "mmm/aaaa"
          const matchBr = dataStr.match(/^([a-z]{3})\/(\d{2,4})$/i)
          if (matchBr) {
            const [, mesStr, anoStr] = matchBr
            const mesNum = mesesPt[mesStr.toLowerCase()]
            let anoNum = parseInt(anoStr, 10)
            
            // Se ano tem 2 dígitos, assumir 20xx
            if (anoNum < 100) {
              anoNum += 2000
            }
            
            if (mesNum && anoNum) {
              dataVenda = new Date(anoNum, mesNum - 1, 1) // mês é 0-indexado no Date
            }
          } else {
            // Tentar conversão direta para outros formatos
            dataVenda = new Date(dataStr)
          }
          
          const vendas = Number.parseInt(vendasStr)
          
          if (dataVenda && !isNaN(dataVenda.getTime()) && !isNaN(vendas)) {
            dados.push({
              data: dataVenda,
              sku: sku,
              familia: familia,
              vendas: vendas
            })
          }
        }
      }
      
      setCsvData(dados)
      console.log('📊 Dados do CSV processados:', dados.length, 'registros')
      console.log('📅 Primeiras 5 datas processadas:', dados.slice(0, 5).map(d => `${d.data.getMonth() + 1}/${d.data.getFullYear()}`))
    } catch (error) {
      console.error('Erro ao processar CSV:', error)
      setCsvData([])
    }
  }



  const removeFile = () => {
    setSelectedFile(null)
    setCsvData([]) // Limpar dados do CSV também
    // Reset file input value
    const fileInput = document.getElementById("csvFile") as HTMLInputElement
    if (fileInput) fileInput.value = ""
  }

  const handleMediaFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type === "text/csv") {
      setSelectedMediaFile(file)
    } else {
      alert("Por favor, selecione um arquivo CSV válido.")
      event.target.value = ""
    }
  }

  const removeMediaFile = () => {
    setSelectedMediaFile(null)
    // Reset file input value
    const fileInput = document.getElementById("mediaFile") as HTMLInputElement
    if (fileInput) fileInput.value = ""
  }

  // Função para fazer parsing do CSV de médias
  const parseMediasCSV = (csvText: string) => {
    console.log('📄 Iniciando parsing do CSV de médias...')
    const lines = csvText.split('\n')
    const data = []
    const errors = []

    // Pular primeira linha (cabeçalho)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue // Pular linhas vazias

      const columns = line.split(';')
      
      if (columns.length < 4) {
        errors.push(`Linha ${i + 1}: Número insuficiente de colunas (${columns.length}/4)`)
        continue
      }

      const [sku, fml_item, media_prevista_str, dt_implant_str] = columns

      // Validar se todos os campos estão presentes
      if (!sku || !fml_item || !media_prevista_str || !dt_implant_str) {
        errors.push(`Linha ${i + 1}: Campos obrigatórios faltando`)
        continue
      }

      // Converter data de dd/mm/yyyy para YYYY-MM-DD
      let dt_implant
      try {
        const dateParts = dt_implant_str.trim().split('/')
        if (dateParts.length !== 3) {
          throw new Error('Formato de data inválido')
        }
        const [day, month, year] = dateParts
        dt_implant = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      } catch (error) {
        errors.push(`Linha ${i + 1}: Data inválida (${dt_implant_str}) - use formato dd/mm/yyyy`)
        continue
      }

      // Converter media_prevista para float (trocar vírgula por ponto)
      let media_prevista
      try {
        const mediaStr = media_prevista_str.trim().replace(',', '.')
        media_prevista = parseFloat(mediaStr)
        if (isNaN(media_prevista)) {
          throw new Error('Número inválido')
        }
      } catch (error) {
        errors.push(`Linha ${i + 1}: Média prevista inválida (${media_prevista_str})`)
        continue
      }

      data.push({
        sku: sku.trim(),
        fml_item: fml_item.trim(),
        media_prevista,
        dt_implant
      })
    }

    console.log(`✅ Parsing concluído: ${data.length} registros válidos, ${errors.length} erros`)
    if (errors.length > 0) {
      console.warn('⚠️ Erros encontrados:', errors)
    }

    return { data, errors }
  }

  // Função para confirmar importação
  const confirmImportData = async () => {
    if (!selectedMediaFile) {
      alert('Nenhum arquivo selecionado!')
      return
    }

    setIsImporting(true)
    setImportMessage('')
    setShowImportConfirmModal(false)

    try {
      console.log('🚀 Iniciando importação de dados...')
      
      // Ler conteúdo do arquivo
      const fileContent = await selectedMediaFile.text()
      console.log('📖 Arquivo lido com sucesso')

      // Fazer parsing do CSV
      const { data, errors } = parseMediasCSV(fileContent)
      
      if (errors.length > 0) {
        setImportMessage(`Erros encontrados no arquivo:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? '\n...' : ''}`)
        return
      }

      if (data.length === 0) {
        setImportMessage('Nenhum dado válido encontrado no arquivo!')
        return
      }

      console.log(`📊 ${data.length} registros para importar`)

      // Preparar dados com IDs sequenciais
      const dataWithIds = data.map((item, index) => ({
        id: index + 1,
        ...item
      }))

      // Conectar ao Supabase
      const supabase = createClient()
      console.log('🔗 Conectado ao Supabase')

      // IMPORTANTE: Limpar TODOS os dados existentes na tabela antes da inserção
      console.log('🗑️ Limpando dados existentes...')
      const { error: deleteError } = await supabase
        .from('previsoes_demanda')
        .delete()
        .neq('id', 0) // Deletar todos os registros

      if (deleteError) {
        console.error('❌ Erro ao limpar dados:', deleteError)
        throw new Error(`Erro ao limpar dados existentes: ${deleteError.message}`)
      }

      console.log('✅ Dados existentes removidos')

      // Inserir novos dados
      console.log('📥 Inserindo novos dados...')
      const { error: insertError } = await supabase
        .from('previsoes_demanda')
        .insert(dataWithIds)

      if (insertError) {
        console.error('❌ Erro ao inserir dados:', insertError)
        throw new Error(`Erro ao inserir dados: ${insertError.message}`)
      }

      console.log('✅ Dados importados com sucesso!')
      setImportSuccessData({ recordCount: data.length })
      setShowImportSuccessPopup(true)
      
      // Limpar estados e input após operação
      setTimeout(() => {
        setSelectedMediaFile(null)
        const fileInput = document.getElementById("mediaFile") as HTMLInputElement
        if (fileInput) fileInput.value = ""
      }, 1000)

    } catch (error) {
      console.error('❌ Erro na importação:', error)
      setImportMessage(`❌ Erro na importação: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
    } finally {
      setIsImporting(false)
    }
  }

  // Função para iniciar processo de importação
  const handleImportClick = () => {
    if (!selectedMediaFile) {
      alert('Por favor, selecione um arquivo CSV primeiro!')
      return
    }
    setShowImportConfirmModal(true)
  }

  return (
    <SharedLayout>
      {/* Compact Header */}
      <header className="bg-gradient-to-r from-[#176B87] via-[#145A6B] to-[#124C5F] shadow-xl flex-shrink-0">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white tracking-tight">Previsão de Demanda</h1>
                <p className="text-white/80 text-xs">Sistema Inteligente de Análise Preditiva</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-white/80">
              <div className="w-2 h-2 bg-green-300 rounded-full animate-pulse"></div>
              <span className="text-xs">Online</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Single Page Layout */}
      <main className="flex-1 container mx-auto px-4 py-4 overflow-hidden">
        <div className="h-full max-w-full mx-auto px-4">
          {/* Main Form Card - Full Height */}
          <Card className="h-full bg-white/95 backdrop-blur-sm shadow-xl border-0 rounded-2xl overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-[#176B87] to-[#145A6B] px-6 py-3 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white text-lg font-bold flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Configuração da Análise
                  </CardTitle>
                  <p className="text-white/90 text-sm mt-1">Preencha os dados necessários para iniciar o processamento</p>
                </div>

              </div>
            </div>
          <CardContent className="flex-1 p-6 overflow-hidden">
            {/* Mensagem de feedback para exclusão da tabela */}
            {clearTableMessage && (
              <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${
                clearTableMessage.includes('sucesso') 
                  ? 'bg-green-100 text-green-800 border border-green-200' 
                  : 'bg-red-100 text-red-800 border border-red-200'
              }`}>
                {clearTableMessage}
              </div>
            )}
            <form action={action} className="h-full flex flex-col">
              {/* Campos hidden para enviar valores controlados */}
              <input type="hidden" name="dataInicio" value={fieldValues.dataInicio} />
              <input type="hidden" name="dataFim" value={fieldValues.dataFim} />
              <input type="hidden" name="diasPrevisao" value={fieldValues.diasPrevisao} />
              <input type="hidden" name="datasAtipicas" value={JSON.stringify(datasAtipicas)} />
              
              {/* New Layout - Responsive Grid */}
              <div className="flex-1 flex flex-col overflow-y-auto">
                <div className="flex-1 space-y-6">
                
                {/* Top Row - 3 Columns with standardized height */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  
                  {/* Superior Esquerdo - Attachment Toggle */}
                  <div className="bg-gradient-to-br from-[#278190]/10 to-[#278190]/15 rounded-xl p-4 border border-[#278190]/20 h-[280px] flex flex-col">
                    {!showAttachments ? (
                      /* Ícone de Anexos */
                      <div className="flex-1 flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => setShowAttachments(true)}
                          className="group flex flex-col items-center justify-center p-8 rounded-2xl bg-[#278190]/10 hover:bg-[#278190]/20 border-2 border-dashed border-[#278190]/40 hover:border-[#278190]/60 transition-all duration-300 hover:scale-105 relative"
                        >
                          <div className="absolute top-2 right-2 w-8 h-8 bg-[#15765a] rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg z-10">
                            1
                          </div>
                          <div className="w-16 h-16 bg-[#278190] rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                            <FileText className="w-8 h-8 text-white" />
                          </div>
                          <span className="text-lg font-semibold text-[#278190] group-hover:text-[#1F6B73] transition-colors">
                            Anexar Arquivos
                          </span>
                          <span className="text-sm text-[#278190]/70 mt-1">
                            Clique para adicionar os arquivos CSV
                          </span>
                        </button>
                      </div>
                    ) : (
                      /* Campos de Upload */
                      <>
                        {/* Upload Section - Arquivo de Média */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-6 h-6 bg-[#278190] rounded-lg flex items-center justify-center">
                              <FileText className="w-4 h-4 text-white" />
                            </div>
                            <Label htmlFor="mediaFile" className="text-sm font-semibold text-black">
                              Arquivo de Média (CSV) <span className="text-red-500">*</span>
                            </Label>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="w-6 h-6 bg-[#278190]/20 hover:bg-[#278190]/30 rounded-full flex items-center justify-center cursor-help transition-colors">
                                    <HelpCircle className="w-4 h-4 text-[#278190]" />
                                  </div>
                                </TooltipTrigger>
                            <button
                              type="button"
                              onClick={() => setShowAttachments(false)}
                              className="ml-auto w-6 h-6 bg-red-500/20 hover:bg-red-500/30 rounded-full flex items-center justify-center transition-colors"
                              title="Fechar campos de anexos"
                            >
                              <X className="w-4 h-4 text-red-600" />
                            </button>
                                <TooltipContent side="bottom" className="bg-[#172133] border-[#172133] shadow-xl max-w-sm">
                                  <div className="p-2">
                                    <div className="flex items-center gap-2 mb-3">
                                      <div className="w-6 h-6 bg-white rounded-lg flex items-center justify-center">
                                        <FileText className="w-4 h-4 text-[#172133]" />
                                      </div>
                                      <h4 className="font-semibold text-white">Formato do Arquivo de Média</h4>
                                    </div>
                                    <div className="space-y-2 text-xs text-white">
                                      <div className="flex items-center gap-2">
                                        <div className="w-1 h-1 bg-white rounded-full"></div>
                                        <span><strong>Formato:</strong> CSV</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <div className="w-1 h-1 bg-white rounded-full"></div>
                                        <span><strong>Separador:</strong> ponto e vírgula (;)</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <div className="w-1 h-1 bg-white rounded-full"></div>
                                        <span><strong>Colunas obrigatórias:</strong> sku, fml_item, media_prevista, dt_implant</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <div className="w-1 h-1 bg-white rounded-full"></div>
                                        <span><strong>Formato da Data:</strong> dd/mm/aaaa</span>
                                      </div>

                                    </div>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Input
                          id="mediaFile"
                          name="mediaFile"
                          type="file"
                          accept=".csv"
                          className="flex-1 h-9 text-xs border-2 border-dashed border-[#278190]/40 bg-[#278190]/5 hover:border-[#278190]/60 transition-colors file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-[#278190]/10 file:text-[#278190]"
                          onChange={handleMediaFileChange}
                        />
                        {selectedMediaFile && (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={handleImportClick}
                              disabled={isImporting}
                              className="h-9 px-2 text-[#278190] hover:text-[#278190] hover:bg-[#278190]/10 border-[#278190]/30"
                              title="Importar dados para o Supabase"
                            >
                              {isImporting ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Upload className="h-3 w-3" />
                              )}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={removeMediaFile}
                              className="h-9 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                              title="Remover arquivo"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                      {selectedMediaFile && (
                        <div className="mt-1.5 p-1.5 bg-[#278190]/10 border border-[#278190]/20 rounded-lg">
                          <p className="text-xs text-[#1E8AA3] flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            {selectedMediaFile.name}
                          </p>
                        </div>
                      )}
                      

                      

                    </div>

                    {/* Upload Section - Histórico de Vendas */}
                    <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 bg-[#278190] rounded-lg flex items-center justify-center">
                        <FileText className="w-4 h-4 text-white" />
                      </div>
                      <Label htmlFor="csvFile" className="text-sm font-semibold text-black">
                        Arquivo de Vendas (CSV) <span className="text-red-500">*</span>
                      </Label>
                      <TooltipProvider>
                         <Tooltip>
                           <TooltipTrigger asChild>
                             <div className="w-6 h-6 bg-[#278190]/20 hover:bg-[#278190]/30 rounded-full flex items-center justify-center cursor-help transition-colors">
                                 <HelpCircle className="w-4 h-4 text-[#278190]" />
                             </div>
                           </TooltipTrigger>
                           <TooltipContent side="bottom" className="bg-[#172133] border-[#172133] shadow-xl max-w-sm">
                             <div className="p-2">
                               <div className="flex items-center gap-2 mb-3">
                                 <div className="w-6 h-6 bg-white rounded-lg flex items-center justify-center">
                                   <FileText className="w-4 h-4 text-[#172133]" />
                                 </div>
                                 <h4 className="font-semibold text-white">Formato do Arquivo de Vendas</h4>
                               </div>
                               <div className="space-y-2 text-xs text-white">
                                 <div className="flex items-center gap-2">
                                   <div className="w-1 h-1 bg-white rounded-full"></div>
                                   <span><strong>Formato:</strong> CSV</span>
                                 </div>
                                 <div className="flex items-center gap-2">
                                        <div className="w-1 h-1 bg-white rounded-full"></div>
                                        <span><strong>Separador:</strong> ponto e vírgula (;)</span>
                                      </div>
                                 <div className="flex items-center gap-2">
                                   <div className="w-1 h-1 bg-white rounded-full"></div>
                                   <span><strong>Colunas:</strong> Data (DD/MM/AAAA), SKU, Família, Vendas</span>
                                 </div>
                                 <div className="flex items-center gap-2">
                                   <div className="w-1 h-1 bg-white rounded-full"></div>
                                   <span><strong>Formato da Data: </strong>mm/aaaa</span>
                                 </div>
                               </div>
                             </div>
                           </TooltipContent>
                         </Tooltip>
                       </TooltipProvider>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Input
                        id="csvFile"
                        name="csvFile"
                        type="file"
                        accept=".csv"
                        required
                        className="flex-1 h-9 text-xs border-2 border-dashed border-[#278190]/40 bg-[#278190]/5 hover:border-[#278190]/60 transition-colors file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-[#278190]/10 file:text-[#278190]"
                        onChange={handleFileChange}
                      />
                      {selectedFile && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={removeFile}
                          className="h-9 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                          title="Remover arquivo"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    {selectedFile && (
                      <div className="mt-1.5 p-1.5 bg-[#278190]/10 border border-[#278190]/20 rounded-lg">
                        <p className="text-xs text-[#1E8AA3] flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          {selectedFile.name}
                        </p>
                      </div>
                    )}
                    </div>
                      </>
                    )}
                  </div>

                  {/* Superior Central - Período de Análise */}
                  <div className="space-y-4">
                    {/* Date Configuration */}
                    <div className="bg-gradient-to-br from-[#278190]/10 to-[#278190]/15 rounded-xl p-4 border border-[#278190]/20 h-[280px] flex flex-col">
                      {!showAnalysisPeriod ? (
                        /* Ícone de Período de Análise */
                        <div className="flex-1 flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => setShowAnalysisPeriod(true)}
                            className="group flex flex-col items-center justify-center p-8 rounded-2xl bg-[#278190]/10 hover:bg-[#278190]/20 border-2 border-dashed border-[#278190]/40 hover:border-[#278190]/60 transition-all duration-300 hover:scale-105 relative"
                          >
                            <div className="absolute top-2 right-2 w-8 h-8 bg-[#15765a] rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg z-10">
                              2
                            </div>
                            <div className="w-16 h-16 bg-[#278190] rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                              <Calendar className="w-8 h-8 text-white" />
                            </div>
                            <span className="text-lg font-semibold text-[#278190] group-hover:text-[#1F6B73] transition-colors">
                              Período de Análise
                            </span>
                            <span className="text-sm text-[#278190]/70 mt-1">
                              Clique para configurar as Datas de Análise
                            </span>
                          </button>
                        </div>
                      ) : (
                        /* Campos de Período de Análise */
                        <>
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-6 h-6 bg-[#278190] rounded-lg flex items-center justify-center">
                              <Calendar className="w-4 h-4 text-white" />
                            </div>
                            <h3 className="text-sm font-semibold text-black">Período de Análise</h3>
                            <button
                              type="button"
                              onClick={() => setShowAnalysisPeriod(false)}
                              className="ml-auto w-6 h-6 bg-red-500/20 hover:bg-red-500/30 rounded-full flex items-center justify-center transition-colors"
                              title="Fechar período de análise"
                            >
                              <X className="w-4 h-4 text-red-600" />
                            </button>
                          </div>
                      
                      <div className="flex-1 flex flex-col justify-center space-y-4">
                        <div>
                          <Label htmlFor="dataInicio" className="text-xs font-medium text-[#1E8AA3]">
                            Data Início <span className="text-red-500">*</span>
                          </Label>
                          <div className="relative">
                            <Input
                              id="dataInicio"
                              name="dataInicio"
                              type="text"
                              required
                              className={`h-8 text-xs bg-[#1E8AA3]/5 border transition-all duration-200 pr-6 ${
                                isFieldEdited("dataInicio") 
                                  ? 'border-[#278190] bg-[#278190]/10'
                              : 'border-[#278190]/30 hover:border-[#278190]/50'
                              }`}
                              placeholder="mm/aaaa"
                              value={fieldValues.dataInicio}
                              onChange={(e) => {
                                let value = e.target.value
                                
                                // Permitir deletar tudo completamente
                                if (value === '') {
                                  handleFieldChange("dataInicio", '')
                                  return
                                }
                                
                                // Remover caracteres não numéricos exceto a barra
                                value = value.replace(/[^\d\/]/g, '')
                                
                                // Se o usuário deletou a barra, permitir continuar editando
                                if (value.length <= 2 && !value.includes('/')) {
                                  handleFieldChange("dataInicio", value)
                                  return
                                }
                                
                                // Formatação automática: adiciona '/' após 2 dígitos se não existir
                                if (value.length >= 2 && !value.includes('/')) {
                                  value = value.slice(0,2) + '/' + value.slice(2,6)
                                }
                                
                                // Limitar o formato mm/aaaa
                                if (value.length > 7) {
                                  value = value.slice(0, 7)
                                }
                                
                                handleFieldChange("dataInicio", value)
                              }}
                              maxLength={7}
                            />
                            {isFieldEdited("dataInicio") && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0.5 top-1/2 -translate-y-1/2 h-5 w-5 p-0 hover:bg-gray-200"
                                onClick={() => resetField("dataInicio")}
                                title="Resetar"
                              >
                                <X className="h-2 w-2 text-gray-500" />
                              </Button>
                            )}
                          </div>
                        </div>
                        
                        <div>
                          <Label htmlFor="dataFim" className="text-xs font-medium text-[#1E8AA3]">
                            Data Fim <span className="text-red-500">*</span>
                          </Label>
                          <div className="relative">
                            <Input
                              id="dataFim"
                              name="dataFim"
                              type="text"
                              required
                              className={`h-8 text-xs bg-[#1E8AA3]/5 border transition-all duration-200 pr-6 ${
                                isFieldEdited("dataFim") 
                                  ? 'border-[#278190] bg-[#278190]/10'
                              : 'border-[#278190]/30 hover:border-[#278190]/50'
                              }`}
                              placeholder="mm/aaaa"
                              value={fieldValues.dataFim}
                              onChange={(e) => {
                                let value = e.target.value
                                
                                // Permitir deletar tudo completamente
                                if (value === '') {
                                  handleFieldChange("dataFim", '')
                                  return
                                }
                                
                                // Remover caracteres não numéricos exceto a barra
                                value = value.replace(/[^\d\/]/g, '')
                                
                                // Se o usuário deletou a barra, permitir continuar editando
                                if (value.length <= 2 && !value.includes('/')) {
                                  handleFieldChange("dataFim", value)
                                  return
                                }
                                
                                // Formatação automática: adiciona '/' após 2 dígitos se não existir
                                if (value.length >= 2 && !value.includes('/')) {
                                  value = value.slice(0,2) + '/' + value.slice(2,6)
                                }
                                
                                // Limitar o formato mm/aaaa
                                if (value.length > 7) {
                                  value = value.slice(0, 7)
                                }
                                
                                handleFieldChange("dataFim", value)
                              }}
                              maxLength={7}
                            />
                            {isFieldEdited("dataFim") && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0.5 top-1/2 -translate-y-1/2 h-5 w-5 p-0 hover:bg-gray-200"
                                onClick={() => resetField("dataFim")}
                                title="Resetar"
                              >
                                <X className="h-2 w-2 text-gray-500" />
                              </Button>
                            )}
                          </div>
                        </div>
                        
                        <div>
                          <Label htmlFor="diasPrevisao" className="text-xs font-medium text-[#1E8AA3]">
                            Meses Previsão <span className="text-red-500">*</span>
                          </Label>
                          <div className="relative">
                            <Input
                              id="diasPrevisao"
                              name="diasPrevisao"
                              type="number"
                              required
                              className={`h-8 text-xs bg-[#1E8AA3]/5 border transition-all duration-200 pr-6 ${
                                isFieldEdited("diasPrevisao") 
                                  ? 'border-[#278190] bg-[#278190]/10'
                              : 'border-[#278190]/30 hover:border-[#278190]/50'
                              }`}
                              value={fieldValues.diasPrevisao}
                              min="1"
                              max="24"
                              onChange={(e) => handleFieldChange("diasPrevisao", e.target.value)}
                            />
                            {isFieldEdited("diasPrevisao") && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0.5 top-1/2 -translate-y-1/2 h-5 w-5 p-0 hover:bg-gray-200"
                                onClick={() => resetField("diasPrevisao")}
                                title="Resetar"
                              >
                                <X className="h-2 w-2 text-gray-500" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Superior Direito - Datas Atípicas */}
                  <div className="space-y-4">
                  {/* Add New Atypical Date */}
                  <div className="bg-gradient-to-br from-[#278190]/10 to-[#278190]/15 rounded-xl p-4 border border-[#278190]/20 h-[280px] flex flex-col">
                    {!showAtypicalDates ? (
                      /* Ícone de Análise de Datas */
                      <div className="flex-1 flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => setShowAtypicalDates(true)}
                          className="group flex flex-col items-center justify-center p-8 rounded-2xl bg-[#278190]/10 hover:bg-[#278190]/20 border-2 border-dashed border-[#278190]/40 hover:border-[#278190]/60 transition-all duration-300 hover:scale-105 relative"
                        >
                          <div className="absolute top-2 right-2 w-8 h-8 bg-[#15765a] rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg z-10">
                            3
                          </div>
                          <div className="w-16 h-16 bg-[#278190] rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                            <AlertTriangle className="w-8 h-8 text-white" />
                          </div>
                          <span className="text-lg font-semibold text-[#278190] group-hover:text-[#1F6B73] transition-colors">
                            Datas Atípicas
                          </span>
                          <span className="text-sm text-[#278190]/70 mt-1">
                            Clique para configurar as Datas Atípicas
                          </span>
                        </button>
                      </div>
                    ) : (
                      /* Campos de Datas Atípicas */
                      <>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-6 h-6 bg-[#278190] rounded-lg flex items-center justify-center">
                            <AlertTriangle className="w-4 h-4 text-white" />
                          </div>
                          <h3 className="text-sm font-semibold text-black">Datas Atípicas</h3>
                          <button
                            type="button"
                            onClick={() => setShowAtypicalDates(false)}
                            className="ml-auto w-6 h-6 bg-red-500/20 hover:bg-red-500/30 rounded-full flex items-center justify-center transition-colors"
                            title="Fechar análise de datas"
                          >
                            <X className="w-4 h-4 text-red-600" />
                          </button>
                        </div>
                    
                    <div className="flex-1 flex flex-col justify-center space-y-3">
                      <div>
                        <Label className="text-xs font-medium text-[#1E8AA3]">Data</Label>
                        <div className="relative">
                          <Input
                            type="text"
                            placeholder="mm/aaaa"
                            value={novaDataAtipica.data}
                            onChange={(e) => {
                              let value = e.target.value.replace(/\D/g, '')
                              if (value.length >= 2) value = value.slice(0,2) + '/' + value.slice(2,6)
                              setNovaDataAtipica({ ...novaDataAtipica, data: value })
                              // Limpar erro quando usuário começar a digitar
                              if (dataAtipicaError) setDataAtipicaError('')
                            }}
                            maxLength={7}
                            className={`h-8 text-xs border-[#278190]/30 focus:border-[#278190] bg-[#278190]/5 pr-6 ${
                              dataAtipicaError ? 'border-red-300 focus:border-red-400' : ''
                            }`}
                          />
                          {novaDataAtipica.data && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0.5 top-1/2 -translate-y-1/2 h-5 w-5 p-0 hover:bg-[#278190]/20"
                              onClick={() => {
                                setNovaDataAtipica({ ...novaDataAtipica, data: '' })
                                if (dataAtipicaError) setDataAtipicaError('')
                              }}
                              title="Limpar Data"
                            >
                              <X className="h-2 w-2 text-[#278190]" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-[#1E8AA3]">Descrição</Label>
                        <div className="relative">
                          <Input
                            type="text"
                            placeholder="Ex: Aumento de Preço"
                            value={novaDataAtipica.descricao}
                            onChange={(e) => setNovaDataAtipica({ ...novaDataAtipica, descricao: e.target.value })}
                            className="h-8 text-xs border-[#278190]/30 focus:border-[#278190] bg-[#278190]/5 pr-6"
                          />
                          {novaDataAtipica.descricao && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0.5 top-1/2 -translate-y-1/2 h-5 w-5 p-0 hover:bg-[#278190]/20"
                              onClick={() => setNovaDataAtipica({ ...novaDataAtipica, descricao: '' })}
                              title="Limpar Descrição"
                            >
                              <X className="h-2 w-2 text-[#278190]" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <Button
                        type="button"
                        onClick={adicionarDataAtipica}
                        size="sm"
                        className="w-full h-8 text-xs bg-[#172133] hover:bg-[#0f1a2a] text-white font-medium transition-colors"
                        disabled={!novaDataAtipica.data}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Adicionar
                      </Button>
                      
                      {/* Exibição de erro */}
                      {dataAtipicaError && (
                        <div className="bg-gradient-to-br from-red-50 to-rose-50 border border-red-200 rounded-lg p-2 mt-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 bg-red-500 rounded flex items-center justify-center">
                                <X className="w-2.5 h-2.5 text-white" />
                              </div>
                              <p className="text-xs text-red-700 font-medium">{dataAtipicaError}</p>
                            </div>
                            <button
                              onClick={() => {
                                setDataAtipicaError('')
                                resetAllFields()
                              }}
                              className="w-4 h-4 flex items-center justify-center hover:bg-red-200 rounded transition-colors"
                              title="Fechar"
                            >
                              <X className="w-2.5 h-2.5 text-red-600" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                      </>
                    )}
                  </div>

                  {/* List of Atypical Dates */}
                  {datasAtipicas.length > 0 && (
                    <div className="bg-white rounded-xl border border-[#278190]/20 shadow-sm overflow-hidden">
                          <div className="bg-gradient-to-r from-[#278190] to-[#1F6B73] px-3 py-2">
                        <h4 className="text-white text-xs font-semibold flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Cadastradas ({datasAtipicas.length})
                        </h4>
                      </div>
                      <div className="max-h-40 overflow-y-auto">
                        {datasAtipicas.map((data, index) => (
                          <div key={index} className="px-3 py-2 border-b border-amber-50 last:border-b-0 hover:bg-amber-50/50 transition-colors">
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="text-xs text-slate-700 font-medium truncate">
{formatDate(data.dataInicial)}
                                </div>
                                <div className="text-xs text-slate-500 truncate">
                                  {data.descricao || '-'}
                                </div>
                              </div>
                              <div className="flex gap-1 ml-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setNovaDataAtipica({
                                      data: data.dataInicial,
                                      descricao: data.descricao || ''
                                    });
                                    removerDataAtipica(index);
                                  }}
                                  className="h-6 w-6 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  title="Editar"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removerDataAtipica(index)}
                                  className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  title="Excluir"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                </div>
                
                </div>
                
                {/* Bottom Row - Calculate Button - Fixed at bottom */}
                <div className="flex justify-center mt-auto pt-6">
                  <div className="w-full max-w-md">
                    <div className="bg-gradient-to-br from-[#176B87] to-[#145A6B] rounded-xl p-6">
                      <div className="text-center mb-4">
                        <div className="flex items-center justify-center gap-3 mb-2">
                          <h3 className="text-white text-lg font-semibold">Pronto para Calcular?</h3>
                          <TooltipProvider>
                            <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="w-6 h-6 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center cursor-help transition-colors">
                                  <HelpCircle className="w-4 h-4 text-white" />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="bg-[#172133] border-[#172133] shadow-xl max-w-sm">
                                <div className="p-2">
                                  <div className="flex items-center gap-2 mb-3">
                                    <div className="w-6 h-6 bg-white rounded-lg flex items-center justify-center">
                                      <CheckCircle className="w-4 h-4 text-[#172133]" />
                                    </div>
                                    <h4 className="font-semibold text-white">Dicas</h4>
                                  </div>
                                  <div className="space-y-2 text-xs text-white">
                                    <div className="flex items-center gap-2">
                                      <div className="w-1 h-1 bg-white rounded-full"></div>
                                      <span><strong>Dados históricos:</strong> pelo menos 12 meses</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <div className="w-1 h-1 bg-white rounded-full"></div>
                                      <span><strong>Datas atípicas:</strong> opcionais</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <div className="w-1 h-1 bg-white rounded-full"></div>
                                      <span><strong>Previsão:</strong> máximo 24 meses</span>
                                    </div>
                                  </div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <p className="text-white/80 text-sm">Clique para iniciar o processamento</p>
                      </div>
                      <Button
                        type="submit"
                        disabled={isPending || !selectedFile}
                        size="lg"
                        className="w-full bg-[#2FA3BE] hover:bg-[#2891A8] text-white font-bold py-3 px-4 rounded-xl transition-all duration-300 transform hover:scale-[1.02] shadow-lg hover:shadow-xl disabled:opacity-50 disabled:transform-none"
                      >
                        <div className="flex items-center justify-center gap-2">
                          <Calculator className="h-4 w-4" />
                          <span className="text-sm">{isPending ? "Calculando..." : "Calcular Previsão"}</span>
                          {!isPending && <ArrowRight className="h-3 w-3" />}
                        </div>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Campos hidden para enviar valores controlados */}
              <input
                type="hidden"
                name="dataInicio"
                value={fieldValues.dataInicio}
              />
              <input
                type="hidden"
                name="dataFim"
                value={fieldValues.dataFim}
              />
              <input
                type="hidden"
                name="diasPrevisao"
                value={fieldValues.diasPrevisao}
              />
              <input
                type="hidden"
                name="datasAtipicas"
                value={JSON.stringify(datasAtipicas)}
              />
            </form>
          </CardContent>
        </Card>
        </div>
      </main>



      {/* Compact Results Popup */}
      {showResultPopup && state && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl shadow-2xl w-[700px] max-h-[85vh] overflow-hidden animate-in slide-in-from-bottom-4 duration-300 flex flex-col">
            {/* Header */}
            <div className={`px-4 py-3 flex-shrink-0 ${
              state.success 
                ? 'bg-gradient-to-r from-green-500 to-emerald-500' 
                : 'bg-gradient-to-r from-red-500 to-rose-500'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                    {state.success ? (
                      <BarChart3 className="w-5 h-5 text-white" />
                    ) : (
                      <X className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      {state.success ? 'Cálculo Concluído!' : 'Erro no Processamento'}
                    </h2>
                    <p className="text-white/80 text-xs">
                      {state.success ? 'Previsão gerada com sucesso' : 'Ocorreu um problema durante o cálculo'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowResultPopup(false)
                    resetAllFields()
                  }}
                  className="text-white/80 hover:text-white hover:bg-white/20 rounded-lg h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 p-4 overflow-y-auto">
              {state.success ? (
                <div className="flex flex-col space-y-4">
                  {/* Success Summary */}
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-5 h-5 bg-green-500 rounded flex items-center justify-center">
                        <BarChart3 className="w-3 h-3 text-white" />
                      </div>
                      <h3 className="text-sm font-semibold text-green-800">Processamento Concluído</h3>
                    </div>
                    <p className="text-sm text-green-700 mb-2">A previsão de demanda foi calculada com sucesso e está pronta para download.</p>
                    <p className="text-sm text-green-600 font-medium">{state.processedSkus} SKUs processados.</p>
                  </div>
                  
                  {/* Details Section */}
                  {state.details && (
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-2">
                        <FileText className="w-4 h-4" />
                        Detalhes do Processamento
                      </h3>
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                        <div className="text-sm space-y-1">
                          <p className="text-slate-700"><span className="font-medium">Total de registros:</span> {state.details.totalRecords}</p>
                          <p className="text-slate-700"><span className="font-medium">Período:</span> {fieldValues.dataInicio?.replace('/', '/')} até {fieldValues.dataFim?.replace('/', '/')}</p>
                          <p className="text-slate-700"><span className="font-medium">Previsão:</span> {fieldValues.diasPrevisao} meses</p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Additional Info */}
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-4 h-4 bg-blue-500 rounded flex items-center justify-center">
                        <CheckCircle className="w-3 h-3 text-white" />
                      </div>
                      <h4 className="text-sm font-semibold text-slate-800">Informações</h4>
                    </div>
                    <div className="text-sm text-slate-600 space-y-1">
                      <p>• Arquivo processado com sucesso</p>
                      <p>• Previsão calculada usando algoritmos avançados (Prophet + SARIMA)</p>
                      <p>• Resultados prontos para análise</p>
                    </div>
                  </div>
                  

                  
                  {/* Ações */}
                  {state.downloadUrl && (
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-6 h-6 bg-green-500 rounded-lg flex items-center justify-center">
                          <CheckCircle className="w-4 h-4 text-white" />
                        </div>
                        <h3 className="text-sm font-semibold text-slate-800">Ações Disponíveis</h3>
                      </div>
                      <p className="text-sm text-slate-600 mb-4">Escolha uma das opções abaixo:</p>
                      
                      <div className="flex flex-col gap-3">
                        {/* Botão Exportar Previsão */}
                        <Button
                          onClick={() => {
                            // Apenas exportar planilha de resultados, sem navegação
                            handleExportResults()
                          }}
                          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-medium text-sm rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-300 shadow-md hover:shadow-lg"
                        >
                          <Download className="w-4 h-4" />
                          Exportar Previsão
                        </Button>
                        
                        {/* Botão Imputar na Análise */}
                        <Button
                          onClick={() => {
                            // Salvar os dados do cálculo no sessionStorage
                            if (state.resultados && state.dataCalculo) {
                              const dadosCalculo = {
                                resultados: state.resultados,
                                dataCalculo: state.dataCalculo,
                                downloadUrl: state.downloadUrl,
                                filename: state.filename
                              }
                              sessionStorage.setItem('dadosCalculo', JSON.stringify(dadosCalculo))
                              
                              // Processar resultados para criar mapeamento SKU -> valor calculado
                              const calculationResults: Record<string, number> = {}
                              
                              if (Array.isArray(state.resultados)) {
                                state.resultados.forEach((item: any) => {
                                  if (item.sku && typeof item.media === 'number') {
                                    calculationResults[item.sku] = item.media
                                  }
                                })
                              }
                              
                              // Salvar mapeamento de resultados de cálculo
                              sessionStorage.setItem('calculationResults', JSON.stringify(calculationResults))
                              console.log('💾 Resultados de cálculo salvos:', Object.keys(calculationResults).length, 'SKUs')
                            }
                            
                            // Fechar popup e navegar para análise
                          setShowResultPopup(false)
                          resetAllFields()
                          router.push('/analise-dados')
                          }}
                          variant="outline"
                          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 border-2 border-green-600 text-green-700 font-medium text-sm rounded-lg hover:bg-green-50 transition-all duration-300"
                        >
                          <BarChart3 className="w-4 h-4" />
                          Imputar na Análise
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col space-y-4">
                  <div className="bg-gradient-to-br from-red-50 to-rose-50 border border-red-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-5 h-5 bg-red-500 rounded flex items-center justify-center">
                        <X className="w-3 h-3 text-white" />
                      </div>
                      <h3 className="text-sm font-semibold text-red-800">Erro no Processamento</h3>
                    </div>
                    <p className="text-sm text-red-700">Ocorreu um problema durante o cálculo da previsão. Verifique os dados e tente novamente.</p>
                  </div>
                  
                  {state.error && (
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-2">
                        <AlertCircle className="w-4 h-4" />
                        Detalhes do Erro
                      </h3>
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 max-h-40 overflow-y-auto">
                        <pre className="text-sm text-red-600 whitespace-pre-wrap font-mono leading-relaxed">{state.error}</pre>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>


          </div>
        </div>
      )}
      
      {/* Modal de Confirmação de Importação */}
      {showImportConfirmModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-bold text-white">Confirmar Importação</h3>
              </div>
            </div>
            
            <div className="p-6">
              <div className="mb-6">
                <p className="text-gray-700 mb-4">
                  <strong>Atenção:</strong> Esta operação irá substituir <strong>TODOS</strong> os dados existentes na tabela de previsões de demanda.
                </p>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-orange-800">
                      <p className="font-medium mb-1">Dados que serão afetados:</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>Todos os registros existentes serão removidos</li>
                        <li>Novos dados do arquivo CSV serão inseridos</li>
                        <li>Esta ação não pode ser desfeita</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowImportConfirmModal(false)
                    resetAllFields()
                  }}
                  className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={confirmImportData}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                >
                  Confirmar Importação
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Popup de Sucesso da Importação */}
      {showImportSuccessPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <h2 className="text-lg font-semibold">Importação Concluída</h2>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowImportSuccessPopup(false)
                    resetAllFields()
                  }}
                  className="text-white hover:bg-white/20 h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 bg-green-500 rounded-lg flex items-center justify-center">
                    <Upload className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="text-sm font-semibold text-green-800">Dados Importados com Sucesso</h3>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-green-700">
                    Os dados do arquivo CSV foram importados para a tabela de previsões de demanda.
                  </p>
                  {importSuccessData && (
                    <div className="bg-white/60 rounded-lg p-3 mt-3">
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-4 h-4 bg-green-500 rounded flex items-center justify-center">
                          <FileText className="w-3 h-3 text-white" />
                        </div>
                        <span className="font-medium text-green-800">
                          {importSuccessData.recordCount} registros importados
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm mt-1">
                        <div className="w-4 h-4 bg-orange-500 rounded flex items-center justify-center">
                          <AlertTriangle className="w-3 h-3 text-white" />
                        </div>
                        <span className="text-orange-700">
                          Dados anteriores foram substituídos
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6">
                <Button
                  onClick={() => {
                    setShowImportSuccessPopup(false)
                    resetAllFields()
                  }}
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-medium py-2 px-4 rounded-lg transition-all duration-300"
                >
                  Fechar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </SharedLayout>
  )
}
