#!/usr/bin/env bash
# =============================================================================
# LUCROM Studio AI — Smoke Test do ciclo de vida da fila BullMQ
# Arquivo: test/smoke-test.sh
#
# Valida o ciclo completo:
#   1. Health check da API
#   2. Criar tenant
#   3. Fazer upload de um vídeo de amostra (gerado pelo script)
#   4. Enfileirar um render job
#   5. Aguardar o job completar (polling de status)
#   6. Verificar métricas do Quality Director
#   7. Verificar audit gate logs
#
# Uso:
#   chmod +x test/smoke-test.sh
#   BASE_URL=http://localhost:3000 API_TOKEN=seu_token ./test/smoke-test.sh
#
# Pré-requisitos: curl, jq, ffmpeg
# =============================================================================

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
API_TOKEN="${API_TOKEN:-}"
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-180}"  # tempo máximo esperando o job concluir

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ok()   { echo -e "${GREEN}[OK]${NC}   $1"; }
fail() { echo -e "${RED}[FAIL]${NC} $1"; exit 1; }
info() { echo -e "${YELLOW}[INFO]${NC} $1"; }

# ---------------------------------------------------------------------------
# Verificações iniciais
# ---------------------------------------------------------------------------
command -v curl >/dev/null 2>&1 || fail "curl não encontrado. Instale curl e tente novamente."
command -v jq   >/dev/null 2>&1 || fail "jq não encontrado. Instale jq e tente novamente."
command -v ffmpeg >/dev/null 2>&1 || fail "ffmpeg não encontrado. Necessário para gerar o vídeo de amostra."

if [ -z "$API_TOKEN" ]; then
  fail "API_TOKEN não definido. Execute: export API_TOKEN=seu_token"
fi

info "Base URL: $BASE_URL"
info "Timeout: ${TIMEOUT_SECONDS}s"
echo ""

# ---------------------------------------------------------------------------
# Função auxiliar para chamadas autenticadas
# ---------------------------------------------------------------------------
api() {
  local METHOD="$1"
  local PATH="$2"
  shift 2
  curl -sf -X "$METHOD" \
    -H "Authorization: Bearer $API_TOKEN" \
    -H "Content-Type: application/json" \
    "$@" \
    "${BASE_URL}${PATH}"
}

# ---------------------------------------------------------------------------
# PASSO 1 — Health Check
# ---------------------------------------------------------------------------
info "Passo 1: Health check…"
HEALTH=$(curl -sf "${BASE_URL}/api/healthz") || fail "API não está respondendo em ${BASE_URL}/api/healthz"
STATUS=$(echo "$HEALTH" | jq -r '.status')
[ "$STATUS" = "ok" ] || fail "Health check retornou status inesperado: $STATUS"
ok "API respondendo (status=ok)"

# ---------------------------------------------------------------------------
# PASSO 2 — Criar Tenant
# ---------------------------------------------------------------------------
info "Passo 2: Criando tenant de smoke test…"
TENANT=$(api POST /api/v1/tenants -d '{"name":"Smoke Test Tenant","plan_tier":"CREATOR"}')
TENANT_ID=$(echo "$TENANT" | jq -r '.id')
[ -n "$TENANT_ID" ] && [ "$TENANT_ID" != "null" ] || fail "Falha ao criar tenant. Resposta: $TENANT"
ok "Tenant criado: $TENANT_ID"

# ---------------------------------------------------------------------------
# PASSO 3 — Gerar vídeo de amostra e fazer upload
# ---------------------------------------------------------------------------
info "Passo 3: Gerando vídeo de amostra (5s, testsrc) com ffmpeg…"
TMP_VIDEO=$(mktemp /tmp/lucrom-smoke-XXXXXX.mp4)
ffmpeg -y -f lavfi -i "testsrc=duration=5:size=640x480:rate=30" \
       -f lavfi -i "sine=frequency=440:duration=5" \
       -c:v libx264 -preset fast -crf 28 \
       -c:a aac -b:a 128k \
       -shortest "$TMP_VIDEO" 2>/dev/null
ok "Vídeo gerado: $TMP_VIDEO ($(du -sh "$TMP_VIDEO" | cut -f1))"

info "Fazendo upload do vídeo…"
UPLOAD_RESP=$(curl -sf -X POST \
  -H "Authorization: Bearer $API_TOKEN" \
  -F "tenant_id=$TENANT_ID" \
  -F "file=@${TMP_VIDEO};type=video/mp4" \
  "${BASE_URL}/api/v1/media-assets/upload")
RAW_VIDEO_KEY=$(echo "$UPLOAD_RESP" | jq -r '.s3_key')
[ -n "$RAW_VIDEO_KEY" ] && [ "$RAW_VIDEO_KEY" != "null" ] || fail "Falha no upload. Resposta: $UPLOAD_RESP"
ok "Upload concluído. s3_key: $RAW_VIDEO_KEY"
rm -f "$TMP_VIDEO"

# ---------------------------------------------------------------------------
# PASSO 4 — Enfileirar Render Job
# ---------------------------------------------------------------------------
info "Passo 4: Enfileirando render job (pipeline básico, sem generativas)…"
RENDER_RESP=$(api POST /api/v1/engines/m8/render -d "{
  \"tenant_id\": \"$TENANT_ID\",
  \"script_id\": \"$(uuidgen 2>/dev/null || cat /proc/sys/kernel/random/uuid)\",
  \"raw_video_key\": \"$RAW_VIDEO_KEY\",
  \"pipeline_options\": {
    \"subtitles_style\": \"none\",
    \"background_denoise\": false
  },
  \"script_text\": \"Conheça nossos produtos. Qualidade garantida. Venha nos visitar.\",
  \"brand_kit\": {
    \"palette\": [\"#FF5733\", \"#FFFFFF\"],
    \"forbidden_words\": []
  }
}")
RENDER_JOB_ID=$(echo "$RENDER_RESP" | jq -r '.render_job_id')
[ -n "$RENDER_JOB_ID" ] && [ "$RENDER_JOB_ID" != "null" ] || fail "Falha ao enfileirar render. Resposta: $RENDER_RESP"
ok "Job enfileirado: $RENDER_JOB_ID (queue=$(echo "$RENDER_RESP" | jq -r '.queue'))"

# ---------------------------------------------------------------------------
# PASSO 5 — Aguardar conclusão (polling)
# ---------------------------------------------------------------------------
info "Passo 5: Aguardando conclusão do job (timeout=${TIMEOUT_SECONDS}s)…"
ELAPSED=0
JOB_STATUS="QUEUED"
while [ "$JOB_STATUS" = "QUEUED" ] || [ "$JOB_STATUS" = "PROCESSING" ]; do
  if [ "$ELAPSED" -ge "$TIMEOUT_SECONDS" ]; then
    fail "Timeout de ${TIMEOUT_SECONDS}s atingido. Status atual: $JOB_STATUS"
  fi
  sleep 5
  ELAPSED=$((ELAPSED + 5))
  JOB_RESP=$(api GET "/api/v1/engines/m8/render/$RENDER_JOB_ID")
  JOB_STATUS=$(echo "$JOB_RESP" | jq -r '.status')
  info "  [${ELAPSED}s] status=$JOB_STATUS"
done

if [ "$JOB_STATUS" = "DONE" ]; then
  ok "Job concluído com sucesso (${ELAPSED}s)"
else
  ERROR=$(echo "$JOB_RESP" | jq -r '.error_message // "sem mensagem de erro"')
  fail "Job terminou com status '$JOB_STATUS'. Erro: $ERROR"
fi

# ---------------------------------------------------------------------------
# PASSO 6 — Verificar Quality Iterations
# ---------------------------------------------------------------------------
info "Passo 6: Verificando métricas do Quality Director…"
QI_RESP=$(api GET "/api/v1/quality-iterations/render-job/$RENDER_JOB_ID")
QI_COUNT=$(echo "$QI_RESP" | jq 'length')
[ "$QI_COUNT" -ge 1 ] || fail "Nenhuma QualityIteration registrada para o job $RENDER_JOB_ID"
OVERALL_SCORE=$(echo "$QI_RESP" | jq -r '.[-1].overall_score')
PASSED=$(echo "$QI_RESP" | jq -r '.[-1].passed')
ok "Quality Director: $QI_COUNT iteração(ões) registrada(s). Score final: $OVERALL_SCORE (passed=$PASSED)"

# ---------------------------------------------------------------------------
# PASSO 7 — Verificar Audit Gate Logs
# ---------------------------------------------------------------------------
info "Passo 7: Verificando audit gate logs do tenant…"
OUTPUT_ASSET_ID=$(echo "$JOB_RESP" | jq -r '.output_asset_id')
if [ -n "$OUTPUT_ASSET_ID" ] && [ "$OUTPUT_ASSET_ID" != "null" ]; then
  AUDIT_RESP=$(api GET "/api/v1/audit-gate-logs/asset/$OUTPUT_ASSET_ID")
  AUDIT_COUNT=$(echo "$AUDIT_RESP" | jq 'length')
  ok "Audit gate logs registrados para o asset $OUTPUT_ASSET_ID: $AUDIT_COUNT gate(s)"
  echo "$AUDIT_RESP" | jq -r '.[] | "    Gate: \(.gate_stage) → \(.status) (score=\(.qa_score))"'
else
  info "output_asset_id não disponível — pulando verificação de audit logs por asset."
fi

# ---------------------------------------------------------------------------
# Resultado final
# ---------------------------------------------------------------------------
echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN} SMOKE TEST CONCLUÍDO COM SUCESSO ✓     ${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo "  Tenant ID:      $TENANT_ID"
echo "  Render Job ID:  $RENDER_JOB_ID"
echo "  Quality Score:  $OVERALL_SCORE"
echo "  Tempo total:    ${ELAPSED}s"
echo ""
