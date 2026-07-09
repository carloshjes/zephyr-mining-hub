import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { NetworkPulsePage } from './modules/network/NetworkPulsePage'
import { PoolsPage } from './modules/pools/PoolsPage'
import { RewardsPage } from './modules/rewards/RewardsPage'
import { MyRigPage } from './modules/rig/MyRigPage'

// Cada módulo do produto vive em src/modules/<nome> e é montado aqui.
// Recompensa/rig são placeholders — serão construídos em prompts
// futuros, em sessões separadas (ver CLAUDE.md).
export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/rede" replace />} />
        <Route path="/rede" element={<NetworkPulsePage />} />
        <Route path="/pools" element={<PoolsPage />} />
        <Route path="/recompensa" element={<RewardsPage />} />
        <Route path="/meu-rig" element={<MyRigPage />} />
        <Route path="*" element={<Navigate to="/rede" replace />} />
      </Route>
    </Routes>
  )
}
