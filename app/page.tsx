"use client"
import { Button } from "@/components/ui/button"
import type React from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { X, FileText, BarChart3, Upload } from "lucide-react"
import { calculateDemandForecast, importMediasData } from "./actions"
import { useActionState, useState, useTransition } from "react"
import Link from "next/link"

export default function DemandForecastPage() {
  const [state, action, isPending] = useActionState(calculateDemandForecast, null)
  const [importState, setImportState] = useState<{
    success: boolean
    message?: string
    error?: string
    importedCount?: number
  } | null>(null)
  const [isImporting, startImportTransition] = useTransition()

  // Data atual formatada para input date
  const today = new Date().toISOString().split("T")[0]

  // Valores padrão - Data Fim agora é hoje
  const defaultValues = {
    dataInicio: "2024-01-01",
    dataFim: today,
    diasPrevisao: "30",
  }

  // Estados para controlar os valores dos campos
  const [fieldValues, setFieldValues] = useState(defaultValues)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedMediasFile, setSelectedMediasFile] = useState<File | null>(null)

  const handleFieldChange = (field: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [field]: value }))
  }

  const resetField = (field: string) => {
    const defaultValue = defaultValues[field as keyof typeof defaultValues]
    setFieldValues((prev) => ({ ...prev, [field]: defaultValue }))
  }

  const isFieldEdited = (field: string) => {
    return fieldValues[field as keyof typeof fieldValues] !== defaultValues[field as keyof typeof defaultValues]
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type === "text/csv") {
      setSelectedFile(file)
    } else {
      alert("Por favor, selecione um arquivo CSV válido.")
      event.target.value = ""
    }
  }

  const handleMediasFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type === "text/csv") {
      setSelectedMediasFile(file)
    } else {
      alert("Por favor, selecione um arquivo CSV válido.")
      event.target.value = ""
    }
  }

  const removeFile = () => {
    setSelectedFile(null)
    const fileInput = document.getElementById("csvFile") as HTMLInputElement
    if (fileInput) fileInput.value = ""
  }

  const removeMediasFile = () => {
    setSelectedMediasFile(null)
    const fileInput = document.getElementById("mediasFile") as HTMLInputElement
    if (fileInput) fileInput.value = ""
  }

  const handleImportMedias = async () => {
    if (!selectedMediasFile) {
      alert("Por favor, selecione um arquivo de médias primeiro.")
      return
    }

    startImportTransition(async () => {
      const formData = new FormData()
      formData.append("mediasFile", selectedMediasFile)

      try {
        const result = await importMediasData(null, formData)
        setImportState(result)
      } catch (error) {
        setImportState({
          success: false,
          error: error instanceof Error ? error.message : "Erro interno do servidor",
        })
      }
    })
  }

  return (
    <div className="min-h-screen bg-gray-200">
      {/* Header */}
      <div className="bg-slate-800 text-white px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-semibold">Cálculo Previsão de Demanda</h1>
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button
              variant="outline"
              className="bg-white text-slate-800 border-white hover:bg-gray-100 hover:text-slate-800"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
          </Link>
          <div className="flex items-center gap-2 text-sm">
            <span>Para sair do modo de ecrã inteiro, prima</span>
            <kbd className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-xs">Esc</kbd>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex items-center justify-center min-h-[calc(100vh-80px)] p-6">
        <Card className="w-full max-w-2xl bg-white shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-slate-700 text-lg font-medium">Preencha os Dados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Upload do arquivo de médias */}
            <div className="space-y-2">
              <Label htmlFor="mediasFile" className="text-slate-700 font-medium">
                Arquivo de Médias (CSV)
              </Label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Input
                    id="mediasFile"
                    name="mediasFile"
                    type="file"
                    accept=".csv"
                    className="bg-gray-50 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-slate-50 file:text-slate-700 hover:file:bg-slate-100"
                    onChange={handleMediasFileChange}
                  />
                  {selectedMediasFile && (
                    <div className="mt-2 flex items-center justify-between p-2 bg-blue-50 border border-blue-200 rounded">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-600" />
                        <span className="text-sm text-blue-700">{selectedMediasFile.name}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 hover:bg-blue-100"
                        onClick={removeMediasFile}
                        title="Remover arquivo"
                      >
                        <X className="h-3 w-3 text-blue-600" />
                      </Button>
                    </div>
                  )}
                </div>
                <Button
                  type="button"
                  onClick={handleImportMedias}
                  disabled={!selectedMediasFile || isImporting}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 disabled:opacity-50"
                  title="Importar dados para o Supabase"
                >
                  {isImporting ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Formato esperado: sku;fml_item;media_prevista;dt_implant (separado por ponto e vírgula)
              </p>
              {/* Resultado da importação */}
              {importState && (
                <div className="mt-2 p-2 rounded">
                  {importState.success ? (
                    <div className="text-green-600 text-sm">
                      ✓ {importState.message} ({importState.importedCount} registros importados)
                    </div>
                  ) : (
                    <div className="text-red-600 text-sm">✗ {importState.error}</div>
                  )}
                </div>
              )}
            </div>

            <form action={action} className="space-y-6">
              {/* Upload do arquivo CSV */}
              <div className="space-y-2">
                <Label htmlFor="csvFile" className="text-slate-700 font-medium">
                  Arquivo de Vendas (CSV) <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="csvFile"
                    name="csvFile"
                    type="file"
                    accept=".csv"
                    required
                    className="bg-gray-50 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-slate-50 file:text-slate-700 hover:file:bg-slate-100"
                    onChange={handleFileChange}
                  />
                  {selectedFile && (
                    <div className="mt-2 flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-green-600" />
                        <span className="text-sm text-green-700">{selectedFile.name}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 hover:bg-green-100"
                        onClick={removeFile}
                        title="Remover arquivo"
                      >
                        <X className="h-3 w-3 text-green-600" />
                      </Button>
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  Formato esperado: Data;SKU;Vendas (separado por ponto e vírgula)
                </p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="dataInicio" className="text-slate-700 font-medium">
                    Data Início <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="dataInicio"
                      name="dataInicio"
                      type="date"
                      required
                      className="bg-gray-50 pr-8"
                      value={fieldValues.dataInicio}
                      max={today}
                      onChange={(e) => handleFieldChange("dataInicio", e.target.value)}
                    />
                    {isFieldEdited("dataInicio") && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0 hover:bg-gray-200"
                        onClick={() => resetField("dataInicio")}
                        title="Resetar para valor padrão"
                      >
                        <X className="h-3 w-3 text-gray-500" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dataFim" className="text-slate-700 font-medium">
                    Data Fim <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="dataFim"
                      name="dataFim"
                      type="date"
                      required
                      className="bg-gray-50 pr-8"
                      value={fieldValues.dataFim}
                      max={today}
                      onChange={(e) => handleFieldChange("dataFim", e.target.value)}
                    />
                    {isFieldEdited("dataFim") && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0 hover:bg-gray-200"
                        onClick={() => resetField("dataFim")}
                        title="Resetar para valor padrão (hoje)"
                      >
                        <X className="h-3 w-3 text-gray-500" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="diasPrevisao" className="text-slate-700 font-medium">
                  Dias Previsão <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="diasPrevisao"
                    name="diasPrevisao"
                    type="number"
                    required
                    className="bg-gray-50 pr-8"
                    value={fieldValues.diasPrevisao}
                    min="1"
                    max="365"
                    onChange={(e) => handleFieldChange("diasPrevisao", e.target.value)}
                  />
                  {isFieldEdited("diasPrevisao") && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0 hover:bg-gray-200"
                      onClick={() => resetField("diasPrevisao")}
                      title="Resetar para valor padrão (30 dias)"
                    >
                      <X className="h-3 w-3 text-gray-500" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex justify-center pt-4">
                <Button
                  type="submit"
                  disabled={isPending || !selectedFile}
                  className="bg-slate-600 hover:bg-slate-700 text-white px-8 py-2 disabled:opacity-50"
                >
                  {isPending ? "Calculando..." : "Calcular"}
                </Button>
              </div>
            </form>

            {/* Results */}
            {state && (
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                {state.success ? (
                  <div className="text-green-600">
                    <p className="font-medium">✓ Cálculo concluído com sucesso!</p>
                    <p className="text-sm mt-1">{state.processedSkus} SKUs processados.</p>
                    {state.details && (
                      <div className="mt-2 text-xs text-gray-600">
                        <p>Total de registros analisados: {state.details.totalRecords}</p>
                        <p>Período analisado: {state.details.dateRange}</p>
                        {state.details.statistics && (
                          <>
                            <p>Média diária de vendas: {state.details.statistics.mediaDiariaVendas}</p>
                            <p>Intervalo em anos: {state.details.statistics.intervaloAnos}</p>
                            <p>SKUs únicos: {state.details.statistics.skusUnicos}</p>
                          </>
                        )}
                      </div>
                    )}
                    {state.downloadUrl && (
                      <div className="mt-3 flex gap-2">
                        <Button
                          onClick={() => {
                            const link = document.createElement("a")
                            link.href = state.downloadUrl!
                            link.download = state.filename || "previsao_calculada.csv"
                            link.click()
                          }}
                          className="bg-green-600 hover:bg-green-700 text-white text-sm px-4 py-2"
                        >
                          📊 Baixar Planilha de Resultados
                        </Button>
                        <Link href="/dashboard">
                          <Button className="bg-blue-600 hover:bg-blue-700 text-white hover:text-white text-sm px-4 py-2">
                            📈 Ver Dashboard
                          </Button>
                        </Link>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-red-600">
                    <p className="font-medium">✗ Erro no cálculo:</p>
                    <p className="text-sm mt-1">{state.error}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <div className="bg-slate-800 text-white text-center py-3 text-sm">
        © 2025 Cálculo Média Mês. Todos os direitos reservados.
      </div>
    </div>
  )
}
