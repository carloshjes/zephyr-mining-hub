// Cadência comum das APIs de pool. O cache público costuma ser de ~30 s;
// 60 s evita tráfego sem ganho e mantém pools/rig no mesmo passo.
export const POOL_POLL_INTERVAL_MS = 60_000

// Folga de 5 s absorve jitter, reload e refetch ao voltar pra aba sem perder
// a próxima leitura real do polling de 60 s.
export const POOL_HISTORY_MIN_READING_GAP_MS = POOL_POLL_INTERVAL_MS - 5_000
