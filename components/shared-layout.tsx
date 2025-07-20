'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Calculator, BarChart3, Menu, Brain, TrendingUp } from 'lucide-react'
import { useRouter, usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

interface SharedLayoutProps {
  children: React.ReactNode
}

export default function SharedLayout({ children }: SharedLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  // Inicializar com o estado do localStorage ou false como padrão
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedState = localStorage.getItem('sidebarCollapsed')
      return savedState ? JSON.parse(savedState) : false
    }
    return false
  })
  const router = useRouter()
  const pathname = usePathname()

  const toggleSidebar = () => {
    const newState = !sidebarCollapsed
    setSidebarCollapsed(newState)
    // Salvar estado no localStorage
    localStorage.setItem('sidebarCollapsed', JSON.stringify(newState))
  }

  const menuItems = [
    {
      id: 'calculo',
      title: 'Cálculo',
      subtitle: 'Previsão de Demanda',
      icon: Calculator,
      path: '/',
      active: pathname === '/'
    },
    {
      id: 'analise',
      title: 'Análise',
      subtitle: 'Dados e Resultados',
      icon: BarChart3,
      path: '/analise-dados',
      active: pathname === '/analise-dados'
    },
    {
      id: 'dashboard',
      title: 'Dashboard',
      subtitle: 'KPIs e Análises',
      icon: TrendingUp,
      path: '/dashboard',
      active: pathname === '/dashboard'
    }
  ]

  const navigateToPage = (path: string) => {
    router.push(path)
    setSidebarOpen(false) // Apenas fecha o menu mobile
  }

  return (
    <div className="h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex overflow-hidden">
      {/* Menu Lateral Mobile */}
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
                  <Brain className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">SupplyMind</h2>
                  <p className="text-white/80 text-sm font-medium">Previsão de Demanda</p>
                </div>
              </div>
            </div>
            <nav className="flex-1 p-8 space-y-4">
              {menuItems.map((item) => {
                const Icon = item.icon
                return (
                  <Button
                    key={item.id}
                    variant="ghost"
                    className={cn(
                      "w-full justify-start h-14 border border-gray-100 shadow-sm rounded-2xl transition-all duration-300 transform hover:scale-[1.02]",
                      item.active
                        ? "bg-gradient-to-r from-[#176B87] to-[#145A6B] text-white hover:from-[#145A6B] hover:to-[#124C5F] shadow-lg"
                        : "bg-gray-50 text-gray-700 hover:bg-[#176B87]/10 hover:text-[#176B87]"
                    )}
                    onClick={() => navigateToPage(item.path)}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center mr-4",
                      item.active
                        ? "bg-white/20"
                        : "bg-[#176B87]/10"
                    )}>
                      <Icon className={cn(
                        "h-5 w-5",
                        item.active ? "text-white" : "text-[#176B87]"
                      )} />
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-base">{item.title}</div>
                      <div className={cn(
                        "text-sm",
                        item.active ? "opacity-90" : "opacity-70"
                      )}>{item.subtitle}</div>
                    </div>
                  </Button>
                )
              })}
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
      <div className={cn(
        "hidden lg:flex lg:flex-col lg:bg-white lg:border-r lg:border-gray-100 lg:shadow-2xl lg:drop-shadow-2xl transition-all duration-300 ease-in-out",
        sidebarCollapsed ? "lg:w-20" : "lg:w-80"
      )}>
        <div className="bg-gradient-to-br from-[#176B87] to-[#145A6B] p-8 shadow-lg">
          <div className={cn(
            "flex items-center transition-all duration-300",
            sidebarCollapsed ? "justify-center" : "gap-4"
          )}>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSidebar}
              className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center shadow-lg backdrop-blur-sm hover:bg-white/30 transition-all duration-300 flex-shrink-0"
            >
              <Brain className="w-7 h-7 text-white" />
            </Button>
            {!sidebarCollapsed && (
              <div className="transition-all duration-300">
                <h2 className="text-2xl font-bold text-white tracking-tight">SupplyMind</h2>
                <p className="text-white/80 text-sm font-medium">Previsão de Demanda</p>
              </div>
            )}
          </div>
        </div>
        <nav className={cn(
          "flex-1 space-y-4 transition-all duration-300",
          sidebarCollapsed ? "p-2" : "p-8"
        )}>
          {menuItems.map((item) => {
            const Icon = item.icon
            return (
              <Button
                key={item.id}
                variant="ghost"
                className={cn(
                  "w-full border border-gray-100 shadow-sm rounded-2xl transition-all duration-300 transform hover:scale-[1.02]",
                  sidebarCollapsed ? "h-12 justify-center px-2" : "h-14 justify-start",
                  item.active
                    ? "bg-gradient-to-r from-[#176B87] to-[#145A6B] text-white hover:from-[#145A6B] hover:to-[#124C5F] shadow-lg"
                    : "bg-gray-50 text-gray-700 hover:bg-[#176B87]/10 hover:text-[#176B87]"
                )}
                onClick={() => navigateToPage(item.path)}
              >
                {sidebarCollapsed ? (
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center",
                    item.active
                      ? "bg-white/20"
                      : "bg-[#176B87]/10"
                  )}>
                    <Icon className={cn(
                      "h-4 w-4",
                      item.active ? "text-white" : "text-[#176B87]"
                    )} />
                  </div>
                ) : (
                  <>
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mr-4",
                      item.active
                        ? "bg-white/20"
                        : "bg-[#176B87]/10"
                    )}>
                      <Icon className={cn(
                        "h-5 w-5",
                        item.active ? "text-white" : "text-[#176B87]"
                      )} />
                    </div>
                    <div className="text-left transition-all duration-300">
                      <div className="font-bold text-base">{item.title}</div>
                      <div className={cn(
                        "text-sm",
                        item.active ? "opacity-90" : "opacity-70"
                      )}>{item.subtitle}</div>
                    </div>
                  </>
                )}
              </Button>
            )
          })}
        </nav>
        {!sidebarCollapsed && (
          <div className="p-8 border-t border-gray-100 transition-all duration-300">
            <div className="text-xs text-gray-500 text-center">
              <p className="font-medium">Sistema de Previsão</p>
              <p className="opacity-70">Versão 1.0</p>
            </div>
          </div>
        )}
      </div>

      {/* Conteúdo Principal */}
      <div className={cn(
        "flex-1 flex flex-col overflow-hidden transition-all duration-300"
      )}>
        {children}
      </div>
    </div>
  )
}