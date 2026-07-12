// Aviso de erro compartilhado por todos os módulos (convenção do CLAUDE.md:
// falha de rede/API sempre visível, nunca tela em branco nem silêncio).
//
// Direção "Sinal Técnico" v2: erro é estado NEGATIVO → laranja (token bad).
// O vermelho alert do R1 saiu do sistema. Os dois variantes usam a mesma
// família, mudando só o peso do tratamento:
// - variant="stale": ainda há dado (antigo) na tela; barra lateral + tag mono.
// - variant="blocking": não há dado nenhum; moldura no lugar do conteúdo.

interface ErrorNoticeProps {
  variant?: 'stale' | 'blocking'
  title?: string
  detail?: string
}

export function ErrorNotice({ variant = 'stale', title, detail }: ErrorNoticeProps) {
  if (variant === 'blocking') {
    return (
      <div role="alert" className="border border-bad/60 bg-bad/10 px-4 py-3 text-body">
        <p className="font-medium text-mist-100">
          <span aria-hidden className="mr-2 font-mono text-caption text-bad">[ FAILED ]</span>
          {title ?? 'Data is unavailable right now — retrying automatically.'}
        </p>
        {detail && <p className="mt-1 text-mist-300">{detail}</p>}
      </div>
    )
  }

  return (
    <div role="alert" className="border-l-2 border-bad py-1 pl-3 text-body text-mist-300">
      <span aria-hidden className="mr-2 font-mono text-caption text-bad">[ ! ]</span>
      {title ?? 'Data is unavailable — showing the last known value and retrying.'}
      {detail && <span className="text-mist-400"> {detail}</span>}
    </div>
  )
}
