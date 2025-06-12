"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft, TrendingUp, Package, Calendar, Target, Search, Trash2 } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"

interface DashboardData {
  totalSkus: number
  ultimaPrevisao: string
  todosSkus: Array<{ sku: string; media_prevista: number }>
  mediaGeral: number
  totalPrevisoes: number
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [filteredSkus, setFilteredSkus] = useState<Array<{ sku: string; media_prevista: number }>>([])

  useEffect(() => {
    loadDashboardData()
  }, [])

  useEffect(() => {
    if (data) {
      const filtered = data.todosSkus.filter((item) => item.sku.toLowerCase().includes(searchTerm.toLowerCase()))
      setFilteredSkus(filtered)
    }
  }, [searchTerm, data])

  const loadDashboardData = async () => {
    try {
      const supabase = createClient()

      // Buscar dados das previsões
      const { data: previsoes, error } = await supabase
        .from("previsoes_demanda")
        .select("*")
        .order("data_calculo", { ascending: false })

      if (error) {
        console.error("Erro ao carregar dados:", error)
        return
      }

      if (!previsoes || previsoes.length === 0) {
        setData({
          totalSkus: 0,
          ultimaPrevisao: "Nenhuma previsão encontrada",
          todosSkus: [],
          mediaGeral: 0,
          totalPrevisoes: 0,
        })
        return
      }

      // Calcular KPIs
      const totalSkus = new Set(previsoes.map((p) => p.sku)).size
      const ultimaPrevisao = new Date(previsoes[0].data_calculo).toLocaleDateString("pt-BR")

      // Todos os SKUs com suas últimas previsões
      const ultimasPrevisoes = previsoes.reduce(
        (acc, curr) => {
          if (!acc[curr.sku] || new Date(curr.data_calculo) > new Date(acc[curr.sku].data_calculo)) {
            acc[curr.sku] = curr
          }
          return acc
        },
        {} as Record<string, any>,
      )

      const todosSkus = Object.values(ultimasPrevisoes)
        .sort((a: any, b: any) => b.media_prevista - a.media_prevista)
        .map((p: any) => ({ sku: p.sku, media_prevista: p.media_prevista }))

      const mediaGeral = previsoes.reduce((sum, p) => sum + Number(p.media_prevista), 0) / previsoes.length

      const dashboardData = {
        totalSkus,
        ultimaPrevisao,
        todosSkus,
        mediaGeral: Math.round(mediaGeral),
        totalPrevisoes: previsoes.length,
      }

      setData(dashboardData)
      setFilteredSkus(todosSkus)
    } catch (error) {
      console.error("Erro ao carregar dashboard:", error)
    } finally {
      setLoading(false)
    }
  }

  const clearAllData = async () => {
    if (!confirm("Tem certeza que deseja excluir TODOS os dados de previsões? Esta ação não pode ser desfeita.")) {
      return
    }

    setDeleting(true)
    try {
      const supabase = createClient()

      const { error } = await supabase.from("previsoes_demanda").delete().neq("id", 0) // Deleta todos os registros

      if (error) {
        console.error("Erro ao excluir dados:", error)
        alert("Erro ao excluir os dados. Tente novamente.")
        return
      }

      // Recarregar dados após exclusão
      await loadDashboardData()
      alert("Todos os dados foram excluídos com sucesso!")
    } catch (error) {
      console.error("Erro ao excluir dados:", error)
      alert("Erro ao excluir os dados. Tente novamente.")
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Carregando dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-slate-800 text-white px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button
              variant="outline"
              className="bg-white text-slate-800 border-white hover:bg-gray-100 hover:text-slate-800"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          </Link>
          <h1 className="text-xl font-semibold">Dashboard - Análise de Previsões</h1>
        </div>
        {data && data.totalSkus > 0 && (
          <Button
            onClick={clearAllData}
            disabled={deleting}
            variant="destructive"
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {deleting ? "Excluindo..." : "Limpar Todos os Dados"}
          </Button>
        )}
      </div>

      {/* Main Content */}
      <div className="p-6">
        {data && data.totalSkus > 0 ? (
          <>
            {/* KPIs Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total de SKUs Analisados</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data.totalSkus}</div>
                  <p className="text-xs text-muted-foreground">SKUs únicos processados</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Última Previsão</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data.ultimaPrevisao}</div>
                  <p className="text-xs text-muted-foreground">Data do último cálculo</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Média Geral</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data.mediaGeral.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">Média de todas as previsões</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total de Previsões</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data.totalPrevisoes}</div>
                  <p className="text-xs text-muted-foreground">Registros de previsões</p>
                </CardContent>
              </Card>
            </div>

            {/* Filtro de Pesquisa */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Pesquisar SKUs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Digite o SKU para pesquisar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Mostrando {filteredSkus.length} de {data.totalSkus} SKUs
                </p>
              </CardContent>
            </Card>

            {/* Todos os SKUs */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Todos os SKUs Calculados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredSkus.length > 0 ? (
                    filteredSkus.map((item, index) => (
                      <div
                        key={item.sku}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-8 h-8 bg-slate-600 text-white rounded-full text-sm font-bold">
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium">{item.sku}</p>
                            <p className="text-sm text-gray-500">SKU</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-green-600">{item.media_prevista.toLocaleString()}</p>
                          <p className="text-sm text-gray-500">unidades</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">Nenhum SKU encontrado com o termo "{searchTerm}"</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Package className="h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma previsão encontrada</h3>
              <p className="text-gray-500 text-center mb-6">
                Faça o primeiro cálculo de previsão para ver os dados do dashboard.
              </p>
              <Link href="/">
                <Button className="bg-slate-600 hover:bg-slate-700">Calcular Previsão</Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
