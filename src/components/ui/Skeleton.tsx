// Placeholder de carregamento compartilhado (convenção: loading/erro têm
// componente único pra todos os módulos — ver CLAUDE.md).
export function Skeleton({ className = 'h-8 w-28' }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block animate-pulse rounded-sm bg-zeph-800/40 motion-reduce:animate-none ${className}`}
    />
  )
}
