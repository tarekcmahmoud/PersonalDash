import '@primer/primitives/dist/css/primitives.css'
import '@primer/primitives/dist/css/functional/themes/light.css'
import '@primer/primitives/dist/css/functional/themes/dark.css'
import { BaseStyles, ThemeProvider } from '@primer/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { createServices } from './data/createServices'
import { ServicesProvider } from './data/services'
import './ui/global.css'

const root = document.documentElement
root.setAttribute('data-color-mode', 'auto')
root.setAttribute('data-light-theme', 'light')
root.setAttribute('data-dark-theme', 'dark')

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } } })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider colorMode="auto">
      <BaseStyles>
        <ServicesProvider services={createServices()}>
          <QueryClientProvider client={queryClient}>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </QueryClientProvider>
        </ServicesProvider>
      </BaseStyles>
    </ThemeProvider>
  </StrictMode>,
)
