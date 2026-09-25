"use client"

// Painel de gestão do usuário final — quanto produziu, quanto gastou de
// cota/créditos, o que tem disponível e a validade do ciclo. Antes disso
// existia como <AccountPanel/>, já implementado, mas só era renderizado
// dentro de <StudioShell/>, que não está mais ligado no roteamento atual
// (ver App.tsx) — este arquivo apenas conecta o componente já pronto a
// uma rota de verdade.

import { AccountPanel } from "@/components/studio/account-panel"

export default function ConsumoPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <AccountPanel />
    </div>
  )
}
