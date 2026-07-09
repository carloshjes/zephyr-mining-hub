// Placeholder padrão pros módulos ainda não construídos (cada um chega em um
// prompt futuro — ver CLAUDE.md). Mantém a rota viva na navegação desde já.

interface ModulePlaceholderProps {
  title: string
  description: string
}

export function ModulePlaceholder({ title, description }: ModulePlaceholderProps) {
  return (
    <section className="mx-auto max-w-2xl rounded-xl border border-dashed border-slate-700 bg-slate-900/50 p-10 text-center">
      <p aria-hidden className="text-3xl">🚧</p>
      <h1 className="mt-3 text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-slate-400">{description}</p>
      <p className="mt-4 text-xs tracking-wide text-slate-500 uppercase">
        Módulo em construção
      </p>
    </section>
  )
}
