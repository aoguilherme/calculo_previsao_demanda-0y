import SharedLayout from "@/components/shared-layout"
import { TrendingUp, Package, TrendingDown, CheckCircle, Calculator, Filter, Search, ChevronDown, ArrowUpDown } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export default function Loading() {
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
          <div className="space-y-8">
            {/* KPIs Grid - 5 cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              {/* Total SKUs */}
              <Card className="bg-white/90 backdrop-blur-sm shadow-xl border-0 rounded-2xl">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Total de SKUs</CardTitle>
                  <Package className="h-5 w-5 text-[#176B87]" />
                </CardHeader>
                <CardContent>
                  <div className="w-16 h-8 bg-gray-200 rounded animate-pulse mb-1"></div>
                  <div className="w-20 h-3 bg-gray-100 rounded animate-pulse"></div>
                </CardContent>
              </Card>

              {/* Variação Positiva */}
              <Card className="bg-white/90 backdrop-blur-sm shadow-xl border-0 rounded-2xl">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Variação Positiva</CardTitle>
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="w-16 h-8 bg-gray-200 rounded animate-pulse mb-1"></div>
                  <div className="w-20 h-3 bg-gray-100 rounded animate-pulse"></div>
                </CardContent>
              </Card>

              {/* Variação Negativa */}
              <Card className="bg-white/90 backdrop-blur-sm shadow-xl border-0 rounded-2xl">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Variação Negativa</CardTitle>
                  <TrendingDown className="h-5 w-5 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="w-16 h-8 bg-gray-200 rounded animate-pulse mb-1"></div>
                  <div className="w-20 h-3 bg-gray-100 rounded animate-pulse"></div>
                </CardContent>
              </Card>

              {/* Sem Variação */}
              <Card className="bg-white/90 backdrop-blur-sm shadow-xl border-0 rounded-2xl">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Sem Variação</CardTitle>
                  <CheckCircle className="h-5 w-5 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="w-16 h-8 bg-gray-200 rounded animate-pulse mb-1"></div>
                  <div className="w-20 h-3 bg-gray-100 rounded animate-pulse"></div>
                </CardContent>
              </Card>

              {/* Primeira Média */}
              <Card className="bg-white/90 backdrop-blur-sm shadow-xl border-0 rounded-2xl">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Primeira Média</CardTitle>
                  <Calculator className="h-5 w-5 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <div className="w-16 h-8 bg-gray-200 rounded animate-pulse mb-1"></div>
                  <div className="w-20 h-3 bg-gray-100 rounded animate-pulse"></div>
                </CardContent>
              </Card>
            </div>

            {/* Filtros */}
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                {/* Filtro Tipo de Variação */}
                <div className="relative">
                  <Button
                    variant="outline"
                    className="w-full justify-between bg-white/90 border-gray-200 opacity-50 cursor-not-allowed"
                    disabled
                  >
                    <span className="flex items-center">
                      <Filter className="mr-2 h-4 w-4" />
                      Selecionar Tipo de Variação
                    </span>
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </div>

                {/* Filtro SKU */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Filtrar por SKU..."
                    className="pl-10 pr-10 bg-white/90 border-gray-200 opacity-50 cursor-not-allowed"
                    disabled
                  />
                </div>

                {/* Filtro Família */}
                <div className="relative">
                  <Button
                    variant="outline"
                    className="w-full justify-between bg-white/90 border-gray-200 opacity-50 cursor-not-allowed"
                    disabled
                  >
                    <span className="flex items-center">
                      <Filter className="mr-2 h-4 w-4" />
                      Filtrar por Família
                    </span>
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Tabela */}
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
                                className="h-4 w-4 p-0 text-white/50 ml-1 cursor-not-allowed"
                                disabled
                              >
                                <ArrowUpDown className="w-3 h-3" />
                              </Button>
                            </div>
                          </TableHead>
                          <TableHead className="font-semibold text-white bg-[#278190] text-sm w-20 text-center">
                            <div className="flex items-center justify-center">
                              <span>Família</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-4 w-4 p-0 text-white/50 ml-1 cursor-not-allowed"
                                disabled
                              >
                                <ArrowUpDown className="w-3 h-3" />
                              </Button>
                            </div>
                          </TableHead>
                          <TableHead className="font-semibold text-white bg-[#278190] text-sm w-24 text-center">
                            <div className="flex items-center justify-center">
                              <span>Média Atual</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-4 w-4 p-0 text-white/50 ml-1 cursor-not-allowed"
                                disabled
                              >
                                <ArrowUpDown className="w-3 h-3" />
                              </Button>
                            </div>
                          </TableHead>
                          <TableHead className="font-semibold text-white bg-[#278190] text-sm w-24 text-center">Data Implant.</TableHead>
                          <TableHead className="font-semibold text-white bg-[#278190] text-sm w-28 text-center">
                            <div className="flex items-center justify-center">
                              <span>Cálculo Realizado</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-4 w-4 p-0 text-white/50 ml-1 cursor-not-allowed"
                                disabled
                              >
                                <ArrowUpDown className="w-3 h-3" />
                              </Button>
                            </div>
                          </TableHead>
                          <TableHead className="font-semibold text-white bg-[#278190] text-sm w-24 text-center">
                            <div className="flex items-center justify-center">
                              <span>Diferença</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-4 w-4 p-0 text-white/50 ml-1 cursor-not-allowed"
                                disabled
                              >
                                <ArrowUpDown className="w-3 h-3" />
                              </Button>
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
                        {Array.from({ length: 5 }).map((_, index) => (
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
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </SharedLayout>
  )
}
