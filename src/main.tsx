import '@primer/primitives/dist/css/primitives.css'
import '@primer/primitives/dist/css/functional/themes/light.css'
import '@primer/primitives/dist/css/functional/themes/dark.css'
import { ThemeProvider } from '@primer/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { createServices } from './data/createServices'
import { ServicesProvider } from './data/services'
import './index.css'
import './ui/global.css'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { syncColorScheme } from '@/lib/theme'

const root = document.documentElement
root.setAttribute('data-color-mode', 'auto')
root.setAttribute('data-light-theme', 'light')
root.setAttribute('data-dark-theme', 'dark')

syncColorScheme()
const services = await createServices()

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } } })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider colorMode="auto">
      <ServicesProvider services={services}>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider delayDuration={300}>
            <BrowserRouter>
              <App />
            </BrowserRouter>
            <Toaster position="bottom-center" />
          </TooltipProvider>
        </QueryClientProvider>
      </ServicesProvider>
    </ThemeProvider>
  </StrictMode>,
)
