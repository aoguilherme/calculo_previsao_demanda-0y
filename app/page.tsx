"use client"
import { Button } from "@/components/ui/button"
import type React from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { X, FileText, BarChart3 } from "lucide-react"
import { calculateDemandForecast } from "./actions"
import { useActionState, useState, useEffect } from "react"
import Link from "next/link"

export default function DemandForecastPage() {
  // Mova todos os estados para dentro do componente
  const [state, action, isPending] = useActionState(calculateDemandForecast, null)
  const [datasAtipicas, setDatasAtipicas] = useState<Array<{
    dataInicial: string;
    dataFinal: string;
    descricao?: string;
  }>>([]) // Inicialize com array vazio

  const [novaDataAtipica, setNovaDataAtipica] = useState({
    dataInicial: '',
    dataFinal: '',
    descricao: ''
  })

  // Estado para a data atual - inicializado vazio para evitar hidratação
  const [today, setToday] = useState('')

  // useEffect para definir a data atual apenas no cliente
  useEffect(() => {
    const today = new Date()
    const day = today.getDate().toString().padStart(2, '0')
    const month = (today.getMonth() + 1).toString().padStart(2, '0')
    const year = today.getFullYear()
    setToday(`${day}/${month}/${year}`)
  }, [])

  // Função para converter data ISO para formato dd/mm/aaaa
  const formatDateToBR = (isoDate: string) => {
    if (!isoDate) return ''
    const date = new Date(isoDate)
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  }

  // Função para converter data dd/mm/aaaa para formato ISO
  const formatDateToISO = (brDate: string) => {
    if (!brDate) return ''
    const [day, month, year] = brDate.split('/')
    if (!day || !month || !year) return ''
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  // Valores padrão - inicializados com valores estáticos para evitar hidratação
  const defaultValues = {
    dataInicio: "01/01/2024",
    dataFim: "31/12/2024",
    diasPrevisao: "30",
  }

  // Estados para controlar os valores dos campos
  const [fieldValues, setFieldValues] = useState(defaultValues)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [showResultPopup, setShowResultPopup] = useState(false)

  // Atualizar fieldValues quando today for definido
  useEffect(() => {
    if (today) {
      setFieldValues(prev => ({
        ...prev,
        dataInicio: today,
        dataFim: today
      }))
    }
  }, [today])

  // Controlar popup de resultados
  useEffect(() => {
    if (state) {
      setShowResultPopup(true)
    }
  }, [state])

  // Função para formatar data de forma consistente
  const formatDate = (dateString: string) => {
    // Se já está no formato dd/mm/aaaa, retorna como está
    if (dateString.includes('/') && dateString.length === 10) {
      return dateString
    }
    // Caso contrário, converte de ISO para dd/mm/aaaa
    const date = new Date(dateString)
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  }

  // Adicione estas funções para gerenciar as datas atípicas
  const adicionarDataAtipica = () => {
    if (!novaDataAtipica.dataInicial || !novaDataAtipica.dataFinal) {
      alert('Por favor, preencha as datas inicial e final do período atípico.');
      return;
    }

    // Converter datas para comparação
    const dataInicialISO = formatDateToISO(novaDataAtipica.dataInicial)
    const dataFinalISO = formatDateToISO(novaDataAtipica.dataFinal)
    
    if (!dataInicialISO || !dataFinalISO) {
      alert('Por favor, insira datas válidas no formato dd/mm/aaaa.');
      return;
    }
    
    if (new Date(dataInicialISO) > new Date(dataFinalISO)) {
      alert('A data inicial deve ser anterior à data final.');
      return;
    }

    setDatasAtipicas([...datasAtipicas, novaDataAtipica]);
    setNovaDataAtipica({ dataInicial: '', dataFinal: '', descricao: '' });
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
      return currentValue !== today
    }
    // Para outros campos, verificar se é diferente do valor padrão
    return currentValue !== defaultValues[field as keyof typeof defaultValues]
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

  const removeFile = () => {
    setSelectedFile(null)
    // Reset file input value
    const fileInput = document.getElementById("csvFile") as HTMLInputElement
    if (fileInput) fileInput.value = ""
  }

  return (
    <div className="min-h-screen bg-gray-200">
      {/* Header */}
      <div className="bg-slate-800 text-white px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-semibold">Cálculo Previsão de Demanda</h1>
        <div className="flex items-center gap-2 text-sm">
          <span>Para sair do modo de ecrã inteiro, prima</span>
          <kbd className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-xs">Esc</kbd>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex items-center justify-center min-h-[calc(100vh-120px)] p-4">
        <Card className="w-full max-w-4xl bg-white shadow-lg">
          <CardHeader className="text-center py-4">
            <CardTitle className="text-slate-700 text-3xl font-bold">Preencha os Dados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action={action} className="space-y-4">
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

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dataInicio" className="text-slate-700 font-medium">
                    Data Analise Inicio <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="dataInicio"
                      name="dataInicio"
                      type="text"
                      required
                      className="bg-gray-50 pr-8 text-sm"
                      placeholder="dd/mm/aaaa"
                      value={fieldValues.dataInicio}
                      onChange={(e) => {
                        let value = e.target.value.replace(/\D/g, '')
                        if (value.length >= 2) value = value.slice(0,2) + '/' + value.slice(2)
                        if (value.length >= 5) value = value.slice(0,5) + '/' + value.slice(5,9)
                        handleFieldChange("dataInicio", value)
                      }}
                      maxLength={10}
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
                    Data Analise Fim <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="dataFim"
                      name="dataFim"
                      type="text"
                      required
                      className="bg-gray-50 pr-8 text-sm"
                      placeholder="dd/mm/aaaa"
                      value={fieldValues.dataFim}
                      onChange={(e) => {
                        let value = e.target.value.replace(/\D/g, '')
                        if (value.length >= 2) value = value.slice(0,2) + '/' + value.slice(2)
                        if (value.length >= 5) value = value.slice(0,5) + '/' + value.slice(5,9)
                        handleFieldChange("dataFim", value)
                      }}
                      maxLength={10}
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
              </div>
              
              <div className="grid grid-cols-7 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="dataInicialAtipica" className="text-slate-700 font-medium">Data Atípica Inicio</Label>
                  <Input
                    id="dataInicialAtipica"
                    type="text"
                    className="bg-gray-50"
                    placeholder="dd/mm/aaaa"
                    value={novaDataAtipica.dataInicial}
                    onChange={(e) => {
                      let value = e.target.value.replace(/\D/g, '')
                      if (value.length >= 2) value = value.slice(0,2) + '/' + value.slice(2)
                      if (value.length >= 5) value = value.slice(0,5) + '/' + value.slice(5,9)
                      setNovaDataAtipica({ ...novaDataAtipica, dataInicial: value })
                    }}
                    maxLength={10}
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="dataFinalAtipica" className="text-slate-700 font-medium">Data Atípica Fim</Label>
                  <Input
                    id="dataFinalAtipica"
                    type="text"
                    className="bg-gray-50"
                    placeholder="dd/mm/aaaa"
                    value={novaDataAtipica.dataFinal}
                    onChange={(e) => {
                      let value = e.target.value.replace(/\D/g, '')
                      if (value.length >= 2) value = value.slice(0,2) + '/' + value.slice(2)
                      if (value.length >= 5) value = value.slice(0,5) + '/' + value.slice(5,9)
                      setNovaDataAtipica({ ...novaDataAtipica, dataFinal: value })
                    }}
                    maxLength={10}
                  />
                </div>
                <div className="col-span-3 space-y-2">
                  <Label htmlFor="descricaoAtipica" className="text-slate-700 font-medium">Descrição</Label>
                  <div className="flex gap-2">
                    <Input
                      id="descricaoAtipica"
                      type="text"
                      className="bg-gray-50 flex-grow"
                      placeholder="Ex: Black Friday"
                      value={novaDataAtipica.descricao}
                      onChange={(e) => setNovaDataAtipica({ ...novaDataAtipica, descricao: e.target.value })}
                    />
                    <Button
                      type="button"
                      onClick={adicionarDataAtipica}
                      className="whitespace-nowrap px-3"
                      title="Adicionar à tabela de datas atípicas"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                    </Button>
                  </div>
                </div>
              </div>

              {datasAtipicas.length > 0 && (
                <div className="mt-3 space-y-2">
                  <Label className="text-sm text-gray-600">Períodos cadastrados:</Label>
                  <div className="max-h-[120px] overflow-y-auto border border-gray-200 rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium text-gray-600">Período</th>
                          <th className="px-4 py-2 text-left font-medium text-gray-600">Descrição</th>
                          <th className="px-4 py-2 text-right font-medium text-gray-600">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {datasAtipicas.map((data, index) => (
                          <tr key={index} className="border-t border-gray-200 hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <span className="font-medium">
                                {formatDate(data.dataInicial)} até {formatDate(data.dataFinal)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-500">
                              {data.descricao || '-'}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setNovaDataAtipica({
                                      dataInicial: data.dataInicial,
                                      dataFinal: data.dataFinal,
                                      descricao: data.descricao || ''
                                    });
                                    removerDataAtipica(index);
                                  }}
                                  title="Editar"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </Button>
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => removerDataAtipica(index)}
                                  title="Excluir"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <input
                type="hidden"
                name="datasAtipicas"
                value={JSON.stringify(datasAtipicas)}
              />

              <div className="flex justify-center pt-3">
                <Button
                  type="submit"
                  disabled={isPending || !selectedFile}
                  className="bg-slate-600 hover:bg-slate-700 text-white px-8 py-2 disabled:opacity-50"
                >
                  {isPending ? "Calculando..." : "Calcular"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <div className="bg-slate-800 text-white text-center py-2 text-sm">
        © 2025 Cálculo Média Mês. Todos os direitos reservados.
      </div>

      {/* Popup de Resultados */}
      {showResultPopup && state && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 relative">
            {/* Botão X para fechar */}
            <button
              onClick={() => setShowResultPopup(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-xl font-bold"
            >
              ×
            </button>
            
            {state.success ? (
              <div className="text-green-600">
                <h3 className="text-lg font-medium mb-3">✓ Cálculo concluído com sucesso!</h3>
                <p className="text-sm mb-2">{state.processedSkus} SKUs processados.</p>
                {state.details && (
                  <div className="mb-4 text-xs text-gray-600">
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
                  <div className="mt-4">
                    <Button
                      onClick={() => {
                        // Create download link
                        if (state.downloadUrl) {
                          const link = document.createElement("a")
                          link.href = state.downloadUrl
                          link.download = state.filename || "previsao_calculada.csv"
                          link.click()
                        }
                        
                        // Fechar popup e resetar campos
                        setShowResultPopup(false)
                        
                        // Resetar todos os campos
                         setFieldValues({
                           dataInicio: today || "01/01/2024",
                           dataFim: today || "31/12/2024",
                           diasPrevisao: "30"
                         })
                        
                        // Resetar arquivo selecionado
                        setSelectedFile(null)
                        
                        // Resetar datas atípicas
                        setDatasAtipicas([])
                        setNovaDataAtipica({
                          dataInicial: '',
                          dataFinal: '',
                          descricao: ''
                        })
                        
                        // Resetar input de arquivo
                        const fileInput = document.getElementById('csvFile') as HTMLInputElement
                        if (fileInput) {
                          fileInput.value = ''
                        }
                      }}
                      className="bg-green-600 hover:bg-green-700 text-white w-full"
                    >
                      📊 Baixar Planilha de Resultados
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-red-600">
                <h3 className="text-lg font-medium mb-3">✗ Erro no cálculo</h3>
                <p className="text-sm">{state.error}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
