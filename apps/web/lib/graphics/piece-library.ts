"use client"

import type { LocalPieceDraft } from "@/components/studio/piece-editor"

export type GalleryPiece = LocalPieceDraft & {
  id: string
  name: string
  createdAt: string
}

const STORAGE_KEY = "criatai-piece-gallery"

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  return `piece-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function readPieces(): GalleryPiece[] {
  if (typeof window === "undefined") return []
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]")
    return Array.isArray(parsed) ? (parsed as GalleryPiece[]) : []
  } catch {
    return []
  }
}

function writePieces(pieces: GalleryPiece[]) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pieces.slice(0, 40)))
}

export function listGalleryPieces() {
  return readPieces().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function saveGalleryPiece(draft: LocalPieceDraft): GalleryPiece {
  const previous = readPieces()
  const existing = draft.id ? previous.find((piece) => piece.id === draft.id) : undefined
  const piece: GalleryPiece = {
    ...draft,
    id: draft.id ?? makeId(),
    name: draft.slides[0]?.title?.trim() || (draft.kind === "carousel" ? "Novo carrossel" : draft.kind === "reel" ? "Novo reels" : "Nova arte"),
    createdAt: existing?.createdAt ?? draft.createdAt ?? new Date().toISOString(),
  }
  writePieces([piece, ...previous.filter((item) => item.id !== piece.id)])
  return piece
}

export function deleteGalleryPiece(id: string) {
  writePieces(readPieces().filter((piece) => piece.id !== id))
}