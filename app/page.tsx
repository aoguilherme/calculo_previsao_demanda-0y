"use client"
import React, { useState, useEffect, useActionState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { X, FileText, BarChart3, Upload, CheckCircle, Calendar, Plus, Edit2, Trash2, Calculator, ArrowRight, AlertTriangle, AlertCircle } from "lucide-react"
import { calculateDemandForecast } from "./actions"

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

  // Valores padrão - inicializados com valores estáticos para evitar hidratação (formato mm/aaaa)
  const defaultValues = 
  {
    dataInicio: "01/2024",
    dataFim: "12/2024",
    diasPrevisao: "1"
  }

  // Estados para controlar os valores dos campos
  const [fieldValues, setFieldValues] = useState(defaultValues)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [csvData, setCsvData] = useState<Array<{data: Date, sku: string, familia: string, vendas: number}>>([]) // Dados do CSV processados

  const [showResultPopup, setShowResultPopup] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState('')

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



  return (
    <div className="h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex flex-col overflow-hidden">
      {/* Compact Header */}
      <header className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 shadow-xl flex-shrink-0">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white tracking-tight">Previsão de Demanda</h1>
                <p className="text-slate-300 text-xs">Sistema Inteligente de Análise Preditiva</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-xs">Online</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Single Page Layout */}
      <main className="flex-1 container mx-auto px-4 py-4 overflow-hidden">
        <div className="h-full max-w-7xl mx-auto">
          {/* Main Form Card - Full Height */}
          <Card className="h-full bg-white/90 backdrop-blur-sm shadow-xl border-0 rounded-2xl overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-3 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white text-lg font-bold flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Configuração da Análise
                  </CardTitle>
                  <p className="text-slate-300 text-sm mt-1">Preencha os dados necessários para iniciar o processamento</p>
                </div>
                <Link href="/analise-dados">
                  <Button 
                    type="button"
                    variant="outline" 
                    size="sm"
                    className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:border-white/30 transition-all duration-200"
                  >
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Análise de Dados
                  </Button>
                </Link>
              </div>
            </div>
          <CardContent className="flex-1 p-4 overflow-hidden">
            <form action={action} className="h-full flex flex-col">
              {/* Compact Grid Layout */}
              <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 overflow-hidden">
                
                {/* Left Column - Upload & Dates */}
                <div className="space-y-4">
                  {/* Upload Section - Histórico de Vendas */}
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 bg-blue-500 rounded-lg flex items-center justify-center">
                        <FileText className="w-4 h-4 text-white" />
                      </div>
                      <Label htmlFor="csvFile" className="text-sm font-semibold text-slate-800">
                        Anexar histórico de vendas <span className="text-red-500">*</span>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Input
                        id="csvFile"
                        name="csvFile"
                        type="file"
                        accept=".csv"
                        required
                        className="flex-1 h-9 text-xs border-2 border-dashed border-blue-300 bg-white/50 hover:border-blue-400 transition-colors file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700"
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
                      <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-xs text-green-700 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          {selectedFile.name}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Upload Section - Média dos Itens */}
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-100">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 bg-green-500 rounded-lg flex items-center justify-center">
                        <FileText className="w-4 h-4 text-white" />
                      </div>
                      <Label htmlFor="csvMediaFile" className="text-sm font-semibold text-slate-800">
                        Anexar média dos itens
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Input
                        id="csvMediaFile"
                        name="csvMediaFile"
                        type="file"
                        accept=".csv"
                        className="flex-1 h-9 text-xs border-2 border-dashed border-green-300 bg-white/50 hover:border-green-400 transition-colors file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-green-50 file:text-green-700"
                      />
                    </div>
                  </div>



                  {/* Date Configuration */}
                  <div className="bg-gradient-to-br from-slate-50 to-gray-50 rounded-xl p-4 border border-slate-200">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 bg-slate-600 rounded-lg flex items-center justify-center">
                        <Calendar className="w-4 h-4 text-white" />
                      </div>
                      <h3 className="text-sm font-semibold text-slate-800">Período de Análise</h3>
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="dataInicio" className="text-xs font-medium text-slate-700">
                          Data Início <span className="text-red-500">*</span>
                        </Label>
                        <div className="relative">
                          <Input
                            id="dataInicio"
                            name="dataInicio"
                            type="text"
                            required
                            className={`h-8 text-xs bg-white border transition-all duration-200 pr-6 ${
                              isFieldEdited("dataInicio") 
                                ? 'border-blue-400 bg-blue-50' 
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                            placeholder="mm/aaaa"
                            value={fieldValues.dataInicio}
                            onChange={(e) => {
                              let value = e.target.value.replace(/\D/g, '')
                              if (value.length >= 2) value = value.slice(0,2) + '/' + value.slice(2,6)
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
                        <Label htmlFor="dataFim" className="text-xs font-medium text-slate-700">
                          Data Fim <span className="text-red-500">*</span>
                        </Label>
                        <div className="relative">
                          <Input
                            id="dataFim"
                            name="dataFim"
                            type="text"
                            required
                            className={`h-8 text-xs bg-white border transition-all duration-200 pr-6 ${
                              isFieldEdited("dataFim") 
                                ? 'border-indigo-400 bg-indigo-50' 
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                            placeholder="mm/aaaa"
                            value={fieldValues.dataFim}
                            onChange={(e) => {
                              let value = e.target.value.replace(/\D/g, '')
                              if (value.length >= 2) value = value.slice(0,2) + '/' + value.slice(2,6)
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
                        <Label htmlFor="diasPrevisao" className="text-xs font-medium text-slate-700">
                          Meses Previsão <span className="text-red-500">*</span>
                        </Label>
                        <div className="relative">
                          <Input
                            id="diasPrevisao"
                            name="diasPrevisao"
                            type="number"
                            required
                            className={`h-8 text-xs bg-white border transition-all duration-200 pr-6 ${
                              isFieldEdited("diasPrevisao") 
                                ? 'border-green-400 bg-green-50' 
                                : 'border-slate-200 hover:border-slate-300'
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
                  </div>
                </div>

                {/* Middle Column - Atypical Dates */}
                <div className="space-y-4">
                  {/* Add New Atypical Date */}
                  <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-200">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 bg-amber-500 rounded-lg flex items-center justify-center">
                        <Plus className="w-4 h-4 text-white" />
                      </div>
                      <h3 className="text-sm font-semibold text-slate-800">Datas Atípicas</h3>
                    </div>
                    
                    <div className="space-y-2">
                      <div>
                        <Label className="text-xs font-medium text-slate-600">Data</Label>
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
                            className={`h-8 text-xs border-amber-200 focus:border-amber-400 bg-amber-50/50 pr-6 ${
                              dataAtipicaError ? 'border-red-300 focus:border-red-400' : ''
                            }`}
                          />
                          {novaDataAtipica.data && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0.5 top-1/2 -translate-y-1/2 h-5 w-5 p-0 hover:bg-amber-200"
                              onClick={() => {
                                setNovaDataAtipica({ ...novaDataAtipica, data: '' })
                                if (dataAtipicaError) setDataAtipicaError('')
                              }}
                              title="Limpar Data"
                            >
                              <X className="h-2 w-2 text-amber-600" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-slate-600">Descrição</Label>
                        <div className="relative">
                          <Input
                            type="text"
                            placeholder="Ex: Aumento de Preço"
                            value={novaDataAtipica.descricao}
                            onChange={(e) => setNovaDataAtipica({ ...novaDataAtipica, descricao: e.target.value })}
                            className="h-8 text-xs border-amber-200 focus:border-amber-400 bg-amber-50/50 pr-6"
                          />
                          {novaDataAtipica.descricao && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0.5 top-1/2 -translate-y-1/2 h-5 w-5 p-0 hover:bg-amber-200"
                              onClick={() => setNovaDataAtipica({ ...novaDataAtipica, descricao: '' })}
                              title="Limpar Descrição"
                            >
                              <X className="h-2 w-2 text-amber-600" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <Button
                        type="button"
                        onClick={adicionarDataAtipica}
                        size="sm"
                        className="w-full h-8 text-xs bg-amber-500 hover:bg-amber-600 text-white font-medium transition-colors"
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
                              onClick={() => setDataAtipicaError('')}
                              className="w-4 h-4 flex items-center justify-center hover:bg-red-200 rounded transition-colors"
                              title="Fechar"
                            >
                              <X className="w-2.5 h-2.5 text-red-600" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* List of Atypical Dates */}
                  {datasAtipicas.length > 0 && (
                    <div className="bg-white rounded-xl border border-amber-100 shadow-sm overflow-hidden">
                      <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-2">
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

                {/* Right Column - Calculate Button & Info */}
                <div className="space-y-4">
                  <div className="bg-gradient-to-br from-slate-800 to-slate-700 rounded-xl p-4">
                    <div className="text-center mb-3">
                      <h3 className="text-white text-sm font-semibold mb-1">Pronto para Calcular?</h3>
                      <p className="text-slate-300 text-xs">Clique para iniciar o processamento</p>
                    </div>
                    <Button
                      type="submit"
                      disabled={isPending || !selectedFile}
                      size="lg"
                      className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3 px-4 rounded-xl transition-all duration-300 transform hover:scale-[1.02] shadow-lg hover:shadow-xl disabled:opacity-50 disabled:transform-none"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <Calculator className="h-4 w-4" />
                        <span className="text-sm">{isPending ? "Calculando..." : "Calcular Previsão"}</span>
                        {!isPending && <ArrowRight className="h-3 w-3" />}
                      </div>
                    </Button>
                  </div>

                  {/* Info Panel - Formato do Arquivo de Vendas */}
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-5 h-5 bg-blue-500 rounded-lg flex items-center justify-center">
                        <AlertTriangle className="w-3 h-3 text-white" />
                      </div>
                      <h4 className="text-xs font-semibold text-slate-800">Formato do Arquivo de Vendas</h4>
                    </div>
                    <div className="text-xs text-slate-600 space-y-1">
                      <p>• Formato: CSV</p>
                      <p>• Separador: ponto e vírgula (;)</p>
                      <p>• Colunas: Data; SKU; Familia; Vendas</p>
                      <p>• Data: mm/aaaa</p>
                    </div>
                  </div>

                  {/* Info Panel - Formato do Arquivo de Médias */}
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-100">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-5 h-5 bg-green-500 rounded-lg flex items-center justify-center">
                        <AlertTriangle className="w-3 h-3 text-white" />
                      </div>
                      <h4 className="text-xs font-semibold text-slate-800">Formato do Arquivo de Médias</h4>
                    </div>
                    <div className="text-xs text-slate-600 space-y-1">
                      <p>• Formato: CSV</p>
                      <p>• Separador: ponto e vírgula (;)</p>
                      <p>• Colunas: sku; fml_item; media_prevista; dt_implant</p>
                      <p>• Data: aaaa/mm/dd</p>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-xl p-4 border border-red-100">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-5 h-5 bg-red-500 rounded-lg flex items-center justify-center">
                        <CheckCircle className="w-3 h-3 text-white" />
                      </div>
                      <h4 className="text-xs font-semibold text-slate-800">Dicas</h4>
                    </div>
                    <div className="text-xs text-slate-600 space-y-1">
                      <p>• Use dados históricos de pelo menos 12 meses</p>
                      <p>• Datas atípicas são opcionais</p>
                      <p>• Máximo 24 meses de previsão</p>
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

      {/* Modern Footer */}
      <footer className="flex-shrink-0 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-t border-slate-700">
        <div className="container mx-auto px-6 py-3">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">Sistema de Previsão de Demanda</p>
                <p className="text-slate-400 text-xs">Tecnologia avançada para análise preditiva</p>
              </div>
            </div>
            <div className="text-slate-400 text-xs text-center lg:text-right">
              <p>© 2025 Todos os direitos reservados.</p>
              <p className="text-xs mt-1">Desenvolvido com tecnologia de ponta</p>
            </div>
          </div>
        </div>
      </footer>

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
                  onClick={() => setShowResultPopup(false)}
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
                          <p className="text-slate-700"><span className="font-medium">Período analisado:</span> {state.details.dateRange}</p>
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
                  
                  {/* Download Section */}
                  {state.downloadUrl && (
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4 text-center">
                      <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center mx-auto mb-2">
                        <FileText className="w-4 h-4 text-white" />
                      </div>
                      <h3 className="text-sm font-semibold text-slate-800 mb-2">Exportação e Salvamento</h3>
                      <p className="text-sm text-slate-600 mb-3">Ir para análise de dados para revisar e salvar</p>
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
                          }
                          
                          // Navegar para a página de análise de dados
                          router.push('/analise-dados')
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-medium text-sm rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all duration-300 shadow-md hover:shadow-lg"
                      >
                        <ArrowRight className="w-4 h-4" />
                        Exportar
                      </Button>
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
    </div>
  )
}
