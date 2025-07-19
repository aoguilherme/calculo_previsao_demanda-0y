'use client'

import { useEffect, useState, useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { TrendingUp, TrendingDown, Package, BarChart3, Calculator, Menu, Search, AlertTriangle, CheckCircle, X, ArrowUpDown, ChevronDown } from "lucide-react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

// Função debounce removida - usando filtragem instantânea

interface PrevisaoDemanda {
  sku: string
  fml_item?: string
  media_prevista: number
  dt_implant?: string
  diferencaCalculada?: number
  calculo_realizado?: number
}

type SortField = 'sku' | 'fml_item' | 'media_prevista' | 'calculo_realizado' | 'diferencaCalculada'
type SortDirection = 'asc' | 'desc'

interface DashboardData {
  totalSkus: number
  skusComVariacaoPositiva: { count: number; percentage: number; items: PrevisaoDemanda[] }
  skusComVariacaoNegativa: { count: number; percentage: number; items: PrevisaoDemanda[] }
  skusComVariacaoZero: { count: number; percentage: number; items: PrevisaoDemanda[] }
  valorTotalNegativo: number
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loadingKPIs, setLoadingKPIs] = useState(true)
  
  // Estados de busca por SKU com debounce
  const [skuFilterPositive, setSkuFilterPositive] = useState('')
  const [skuFilterNegative, setSkuFilterNegative] = useState('')
  const [debouncedSkuFilterPositive, setDebouncedSkuFilterPositive] = useState('')
  const [debouncedSkuFilterNegative, setDebouncedSkuFilterNegative] = useState('')
  
  // Estados para paginação virtual
  const [currentPagePositive, setCurrentPagePositive] = useState(1)
  const [currentPageNegative, setCurrentPageNegative] = useState(1)
  const ITEMS_PER_PAGE = 50 // Limitar renderização para melhor performance
  
  const [sidebarOpen, setSidebarOpen] = useState(false)
  
  // Estados para filtros de família
  const [familiaFilterPositive, setFamiliaFilterPositive] = useState<string[]>([])
  const [familiaFilterNegative, setFamiliaFilterNegative] = useState<string[]>([])
  
  // Estados para classificação das tabelas
  const [sortFieldPositive, setSortFieldPositive] = useState<SortField>('diferencaCalculada')
  const [sortDirectionPositive, setSortDirectionPositive] = useState<SortDirection>('desc')
  const [sortFieldNegative, setSortFieldNegative] = useState<SortField>('diferencaCalculada')
  const [sortDirectionNegative, setSortDirectionNegative] = useState<SortDirection>('asc')
  
  const router = useRouter()

  useEffect(() => {
    loadDashboardData()
  }, [])

  // Debounce para filtro SKU positivo
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSkuFilterPositive(skuFilterPositive)
      setCurrentPagePositive(1) // Reset página ao filtrar
    }, 300)
    return () => clearTimeout(timer)
  }, [skuFilterPositive])

  // Debounce para filtro SKU negativo
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSkuFilterNegative(skuFilterNegative)
      setCurrentPageNegative(1) // Reset página ao filtrar
    }, 300)
    return () => clearTimeout(timer)
  }, [skuFilterNegative])

  // Reset páginas quando filtros de família mudam
  useEffect(() => {
    setCurrentPagePositive(1)
  }, [familiaFilterPositive])

  useEffect(() => {
    setCurrentPageNegative(1)
  }, [familiaFilterNegative])

  const loadDashboardData = async () => {
    try {
      const supabase = createClient()

      // Carregar resultados de cálculos do sessionStorage (mesma lógica da página de análise)
      const savedResults = sessionStorage.getItem('calculationResults')
      let calculationResults: Record<string, number> = {}
      
      if (savedResults) {
        try {
          calculationResults = JSON.parse(savedResults)
          console.log('📋 Resultados de cálculos carregados do sessionStorage para dashboard')
        } catch (e) {
          console.warn('Erro ao parsear resultados salvos:', e)
        }
      }

      // Buscar TODOS os dados das previsões (sem limite) - mesma consulta da página de análise
      const BATCH_SIZE = 1000
      let allData: any[] = []
      let currentBatch = 0
      let hasMore = true
      
      // Carregar todos os dados em lotes para garantir que nada seja omitido
      while (hasMore) {
        const startRange = currentBatch * BATCH_SIZE
        const endRange = startRange + BATCH_SIZE - 1
        
        const { data, error } = await supabase
          .from('previsoes_demanda')
          .select('sku, media_prevista, fml_item, dt_implant')
          .order('sku')
          .range(startRange, endRange)

        if (error) {
          console.error("Erro ao carregar dados do Supabase:", error.message || error)
          setData({
            totalSkus: 0,
            skusComVariacaoPositiva: { count: 0, percentage: 0, items: [] },
            skusComVariacaoNegativa: { count: 0, percentage: 0, items: [] },
            skusComVariacaoZero: { count: 0, percentage: 0, items: [] },
            valorTotalNegativo: 0
          })
          setLoadingKPIs(false)
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
          } else {
            currentBatch++
          }
        } else {
          hasMore = false
        }
      }

      // Usar TODOS os dados carregados (não filtrar por cálculos realizados)
      // Isso garante que todos os 2560 SKUs sejam analisados nos KPIs
      const previsoes = allData.filter(item => 
        item.media_prevista != null // Apenas garantir que tem média prevista
      )

      if (!previsoes || previsoes.length === 0) {
        setData(null) // Definir como null para mostrar o aviso
        setLoadingKPIs(false)
        return
      }

      // Processar dados para o dashboard incluindo TODOS os SKUs
      const dadosProcessados = previsoes.map(item => {
        try {
          const mediaPrevista = Number(item.media_prevista) || 0
          const calculoRealizado = Number(item.calculo_realizado) || 0
          
          // Se não há cálculo realizado, considerar diferença como 0
          // Isso permite incluir todos os SKUs nos KPIs
          const diferenca = item.calculo_realizado != null ? calculoRealizado - mediaPrevista : 0
          
          return {
            ...item,
            diferenca: diferenca,
            diferencaCalculada: diferenca
          }
        } catch (error) {
          return {
            ...item,
            diferenca: 0,
            diferencaCalculada: 0
          }
        }
      })

      const totalSkus = dadosProcessados.length
      
      // Separar SKUs por tipo de variação
      const skusPositivos = dadosProcessados.filter(item => item.diferencaCalculada > 0)
      const skusNegativos = dadosProcessados.filter(item => item.diferencaCalculada < 0)
      const skusZero = dadosProcessados.filter(item => item.diferencaCalculada === 0)
      
      // Calcular valor total dos SKUs com variação negativa
      const valorTotalNegativo = skusNegativos.reduce((total, item) => {
        try {
          const valor = Number(item.media_prevista) || 0
          return total + (isNaN(valor) ? 0 : valor)
        } catch (error) {
          console.warn("Erro ao calcular valor para SKU:", item.sku, error)
          return total
        }
      }, 0)

      const dashboardData: DashboardData = {
        totalSkus,
        skusComVariacaoPositiva: {
          count: skusPositivos.length,
          percentage: totalSkus > 0 ? (skusPositivos.length / totalSkus) * 100 : 0,
          items: skusPositivos
        },
        skusComVariacaoNegativa: {
          count: skusNegativos.length,
          percentage: totalSkus > 0 ? (skusNegativos.length / totalSkus) * 100 : 0,
          items: skusNegativos
        },
        skusComVariacaoZero: {
          count: skusZero.length,
          percentage: totalSkus > 0 ? (skusZero.length / totalSkus) * 100 : 0,
          items: skusZero
        },
        valorTotalNegativo
      }

      setData(dashboardData)
    } catch (error) {
      console.error("Erro ao processar dados do dashboard:", error instanceof Error ? error.message : String(error))
      setData({
        totalSkus: 0,
        skusComVariacaoPositiva: { count: 0, percentage: 0, items: [] },
        skusComVariacaoNegativa: { count: 0, percentage: 0, items: [] },
        skusComVariacaoZero: { count: 0, percentage: 0, items: [] },
        valorTotalNegativo: 0
      })
    } finally {
      setLoadingKPIs(false)
    }
  }

  // Funções para classificação
  const handleSortPositive = useCallback((field: SortField) => {
    setSortFieldPositive(field)
    setSortDirectionPositive(prev => 
      sortFieldPositive === field && prev === 'asc' ? 'desc' : 'asc'
    )
  }, [sortFieldPositive])

  const handleSortNegative = useCallback((field: SortField) => {
    setSortFieldNegative(field)
    setSortDirectionNegative(prev => 
      sortFieldNegative === field && prev === 'asc' ? 'desc' : 'asc'
    )
  }, [sortFieldNegative])

  // Funções para filtros de família
  // Handlers otimizados para filtros de família
  const handleFamiliaPositiveChange = useCallback((familia: string, checked: boolean) => {
    setFamiliaFilterPositive(prev => {
      if (checked) {
        return [...prev, familia]
      } else {
        return prev.filter(f => f !== familia)
      }
    })
  }, [])

  const handleFamiliaNegativeChange = useCallback((familia: string, checked: boolean) => {
    setFamiliaFilterNegative(prev => {
      if (checked) {
        return [...prev, familia]
      } else {
        return prev.filter(f => f !== familia)
      }
    })
  }, [])

  const clearFamiliaPositiveFilter = useCallback(() => {
    setFamiliaFilterPositive([])
  }, [])

  const clearFamiliaNegativeFilter = useCallback(() => {
    setFamiliaFilterNegative([])
  }, [])

  // Handlers otimizados para filtros de texto (filtragem instantânea)
  const handleSearchPositiveChange = useCallback((value: string) => {
    setSkuFilterPositive(value)
  }, [])

  const handleSearchNegativeChange = useCallback((value: string) => {
    setSkuFilterNegative(value)
  }, [])

  const clearSearchPositive = useCallback(() => {
    setSkuFilterPositive('')
  }, [])

  const clearSearchNegative = useCallback(() => {
    setSkuFilterNegative('')
  }, [])

  // Opções de família baseadas nos dados de cada tabela
  const familiaOptionsPositive = useMemo(() => {
    if (!data?.skusComVariacaoPositiva.items) return []
    const familiasUnicas = new Set<string>()
    data.skusComVariacaoPositiva.items.forEach(item => {
      if (item.fml_item && item.fml_item.trim() !== '') {
        familiasUnicas.add(item.fml_item)
      }
    })
    return Array.from(familiasUnicas).sort()
  }, [data?.skusComVariacaoPositiva.items])

  const familiaOptionsNegative = useMemo(() => {
    if (!data?.skusComVariacaoNegativa.items) return []
    const familiasUnicas = new Set<string>()
    data.skusComVariacaoNegativa.items.forEach(item => {
      if (item.fml_item && item.fml_item.trim() !== '') {
        familiasUnicas.add(item.fml_item)
      }
    })
    return Array.from(familiasUnicas).sort()
  }, [data?.skusComVariacaoNegativa.items])

  // Função de ordenação removida - agora implementada diretamente nos useMemo para melhor performance

  // Dados com diferença calculada - SKUs positivos
  const dadosComDiferencaPositivos = useMemo(() => {
    if (!data?.skusComVariacaoPositiva?.items || data.skusComVariacaoPositiva.items.length === 0) {
      return []
    }
    return data.skusComVariacaoPositiva.items.map(item => ({
      ...item,
      diferencaCalculada: item.calculo_realizado 
        ? (item.media_prevista === 0 ? 0 : ((item.calculo_realizado - item.media_prevista) / item.media_prevista) * 100)
        : 0
    }))
  }, [data?.skusComVariacaoPositiva?.items])

  // Dados filtrados SKUs positivos - APENAS FILTRAGEM com debounce
  const dadosFiltradosPositivos = useMemo(() => {
    // Early return se não há dados
    if (dadosComDiferencaPositivos.length === 0) return []

    // Verificar se há filtros ativos (usando debounced)
    const hasSkuFilter = debouncedSkuFilterPositive.trim().length > 0
    const hasFamiliaFilter = familiaFilterPositive.length > 0

    if (!hasSkuFilter && !hasFamiliaFilter) {
      return dadosComDiferencaPositivos
    }

    // Pré-processar termos de filtro uma vez
    const skuTerm = hasSkuFilter ? debouncedSkuFilterPositive.toLowerCase().trim() : ''

    // Filtra em uma única passagem
    return dadosComDiferencaPositivos.filter(item => {
      if (hasSkuFilter && !item.sku.toLowerCase().includes(skuTerm)) {
        return false
      }
      if (hasFamiliaFilter && !familiaFilterPositive.includes(item.fml_item || '')) {
        return false
      }
      return true
    })
  }, [dadosComDiferencaPositivos, debouncedSkuFilterPositive, familiaFilterPositive])

  // Dados processados SKUs positivos - FILTRAGEM + ORDENAÇÃO
  const filteredPositiveSkus = useMemo(() => {
    // Early return se não há dados filtrados
    if (dadosFiltradosPositivos.length === 0) return []
    
    // Usar dados filtrados
    let filtered = dadosFiltradosPositivos
    
    // Aplicar ordenação apenas se necessário
    if (!sortFieldPositive) return filtered
    
    // Criar uma cópia para ordenação (evita mutação do array original)
    const sorted = [...filtered]
    
    sorted.sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortFieldPositive) {
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
        case 'calculo_realizado':
          aValue = a.calculo_realizado || 0
          bValue = b.calculo_realizado || 0
          break
        case 'diferencaCalculada':
          aValue = a.diferencaCalculada || 0
          bValue = b.diferencaCalculada || 0
          break
        default:
          return 0
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.localeCompare(bValue)
        return sortDirectionPositive === 'asc' ? comparison : -comparison
      } else {
        const comparison = (aValue || 0) - (bValue || 0)
        return sortDirectionPositive === 'asc' ? comparison : -comparison
      }
    })
    
    return sorted
  }, [dadosFiltradosPositivos, sortFieldPositive, sortDirectionPositive])

  // Dados paginados SKUs positivos - APENAS PARA RENDERIZAÇÃO
  const paginatedPositiveSkus = useMemo(() => {
    const startIndex = (currentPagePositive - 1) * ITEMS_PER_PAGE
    const endIndex = startIndex + ITEMS_PER_PAGE
    return filteredPositiveSkus.slice(startIndex, endIndex)
  }, [filteredPositiveSkus, currentPagePositive, ITEMS_PER_PAGE])

  // Dados com diferença calculada - SKUs negativos
  const dadosComDiferencaNegativos = useMemo(() => {
    if (!data?.skusComVariacaoNegativa?.items || data.skusComVariacaoNegativa.items.length === 0) {
      return []
    }
    return data.skusComVariacaoNegativa.items.map(item => ({
      ...item,
      diferencaCalculada: item.calculo_realizado 
        ? (item.media_prevista === 0 ? 0 : ((item.calculo_realizado - item.media_prevista) / item.media_prevista) * 100)
        : 0
    }))
  }, [data?.skusComVariacaoNegativa?.items])

  // Dados filtrados SKUs negativos - APENAS FILTRAGEM
  const dadosFiltradosNegativos = useMemo(() => {
    // Early return se não há dados
    if (dadosComDiferencaNegativos.length === 0) return []

    // Verificar se há filtros ativos (usando debounced)
    const hasSkuFilter = debouncedSkuFilterNegative.trim().length > 0
    const hasFamiliaFilter = familiaFilterNegative.length > 0

    if (!hasSkuFilter && !hasFamiliaFilter) {
      return dadosComDiferencaNegativos
    }

    // Pré-processar termos de filtro uma vez
    const skuTerm = hasSkuFilter ? debouncedSkuFilterNegative.toLowerCase().trim() : ''

    // Filtra em uma única passagem
    return dadosComDiferencaNegativos.filter(item => {
      if (hasSkuFilter && !item.sku.toLowerCase().includes(skuTerm)) {
        return false
      }
      if (hasFamiliaFilter && !familiaFilterNegative.includes(item.fml_item || '')) {
        return false
      }
      return true
    })
  }, [dadosComDiferencaNegativos, debouncedSkuFilterNegative, familiaFilterNegative])

  // Dados processados SKUs negativos - FILTRAGEM + ORDENAÇÃO
  const filteredNegativeSkus = useMemo(() => {
    // Early return se não há dados filtrados
    if (dadosFiltradosNegativos.length === 0) return []
    
    // Usar dados filtrados
    let filtered = dadosFiltradosNegativos
    
    // Aplicar ordenação apenas se necessário
    if (!sortFieldNegative) return filtered
    
    // Criar uma cópia para ordenação (evita mutação do array original)
    const sorted = [...filtered]
    
    sorted.sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortFieldNegative) {
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
        case 'calculo_realizado':
          aValue = a.calculo_realizado || 0
          bValue = b.calculo_realizado || 0
          break
        case 'diferencaCalculada':
          aValue = a.diferencaCalculada || 0
          bValue = b.diferencaCalculada || 0
          break
        default:
          return 0
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.localeCompare(bValue)
        return sortDirectionNegative === 'asc' ? comparison : -comparison
      } else {
        const comparison = (aValue || 0) - (bValue || 0)
        return sortDirectionNegative === 'asc' ? comparison : -comparison
      }
    })
    
    return sorted
  }, [dadosFiltradosNegativos, sortFieldNegative, sortDirectionNegative])

  // Dados paginados SKUs negativos - APENAS PARA RENDERIZAÇÃO
  const paginatedNegativeSkus = useMemo(() => {
    const startIndex = (currentPageNegative - 1) * ITEMS_PER_PAGE
    const endIndex = startIndex + ITEMS_PER_PAGE
    return filteredNegativeSkus.slice(startIndex, endIndex)
  }, [filteredNegativeSkus, currentPageNegative, ITEMS_PER_PAGE])

  // Componente de loading para KPIs individuais
  const KPILoadingCard = ({ title, icon }: { title: string; icon: React.ReactNode }) => (
    <Card className="bg-white/90 backdrop-blur-sm shadow-xl border-0 rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center h-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#176B87]"></div>
        </div>
        <p className="text-xs text-gray-500 mt-1">Carregando...</p>
      </CardContent>
    </Card>
  )

  // Mostrar aviso quando não há dados calculados (apenas se não está carregando)
  const showNoDataMessage = !loadingKPIs && !data

  return (
    <div className="h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex overflow-hidden">
      {/* Menu Lateral Mobile */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="icon"
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
                className="w-full justify-start h-14 bg-gray-50 text-gray-700 hover:bg-[#176B87]/10 hover:text-[#176B87] border border-gray-100 shadow-sm rounded-2xl transition-all duration-300 transform hover:scale-[1.02]"
                onClick={() => {
                  router.push('/analise-dados')
                  setSidebarOpen(false)
                }}
              >
                <div className="w-10 h-10 bg-[#176B87]/10 rounded-xl flex items-center justify-center mr-4">
                  <BarChart3 className="h-5 w-5 text-[#176B87]" />
                </div>
                <div className="text-left">
                  <div className="font-bold text-base">Análise</div>
                  <div className="text-sm opacity-70">Dados e Resultados</div>
                </div>
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start h-14 bg-gradient-to-r from-[#176B87] to-[#145A6B] text-white hover:from-[#145A6B] hover:to-[#124C5F] shadow-lg rounded-2xl transition-all duration-300 transform hover:scale-[1.02]"
              >
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mr-4">
                  <BarChart3 className="h-5 w-5 text-white" />
                </div>
                <div className="text-left">
                  <div className="font-bold text-base">Dashboard</div>
                  <div className="text-sm opacity-90">KPIs e Análises</div>
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
            className="w-full justify-start h-14 bg-gray-50 text-gray-700 hover:bg-[#176B87]/10 hover:text-[#176B87] border border-gray-100 shadow-sm rounded-2xl transition-all duration-300 transform hover:scale-[1.02]"
            onClick={() => router.push('/analise-dados')}
          >
            <div className="w-10 h-10 bg-[#176B87]/10 rounded-xl flex items-center justify-center mr-4">
              <BarChart3 className="h-5 w-5 text-[#176B87]" />
            </div>
            <div className="text-left">
              <div className="font-bold text-base">Análise</div>
              <div className="text-sm opacity-70">Dados e Resultados</div>
            </div>
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start h-14 bg-gradient-to-r from-[#176B87] to-[#145A6B] text-white hover:from-[#145A6B] hover:to-[#124C5F] shadow-lg rounded-2xl transition-all duration-300 transform hover:scale-[1.02]"
          >
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mr-4">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <div className="text-left">
              <div className="font-bold text-base">Dashboard</div>
              <div className="text-sm opacity-90">KPIs e Análises</div>
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
        {/* Header */}
        <header className="bg-[#176B87] shadow-xl flex-shrink-0">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/20 rounded-2xl flex items-center justify-center shadow-lg backdrop-blur-sm">
                  <BarChart3 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white tracking-tight">Dashboard Analítico</h1>
                  <p className="text-slate-300 text-xs">KPIs e Análises de Variação de Demanda</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-slate-300">
                  <div className="w-2 h-2 bg-green-300 rounded-full animate-pulse"></div>
                  <span className="text-xs">Online</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto bg-gradient-to-br from-[#176B87]/5 via-[#145A6B]/10 to-[#124C5F]/15">
          <div className="container mx-auto px-4 py-6">
            {/* Mostrar aviso quando não há dados calculados */}
            {showNoDataMessage ? (
              <div className="flex items-center justify-center h-full min-h-[60vh]">
                <div className="text-center max-w-md mx-auto p-8">
                  <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <AlertTriangle className="w-10 h-10 text-orange-500" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-4">Nenhum Dado Disponível</h2>
                  <p className="text-gray-600 mb-6">
                    Para visualizar o dashboard, é necessário realizar cálculos de previsão de demanda primeiro.
                  </p>
                  <Button
                    onClick={() => router.push('/')}
                    className="bg-[#176B87] hover:bg-[#145A6B] text-white px-6 py-3 rounded-lg font-medium transition-colors"
                  >
                    <Calculator className="w-5 h-5 mr-2" />
                    Ir para Cálculo
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* KPIs Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Total SKUs */}
                  {loadingKPIs ? (
                    <KPILoadingCard 
                      title="Total de SKUs Analisados" 
                      icon={<Package className="h-5 w-5 text-[#176B87]" />} 
                    />
                  ) : (
                    <Card className="bg-white/90 backdrop-blur-sm shadow-xl border-0 rounded-2xl">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-600">Total de SKUs Analisados</CardTitle>
                        <Package className="h-5 w-5 text-[#176B87]" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-[#176B87]">{data?.totalSkus.toLocaleString('pt-BR')}</div>
                        <p className="text-xs text-gray-500 mt-1">SKUs com cálculo realizado</p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Variação Positiva */}
                  {loadingKPIs ? (
                    <KPILoadingCard 
                      title="Variação Positiva (>0%)" 
                      icon={<TrendingUp className="h-5 w-5 text-green-600" />} 
                    />
                  ) : (
                    <Card className="bg-white/90 backdrop-blur-sm shadow-xl border-0 rounded-2xl">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-600">Variação Positiva ({'>'}0%)</CardTitle>
                        <TrendingUp className="h-5 w-5 text-green-600" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-green-600">{data?.skusComVariacaoPositiva.count.toLocaleString('pt-BR')}</div>
                        <p className="text-xs text-gray-500 mt-1">{data?.skusComVariacaoPositiva.percentage.toFixed(1)}% do total</p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Variação Negativa */}
                  {loadingKPIs ? (
                    <KPILoadingCard 
                      title="Variação Negativa (<0%)" 
                      icon={<TrendingDown className="h-5 w-5 text-red-600" />} 
                    />
                  ) : (
                    <Card className="bg-white/90 backdrop-blur-sm shadow-xl border-0 rounded-2xl">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-600">Variação Negativa ({'<'}0%)</CardTitle>
                        <TrendingDown className="h-5 w-5 text-red-600" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-red-600">{data?.skusComVariacaoNegativa.count.toLocaleString('pt-BR')}</div>
                        <p className="text-xs text-gray-500 mt-1">{data?.skusComVariacaoNegativa.percentage.toFixed(1)}% do total</p>
                        </CardContent>
                    </Card>
                  )}

                  {/* Variação Zero */}
                  {loadingKPIs ? (
                    <KPILoadingCard 
                      title="SKUs sem variação (= 0%)" 
                      icon={<CheckCircle className="h-5 w-5 text-blue-600" />} 
                    />
                  ) : (
                    <Card className="bg-white/90 backdrop-blur-sm shadow-xl border-0 rounded-2xl">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-600">SKUs sem variação(= 0%)</CardTitle>
                        <CheckCircle className="h-5 w-5 text-blue-600" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-blue-600">{data?.skusComVariacaoZero.count.toLocaleString('pt-BR')}</div>
                        <p className="text-xs text-gray-500 mt-1">{data?.skusComVariacaoZero.percentage.toFixed(1)}% do total</p>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Tabelas */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Tabela SKUs com Variação Positiva */}
                  <Card className="bg-white/90 backdrop-blur-sm shadow-xl border-0 rounded-2xl">
                    <CardHeader className="bg-gradient-to-r from-green-600 to-green-700 text-white rounded-t-2xl">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                          <TrendingUp className="w-5 h-5" />
                          SKUs com Variação Positiva
                        </CardTitle>
                        <div className="text-sm bg-white/20 px-3 py-1 rounded-full">
                          {filteredPositiveSkus.length} itens
                        </div>
                      </div>
                      <div className="mt-3">
                        {/* Filtros em linha */}
                        <div className="flex gap-3">
                          {/* Filtro SKU */}
                          <div className="flex-1">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/60 w-4 h-4" />
                              <Input
                                placeholder="Buscar SKU..."
                                value={skuFilterPositive}
                                onChange={(e) => handleSearchPositiveChange(e.target.value)}
                                className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/60 focus:bg-white/20 focus:border-white/40"
                              />
                              {skuFilterPositive && (
                                <button
                                  onClick={clearSearchPositive}
                                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/60 hover:text-white transition-colors"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                          
                          {/* Filtro Família */}
                          <div className="flex-1">
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:border-white/40 h-10 text-sm transition-all duration-200 w-full justify-between"
                                >
                                  <span className="truncate">
                                    {familiaFilterPositive.length === 0 
                                      ? "Selecione famílias..." 
                                      : `${familiaFilterPositive.length} selecionada(s)`
                                    }
                                  </span>
                                  <ChevronDown className="w-3 h-3 ml-2 flex-shrink-0" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-48 p-2 bg-slate-800 border-slate-700">
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                  {familiaOptionsPositive.map((familia) => (
                                    <div key={familia} className="flex items-center space-x-2">
                                      <Checkbox
                                        id={`pos-${familia}`}
                                        checked={familiaFilterPositive.includes(familia)}
                                        onCheckedChange={(checked) => handleFamiliaPositiveChange(familia, checked as boolean)}
                                        className="border-white/20 data-[state=checked]:bg-white data-[state=checked]:border-white"
                                      />
                                      <label
                                        htmlFor={`pos-${familia}`}
                                        className="text-sm text-white cursor-pointer flex-1"
                                      >
                                        {familia}
                                      </label>
                                    </div>
                                  ))}
                                </div>
                                {familiaFilterPositive.length > 0 && (
                                  <div className="mt-2 pt-2 border-t border-slate-600">
                                    <Button
                                      onClick={clearFamiliaPositiveFilter}
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
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="h-[500px] overflow-y-auto">
                        <div className="sticky top-0 bg-gray-50 z-50 border-b border-gray-200">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="font-semibold text-gray-700 text-sm w-32">
                                  <div className="flex items-center justify-between">
                                    <span>SKU</span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-4 w-4 p-0 text-gray-700 hover:text-gray-900"
                                      onClick={() => handleSortPositive('sku')}
                                    >
                                      <ArrowUpDown className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </TableHead>
                                <TableHead className="font-semibold text-gray-700 text-sm w-20 text-center">
                                  <div className="flex items-center justify-center">
                                    <span>Família</span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-4 w-4 p-0 text-gray-700 hover:text-gray-900 ml-2"
                                      onClick={() => handleSortPositive('fml_item')}
                                    >
                                      <ArrowUpDown className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </TableHead>
                                <TableHead className="font-semibold text-gray-700 text-sm w-24 text-center">
                                  <div className="flex items-center justify-center">
                                    <span>Média Atual</span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-4 w-4 p-0 text-gray-700 hover:text-gray-900 ml-2"
                                      onClick={() => handleSortPositive('media_prevista')}
                                    >
                                      <ArrowUpDown className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </TableHead>
                                <TableHead className="font-semibold text-gray-700 text-sm w-28 text-center">
                                  <div className="flex items-center justify-center">
                                    <span>Cálculo Realizado</span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-4 w-4 p-0 text-gray-700 hover:text-gray-900 ml-2"
                                      onClick={() => handleSortPositive('calculo_realizado')}
                                    >
                                      <ArrowUpDown className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </TableHead>
                                <TableHead className="font-semibold text-gray-700 text-sm w-24 text-center">
                                  <div className="flex items-center justify-center">
                                    <span>Variação (%)</span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-4 w-4 p-0 text-gray-700 hover:text-gray-900 ml-2"
                                      onClick={() => handleSortPositive('diferencaCalculada')}
                                    >
                                      <ArrowUpDown className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                          </Table>
                        </div>
                        <Table>
                          <TableBody>
                            {filteredPositiveSkus.length > 0 ? (
                              filteredPositiveSkus.map((item, index) => (
                                <TableRow key={index} className="hover:bg-green-50">
                                  <TableCell className="font-medium py-2 text-sm w-32">{item.sku}</TableCell>
                                  <TableCell className="text-center py-2 text-sm w-20">{item.fml_item || '-'}</TableCell>
                                  <TableCell className="text-center py-2 text-sm w-24">
                                    {Number(item.media_prevista || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                                  </TableCell>
                                  <TableCell className="text-center py-2 text-sm w-28">
                                    {Number(item.calculo_realizado || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                                  </TableCell>
                                  <TableCell className="text-center py-2 text-sm w-24">
                                    <span className="font-medium text-green-600">
                                      +{item.diferencaCalculada?.toFixed(1)}%
                                    </span>
                                  </TableCell>
                                </TableRow>
                              ))
                            ) : (
                              <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                                  {skuFilterPositive ? 'Nenhum SKU encontrado' : 'Nenhum SKU com variação positiva'}
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Tabela SKUs com Variação Negativa */}
                  <Card className="bg-white/90 backdrop-blur-sm shadow-xl border-0 rounded-2xl">
                    <CardHeader className="bg-gradient-to-r from-red-600 to-red-700 text-white rounded-t-2xl">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                          <TrendingDown className="w-5 h-5" />
                          SKUs com Variação Negativa
                        </CardTitle>
                        <div className="text-sm bg-white/20 px-3 py-1 rounded-full">
                          {filteredNegativeSkus.length} itens
                        </div>
                      </div>
                      <div className="mt-3">
                        {/* Filtros em linha */}
                        <div className="flex gap-3">
                          {/* Filtro SKU */}
                          <div className="flex-1">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/60 w-4 h-4" />
                              <Input
                                placeholder="Buscar SKU..."
                                value={skuFilterNegative}
                                onChange={(e) => handleSearchNegativeChange(e.target.value)}
                                className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/60 focus:bg-white/20 focus:border-white/40"
                              />
                              {skuFilterNegative && (
                                <button
                                  onClick={clearSearchNegative}
                                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/60 hover:text-white transition-colors"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                          
                          {/* Filtro Família */}
                          <div className="flex-1">
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:border-white/40 h-10 text-sm transition-all duration-200 w-full justify-between"
                                >
                                  <span className="truncate">
                                    {familiaFilterNegative.length === 0 
                                      ? "Selecione famílias..." 
                                      : `${familiaFilterNegative.length} selecionada(s)`
                                    }
                                  </span>
                                  <ChevronDown className="w-3 h-3 ml-2 flex-shrink-0" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-48 p-2 bg-slate-800 border-slate-700">
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                  {familiaOptionsNegative.map((familia) => (
                                    <div key={familia} className="flex items-center space-x-2">
                                      <Checkbox
                                        id={`neg-${familia}`}
                                        checked={familiaFilterNegative.includes(familia)}
                                        onCheckedChange={(checked) => handleFamiliaNegativeChange(familia, checked as boolean)}
                                        className="border-white/20 data-[state=checked]:bg-white data-[state=checked]:border-white"
                                      />
                                      <label
                                        htmlFor={`neg-${familia}`}
                                        className="text-sm text-white cursor-pointer flex-1"
                                      >
                                        {familia}
                                      </label>
                                    </div>
                                  ))}
                                </div>
                                {familiaFilterNegative.length > 0 && (
                                  <div className="mt-2 pt-2 border-t border-slate-600">
                                    <Button
                                      onClick={clearFamiliaNegativeFilter}
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
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="h-[500px] overflow-y-auto">
                        <div className="sticky top-0 bg-gray-50 z-50 border-b border-gray-200">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="font-semibold text-gray-700 text-sm w-32">
                                  <div className="flex items-center justify-between">
                                    <span>SKU</span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-4 w-4 p-0 text-gray-700 hover:text-gray-900"
                                      onClick={() => handleSortNegative('sku')}
                                    >
                                      <ArrowUpDown className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </TableHead>
                                <TableHead className="font-semibold text-gray-700 text-sm w-20 text-center">
                                  <div className="flex items-center justify-center">
                                    <span>Família</span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-4 w-4 p-0 text-gray-700 hover:text-gray-900 ml-2"
                                      onClick={() => handleSortNegative('fml_item')}
                                    >
                                      <ArrowUpDown className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </TableHead>
                                <TableHead className="font-semibold text-gray-700 text-sm w-24 text-center">
                                  <div className="flex items-center justify-center">
                                    <span>Média Atual</span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-4 w-4 p-0 text-gray-700 hover:text-gray-900 ml-2"
                                      onClick={() => handleSortNegative('media_prevista')}
                                    >
                                      <ArrowUpDown className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </TableHead>
                                <TableHead className="font-semibold text-gray-700 text-sm w-28 text-center">
                                  <div className="flex items-center justify-center">
                                    <span>Cálculo Realizado</span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-4 w-4 p-0 text-gray-700 hover:text-gray-900 ml-2"
                                      onClick={() => handleSortNegative('calculo_realizado')}
                                    >
                                      <ArrowUpDown className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </TableHead>
                                <TableHead className="font-semibold text-gray-700 text-sm w-24 text-center">
                                  <div className="flex items-center justify-center">
                                    <span>Variação (%)</span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-4 w-4 p-0 text-gray-700 hover:text-gray-900 ml-2"
                                      onClick={() => handleSortNegative('diferencaCalculada')}
                                    >
                                      <ArrowUpDown className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                          </Table>
                        </div>
                        <Table>
                          <TableBody>
                            {filteredNegativeSkus.length > 0 ? (
                              filteredNegativeSkus.map((item, index) => (
                                <TableRow key={index} className="hover:bg-red-50">
                                  <TableCell className="font-medium py-2 text-sm w-32">{item.sku}</TableCell>
                                  <TableCell className="text-center py-2 text-sm w-20">{item.fml_item || '-'}</TableCell>
                                  <TableCell className="text-center py-2 text-sm w-24">
                                    {Number(item.media_prevista || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                                  </TableCell>
                                  <TableCell className="text-center py-2 text-sm w-28">
                                    {Number(item.calculo_realizado || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                                  </TableCell>
                                  <TableCell className="text-center py-2 text-sm w-24">
                                    <span className="font-medium text-red-600">
                                      {item.diferencaCalculada?.toFixed(1)}%
                                    </span>
                                  </TableCell>
                                </TableRow>
                              ))
                            ) : (
                              <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                                  {skuFilterNegative ? 'Nenhum SKU encontrado' : 'Nenhum SKU com variação negativa'}
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}