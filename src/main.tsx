import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { createServices } from './data/createServices'
import { ServicesProvider } from './data/services'
import './index.css'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { syncColorScheme } from '@/lib/theme'

syncColorScheme()
const services = await createServices()

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } } })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ServicesProvider services={services}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={300}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
          {/* On phones, keep toasts above the fixed bottom tab bar. */}
          <Toaster
            position="bottom-center"
            mobileOffset={{ bottom: 'calc(72px + env(safe-area-inset-bottom))' }}
          />
        </TooltipProvider>
      </QueryClientProvider>
    </ServicesProvider>
  </StrictMode>,
)
