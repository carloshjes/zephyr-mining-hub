import { Component, type ReactNode } from 'react'
import { ErrorNotice } from './ErrorNotice'

interface RouteErrorBoundaryProps {
  children: ReactNode
}

interface RouteErrorBoundaryState {
  hasError: boolean
}

// Rede de proteção da rota ativa: erros de render não podem apagar a casca
// inteira. O boundary não escreve no console de propósito — o produto mantém
// toda falha observável na UI, na mesma linguagem do ErrorNotice bloqueante.
export class RouteErrorBoundary extends Component<
  RouteErrorBoundaryProps,
  RouteErrorBoundaryState
> {
  state: RouteErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): RouteErrorBoundaryState {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorNotice
          variant="blocking"
          title="This section could not be displayed."
          detail="Reload the page or switch sections to try again."
        />
      )
    }

    return this.props.children
  }
}
