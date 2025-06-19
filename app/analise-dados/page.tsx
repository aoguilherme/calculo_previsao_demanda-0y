'use client'

import { useState, useEffect, useMemo, useCallback, memo } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { ArrowUpDown, Filter, Search, X, Edit2, Save, BarChart3, Download, Upload, ArrowLeft, ChevronUp, ChevronDown, Check, Plus, Menu, Home, Calculator } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import * as XLSX from 'xlsx'
import { useRouter } from 'next/navigation'

// Função debounce customizada para evitar dependências externas
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

interface PrevisaoDemanda {
  sku: string
  media_prevista: number
  calculo_realizado?: number
  fml_item?: string
  dt_implant?: string
  diferencaCalculada?: number
}

type SortField = 'sku' | 'fml_item' | 'media_prevista' | 'dt_implant' | 'calculo_realizado' | 'diferenca'
type SortDirection = 'asc' | 'desc'

export default function AnaliseDadosPage() {
  const router = useRouter()
  const [dados, setDados] = useState<PrevisaoDemanda[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [editingRow, setEditingRow] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [totalSkus, setTotalSkus] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [saveProgress, setSaveProgress] = useState('')
  const [showProgressPopup, setShowProgressPopup] = useState(false)
  const [progressState, setProgressState] = useState<{current: number, total: number, currentSku: string, message: string} | null>(null)
  const [showResultPopup, setShowResultPopup] = useState(false)
  const [resultPopupState, setResultPopupState] = useState<{success: boolean, message: string} | null>(null)
  
  // Estados para virtualização da tabela
  const [scrollTop, setScrollTop] = useState(0)
  const [containerHeight] = useState(600) // altura fixa do container
  const rowHeight = 40 // altura de cada linha
  const overscan = 5 // linhas extras para renderizar fora da view
  
  // Estados para filtro e ordenação
  const [sortField, setSortField] = useState<SortField>('sku')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  
  // Estados para filtros de texto (sem debounce para filtragem instantânea)
  const [skuFilter, setSkuFilter] = useState('')
  const [familiaSelectFilter, setFamiliaSelectFilter] = useState<string[]>([])
  
  // Opções de família PA-001 a PA-018
  const familiaOptions = Array.from({ length: 18 }, (_, i) => {
    const num = (i + 1).toString().padStart(3, '0')
    return `PA-${num}`
  })

  // Handlers para filtros otimizados
  const handleSkuFilterChange = useCallback((value: string) => {
    setSkuFilter(value)
  }, [])

  const handleFamiliaSelectChange = useCallback((familia: string, checked: boolean) => {
    setFamiliaSelectFilter(prev => {
      if (checked) {
        return [...prev, familia]
      } else {
        return prev.filter(f => f !== familia)
      }
    })
  }, [])

  const clearSkuFilter = useCallback(() => {
    setSkuFilter('')
  }, [])

  const clearFamiliaSelectFilter = useCallback(() => {
    setFamiliaSelectFilter([])
  }, [])

  // Função para carregar dados iniciais - TODOS os registros
  const carregarDados = async () => {
    try {
      setLoading(true)
      console.log('🔄 Carregando todos os dados...')
      
      // Primeiro, obter o total de registros
      const supabase = createClient()
      const { count } = await supabase
        .from('previsoes_demanda')
        .select('*', { count: 'exact', head: true })
      
      setTotalSkus(count || 0)
      console.log(`📊 Total de registros: ${count}`)
      
      // Carregar TODOS os dados em lotes para garantir que nada seja omitido
      const BATCH_SIZE = 1000 // Tamanho do lote para carregamento
      let allData: any[] = []
      let currentBatch = 0
      let hasMore = true
      
      // Tentar carregar resultados de cálculos do sessionStorage
      const savedResults = sessionStorage.getItem('calculationResults')
      let calculationResults: Record<string, number> = {}
      
      if (savedResults) {
        try {
          calculationResults = JSON.parse(savedResults)
          console.log('📋 Resultados de cálculos carregados do sessionStorage')
        } catch (e) {
          console.warn('Erro ao parsear resultados salvos:', e)
        }
      }
      
      // Carregar todos os dados em lotes
      while (hasMore) {
        const startRange = currentBatch * BATCH_SIZE
        const endRange = startRange + BATCH_SIZE - 1
        
        console.log(`🔄 Carregando lote ${currentBatch + 1} (registros ${startRange + 1}-${endRange + 1})...`)
        
        const { data, error } = await supabase
          .from('previsoes_demanda')
          .select('sku, media_prevista, fml_item, dt_implant')
          .order('sku')
          .range(startRange, endRange)

        if (error) {
          console.error('Erro ao carregar dados:', error)
          toast({
            title: "Erro ao carregar dados",
            description: error.message,
            variant: "destructive"
          })
          return
        }

        if (data && data.length > 0) {
          // Mesclar dados do Supabase com resultados de cálculos
          const dadosComCalculos = data.map(item => ({
            ...item,
            calculo_realizado: calculationResults[item.sku] || undefined,
            fml_item: item.fml_item || ''
          }))
          
          allData = [...allData, ...dadosComCalculos]
          
          // Se retornou menos dados que o tamanho do lote, chegamos ao fim
          if (data.length < BATCH_SIZE) {
            hasMore = false
          }
          
          currentBatch++
          
          // Atualizar progresso para o usuário
          if (currentBatch % 5 === 0 || !hasMore) { // Atualizar a cada 5 lotes ou no final
            toast({
              title: "Carregando dados...",
              description: `${allData.length.toLocaleString('pt-BR')} de ${count?.toLocaleString('pt-BR')} registros carregados`,
            })
          }
        } else {
          hasMore = false
        }
      }
      
      // Definir todos os dados carregados
       setDados(allData)
      
      console.log(`✅ TODOS os ${allData.length} registros carregados com sucesso`)
      
      toast({
        title: "Dados carregados com sucesso!",
        description: `Todos os ${allData.length.toLocaleString('pt-BR')} registros foram carregados e estão disponíveis para visualização.`,
      })
      
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
      toast({
        title: "Erro de conexão",
        description: "Não foi possível carregar os dados. Tente novamente.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }



  // Carregar dados na inicialização
  useEffect(() => {
    carregarDados()
  }, [])

  // Verificar se há dados calculados no sessionStorage e notificar o usuário
  useEffect(() => {
    const savedResults = sessionStorage.getItem('calculationResults')
    const savedData = sessionStorage.getItem('calculationData')
    
    if (savedResults && savedData) {
      try {
        const results = JSON.parse(savedResults)
        const data = JSON.parse(savedData)
        const skuCount = Object.keys(results).length
        
        toast({
          title: "Previsão Imputada com Sucesso!",
          description: `Os valores calculados foram inseridos automaticamente na coluna "Cálculo Realizado" para ${skuCount} SKUs. Média geral: ${data.averageValue?.toLocaleString('pt-BR')} unidades.`,
          duration: 8000,
        })
        
        // Limpar dados do sessionStorage após a notificação
        sessionStorage.removeItem('calculationResults')
        sessionStorage.removeItem('calculationData')
      } catch (e) {
        console.warn('Erro ao processar dados salvos:', e)
      }
    }
  }, [dados]) // Executar quando os dados forem carregados

  // Função para iniciar edição
  const iniciarEdicao = (sku: string, valorAtual?: number) => {
    setEditingRow(sku)
    // Se não há valor calculado, usar a média atual como fallback
    const valorParaEdicao = valorAtual || dados.find(item => item.sku === sku)?.media_prevista || 0
    setEditValue(Math.round(valorParaEdicao).toString())
  }

  // Cancelar edição
  const cancelarEdicao = () => {
    setEditingRow(null)
    setEditValue('')
  }

  // Salvar edição
  const salvarEdicao = (sku: string) => {
    const novoValor = Math.round(parseFloat(editValue))
    if (isNaN(novoValor)) {
      toast({
        title: "Valor inválido",
        description: "Por favor, insira um número válido.",
        variant: "destructive"
      })
      return
    }

    setDados(prev => prev.map(item => 
      item.sku === sku 
        ? { ...item, calculo_realizado: novoValor }
        : item
    ))

    // Salvar no sessionStorage
    const savedResults = sessionStorage.getItem('calculationResults')
    let calculationResults: Record<string, number> = {}
    
    if (savedResults) {
      try {
        calculationResults = JSON.parse(savedResults)
      } catch (e) {
        console.warn('Erro ao parsear resultados salvos:', e)
      }
    }
    
    calculationResults[sku] = novoValor
    sessionStorage.setItem('calculationResults', JSON.stringify(calculationResults))

    setEditingRow(null)
    setEditValue('')
    
    toast({
      title: "Valor atualizado",
      description: `Cálculo realizado para ${sku} foi atualizado.`,
    })
  }

  // Função para atualizar médias no Supabase e exportar Excel
  const handleSaveAndExport = async () => {
    setIsSaving(true)
    setShowResultPopup(false)
    setResultPopupState(null)
    setShowProgressPopup(true)
    
    try {
      // 1. Primeiro, gerar planilha Excel com TODOS os dados da tabela (inclusive os não visíveis)
      setProgressState({current: 0, total: 100, currentSku: '', message: 'Gerando planilha Excel...'})
      const wb = XLSX.utils.book_new()
      
      // Usar dadosProcessados que contém TODOS os dados filtrados e ordenados
      const wsData = dadosProcessados.map(item => ({
        'Código Item': item.sku,
        'Família': item.fml_item || '-',
        'Média Atual': item.media_prevista || 0,
        'Data Implantação': item.dt_implant ? item.dt_implant.split('T')[0].split('-').reverse().join('/') : '-',
        'Cálculo Realizado': item.calculo_realizado || item.media_prevista || 0,
        'Diferença (%)': item.diferencaCalculada ? Number(item.diferencaCalculada.toFixed(2)) : 0
      }))
      
      const ws = XLSX.utils.json_to_sheet(wsData)
      XLSX.utils.book_append_sheet(wb, ws, 'Análise de Dados')
      
      const now = new Date()
      const pad = (n: number) => n.toString().padStart(2, '0')
      const fileName = `analise_dados_${pad(now.getDate())}-${pad(now.getMonth()+1)}-${now.getFullYear()}_${pad(now.getHours())}h${pad(now.getMinutes())}.xlsx`
      
      // Gerar arquivo usando buffer e blob para evitar corrupção
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      
      // Criar link para download
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      // Limpar URL do objeto
      URL.revokeObjectURL(url)
      
      setProgressState({current: 10, total: 100, currentSku: '', message: 'Excel gerado com sucesso!'})
      
      // 2. Atualizar Supabase com progresso em tempo real
      const supabase = createClient()
      const itemsToUpdate = dadosProcessados.filter(item => 
        item.sku && typeof item.calculo_realizado === 'number'
      )
      
      const totalItems = itemsToUpdate.length
      let updatedCount = 0
      let errorCount = 0
      const errors: string[] = []
      
      setProgressState({current: 15, total: 100, currentSku: '', message: `Iniciando atualização de ${totalItems} SKUs no Supabase...`})
      
      // Processar em lotes para melhor performance
      const BATCH_SIZE = 10
      for (let i = 0; i < itemsToUpdate.length; i += BATCH_SIZE) {
        const batch = itemsToUpdate.slice(i, i + BATCH_SIZE)
        
        // Processar lote em paralelo
        const batchPromises = batch.map(async (item) => {
          try {
            const { error } = await supabase
              .from('previsoes_demanda')
              .update({ media_prevista: item.calculo_realizado })
              .eq('sku', item.sku)
            
            if (error) {
              throw error
            }
            
            updatedCount++
            const progressPercent = Math.round(15 + (updatedCount / totalItems) * 80) // 15% inicial + 80% para atualizações
            setProgressState({
              current: progressPercent, 
              total: 100, 
              currentSku: item.sku, 
              message: `Atualizando SKU ${item.sku}...`
            })
            
            return { success: true, sku: item.sku }
          } catch (error) {
            errorCount++
            const errorMsg = `Erro ao atualizar SKU ${item.sku}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
            errors.push(errorMsg)
            console.error(errorMsg)
            return { success: false, sku: item.sku, error: errorMsg }
          }
        })
        
        await Promise.all(batchPromises)
        
        // Pequena pausa entre lotes para não sobrecarregar o servidor
        if (i + BATCH_SIZE < itemsToUpdate.length) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }
      
      setProgressState({current: 95, total: 100, currentSku: '', message: 'Finalizando processo...'})
      
      // Resultado final
      if (errorCount === 0) {
        setProgressState({current: 100, total: 100, currentSku: '', message: `✅ Atualização concluída com sucesso! ${updatedCount} SKUs atualizados.`})
        setResultPopupState({
          success: true, 
          message: `Planilha Excel exportada com sucesso!\n\nAtualização do Supabase:\n• ${updatedCount} SKUs atualizados com sucesso\n• ${totalItems - updatedCount} SKUs sem alterações\n\nArquivo salvo: ${fileName}`
        })
      } else {
        setProgressState({current: 100, total: 100, currentSku: '', message: `⚠️ Atualização concluída com ${errorCount} erros`})
        setResultPopupState({
          success: false,
          message: `Planilha Excel exportada com sucesso!\n\nAtualização do Supabase:\n• ${updatedCount} SKUs atualizados\n• ${errorCount} SKUs com erro\n\nPrimeiros erros:\n${errors.slice(0, 3).join('\n')}${errors.length > 3 ? '\n...' : ''}`
        })
      }
      
      // Aguardar um pouco antes de mostrar o resultado final
      setTimeout(() => {
        setShowProgressPopup(false)
        setShowResultPopup(true)
      }, 1500)
      
    } catch (error) {
      console.error('Erro durante o processo:', error)
      setProgressState({current: 0, total: 100, currentSku: '', message: '❌ Erro durante o processo'})
      setResultPopupState({
        success: false, 
        message: `Ocorreu um erro durante o processo de exportação:\n${error instanceof Error ? error.message : 'Erro desconhecido'}`
      })
      setTimeout(() => {
        setShowProgressPopup(false)
        setShowResultPopup(true)
      }, 1500)
    } finally {
      setIsSaving(false)
    }
  }

  // Função para ordenação (otimizada)
  const handleSort = useCallback((field: SortField) => {
    setSortField(field)
    setSortDirection(prev => 
      sortField === field && prev === 'asc' ? 'desc' : 'asc'
    )
  }, [sortField])

  // Memoizar cálculos de diferença para evitar recálculos
  const dadosComDiferenca = useMemo(() => {
    return dados.map(item => ({
      ...item,
      diferencaCalculada: item.calculo_realizado 
        ? ((item.calculo_realizado - item.media_prevista) / item.media_prevista) * 100 
        : 0
    }))
  }, [dados])

  // Dados filtrados otimizados
  const dadosFiltrados = useMemo(() => {
    // Early return se não há dados
    if (dadosComDiferenca.length === 0) return []
    
    // Verificar se há filtros ativos
    const hasSkuFilter = skuFilter.trim().length > 0
    const hasFamiliaSelectFilter = familiaSelectFilter.length > 0
    
    if (!hasSkuFilter && !hasFamiliaSelectFilter) {
      return dadosComDiferenca
    }
    
    // Pré-processar termos de filtro uma vez
    const skuTerm = hasSkuFilter ? skuFilter.toLowerCase().trim() : ''
    
    // Filtra em uma única passagem
    return dadosComDiferenca.filter(item => {
      if (hasSkuFilter && !item.sku.toLowerCase().includes(skuTerm)) {
        return false
      }
      if (hasFamiliaSelectFilter && !familiaSelectFilter.includes(item.fml_item || '')) {
        return false
      }
      return true
    })
  }, [dadosComDiferenca, skuFilter, familiaSelectFilter])

  // Função para verificar se uma data é do ano atual
  const isCurrentYear = useCallback((dateString: string | null | undefined) => {
    if (!dateString) return false
    const currentYear = new Date().getFullYear()
    const itemYear = new Date(dateString).getFullYear()
    return itemYear === currentYear
  }, [])

  // Dados filtrados e ordenados otimizados
  const dadosProcessados = useMemo(() => {
    // Early return se não há dados
    if (dadosComDiferenca.length === 0) return []

    // Usar dados filtrados por texto em vez de seleção
    let filtered = dadosFiltrados

    // Se não há dados após filtros, retornar array vazio
    if (filtered.length === 0) return []

    // Aplicar ordenação otimizada apenas se necessário
    if (!sortField) return filtered

    // Criar uma cópia para ordenação (evita mutação do array original)
    const sorted = [...filtered]

    // Aplicar ordenação otimizada com cache de valores
    sorted.sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortField) {
        case 'sku':
          aValue = a.sku
          bValue = b.sku
          break
        case 'fml_item':
          aValue = a.fml_item || ''
          bValue = b.fml_item || ''
          break
        case 'media_prevista':
          aValue = a.media_prevista || 0
          bValue = b.media_prevista || 0
          break
        case 'dt_implant':
          aValue = a.dt_implant || ''
          bValue = b.dt_implant || ''
          break
        case 'calculo_realizado':
          aValue = a.calculo_realizado || 0
          bValue = b.calculo_realizado || 0
          break
        case 'diferenca':
          // Cache dos cálculos de diferença para evitar recálculo
          aValue = a.diferencaCalculada
          bValue = b.diferencaCalculada
          break
        default:
          return 0
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.localeCompare(bValue)
        return sortDirection === 'asc' ? comparison : -comparison
      } else {
        const comparison = (aValue || 0) - (bValue || 0)
        return sortDirection === 'asc' ? comparison : -comparison
      }
    })

    return sorted
  }, [dadosFiltrados, sortField, sortDirection, dadosComDiferenca])

  // Virtualização da tabela - calcular itens visíveis
  const virtualizedData = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan)
    const endIndex = Math.min(
      dadosProcessados.length,
      Math.ceil((scrollTop + containerHeight) / rowHeight) + overscan
    )
    
    return {
      items: dadosProcessados.slice(startIndex, endIndex),
      startIndex,
      endIndex,
      totalHeight: dadosProcessados.length * rowHeight,
      offsetY: startIndex * rowHeight
    }
  }, [dadosProcessados, scrollTop, containerHeight, rowHeight, overscan])

  // Handler para scroll da tabela
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  // Removido: tela de carregamento completa

  return (
    <div className="h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex overflow-hidden">
      {/* Menu Lateral */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="fixed top-4 left-4 z-50 lg:hidden bg-white/95 border-[#176B87]/30 text-[#176B87] hover:bg-[#176B87] hover:text-white shadow-lg backdrop-blur-sm transition-all duration-300"
          >
            <Menu className="h-4 w-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-80 p-0 bg-white border-r border-gray-100 shadow-2xl drop-shadow-2xl">
          <div className="flex flex-col h-full">
            <div className="bg-gradient-to-br from-[#176B87] to-[#145A6B] p-8 shadow-lg">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center shadow-lg backdrop-blur-sm">
                  <BarChart3 className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">SupplyMind</h2>
                  <p className="text-white/80 text-sm font-medium">Previsão de Demanda</p>
                </div>
              </div>
            </div>
            <nav className="flex-1 p-8 space-y-4">
              <Button
                variant="ghost"
                className="w-full justify-start h-14 bg-gray-50 text-gray-700 hover:bg-[#176B87]/10 hover:text-[#176B87] border border-gray-100 shadow-sm rounded-2xl transition-all duration-300 transform hover:scale-[1.02]"
                onClick={() => {
                  router.push('/')
                  setSidebarOpen(false)
                }}
              >
                <div className="w-10 h-10 bg-[#176B87]/10 rounded-xl flex items-center justify-center mr-4">
                  <Calculator className="h-5 w-5 text-[#176B87]" />
                </div>
                <div className="text-left">
                  <div className="font-bold text-base">Cálculo</div>
                  <div className="text-sm opacity-70">Previsão de Demanda</div>
                </div>
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start h-14 bg-gradient-to-r from-[#176B87] to-[#145A6B] text-white hover:from-[#145A6B] hover:to-[#124C5F] shadow-lg rounded-2xl transition-all duration-300 transform hover:scale-[1.02]"
                onClick={() => {
                  router.push('/analise-dados')
                  setSidebarOpen(false)
                }}
              >
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mr-4">
                  <BarChart3 className="h-5 w-5 text-white" />
                </div>
                <div className="text-left">
                  <div className="font-bold text-base">Análise</div>
                  <div className="text-sm opacity-90">Dados e Resultados</div>
                </div>
              </Button>
            </nav>
            <div className="p-8 border-t border-gray-100">
              <div className="text-xs text-gray-500 text-center">
                <p className="font-medium">Sistema de Previsão</p>
                <p className="opacity-70">Versão 1.0</p>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Menu Lateral Desktop */}
      <div className="hidden lg:flex lg:w-80 lg:flex-col lg:bg-white lg:border-r lg:border-gray-100 lg:shadow-2xl lg:drop-shadow-2xl">
        <div className="bg-gradient-to-br from-[#176B87] to-[#145A6B] p-8 shadow-lg">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center shadow-lg backdrop-blur-sm">
              <BarChart3 className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">SupplyMind</h2>
              <p className="text-white/80 text-sm font-medium">Previsão de Demanda</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-8 space-y-4">
          <Button
            variant="ghost"
            className="w-full justify-start h-14 bg-gray-50 text-gray-700 hover:bg-[#176B87]/10 hover:text-[#176B87] border border-gray-100 shadow-sm rounded-2xl transition-all duration-300 transform hover:scale-[1.02]"
            onClick={() => router.push('/')}
          >
            <div className="w-10 h-10 bg-[#176B87]/10 rounded-xl flex items-center justify-center mr-4">
              <Calculator className="h-5 w-5 text-[#176B87]" />
            </div>
            <div className="text-left">
              <div className="font-bold text-base">Cálculo</div>
              <div className="text-sm opacity-70">Previsão de Demanda</div>
            </div>
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start h-14 bg-gradient-to-r from-[#176B87] to-[#145A6B] text-white hover:from-[#145A6B] hover:to-[#124C5F] shadow-lg rounded-2xl transition-all duration-300 transform hover:scale-[1.02]"
            onClick={() => router.push('/analise-dados')}
          >
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mr-4">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <div className="text-left">
              <div className="font-bold text-base">Análise</div>
              <div className="text-sm opacity-90">Dados e Resultados</div>
            </div>
          </Button>
        </nav>
        <div className="p-8 border-t border-gray-100">
          <div className="text-xs text-gray-500 text-center">
            <p className="font-medium">Sistema de Previsão</p>
            <p className="opacity-70">Versão 1.0</p>
          </div>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="flex-1 flex flex-col overflow-hidden">
      <Toaster />
      
        {/* Header */}
        <header className="bg-[#176B87] shadow-xl flex-shrink-0">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="lg:hidden w-8"></div>
                <div className="w-8 h-8 bg-white/20 rounded-2xl flex items-center justify-center shadow-lg backdrop-blur-sm">
                  <BarChart3 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white tracking-tight">Análise de Dados</h1>
                  <p className="text-slate-300 text-xs">Comparação de Previsões e Cálculos Realizados</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-xs">Online</span>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto bg-gradient-to-br from-[#176B87]/5 via-[#145A6B]/10 to-[#124C5F]/15">
          <div className="container mx-auto px-4 py-6">
        <Card className="bg-white/90 backdrop-blur-sm shadow-xl border-0 rounded-2xl">
          <CardHeader className="bg-gradient-to-r from-[#124C5F] to-[#176B87] text-white rounded-t-2xl p-2">
            {/* Seção de Filtros Compacta */}
            <div className="p-2">
              <div className="flex items-center gap-2 mb-2">
                <Filter className="w-4 h-4 text-white/80" />
                <h3 className="text-sm font-semibold text-white">Filtros</h3>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6 flex-wrap">
                  {/* Filtro por SKU */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-white/80 whitespace-nowrap">Código SKU</label>
                    <div className="relative w-64">
                      <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-white/60 w-3 h-3" />
                      <Input
                        placeholder="Digite o código..."
                        value={skuFilter}
                        onChange={(e) => handleSkuFilterChange(e.target.value)}
                        className="pl-7 pr-7 bg-white/10 border-white/20 text-white placeholder:text-white/60 focus:bg-white/20 focus:border-white/40 h-10 text-lg transition-all duration-200 w-full"
                        autoComplete="off"
                        spellCheck={false}
                      />
                      {skuFilter && (
                        <button
                          onClick={clearSkuFilter}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-white/60 hover:text-white transition-colors"
                          type="button"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Filtro por Família (Checkboxes) */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-white/80 whitespace-nowrap">Família SKU</label>
                    <div className="w-64">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:border-white/40 h-10 text-sm transition-all duration-200 w-full justify-between"
                          >
                            <span className="truncate">
                              {familiaSelectFilter.length === 0 
                                ? "Selecione famílias..." 
                                : `${familiaSelectFilter.length} selecionada(s)`
                              }
                            </span>
                            <ChevronDown className="w-3 h-3 ml-2 flex-shrink-0" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48 p-2 bg-slate-800 border-slate-700">
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {familiaOptions.map((familia) => (
                              <div key={familia} className="flex items-center space-x-2">
                                <Checkbox
                                  id={familia}
                                  checked={familiaSelectFilter.includes(familia)}
                                  onCheckedChange={(checked) => handleFamiliaSelectChange(familia, checked as boolean)}
                                  className="border-white/20 data-[state=checked]:bg-white data-[state=checked]:border-white"
                                />
                                <label
                                  htmlFor={familia}
                                  className="text-sm text-white cursor-pointer flex-1"
                                >
                                  {familia}
                                </label>
                              </div>
                            ))}
                          </div>
                          {familiaSelectFilter.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-slate-600">
                              <Button
                                onClick={clearFamiliaSelectFilter}
                                variant="outline"
                                size="sm"
                                className="w-full h-6 text-xs bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
                              >
                                Limpar Seleção
                              </Button>
                            </div>
                          )}
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>
                
                {/* Botão Exportar no centro-direita */}
                <div className="flex items-center">
                  <Button
                    onClick={handleSaveAndExport}
                    disabled={isSaving || dadosProcessados.length === 0}
                    variant="outline"
                    size="lg"
                    className="bg-[#172133] border-[#172133] text-white hover:bg-[#0f1a2a] hover:border-[#0f1a2a] h-12 w-12 p-0 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed rounded-lg"
                    title={isSaving ? 'Salvando...' : 'Salvar e Exportar'}
                  >
                    {isSaving ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    ) : (
                      <Download className="w-6 h-6" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-6">
            <div className="rounded-lg border border-slate-200 h-[637px] flex flex-col">
              <div className="sticky top-0 bg-[#39ca96] z-50 border-b-2 border-[#39ca96]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#39ca96]">
                      <TableHead className="font-semibold text-white bg-[#278190] border-r border-white/20 text-sm w-32">
                        <div className="flex items-center justify-between">
                          <span>Código Item</span>
                          <div className="flex flex-col">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-4 w-4 p-0 text-white hover:text-white/80 hover:bg-white/20"
                              onClick={() => handleSort('sku')}
                            >
                              <ArrowUpDown className="w-3 h-3" />
                            </Button>
                            {sortField === 'sku' && (
                              <div className="text-xs text-slate-300 mt-1">
                                {sortDirection === 'asc' ? '↑' : '↓'}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableHead>
                      <TableHead className="font-semibold text-white bg-[#278190] border-r border-white/20 text-sm w-20">
                        <div className="flex items-center justify-between">
                          <span>Família</span>
                          <div className="flex flex-col">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-4 w-4 p-0 text-white hover:text-white/80 hover:bg-white/20"
                              onClick={() => handleSort('fml_item')}
                            >
                              <ArrowUpDown className="w-3 h-3" />
                            </Button>
                            {sortField === 'fml_item' && (
                              <div className="text-xs text-slate-300 mt-1">
                                {sortDirection === 'asc' ? '↑' : '↓'}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableHead>
                      <TableHead className="font-semibold text-white bg-[#278190] border-r border-white/20 text-sm w-24">
                        <div className="flex items-center justify-between">
                          <span>Média Atual</span>
                          <div className="flex flex-col">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-4 w-4 p-0 text-white hover:text-white/80 hover:bg-white/20"
                              onClick={() => handleSort('media_prevista')}
                            >
                              <ArrowUpDown className="w-3 h-3" />
                            </Button>
                            {sortField === 'media_prevista' && (
                              <div className="text-xs text-slate-300 mt-1">
                                {sortDirection === 'asc' ? '↑' : '↓'}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableHead>
                      <TableHead className="font-semibold text-white bg-[#278190] border-r border-white/20 text-sm w-24">
                        <div className="flex items-center justify-between">
                          <span>Data Implant.</span>
                          <div className="flex flex-col">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-4 w-4 p-0 text-white hover:text-white/80 hover:bg-white/20"
                              onClick={() => handleSort('dt_implant')}
                            >
                              <ArrowUpDown className="w-3 h-3" />
                            </Button>
                            {sortField === 'dt_implant' && (
                              <div className="text-xs text-slate-300 mt-1">
                                {sortDirection === 'asc' ? '↑' : '↓'}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableHead>
                      <TableHead className="font-semibold text-white bg-[#278190] border-r border-white/20 text-sm w-28">
                        <div className="flex items-center justify-between">
                          <span>Cálculo Realizado</span>
                          <div className="flex flex-col">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-4 w-4 p-0 text-white hover:text-white/80 hover:bg-white/20"
                              onClick={() => handleSort('calculo_realizado')}
                            >
                              <ArrowUpDown className="w-3 h-3" />
                            </Button>
                            {sortField === 'calculo_realizado' && (
                              <div className="text-xs text-slate-300 mt-1">
                                {sortDirection === 'asc' ? '↑' : '↓'}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableHead>
                      <TableHead className="font-semibold text-white bg-[#278190] border-r border-white/20 text-sm w-24">
                        <div className="flex items-center justify-between">
                          <span>Diferença (%)</span>
                          <div className="flex flex-col">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-4 w-4 p-0 text-white hover:text-white/80 hover:bg-white/20"
                              onClick={() => handleSort('diferenca')}
                            >
                              <ArrowUpDown className="w-3 h-3" />
                            </Button>
                            {sortField === 'diferenca' && (
                              <div className="text-xs text-slate-300 mt-1">
                                {sortDirection === 'asc' ? '↑' : '↓'}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableHead>
                      <TableHead className="font-semibold text-white bg-[#278190] text-sm w-20 text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                </Table>
              </div>
              <div 
                className="flex-1 overflow-auto"
                style={{ height: containerHeight }}
                onScroll={handleScroll}
              >
                <div style={{ height: virtualizedData.totalHeight, position: 'relative' }}>
                  <Table>
                    <TableHeader className="sr-only">
                      <TableRow>
                        <TableHead className="w-32">Código Item</TableHead>
                        <TableHead className="w-20">Família</TableHead>
                        <TableHead className="w-24">Média Atual</TableHead>
                        <TableHead className="w-24">Data Implant.</TableHead>
                        <TableHead className="w-28">Cálculo Realizado</TableHead>
                        <TableHead className="text-center w-24">Diferença (%)</TableHead>
                        <TableHead className="text-center w-20">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8">
                            <div className="flex items-center justify-center gap-3">
                              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                              <span className="text-slate-600">Carregando dados...</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        <>
                          <tr style={{ height: virtualizedData.offsetY }}></tr>
                          {virtualizedData.items.map((item) => {
                        const isCurrentYearDate = isCurrentYear(item.dt_implant)
                        return (
                          <TableRow 
                            key={item.sku} 
                            className={`h-10 transition-colors ${
                              isCurrentYearDate 
                                ? 'bg-[#C3E1DC] hover:bg-[#B8D6D0]' 
                                : 'hover:bg-slate-50/50'
                            }`}
                            style={{ height: rowHeight }}
                          >
                            <TableCell className="font-medium py-2 text-sm w-32">{item.sku}</TableCell>
                            <TableCell className="text-center py-2 text-sm w-20">{item.fml_item || '-'}</TableCell>
                            <TableCell className="text-center py-2 text-sm w-24">{item.media_prevista.toLocaleString('pt-BR', { maximumFractionDigits: 0, useGrouping: true }).replace(/,/g, '.')}</TableCell>
                            <TableCell className="text-center py-2 text-sm w-24">
                              {item.dt_implant ? item.dt_implant.split('T')[0].split('-').reverse().join('/') : '-'}
                            </TableCell>
                            <TableCell className="text-center py-2 text-sm w-28">
                              {editingRow === item.sku ? (
                                <div className="flex items-center justify-center gap-2">
                                  <Input
                                    type="number"
                                    step="1"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    className="w-20 h-6 text-sm text-center"
                                    autoFocus
                                  />
                                </div>
                              ) : (
                                <span className={item.calculo_realizado ? '' : 'text-slate-400'}>
                                  {item.calculo_realizado ? Math.round(item.calculo_realizado).toLocaleString('pt-BR', { useGrouping: true }).replace(/,/g, '.') : item.media_prevista ? Math.round(item.media_prevista).toLocaleString('pt-BR', { useGrouping: true }).replace(/,/g, '.') : '0'}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-center py-2 w-24">
                              <span className={`font-medium text-sm ${
                                item.calculo_realizado && item.calculo_realizado > 0
                                  ? item.diferencaCalculada! > 0
                                    ? 'text-green-600'
                                    : item.diferencaCalculada! < 0
                                      ? 'text-red-600'
                                      : 'text-slate-500'
                                  : 'text-slate-500'
                              }`}>
                                {item.calculo_realizado && item.calculo_realizado > 0 
                                   ? `${item.diferencaCalculada!.toFixed(1)}%`
                                   : '0.0%'
                                }
                              </span>
                            </TableCell>
                            <TableCell className="text-center py-2 w-20">
                              {editingRow === item.sku ? (
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    onClick={() => salvarEdicao(item.sku)}
                                    size="sm"
                                    variant="outline"
                                    className="h-6 w-6 p-0 bg-green-50 border-green-200 hover:bg-green-100"
                                  >
                                    <Check className="w-3 h-3 text-green-600" />
                                  </Button>
                                  <Button
                                    onClick={cancelarEdicao}
                                    size="sm"
                                    variant="outline"
                                    className="h-6 w-6 p-0 bg-red-50 border-red-200 hover:bg-red-100"
                                  >
                                    <X className="w-3 h-3 text-red-600" />
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  onClick={() => iniciarEdicao(item.sku, item.calculo_realizado)}
                                  size="sm"
                                  variant="outline"
                                  className="h-6 w-6 p-0 bg-blue-50 border-blue-200 hover:bg-blue-100"
                                >
                                  <Edit2 className="w-3 h-3 text-blue-600" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                        </>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
            

            {/* Seção de informações dos dados */}
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <span>Total de SKUs: {totalSkus.toLocaleString('pt-BR')}</span>
                <span>Exibindo: {dadosProcessados.length.toLocaleString('pt-BR')}</span>
              </div>
            </div>
            

          </CardContent>
          </Card>
          </div>
        </main>
      </div>

      {/* Popup de progresso moderno */}
      {showProgressPopup && progressState && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-500">
          <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-xl border border-white/20 w-[420px] overflow-hidden animate-in slide-in-from-bottom-6 duration-500 flex flex-col">
            {/* Header moderno */}
            <div className="px-6 py-5 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border-b border-blue-100/50">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div>
                  </div>
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-400 rounded-full animate-pulse"></div>
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-gray-800 mb-1">
                    Processando Exportação
                  </h2>
                  <p className="text-sm text-gray-500">
                    Aguarde enquanto processamos seus dados
                  </p>
                </div>
              </div>
            </div>
            
            {/* Conteúdo do progresso */}
            <div className="p-6">
              <div className="space-y-6">
                {/* Barra de progresso moderna */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Progresso</span>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                        {progressState.current}%
                      </span>
                    </div>
                  </div>
                  <div className="relative">
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2 rounded-full transition-all duration-700 ease-out relative overflow-hidden"
                        style={{ width: `${progressState.current}%` }}
                      >
                        <div className="absolute inset-0 bg-white/30 animate-pulse"></div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Status atual moderno */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-4 border border-blue-100/50">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse mt-2 flex-shrink-0"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-700 mb-1">Status Atual</p>
                      <p className="text-sm text-gray-600 leading-relaxed">
                        {progressState.message}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Popup de confirmação moderno */}
      {showResultPopup && resultPopupState && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-500">
          <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-xl border border-white/20 w-[380px] overflow-hidden animate-in slide-in-from-bottom-6 duration-500">
            {/* Header de confirmação */}
            <div className={`px-6 py-5 ${resultPopupState.success ? 'bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-b border-green-100/50' : 'bg-gradient-to-r from-red-500/10 to-rose-500/10 border-b border-red-100/50'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${resultPopupState.success ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-gradient-to-r from-red-500 to-rose-500'}`}>
                    {resultPopupState.success ? (
                      <BarChart3 className="w-6 h-6 text-white" />
                    ) : (
                      <X className="w-6 h-6 text-white" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-800">
                      {resultPopupState.success ? 'Concluído!' : 'Erro'}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {resultPopupState.success ? 'Operação realizada com sucesso' : 'Ocorreu um problema'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowResultPopup(false)}
                  className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl h-8 w-8 p-0 transition-colors"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {/* Conteúdo da confirmação */}
            <div className="p-6">
              <div className={`rounded-2xl p-4 ${resultPopupState.success ? 'bg-gradient-to-r from-green-50 to-emerald-50 border border-green-100/50' : 'bg-gradient-to-r from-red-50 to-rose-50 border border-red-100/50'}`}>
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                  {resultPopupState.message}
                </p>
              </div>
              
              {/* Botão de ação */}
              <div className="mt-6 flex justify-end">
                <Button
                  onClick={() => setShowResultPopup(false)}
                  className={`px-6 py-2 rounded-xl font-medium transition-all duration-200 ${resultPopupState.success ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-lg hover:shadow-xl' : 'bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white shadow-lg hover:shadow-xl'}`}
                >
                  Entendi
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
