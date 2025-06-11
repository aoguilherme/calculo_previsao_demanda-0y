'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, BarChart3, Edit2, Save, X, Search, ChevronUp, ChevronDown, ArrowUpDown, ArrowUp, ArrowDown, Filter, Check, Edit, Cancel, Download } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

interface PrevisaoDemanda {
  sku: string
  media_prevista: number
  calculo_realizado?: number
  fml_item?: string
  dt_implant?: string
}

type SortField = 'sku' | 'fml_item' | 'media_prevista' | 'dt_implant' | 'calculo_realizado' | 'diferenca'
type SortDirection = 'asc' | 'desc'

// Componente super simplificado para item do checkbox de SKU
const SkuCheckboxItem = ({ sku, isSelected, onToggle }: {
  sku: string
  isSelected: boolean
  onToggle: (sku: string) => void
}) => (
  <div className="flex items-center space-x-2 h-8 w-full">
    <Checkbox
      checked={isSelected}
      onCheckedChange={() => onToggle(sku)}
      className="shrink-0"
    />
    <label
      onClick={() => onToggle(sku)}
      className="text-sm font-medium leading-none cursor-pointer flex-1 truncate select-none"
      title={sku}
    >
      {sku}
    </label>
  </div>
)

// Componente super simplificado para item do checkbox de Família
const FamiliaCheckboxItem = ({ familia, isSelected, onToggle }: {
  familia: string
  isSelected: boolean
  onToggle: (familia: string) => void
}) => (
  <div className="flex items-center space-x-2 h-8 w-full">
    <Checkbox
      checked={isSelected}
      onCheckedChange={() => onToggle(familia)}
      className="shrink-0"
    />
    <label
      onClick={() => onToggle(familia)}
      className="text-sm font-medium leading-none cursor-pointer flex-1 truncate select-none"
      title={familia}
    >
      {familia}
    </label>
  </div>
)

export default function AnaliseDadosPage() {
  const [dados, setDados] = useState<PrevisaoDemanda[]>([])
  const [loading, setLoading] = useState(true)
  const [editingRow, setEditingRow] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [totalSkus, setTotalSkus] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [saveProgress, setSaveProgress] = useState('')
  
  // Estados para filtro e ordenação
  const [sortField, setSortField] = useState<SortField>('sku')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  
  // Estados para o checklist de SKUs
  const [skuSearchTerm, setSkuSearchTerm] = useState('')
  const [selectedSkus, setSelectedSkus] = useState<string[]>([])
  const [isSkuPopoverOpen, setIsSkuPopoverOpen] = useState(false)
  
  // Estados para o checklist de Famílias
  const [familiaSearchTerm, setFamiliaSearchTerm] = useState('')
  const [selectedFamilias, setSelectedFamilias] = useState<string[]>([])
  const [isFamiliaPopoverOpen, setIsFamiliaPopoverOpen] = useState(false)
  
  // Removido cache de filtros para eliminar overhead
  
  // Lista de SKUs únicos (otimizada com useMemo)
  const uniqueSkus = useMemo(() => {
    const skus = dados.map(item => item.sku).sort()
    return [...new Set(skus)]
  }, [dados])
  
  // Lista de Famílias únicas (otimizada com useMemo)
  const uniqueFamilias = useMemo(() => {
    const familias = dados
      .map(item => item.fml_item || '')
      .filter(familia => familia.trim() !== '')
      .sort()
    return [...new Set(familias)]
  }, [dados])
  
  // Sets simples para verificação rápida
  const selectedSkusSet = new Set(selectedSkus)
  const selectedFamiliasSet = new Set(selectedFamilias)
  
  // Reset quando o popover fecha
  useEffect(() => {
    if (!isSkuPopoverOpen) {
      setSkuSearchTerm('')
    }
  }, [isSkuPopoverOpen])
  
  useEffect(() => {
    if (!isFamiliaPopoverOpen) {
      setFamiliaSearchTerm('')
    }
  }, [isFamiliaPopoverOpen])
  
  // Não inicializar selectedSkus - deixar vazio por padrão para mostrar todos os dados
  // useEffect removido para permitir que todos os dados sejam mostrados quando nenhum SKU estiver selecionado

  // Carregar dados do Supabase
  useEffect(() => {
    carregarDados()
  }, [])

  const carregarDados = async () => {
    try {
      setLoading(true)
      
      // Verificar se há dados do cálculo no sessionStorage
      const dadosCalculoStr = sessionStorage.getItem('dadosCalculo')
      let dadosCalculo = null
      if (dadosCalculoStr) {
        try {
          dadosCalculo = JSON.parse(dadosCalculoStr)
          console.log('Dados do cálculo encontrados no sessionStorage:', dadosCalculo)
        } catch (error) {
          console.error('Erro ao parsear dados do sessionStorage:', error)
        }
      }
      
      let allData: any[] = []
      let from = 0
      const batchSize = 1000
      let hasMore = true

      // Buscar todos os dados usando paginação
      while (hasMore) {
        const { data, error } = await supabase
          .from('previsoes_demanda')
          .select('sku, media_prevista, fml_item, dt_implant')
          .order('sku')
          .range(from, from + batchSize - 1)

        if (error) {
          console.error('Erro ao carregar dados:', error)
          return
        }

        if (data && data.length > 0) {
          allData = [...allData, ...data]
          from += batchSize
          hasMore = data.length === batchSize
        } else {
          hasMore = false
        }
      }

      if (allData.length > 0) {
        // Criar um mapa dos resultados do cálculo para busca rápida
        const calculoMap = new Map()
        const familiaMap = new Map()
        if (dadosCalculo?.resultados) {
          dadosCalculo.resultados.forEach((resultado: any) => {
            calculoMap.set(resultado.sku, resultado.media)
            if (resultado.familia) {
              familiaMap.set(resultado.sku, resultado.familia)
            }
          })
        }
        
        // Adicionar campo calculo_realizado e atualizar família se disponível
        const dadosComCalculo = allData.map(item => ({
          ...item,
          calculo_realizado: calculoMap.get(item.sku) || undefined,
          fml_item: familiaMap.get(item.sku) || item.fml_item || ''
        }))
        setDados(dadosComCalculo)
        setTotalSkus(allData.length)
        
        // Limpar dados do sessionStorage após carregar
        if (dadosCalculo) {
          sessionStorage.removeItem('dadosCalculo')
        }
      }
    } catch (error) {
      console.error('Erro ao conectar com Supabase:', error)
    } finally {
      setLoading(false)
    }
  }

  // Função para calcular diferença percentual (otimizada - usa valor pré-calculado)
  const calcularDiferenca = useCallback((item: any) => {
    return item.diferencaCalculada || 0
  }, [])

  // Iniciar edição
  const iniciarEdicao = (sku: string, valorAtual?: number) => {
    setEditingRow(sku)
    setEditValue(valorAtual?.toString() || '')
  }

  // Salvar edição
  const salvarEdicao = () => {
    if (editingRow) {
      const novoValor = parseFloat(editValue)
      if (!isNaN(novoValor)) {
        setDados(prev => prev.map(item => 
          item.sku === editingRow 
            ? { ...item, calculo_realizado: novoValor }
            : item
        ))
      }
      setEditingRow(null)
      setEditValue('')
    }
  }

  // Cancelar edição
  const cancelarEdicao = () => {
    setEditingRow(null)
    setEditValue('')
  }

  // Função para salvar dados no Supabase e exportar Excel
  const handleSaveAndExport = async () => {
    if (isSaving) return
    
    setIsSaving(true)
    setSaveProgress('Preparando dados...')
    
    try {
      // 1º Passo: Salvar no Supabase
      setSaveProgress('Salvando no Supabase...')
      
      // Preparar dados para o Supabase
      const dadosParaSalvar = dadosProcessados.map(item => ({
        sku: item.sku,
        media: item.calculo_realizado || item.media_prevista,
        previsao_total: item.media_prevista,
        categoria: 'alto_volume',
        ajuste_validacao: 100,
        familia: item.fml_item || ''
      }))
      
      // Salvar no Supabase
      const { saveToSupabase } = await import('../saveToSupabase')
      const saveResult = await saveToSupabase(dadosParaSalvar, new Date())
      
      if (!saveResult.success) {
        console.warn('Erro ao salvar no Supabase:', saveResult.error)
      }
      
      // 2º Passo: Gerar e baixar arquivo Excel
      setSaveProgress('Gerando arquivo Excel...')
      
      // Preparar dados para o Excel (sem a coluna Previsão Total)
      const excelData = dadosProcessados.map(item => ({
        'SKU': item.sku,
        'Família': item.fml_item || '',
        'Media': item.calculo_realizado || item.media_prevista,
        'Categoria': 'alto_volume',
        'Ajuste Validacao (%)': 100
      }))
      
      // Criar planilha Excel usando SheetJS
      const worksheet = XLSX.utils.json_to_sheet(excelData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Análise de Dados')
      
      // Gerar arquivo Excel
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      
      // Baixar arquivo
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `analise_dados_${new Date().toISOString().split('T')[0]}.xlsx`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      setSaveProgress('✅ Dados salvos e arquivo Excel gerado com sucesso!')
      await new Promise(resolve => setTimeout(resolve, 2000))
      
    } catch (error) {
      console.error('Erro durante o processo:', error)
      setSaveProgress('❌ Erro durante o processo')
      await new Promise(resolve => setTimeout(resolve, 2000))
    } finally {
      setIsSaving(false)
      setSaveProgress('')
    }
  }

  // Função para ordenação (otimizada)
  const handleSort = useCallback((field: SortField) => {
    startTransition(() => {
      setSortField(field)
      setSortDirection(prev => 
        sortField === field && prev === 'asc' ? 'desc' : 'asc'
      )
    })
  }, [sortField])

  // Filtrar SKUs baseado na pesquisa (ultra simplificado)
  const filteredSkus = useMemo(() => {
    const searchTerm = skuSearchTerm.toLowerCase().trim()
    
    if (!searchTerm) {
      return uniqueSkus.slice(0, 50) // Mostrar apenas 50 iniciais
    }
    
    // Filtrar diretamente sem interdependências
    return uniqueSkus
      .filter(sku => sku.toLowerCase().includes(searchTerm))
      .slice(0, 30) // Limitar ainda mais para performance
  }, [uniqueSkus, skuSearchTerm])
  
  // Filtrar Famílias baseado na pesquisa (ultra simplificado)
  const filteredFamilias = useMemo(() => {
    const searchTerm = familiaSearchTerm.toLowerCase().trim()
    
    if (!searchTerm) {
      return uniqueFamilias.slice(0, 50) // Mostrar apenas 50 iniciais
    }
    
    // Filtrar diretamente sem interdependências
    return uniqueFamilias
      .filter(familia => familia.toLowerCase().includes(searchTerm))
      .slice(0, 30) // Limitar ainda mais para performance
  }, [uniqueFamilias, familiaSearchTerm])
  
  // Renderização simples sem virtualização complexa
  const displayedSkus = useMemo(() => {
    return filteredSkus.slice(0, 50) // Mostrar apenas os primeiros 50 para melhor performance
  }, [filteredSkus])
  
  const displayedFamilias = useMemo(() => {
    return filteredFamilias.slice(0, 50) // Mostrar apenas as primeiras 50 para melhor performance
  }, [filteredFamilias])
  
  // Indicador se há mais SKUs para mostrar
  const hasMoreSkus = uniqueSkus.length > (skuSearchTerm ? 30 : 50)
  
  // Indicador se há mais Famílias para mostrar
  const hasMoreFamilias = uniqueFamilias.length > (familiaSearchTerm ? 30 : 50)
  
  // Função para alternar seleção de SKU (simplificada)
  const toggleSku = (sku: string) => {
    setSelectedSkus(prev => {
      const isSelected = prev.includes(sku)
      if (isSelected) {
        return prev.filter(s => s !== sku)
      } else {
        return [...prev, sku]
      }
    })
  }
  
  // Função para alternar seleção de Família (simplificada)
  const toggleFamilia = (familia: string) => {
    setSelectedFamilias(prev => {
      const isSelected = prev.includes(familia)
      if (isSelected) {
        return prev.filter(f => f !== familia)
      } else {
        return [...prev, familia]
      }
    })
  }
  
  // Função para selecionar/deselecionar todos os SKUs (simplificada)
  const toggleAllSkus = () => {
    if (selectedSkus.length === filteredSkus.length) {
      setSelectedSkus([])
    } else {
      setSelectedSkus([...filteredSkus])
    }
  }
  
  // Função para selecionar/deselecionar todas as Famílias (simplificada)
  const toggleAllFamilias = () => {
    if (selectedFamilias.length === filteredFamilias.length) {
      setSelectedFamilias([])
    } else {
      setSelectedFamilias([...filteredFamilias])
    }
  }
  
  // Função para limpar seleção de SKUs (simplificada)
  const clearSkuSelection = () => setSelectedSkus([])

  // Função para limpar seleção de Famílias (simplificada)
  const clearFamiliaSelection = () => setSelectedFamilias([])



  // Memoizar cálculos de diferença para evitar recálculos
  const dadosComDiferenca = useMemo(() => {
    return dados.map(item => ({
      ...item,
      diferencaCalculada: item.calculo_realizado 
        ? ((item.calculo_realizado - item.media_prevista) / item.media_prevista) * 100 
        : 0
    }))
  }, [dados])

  // Função para verificar se uma data é do ano atual
  const isCurrentYear = useCallback((dateString: string | null | undefined) => {
    if (!dateString) return false
    const currentYear = new Date().getFullYear()
    const itemYear = new Date(dateString).getFullYear()
    return itemYear === currentYear
  }, [])

  // Dados filtrados e ordenados (mostrando todos os itens)
  const dadosProcessados = useMemo(() => {
    // Aplicar filtro por SKUs selecionados usando Set para O(1) lookup
    let filtered = selectedSkus.length > 0 
      ? dadosComDiferenca.filter(item => selectedSkusSet.has(item.sku))
      : dadosComDiferenca

    // Aplicar filtro por Famílias selecionadas usando Set para O(1) lookup
    if (selectedFamilias.length > 0) {
      filtered = filtered.filter(item => selectedFamiliasSet.has(item.fml_item || ''))
    }

    // Se não há dados para processar, retornar array vazio
    if (filtered.length === 0) return []

    // Criar uma cópia para ordenação (evita mutação do array original)
    const sorted = [...filtered]

    // Aplicar ordenação otimizada
    if (sortField) {
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
    }

    // Retornar todos os dados sem limitação
    return sorted
  }, [dadosComDiferenca, selectedSkus, selectedSkusSet, selectedFamilias, selectedFamiliasSet, sortField, sortDirection])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Carregando dados...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 shadow-xl">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button variant="ghost" size="sm" className="text-white hover:bg-white/10">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar
                </Button>
              </Link>
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
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
      <main className="container mx-auto px-4 py-6">
        <Card className="bg-white/90 backdrop-blur-sm shadow-xl border-0 rounded-2xl">
          <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-700 text-white rounded-t-2xl">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Popover open={isSkuPopoverOpen} onOpenChange={setIsSkuPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="w-48 justify-between bg-white/10 border-white/20 text-white hover:bg-white/20"
                    >
                      <span className="flex items-center gap-2">
                        <Search className="w-4 h-4" />
                        SKU ({selectedSkus.length > 0 ? selectedSkus.length : 'Todos'})
                      </span>
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="start">
                    <div className="p-3 border-b">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <Input
                          placeholder="Pesquisar SKU..."
                          value={skuSearchTerm}
                          onChange={(e) => setSkuSearchTerm(e.target.value)}
                          className="pl-10 pr-10"
                          autoComplete="off"
                          spellCheck={false}
                        />
                        {skuSearchTerm && (
                          <button
                            onClick={() => setSkuSearchTerm('')}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                            type="button"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <div className="p-3">
                      <div className="flex items-center justify-between mb-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={toggleAllSkus}
                          className="h-auto p-0 text-sm font-medium"
                        >
                          {filteredSkus.length > 0 && filteredSkus.every(sku => selectedSkusSet.has(sku)) 
                            ? 'Desmarcar visíveis' 
                            : 'Selecionar visíveis'
                          }
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearSkuSelection}
                          className="h-auto p-0 text-sm text-red-600 hover:text-red-700"
                        >
                          Limpar
                        </Button>
                      </div>
                      
                      <div className="max-h-64 overflow-y-auto space-y-1">
                        {displayedSkus.map((sku) => (
                          <SkuCheckboxItem
                            key={sku}
                            sku={sku}
                            isSelected={selectedSkusSet.has(sku)}
                            onToggle={toggleSku}
                          />
                        ))}
                      </div>
                      
                      {filteredSkus.length === 0 && (
                        <div className="text-center py-4 text-sm text-slate-500">
                          Nenhum SKU encontrado
                        </div>
                      )}
                      
                      {filteredSkus.length > 0 && (
                        <div className="text-center py-2 text-xs text-slate-400 border-t">
                          {`${filteredSkus.length} SKUs ${hasMoreSkus ? '(mostrando primeiros 50)' : 'encontrados'}`}
                        </div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
                
                <Popover open={isFamiliaPopoverOpen} onOpenChange={setIsFamiliaPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="w-48 justify-between bg-white/10 border-white/20 text-white hover:bg-white/20"
                    >
                      <span className="flex items-center gap-2">
                        <Filter className="w-4 h-4" />
                        Família ({selectedFamilias.length > 0 ? selectedFamilias.length : 'Todas'})
                      </span>
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="start">
                      <div className="p-3 border-b">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                          <Input
                            placeholder="Pesquisar Família..."
                            value={familiaSearchTerm}
                            onChange={(e) => setFamiliaSearchTerm(e.target.value)}
                            className="pl-10 pr-10"
                            autoComplete="off"
                            spellCheck={false}
                          />
                          {familiaSearchTerm && (
                            <button
                              onClick={() => setFamiliaSearchTerm('')}
                              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                              type="button"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      
                      <div className="p-3">
                        <div className="flex items-center justify-between mb-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={toggleAllFamilias}
                            className="h-auto p-0 text-sm font-medium"
                          >
                            {filteredFamilias.length > 0 && filteredFamilias.every(familia => selectedFamiliasSet.has(familia)) 
                              ? 'Desmarcar visíveis' 
                              : 'Selecionar visíveis'
                            }
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearFamiliaSelection}
                            className="h-auto p-0 text-sm text-red-600 hover:text-red-700"
                          >
                            Limpar
                          </Button>
                        </div>
                        
                        <div className="max-h-64 overflow-y-auto space-y-1">
                          {displayedFamilias.map((familia) => (
                            <FamiliaCheckboxItem
                              key={familia}
                              familia={familia}
                              isSelected={selectedFamiliasSet.has(familia)}
                              onToggle={toggleFamilia}
                            />
                          ))}
                        </div>
                        
                        {filteredFamilias.length === 0 && (
                          <div className="text-center py-4 text-sm text-slate-500">
                            Nenhuma Família encontrada
                          </div>
                        )}
                        
                        {filteredFamilias.length > 0 && (
                          <div className="text-center py-2 text-xs text-slate-400 border-t">
                            {`${filteredFamilias.length} Famílias ${hasMoreFamilias ? '(mostrando primeiras 50)' : 'encontradas'}`}
                          </div>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              
              <div className="flex gap-2">
                <Button
                  onClick={handleSaveAndExport}
                  disabled={isSaving || dadosProcessados.length === 0}
                  variant="outline"
                  size="sm"
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20 px-3 py-1"
                >
                  {isSaving ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-6">
            <div className="rounded-lg border border-slate-200 h-[667px] flex flex-col">
              <div className="sticky top-0 bg-slate-800 z-50 border-b-2 border-slate-600">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-800">
                      <TableHead className="font-semibold text-white bg-slate-800 border-r border-slate-700 text-sm w-32">
                        <div className="flex items-center justify-between">
                          <span>Código Item</span>
                          <div className="flex flex-col">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-4 w-4 p-0 text-white hover:text-slate-300 hover:bg-slate-700"
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
                      <TableHead className="font-semibold text-white bg-slate-800 border-r border-slate-700 text-sm w-20">
                        <div className="flex items-center justify-between">
                          <span>Família</span>
                          <div className="flex flex-col">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-4 w-4 p-0 text-white hover:text-slate-300 hover:bg-slate-700"
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
                      <TableHead className="font-semibold text-white bg-slate-800 border-r border-slate-700 text-sm w-24">
                        <div className="flex items-center justify-between">
                          <span>Média Atual</span>
                          <div className="flex flex-col">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-4 w-4 p-0 text-white hover:text-slate-300 hover:bg-slate-700"
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
                      <TableHead className="font-semibold text-white bg-slate-800 border-r border-slate-700 text-sm w-24">
                        <div className="flex items-center justify-between">
                          <span>Data Implant.</span>
                          <div className="flex flex-col">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-4 w-4 p-0 text-white hover:text-slate-300 hover:bg-slate-700"
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
                      <TableHead className="font-semibold text-white bg-slate-800 border-r border-slate-700 text-sm w-28">
                        <div className="flex items-center justify-between">
                          <span>Cálculo Realizado</span>
                          <div className="flex flex-col">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-4 w-4 p-0 text-white hover:text-slate-300 hover:bg-slate-700"
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
                      <TableHead className="font-semibold text-white bg-slate-800 border-r border-slate-700 text-sm w-24">
                        <div className="flex items-center justify-between">
                          <span>Diferença (%)</span>
                          <div className="flex flex-col">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-4 w-4 p-0 text-white hover:text-slate-300 hover:bg-slate-700"
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
                      <TableHead className="font-semibold text-white bg-slate-800 text-sm w-20 text-center">Ações</TableHead>
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
                        <TableHead className="text-center w-20">Ações</TableHead>
                     </TableRow>
                   </TableHeader>
                  <TableBody>
                    {dadosProcessados.map((item) => {
                      const isCurrentYearDate = isCurrentYear(item.dt_implant)
                      return (
                        <TableRow 
                          key={item.sku} 
                          className={`h-10 transition-colors ${
                            isCurrentYearDate 
                              ? 'bg-[#C3E1DC] hover:bg-[#B8D6D0]' 
                              : 'hover:bg-slate-50/50'
                          }`}
                        >
                        <TableCell className="font-medium py-2 text-sm w-32">{item.sku}</TableCell>
                        <TableCell className="py-2 text-sm w-20">{item.fml_item || '-'}</TableCell>
                        <TableCell className="py-2 text-sm w-24">{item.media_prevista.toLocaleString('pt-BR', { maximumFractionDigits: 0, useGrouping: true }).replace(/,/g, '.')}</TableCell>
                        <TableCell className="py-2 text-sm w-24">
                          {item.dt_implant ? item.dt_implant.split('T')[0].split('-').reverse().join('/') : '-'}
                        </TableCell>
                        <TableCell className="py-2 text-sm w-28">
                          {editingRow === item.sku ? (
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                step="0.01"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="w-20 h-6 text-sm"
                                autoFocus
                              />
                            </div>
                          ) : (
                            <span className={item.calculo_realizado ? '' : 'text-slate-400'}>
                              {item.calculo_realizado ? item.calculo_realizado.toLocaleString('pt-BR', { maximumFractionDigits: 0, useGrouping: true }).replace(/,/g, '.') : '0'}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-center py-2 w-24">
                           <span className={`font-medium text-sm ${
                             item.calculo_realizado && item.calculo_realizado > 0
                               ? item.diferencaCalculada > 0
                                 ? 'text-green-600'
                                 : item.diferencaCalculada < 0
                                   ? 'text-red-600'
                                   : 'text-slate-500'
                               : 'text-slate-500'
                           }`}>
                             {item.calculo_realizado && item.calculo_realizado > 0 
                                ? `${item.diferencaCalculada < 0 ? '-' : ''}${Math.abs(item.diferencaCalculada).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
                                : '-'
                              }
                           </span>
                         </TableCell>
                        <TableCell className="text-center py-2 w-20">
                          {editingRow === item.sku ? (
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                size="sm"
                                onClick={salvarEdicao}
                                className="h-6 w-6 p-0 bg-green-600 hover:bg-green-700"
                              >
                                <Save className="w-2 h-2" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={cancelarEdicao}
                                className="h-6 w-6 p-0"
                              >
                                <X className="w-2 h-2" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex justify-center">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => iniciarEdicao(item.sku, item.calculo_realizado)}
                                className="h-6 w-6 p-0 hover:bg-blue-100"
                              >
                                <Edit2 className="w-2 h-2" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
            
            {dadosProcessados.length === 0 && (
              <div className="text-center py-8 text-slate-500">
                <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                {selectedSkus.length > 0 ? (
                  <div>
                    <p className="mb-2">Nenhum item encontrado para os SKUs selecionados</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={clearSkuSelection}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      Limpar filtro
                    </Button>
                  </div>
                ) : (
                  <p>Nenhum dado encontrado</p>
                )}
              </div>
            )}
          </CardContent>
          

        </Card>
      </main>
    </div>
  )
}