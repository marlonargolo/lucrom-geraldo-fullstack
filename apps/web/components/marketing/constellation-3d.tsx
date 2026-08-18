"use client"

import { useEffect, useRef, useCallback } from "react"

// ─── Constellation3D ────────────────────────────────────────────────────────
//
// Componente de partículas triangulares em canvas puro (zero dependências
// externas). Renderiza milhares de triângulos coloridos formando uma nuvem
// orgânica em forma de cérebro/neurônio com:
//   • Rotação 3D suave em torno do eixo Y (automática + vinculada ao scroll)
//   • Reação ao mouse: partículas se afastam do cursor (campo de repulsão)
//   • Partículas ambiente flutuando ao redor da forma central
//   • Conexões/sinapses entre partículas próximas ao centro
//   • Paleta cromática completa: violet, amber, teal, magenta, blue
//
// Design reference: Dala — constellation floating on black velvet
// ─────────────────────────────────────────────────────────────────────────────

const PALETTE = [
  "#8052ff", // Electric Iris — violet primário
  "#9966ff", // violet mais claro
  "#6633cc", // violet escuro
  "#ffb829", // Saffron Spark — amber
  "#ff9500", // amber escuro
  "#15846e", // Deep Verdant — teal
  "#00c9a7", // teal claro
  "#ff3399", // magenta
  "#cc44ff", // roxo magenta
  "#3399ff", // azul
  "#00ccff", // ciano
  "#ff6644", // laranja
]

interface Particle {
  // posição no espaço 3D (modelo)
  ox: number; oy: number; oz: number
  // posição atual (com noise/flutuação)
  x: number; y: number; z: number
  // projeção 2D
  px: number; py: number
  // visual
  size: number
  color: string
  alpha: number
  rotation: number
  rotationSpeed: number
  // animação
  phaseX: number; phaseY: number; phaseZ: number
  speedX: number; speedY: number; speedZ: number
  amplitude: number
  // tipo: 'core' = forma central, 'ambient' = flutuante ao redor
  type: "core" | "ambient"
  // velocidade de repulsão atual
  vx: number; vy: number; vz: number
}

// Gera pontos em formato de nuvem orgânica (cérebro/neurônio)
// usando superposição de esferas deformadas
function generateBrainPoints(count: number): Array<{ x: number; y: number; z: number }> {
  const points: Array<{ x: number; y: number; z: number }> = []

  // Hemisférios esquerdo e direito, com deformações orgânicas
  const hemispheres = [
    { cx: -0.35, cy: 0, cz: 0, rx: 0.55, ry: 0.45, rz: 0.5 },
    { cx: 0.35,  cy: 0, cz: 0, rx: 0.55, ry: 0.45, rz: 0.5 },
    // lobo frontal
    { cx: 0,    cy: -0.1, cz: 0.4, rx: 0.4, ry: 0.35, rz: 0.35 },
    // cerebelo (base)
    { cx: 0,    cy: 0.25, cz: -0.25, rx: 0.3, ry: 0.25, rz: 0.3 },
  ]

  let attempts = 0
  while (points.length < count && attempts < count * 20) {
    attempts++
    // escolhe hemisférios com peso proporcional ao volume
    const weights = [0.3, 0.3, 0.25, 0.15]
    const rand = Math.random()
    let hIdx = 0
    let cumulative = 0
    for (let i = 0; i < weights.length; i++) {
      cumulative += weights[i]
      if (rand < cumulative) { hIdx = i; break }
    }
    const h = hemispheres[hIdx]

    // ponto em shell esférica (concentrado na superfície + interior)
    const u = Math.random(); const v = Math.random()
    const theta = 2 * Math.PI * u
    const phi = Math.acos(2 * v - 1)
    // raio entre 0.2 e 1 (mais denso na superfície)
    const r = Math.pow(Math.random(), 0.5)

    const x = h.cx + h.rx * r * Math.sin(phi) * Math.cos(theta)
    const y = h.cy + h.ry * r * Math.sin(phi) * Math.sin(theta)
    const z = h.cz + h.rz * r * Math.cos(phi)

    // descarta pontos muito fora da forma geral
    const distFromCenter = Math.sqrt(x * x + y * y * 0.8 + z * z * 0.9)
    if (distFromCenter > 1.1) continue

    // deformação orgânica com noise (simplex aproximado via senos)
    const noiseX = 0.08 * Math.sin(x * 7 + y * 5) * Math.cos(z * 6)
    const noiseY = 0.06 * Math.cos(x * 5 + z * 7) * Math.sin(y * 4)
    const noiseZ = 0.07 * Math.sin(y * 6 + z * 5) * Math.cos(x * 8)

    points.push({ x: x + noiseX, y: y + noiseY, z: z + noiseZ })
  }

  return points
}

function createParticles(coreCount: number, ambientCount: number): Particle[] {
  const particles: Particle[] = []

  // Partículas centrais (forma do cérebro)
  const brainPoints = generateBrainPoints(coreCount)
  for (const pt of brainPoints) {
    particles.push({
      ox: pt.x, oy: pt.y, oz: pt.z,
      x: pt.x,  y: pt.y,  z: pt.z,
      px: 0, py: 0,
      size: 0.8 + Math.random() * 2.2,
      color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      alpha: 0.5 + Math.random() * 0.5,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.04,
      phaseX: Math.random() * Math.PI * 2,
      phaseY: Math.random() * Math.PI * 2,
      phaseZ: Math.random() * Math.PI * 2,
      speedX: 0.3 + Math.random() * 0.7,
      speedY: 0.3 + Math.random() * 0.7,
      speedZ: 0.2 + Math.random() * 0.5,
      amplitude: 0.01 + Math.random() * 0.025,
      type: "core",
      vx: 0, vy: 0, vz: 0,
    })
  }

  // Partículas ambiente (espalhadas ao redor)
  for (let i = 0; i < ambientCount; i++) {
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    const r = 1.2 + Math.random() * 0.9
    particles.push({
      ox: r * Math.sin(phi) * Math.cos(theta),
      oy: r * Math.sin(phi) * Math.sin(theta) * 0.7,
      oz: r * Math.cos(phi),
      x: 0, y: 0, z: 0,
      px: 0, py: 0,
      size: 0.5 + Math.random() * 1.2,
      color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      alpha: 0.15 + Math.random() * 0.35,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.02,
      phaseX: Math.random() * Math.PI * 2,
      phaseY: Math.random() * Math.PI * 2,
      phaseZ: Math.random() * Math.PI * 2,
      speedX: 0.1 + Math.random() * 0.3,
      speedY: 0.1 + Math.random() * 0.3,
      speedZ: 0.1 + Math.random() * 0.2,
      amplitude: 0.03 + Math.random() * 0.06,
      type: "ambient",
      vx: 0, vy: 0, vz: 0,
    })
  }

  return particles
}

// Desenha um triângulo rotacionado no canvas
function drawTriangle(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  size: number, rotation: number,
  color: string, alpha: number,
) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.strokeStyle = color
  ctx.lineWidth = 0.8
  ctx.translate(cx, cy)
  ctx.rotate(rotation)
  ctx.beginPath()
  // triângulo equilátero
  ctx.moveTo(0, -size)
  ctx.lineTo(size * 0.866, size * 0.5)
  ctx.lineTo(-size * 0.866, size * 0.5)
  ctx.closePath()
  ctx.stroke()
  ctx.restore()
}

// Projeção 3D perspectiva simples
function project(
  x: number, y: number, z: number,
  cx: number, cy: number,
  fov: number, scale: number,
): { px: number; py: number; depth: number } {
  const depth = fov / (fov + z * scale)
  return {
    px: cx + x * scale * depth,
    py: cy + y * scale * depth,
    depth,
  }
}

interface ConstellationProps {
  className?: string
  particleCount?: number
  ambientCount?: number
  /** Multiplicador da rotação extra vinculada ao scroll (radianos por 100% de scroll). Default: 2π * 1.5 (1.5 voltas ao longo da página). */
  scrollRotationTurns?: number
  /** Se true (default), reage ao scroll da página com rotação + leve profundidade extra. */
  reactToScroll?: boolean
}

export function Constellation3D({
  className = "",
  particleCount = 1800,
  ambientCount = 200,
  scrollRotationTurns = 1.5,
  reactToScroll = true,
}: ConstellationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef({
    particles: [] as Particle[],
    rotY: 0,           // ângulo de rotação Y global (auto + scroll)
    rotX: -0.12,       // leve inclinação fixa no X
    scrollProgress: 0, // 0..1, posição de scroll da página
    scrollRotX: 0,     // inclinação extra no X vinda do scroll
    mouseX: 0,
    mouseY: 0,
    mouseInside: false,
    time: 0,
    animId: 0,
    dpr: 1,
  })

  const initParticles = useCallback(() => {
    stateRef.current.particles = createParticles(particleCount, ambientCount)
  }, [particleCount, ambientCount])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const state = stateRef.current
    state.dpr = window.devicePixelRatio || 1

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * state.dpr
      canvas.height = rect.height * state.dpr
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.scale(state.dpr, state.dpr)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    initParticles()

    // Scroll → rotação extra + leve inclinação, suavizados
    const onScroll = () => {
      if (!reactToScroll) return
      const doc = document.documentElement
      const maxScroll = Math.max(doc.scrollHeight - window.innerHeight, 1)
      const progress = Math.min(Math.max(window.scrollY / maxScroll, 0), 1)
      state.scrollProgress = progress
    }
    if (reactToScroll) {
      window.addEventListener("scroll", onScroll, { passive: true })
      onScroll()
    }

    // Mouse
    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      state.mouseX = e.clientX - rect.left
      state.mouseY = e.clientY - rect.top
      state.mouseInside = true
    }
    const onMouseLeave = () => { state.mouseInside = false }
    canvas.addEventListener("mousemove", onMouseMove)
    canvas.addEventListener("mouseleave", onMouseLeave)

    // Touch
    const onTouchMove = (e: TouchEvent) => {
      const rect = canvas.getBoundingClientRect()
      const t = e.touches[0]
      state.mouseX = t.clientX - rect.left
      state.mouseY = t.clientY - rect.top
      state.mouseInside = true
    }
    canvas.addEventListener("touchmove", onTouchMove, { passive: true })
    canvas.addEventListener("touchend", onMouseLeave)

    let lastTime = 0

    const render = (ts: number) => {
      state.animId = requestAnimationFrame(render)
      const dt = Math.min((ts - lastTime) / 1000, 0.05)
      lastTime = ts
      state.time += dt

      const rect = canvas.getBoundingClientRect()
      const W = rect.width
      const H = rect.height
      const cx = W / 2
      const cy = H / 2
      const scale = Math.min(W, H) * 0.38

      // Suaviza a rotação/inclinação vindas do scroll (lerp)
      const targetScrollRotY = state.scrollProgress * Math.PI * 2 * scrollRotationTurns
      const targetScrollRotX = state.scrollProgress * 0.5 - 0.25
      state.scrollRotX += (targetScrollRotX - state.scrollRotX) * 0.06

      // Rotação automática suave + contribuição do scroll
      state.rotY += dt * 0.18
      const totalRotY = state.rotY + targetScrollRotY
      const totalRotX = state.rotX + state.scrollRotX

      ctx.clearRect(0, 0, W, H)

      // Pré-calcular senos/cossenos da rotação global
      const cosY = Math.cos(totalRotY)
      const sinY = Math.sin(totalRotY)
      const cosX = Math.cos(totalRotX)
      const sinX = Math.sin(totalRotX)

      // Repulsão do mouse
      const mouseRepulseRadius = scale * 0.35
      const mouseRepulseStrength = scale * 0.0008

      // Atualizar e projetar partículas
      const sorted: Array<{ p: Particle; depth: number }> = []

      for (const p of state.particles) {
        // Flutuação orgânica
        const t = state.time
        p.x = p.ox + Math.sin(t * p.speedX + p.phaseX) * p.amplitude
        p.y = p.oy + Math.cos(t * p.speedY + p.phaseY) * p.amplitude
        p.z = p.oz + Math.sin(t * p.speedZ + p.phaseZ) * p.amplitude * 0.6

        // Rotação global Y
        const x1 = p.x * cosY - p.z * sinY
        const z1 = p.x * sinY + p.z * cosY
        // Rotação leve X
        const y1 = p.y * cosX - z1 * sinX
        const z2 = p.y * sinX + z1 * cosX

        const { px, py, depth } = project(x1, y1, z2, cx, cy, 400, scale)
        p.px = px; p.py = py

        // Repulsão do mouse
        if (state.mouseInside) {
          const dx = px - state.mouseX
          const dy = py - state.mouseY
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < mouseRepulseRadius && dist > 0) {
            const force = (1 - dist / mouseRepulseRadius) * mouseRepulseStrength
            p.vx += (dx / dist) * force * 60
            p.vy += (dy / dist) * force * 60
          }
        }

        // Damping da velocidade de repulsão
        p.vx *= 0.88; p.vy *= 0.88

        // Rotação do triângulo
        p.rotation += p.rotationSpeed

        sorted.push({ p, depth })
      }

      // Ordenar por profundidade (painter's algorithm)
      sorted.sort((a, b) => a.depth - b.depth)

      // Conexões entre partículas core próximas (sinapses)
      if (scale > 80) {
        const coreParticles = sorted.filter(({ p }) => p.type === "core")
        const connectionRadius = scale * 0.12
        const maxConnections = 600

        ctx.lineWidth = 0.4
        let connections = 0

        outer: for (let i = 0; i < coreParticles.length && connections < maxConnections; i++) {
          const { p: a } = coreParticles[i]
          for (let j = i + 1; j < coreParticles.length; j++) {
            const { p: b } = coreParticles[j]
            const dx = a.px - b.px
            const dy = a.py - b.py
            const dist = Math.sqrt(dx * dx + dy * dy)
            if (dist < connectionRadius) {
              const alpha = (1 - dist / connectionRadius) * 0.12
              ctx.globalAlpha = alpha
              ctx.strokeStyle = a.color
              ctx.beginPath()
              ctx.moveTo(a.px + a.vx, a.py + a.vy)
              ctx.lineTo(b.px + b.vx, b.py + b.vy)
              ctx.stroke()
              connections++
              if (connections >= maxConnections) break outer
            }
          }
        }
        ctx.globalAlpha = 1
      }

      // Desenhar partículas
      for (const { p, depth } of sorted) {
        const displaySize = p.size * depth
        if (displaySize < 0.3) continue
        drawTriangle(
          ctx,
          p.px + p.vx,
          p.py + p.vy,
          displaySize,
          p.rotation,
          p.color,
          p.alpha * Math.min(depth * 1.5, 1),
        )
      }
    }

    state.animId = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(state.animId)
      ro.disconnect()
      if (reactToScroll) window.removeEventListener("scroll", onScroll)
      canvas.removeEventListener("mousemove", onMouseMove)
      canvas.removeEventListener("mouseleave", onMouseLeave)
      canvas.removeEventListener("touchmove", onTouchMove)
      canvas.removeEventListener("touchend", onMouseLeave)
    }
  }, [initParticles, reactToScroll, scrollRotationTurns])

  return (
    <canvas
      ref={canvasRef}
      className={`block w-full h-full ${className}`}
      style={{ background: "transparent" }}
      aria-hidden="true"
    />
  )
}