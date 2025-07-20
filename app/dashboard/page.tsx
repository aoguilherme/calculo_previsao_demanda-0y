'use client'

import { useEffect, useState, useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { TrendingUp, TrendingDown, Package, BarChart3, Calculator, Search, AlertTriangle, CheckCircle, X, ArrowUpDown, ChevronDown, Filter, Table2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import SharedLayout from "@/components/shared-layout"

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
  skusPrimeiraMedia: { count: number; percentage: number; items: PrevisaoDemanda[] }
  valorTotalNegativo: number
}

// Componente de loading para KPIs individuais
const KPILoadingCard = ({ title, icon }: { title: string; icon: React.ReactNode }) => {
  return (
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
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loadingKPIs, setLoadingKPIs] = useState(true)
  const [tableLoaded, setTableLoaded] = useState(false)
  
  // Estados para filtros da tabela unificada
  const [skuFilter, setSkuFilter] = useState('')
  const [debouncedSkuFilter, setDebouncedSkuFilter] = useState('')
  const [familiaFilter, setFamiliaFilter] = useState<string[]>([])
  
  // Estado para o filtro de radio (tipo de variação)
  const [variationFilter, setVariationFilter] = useState<'positive' | 'negative' | 'zero' | 'primeira_media' | null>(null)

  // Estados para classificação da tabela unificada
  const [sortField, setSortField] = useState<SortField>('diferencaCalculada')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  
  const router = useRouter()

  // Função para verificar se uma data é do ano atual
  const isCurrentYear = useCallback((dateString: string | null | undefined) => {
    if (!dateString) return false
    const currentYear = new Date().getFullYear()
    const itemYear = new Date(dateString).getFullYear()
    return itemYear === currentYear
  }, [])

  useEffect(() => {
    loadDashboardData()
  }, [])

  // Debounce para filtro SKU unificado
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSkuFilter(skuFilter)
    }, 300)
    return () => clearTimeout(timer)
  }, [skuFilter])

  const loadDashboardData = async () => {
    try {
      setLoadingKPIs(true)
      setTableLoaded(false)
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
            skusPrimeiraMedia: { count: 0, percentage: 0, items: [] },
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
      
      // Separar SKUs com "Primeira Média" (média prevista = 0 mas tem cálculo realizado)
      const skusPrimeiraMedia = dadosProcessados.filter(item => 
        item.calculo_realizado && item.calculo_realizado > 0 && item.media_prevista === 0
      )
      
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
        skusPrimeiraMedia: {
          count: skusPrimeiraMedia.length,
          percentage: totalSkus > 0 ? (skusPrimeiraMedia.length / totalSkus) * 100 : 0,
          items: skusPrimeiraMedia
        },
        valorTotalNegativo
      }

      setData(dashboardData)
      setTableLoaded(true)
    } catch (error) {
      console.error('Erro ao carregar dados do dashboard:', error)
      setData({
        totalSkus: 0,
        skusPrimeiraMedia: { count: 0, percentage: 0, items: [] },
        skusComVariacaoPositiva: { count: 0, percentage: 0, items: [] },
        skusComVariacaoNegativa: { count: 0, percentage: 0, items: [] },
        skusComVariacaoZero: { count: 0, percentage: 0, items: [] },
        valorTotalNegativo: 0
      })
      setTableLoaded(true)
    } finally {
      setLoadingKPIs(false)
    }
  }

  const handleFamiliaChange = useCallback((familia: string, checked: boolean) => {
    setFamiliaFilter(prev => {
      if (checked) {
        return [...prev, familia]
      } else {
        return prev.filter(f => f !== familia)
      }
    })
  }, [])

  const clearFamiliaFilter = useCallback(() => {
    setFamiliaFilter([])
  }, [])

  const handleSearchChange = useCallback((value: string) => {
    setSkuFilter(value)
  }, [])

  const clearSearch = useCallback(() => {
    setSkuFilter('')
  }, [])

  // Dados unificados de todos os SKUs com diferença calculada
  const allSkusWithDifference = useMemo(() => {
    if (!data) return []
    
    const allItems = [
      ...(data.skusComVariacaoPositiva?.items || []),
      ...(data.skusComVariacaoNegativa?.items || []),
      ...(data.skusComVariacaoZero?.items || [])
    ]
    
    return allItems.map(item => ({
      ...item,
      diferencaCalculada: item.calculo_realizado 
        ? (item.media_prevista === 0 ? 0 : ((item.calculo_realizado - item.media_prevista) / item.media_prevista) * 100)
        : 0
    }))
  }, [data])

  // Dados filtrados por tipo de variação (radio)
  const filteredByVariationType = useMemo(() => {
    if (!variationFilter) return []
    
    switch (variationFilter) {
      case 'positive':
        return allSkusWithDifference.filter(item => 
          item.calculo_realizado && item.calculo_realizado > 0 && item.media_prevista > 0 && item.diferencaCalculada > 0
        )
      case 'negative':
        return allSkusWithDifference.filter(item => 
          item.calculo_realizado && item.calculo_realizado > 0 && item.media_prevista > 0 && item.diferencaCalculada < 0
        )
      case 'zero':
        return allSkusWithDifference.filter(item => 
          item.calculo_realizado && item.calculo_realizado > 0 && item.media_prevista > 0 && item.diferencaCalculada === 0
        )
      case 'primeira_media':
        return allSkusWithDifference.filter(item => 
          item.calculo_realizado && item.calculo_realizado > 0 && item.media_prevista === 0
        )
      default:
        return []
    }
  }, [allSkusWithDifference, variationFilter])

  // Dados filtrados por SKU e família
  const filteredData = useMemo(() => {
    if (filteredByVariationType.length === 0) return []

    const hasSkuFilter = debouncedSkuFilter.trim().length > 0
    const hasFamiliaFilter = familiaFilter.length > 0

    if (!hasSkuFilter && !hasFamiliaFilter) {
      return filteredByVariationType
    }

    const skuTerm = hasSkuFilter ? debouncedSkuFilter.toLowerCase().trim() : ''

    return filteredByVariationType.filter(item => {
      if (hasSkuFilter && !item.sku.toLowerCase().includes(skuTerm)) {
        return false
      }
      if (hasFamiliaFilter && !familiaFilter.includes(item.fml_item || '')) {
        return false
      }
      return true
    })
  }, [filteredByVariationType, debouncedSkuFilter, familiaFilter])

  // Dados ordenados para exibição
  const sortedData = useMemo(() => {
    if (filteredData.length === 0) return []
    
    if (!sortField) return filteredData
    
    const sorted = [...filteredData]
    
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
        return sortDirection === 'asc' ? comparison : -comparison
      } else {
        const comparison = (aValue || 0) - (bValue || 0)
        return sortDirection === 'asc' ? comparison : -comparison
      }
    })
    
    return sorted
  }, [filteredData, sortField, sortDirection])

  // Função para lidar com ordenação
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  // Opções de família baseadas nos dados filtrados por tipo de variação
  const familiaOptions = useMemo(() => {
    const familiasUnicas = new Set<string>()
    filteredByVariationType.forEach(item => {
      if (item.fml_item && item.fml_item.trim() !== '') {
        familiasUnicas.add(item.fml_item)
      }
    })
    
    return Array.from(familiasUnicas).sort()
  }, [filteredByVariationType])

  // Mostrar aviso quando não há dados calculados (apenas se não está carregando)
  const showNoDataMessage = !loadingKPIs && !data

  return (
    <SharedLayout>
      {/* Header */}
      <header className="bg-[#176B87] shadow-xl flex-shrink-0">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-2xl flex items-center justify-center shadow-lg backdrop-blur-sm">
                <TrendingUp className="w-5 h-5 text-white" />
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
              <div className="space-y-8">
                {/* KPIs Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                  {/* Total SKUs */}
                  {loadingKPIs ? (
                    <KPILoadingCard 
                      title="Total de SKUs" 
                      icon={<Package className="h-5 w-5 text-[#176B87]" />} 
                    />
                  ) : (
                    <Card className="bg-white/90 backdrop-blur-sm shadow-xl border-0 rounded-2xl hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02]">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-600">Total de SKUs</CardTitle>
                        <Package className="h-5 w-5 text-[#176B87]" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-[#176B87] mb-1">
                          {data?.totalSkus?.toLocaleString('pt-BR') || '0'}
                        </div>
                        <p className="text-xs text-gray-500">SKUs analisados</p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Variação Positiva */}
                  {loadingKPIs ? (
                    <KPILoadingCard 
                      title="Variação Positiva" 
                      icon={<TrendingUp className="h-5 w-5 text-green-600" />} 
                    />
                  ) : (
                    <Card className="bg-white/90 backdrop-blur-sm shadow-xl border-0 rounded-2xl hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02]">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-600">Variação Positiva</CardTitle>
                        <TrendingUp className="h-5 w-5 text-green-600" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-green-600 mb-1">
                          {data?.skusComVariacaoPositiva?.count?.toLocaleString('pt-BR') || '0'}
                        </div>
                        <p className="text-xs text-gray-500">
                          {data?.skusComVariacaoPositiva?.percentage?.toFixed(1) || '0'}% do total
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Variação Negativa */}
                  {loadingKPIs ? (
                    <KPILoadingCard 
                      title="Variação Negativa" 
                      icon={<TrendingDown className="h-5 w-5 text-red-600" />} 
                    />
                  ) : (
                    <Card className="bg-white/90 backdrop-blur-sm shadow-xl border-0 rounded-2xl hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02]">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-600">Variação Negativa</CardTitle>
                        <TrendingDown className="h-5 w-5 text-red-600" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-red-600 mb-1">
                          {data?.skusComVariacaoNegativa?.count?.toLocaleString('pt-BR') || '0'}
                        </div>
                        <p className="text-xs text-gray-500">
                          {data?.skusComVariacaoNegativa?.percentage?.toFixed(1) || '0'}% do total
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Sem Variação */}
                  {loadingKPIs ? (
                    <KPILoadingCard 
                      title="Sem Variação" 
                      icon={<CheckCircle className="h-5 w-5 text-blue-600" />} 
                    />
                  ) : (
                    <Card className="bg-white/90 backdrop-blur-sm shadow-xl border-0 rounded-2xl hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02]">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-600">Sem Variação</CardTitle>
                        <CheckCircle className="h-5 w-5 text-blue-600" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-blue-600 mb-1">
                          {data?.skusComVariacaoZero?.count?.toLocaleString('pt-BR') || '0'}
                        </div>
                        <p className="text-xs text-gray-500">
                          {data?.skusComVariacaoZero?.percentage?.toFixed(1) || '0'}% do total
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Primeira Média */}
                  {loadingKPIs ? (
                    <KPILoadingCard 
                      title="Primeira Média" 
                      icon={<Calculator className="h-5 w-5 text-purple-600" />} 
                    />
                  ) : (
                    <Card className="bg-white/90 backdrop-blur-sm shadow-xl border-0 rounded-2xl hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02]">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-600">Primeira Média</CardTitle>
                        <Calculator className="h-5 w-5 text-purple-600" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-purple-600 mb-1">
                          {data?.skusPrimeiraMedia?.count?.toLocaleString('pt-BR') || '0'}
                        </div>
                        <p className="text-xs text-gray-500">
                          {data?.skusPrimeiraMedia?.percentage?.toFixed(1) || '0'}% do total
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Filtros - Sempre visíveis e estáveis */}
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    {/* Filtro Tipo de Variação (Checkbox único) */}
                    <div className="relative">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-between bg-white/90 border-gray-200 hover:bg-gray-50"
                            disabled={!tableLoaded}
                          >
                            <span className="flex items-center">
                              <Filter className="mr-2 h-4 w-4" />
                              {!variationFilter
                                ? "Selecionar Tipo de Variação"
                                : variationFilter === 'positive'
                                ? "Variação Positiva"
                                : variationFilter === 'negative'
                                ? "Variação Negativa"
                                : variationFilter === 'zero'
                                ? "Sem Variação"
                                : "Primeira Média"}
                            </span>
                            <ChevronDown className="ml-2 h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-0" align="start">
                          <div className="p-4 space-y-2">
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="positive"
                                checked={variationFilter === 'positive'}
                                onCheckedChange={(checked) => {
                                  setVariationFilter(checked ? 'positive' : null)
                                }}
                              />
                              <label
                                htmlFor="positive"
                                className="text-sm font-medium leading-none cursor-pointer text-gray-900"
                              >
                                Variação Positiva
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="negative"
                                checked={variationFilter === 'negative'}
                                onCheckedChange={(checked) => {
                                  setVariationFilter(checked ? 'negative' : null)
                                }}
                              />
                              <label
                                htmlFor="negative"
                                className="text-sm font-medium leading-none cursor-pointer text-gray-900"
                              >
                                Variação Negativa
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="zero"
                                checked={variationFilter === 'zero'}
                                onCheckedChange={(checked) => {
                                  setVariationFilter(checked ? 'zero' : null)
                                }}
                              />
                              <label
                                htmlFor="zero"
                                className="text-sm font-medium leading-none cursor-pointer text-gray-900"
                              >
                                Sem Variação
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="primeira_media"
                                checked={variationFilter === 'primeira_media'}
                                onCheckedChange={(checked) => {
                                  setVariationFilter(checked ? 'primeira_media' : null)
                                }}
                              />
                              <label
                                htmlFor="primeira_media"
                                className="text-sm font-medium leading-none cursor-pointer text-gray-900"
                              >
                                Primeira Média
                              </label>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Filtro SKU */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        placeholder="Filtrar por SKU..."
                        value={skuFilter}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        className="pl-10 pr-10 bg-white/90 border-gray-200 focus:border-[#176B87] focus:ring-[#176B87]"
                        disabled={!tableLoaded}
                      />
                      {debouncedSkuFilter && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearSearch}
                          className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>

                    {/* Filtro Família */}
                    <div className="relative">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-between bg-white/90 border-gray-200 hover:bg-gray-50"
                            disabled={!tableLoaded}
                          >
                            <span className="flex items-center">
                              <Filter className="mr-2 h-4 w-4" />
                              {familiaFilter.length === 0
                                ? "Filtrar por Família"
                                : `${familiaFilter.length} família(s) selecionada(s)`}
                            </span>
                            <ChevronDown className="ml-2 h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-0" align="start">
                          <div className="max-h-64 overflow-auto p-4">
                            {familiaOptions.map((familia) => (
                              <div key={familia} className="flex items-center space-x-2 py-1">
                                <Checkbox
                                  id={familia}
                                  checked={familiaFilter.includes(familia)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      handleFamiliaChange(familia, true)
                                    } else {
                                      handleFamiliaChange(familia, false)
                                    }
                                  }}
                                />
                                <label
                                  htmlFor={familia}
                                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                >
                                  {familia}
                                </label>
                              </div>
                            ))}
                            {familiaFilter.length > 0 && (
                              <div className="mt-2 pt-2 border-t">
                                <Button
                                  onClick={() => setFamiliaFilter([])}
                                  variant="outline"
                                  size="sm"
                                  className="w-full h-6 text-xs"
                                >
                                  Limpar Seleção
                                </Button>
              </div>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>

                {/* Tabela Unificada - Sempre visível */}
                <Card className="bg-white/90 backdrop-blur-sm shadow-xl border-0 rounded-2xl">
                  <CardContent className="p-0">
                    <div className="flex flex-col h-[570px]">
                      <div className="flex-shrink-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="font-semibold text-white bg-[#278190] text-sm w-32 text-center">
                                <div className="flex items-center justify-center">
                                  <span>Código Item</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-4 w-4 p-0 text-white hover:text-white/80 hover:bg-white/20 ml-1"
                                    onClick={() => handleSort('sku')}
                                    disabled={!tableLoaded}
                                  >
                                    <ArrowUpDown className="w-3 h-3" />
                                  </Button>
                                  {sortField === 'sku' && (
                                    <div className="text-xs text-slate-300 mt-1 ml-1">
                                      {sortDirection === 'asc' ? '↑' : '↓'}
                                    </div>
                                  )}
                                </div>
                              </TableHead>
                              <TableHead className="font-semibold text-white bg-[#278190] text-sm w-20 text-center">
                                <div className="flex items-center justify-center">
                                  <span>Família</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-4 w-4 p-0 text-white hover:text-white/80 hover:bg-white/20 ml-1"
                                    onClick={() => handleSort('fml_item')}
                                    disabled={!tableLoaded}
                                  >
                                    <ArrowUpDown className="w-3 h-3" />
                                  </Button>
                                  {sortField === 'fml_item' && (
                                    <div className="text-xs text-slate-300 mt-1 ml-1">
                                      {sortDirection === 'asc' ? '↑' : '↓'}
                                    </div>
                                  )}
                                </div>
                              </TableHead>
                              <TableHead className="font-semibold text-white bg-[#278190] text-sm w-24 text-center">
                                <div className="flex items-center justify-center">
                                  <span>Média Atual</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-4 w-4 p-0 text-white hover:text-white/80 hover:bg-white/20 ml-1"
                                    onClick={() => handleSort('media_prevista')}
                                    disabled={!tableLoaded}
                                  >
                                    <ArrowUpDown className="w-3 h-3" />
                                  </Button>
                                  {sortField === 'media_prevista' && (
                                    <div className="text-xs text-slate-300 mt-1 ml-1">
                                      {sortDirection === 'asc' ? '↑' : '↓'}
                                    </div>
                                  )}
                                </div>
                              </TableHead>
                              <TableHead className="font-semibold text-white bg-[#278190] text-sm w-24 text-center">Data Implant.</TableHead>
                              <TableHead className="font-semibold text-white bg-[#278190] text-sm w-28 text-center">
                                <div className="flex items-center justify-center">
                                  <span>Cálculo Realizado</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-4 w-4 p-0 text-white hover:text-white/80 hover:bg-white/20 ml-1"
                                    onClick={() => handleSort('calculo_realizado')}
                                    disabled={!tableLoaded}
                                  >
                                    <ArrowUpDown className="w-3 h-3" />
                                  </Button>
                                  {sortField === 'calculo_realizado' && (
                                    <div className="text-xs text-slate-300 mt-1 ml-1">
                                      {sortDirection === 'asc' ? '↑' : '↓'}
                                    </div>
                                  )}
                                </div>
                              </TableHead>
                              <TableHead className="font-semibold text-white bg-[#278190] text-sm w-24 text-center">
                                <div className="flex items-center justify-center">
                                  <span>Diferença</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-4 w-4 p-0 text-white hover:text-white/80 hover:bg-white/20 ml-1"
                                    onClick={() => handleSort('diferencaCalculada')}
                                    disabled={!tableLoaded}
                                  >
                                    <ArrowUpDown className="w-3 h-3" />
                                  </Button>
                                  {sortField === 'diferencaCalculada' && (
                                    <div className="text-xs text-slate-300 mt-1 ml-1">
                                      {sortDirection === 'asc' ? '↑' : '↓'}
                                    </div>
                                  )}
                                </div>
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                        </Table>
                      </div>
                      <div className="flex-1 overflow-auto">
                        <Table>
                          <TableHeader className="sr-only">
                            <TableRow>
                              <TableHead className="w-32">Código Item</TableHead>
                              <TableHead className="w-20">Família</TableHead>
                              <TableHead className="w-24">Média Atual</TableHead>
                              <TableHead className="w-24">Data Implant.</TableHead>
                              <TableHead className="w-28">Cálculo Realizado</TableHead>
                              <TableHead className="text-center w-24">Diferença (%)</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {!tableLoaded ? (
                              // Estado de carregamento da tabela
                              Array.from({ length: 5 }).map((_, index) => (
                                <TableRow key={`loading-${index}`}>
                                  <TableCell className="text-center py-3">
                                    <div className="w-20 h-4 bg-gray-200 rounded animate-pulse mx-auto"></div>
                                  </TableCell>
                                  <TableCell className="text-center py-3">
                                    <div className="w-16 h-4 bg-gray-200 rounded animate-pulse mx-auto"></div>
                                  </TableCell>
                                  <TableCell className="text-center py-3">
                                    <div className="w-12 h-4 bg-gray-200 rounded animate-pulse mx-auto"></div>
                                  </TableCell>
                                  <TableCell className="text-center py-3">
                                    <div className="w-16 h-4 bg-gray-200 rounded animate-pulse mx-auto"></div>
                                  </TableCell>
                                  <TableCell className="text-center py-3">
                                    <div className="w-20 h-4 bg-gray-200 rounded animate-pulse mx-auto"></div>
                                  </TableCell>
                                  <TableCell className="text-center py-3">
                                    <div className="w-12 h-4 bg-gray-200 rounded animate-pulse mx-auto"></div>
                                  </TableCell>
                                </TableRow>
                              ))
                            ) : !variationFilter ? (
                              <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                                  Selecione um filtro de variação para visualizar os dados
                                </TableCell>
                              </TableRow>
                            ) : sortedData.length > 0 ? (
                              sortedData.map((item, index) => {
                                const isFirstMedia = !item.calculo_realizado || item.calculo_realizado === 0
                                const isCurrentYearRow = item.dt_implant && isCurrentYear(item.dt_implant)
                                
                                return (
                                  <TableRow key={index} className={`${
                                    isCurrentYearRow 
                                      ? 'bg-[#C3E1DC] hover:bg-[#B8D6D0]' 
                                      : 'hover:bg-gray-50'
                                  }`}>
                                    <TableCell className="font-medium py-2 text-sm text-center w-32">{item.sku}</TableCell>
                                    <TableCell className="text-center py-2 text-sm w-20">{item.fml_item || '-'}</TableCell>
                                    <TableCell className="text-center py-2 text-sm w-24">
                                      {Number(item.media_prevista || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                                    </TableCell>
                                    <TableCell className="text-center py-2 text-sm w-24">
                                      {item.dt_implant || '-'}
                                    </TableCell>
                                    <TableCell className="text-center py-2 text-sm w-28">
                                      {isFirstMedia ? (
                                        <span className="text-purple-600 font-medium">Primeira Média</span>
                                      ) : (
                                        Number(item.calculo_realizado || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })
                                      )}
                                    </TableCell>
                                    <TableCell className="text-center py-2 text-sm w-24">
                                      {isFirstMedia ? (
                                        <span className="text-purple-600 font-medium">Primeira Média</span>
                                      ) : (
                                        <span className={`font-medium ${
                                          (item.diferencaCalculada || 0) > 0 
                                            ? 'text-green-600' 
                                            : (item.diferencaCalculada || 0) < 0 
                                            ? 'text-red-600' 
                                            : 'text-gray-600'
                                        }`}>
                                          {(item.diferencaCalculada || 0) > 0 && '+'}
                                          {(item.diferencaCalculada || 0).toFixed(1)}%
                                        </span>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                )
                              })
                            ) : (
                              <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                                  Nenhum SKU encontrado com os filtros aplicados
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </main>
    </SharedLayout>
  )
}