"use client"

/**
 * LoginGate — mantido por compatibilidade com imports existentes.
 * 
 * O fluxo de login foi movido para /studio/login (tela completa).
 * O layout /app/studio/layout.tsx já redireciona usuários não autenticados.
 * 
 * Este componente agora expõe apenas o widget de usuário logado no header
 * (ver UserMenu em studio-shell.tsx que já usa useAuth diretamente).
 * 
 * Mantido aqui para não quebrar imports que ainda referenciam este arquivo.
 */

export function LoginGate() {
  // Widget movido para studio-shell.tsx (UserMenu)
  return null
}
