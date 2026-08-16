import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RenderJob } from './render-job.entity';
import { MediaAsset } from '../../media-assets/media-asset.entity';
import { StorageService } from '../../storage/storage.service';
import { FfmpegService } from './ffmpeg.service';
import { FidelityService, FrameStats } from '../../audit/fidelity.service';
import { AuditService } from '../../audit/audit.service';
import { GateResult } from '../../audit/gates.service';
import { QualityDirectorService } from '../../quality-director/quality-director.service';
import { QualityIterationsService } from '../../quality-director/quality-iterations.service';
import { DiagnosisReport, MAX_CORRECTION_ITERATIONS } from '../../quality-director/quality-director.types';
import { M8RenderJobData } from '../../queue/queue.constants';
import { AudioCleanService, WordTimestamp } from './audio-clean.service';
import { VideoMattingService } from './video-matting.service';
import { NichePresetService, NicheType } from './niche-preset.service';
import { MotionLegendsService } from './motion-legends.service';

@Injectable()
export class M8ProcessorCore {
  private readonly logger = new Logger(M8ProcessorCore.name);

  constructor(
    @InjectRepository(RenderJob) private readonly jobs: Repository<RenderJob>,
    @InjectRepository(MediaAsset) private readonly assets: Repository<MediaAsset>,
    private readonly storage: StorageService,
    private readonly ffmpeg: FfmpegService,
    private readonly fidelity: FidelityService,
    private readonly audit: AuditService,
    private readonly qualityDirector: QualityDirectorService,
    private readonly qualityIterations: QualityIterationsService,
    // ─── Etapas 1-4 do pipeline M8 (generativas via Replicate) ───────────────
    private readonly audioClean: AudioCleanService,
    private readonly videoMatting: VideoMattingService,
    private readonly nichePreset: NichePresetService,
    private readonly motionLegends: MotionLegendsService,
  ) {}

  async handle(data: M8RenderJobData): Promise<{ outputAssetId: string; gatesPassed: boolean; iterations: number }> {
    const renderJob = await this.jobs.findOneOrFail({ where: { id: data.renderJobId } });
    renderJob.status = 'PROCESSING';
    await this.jobs.save(renderJob);

    const tmpPaths: string[] = []; // tudo que precisa ser limpo no finally, na ordem em que foi criado

    try {
      // 1) Baixa o asset bruto via streaming (sem carregar na RAM) e a referência (se houver)
      //
      // streamToTemp() faz pipe S3 → disco sem bufferizar o vídeo inteiro na
      // heap. getObjectBuffer() é usado para a referência (menor, e
      // measureFrame() precisa de Buffer) — o asset principal nunca passa
      // pela RAM inteiro.
      const rawAsset = await this.assets.findOneOrFail({ where: { id: data.rawAssetId } });
      const ext = rawAsset.file_type.includes('mp4') ? 'mp4' : 'mov';
      let currentPath = await this.storage.streamToTemp(rawAsset.s3_key, ext);
      tmpPaths.push(currentPath);

      let referenceStats: FrameStats | null = null;
      if (data.referenceVideoKey) {
        const referenceBuffer = await this.storage.getObjectBuffer(data.referenceVideoKey).catch(() => null);
        if (referenceBuffer) referenceStats = await this.fidelity.measureFrame(referenceBuffer);
      }

      // ─────────────────────────────────────────────────────────────────────
      // ETAPAS 1 + 2 + 3 — Paralelo via Promise.all
      //
      // Etapas 1 (WhisperX/DeepFilterNet), 2 (RVM) e 3 (Flux) são totalmente
      // independentes entre si — todas leem apenas do arquivo de entrada
      // original (`currentPath`) sem mutá-lo, o que permite rodá-las em
      // paralelo em vez de em série.
      //
      // Composição final após o paralelo:
      //   - Se Etapa 2+3 produziram foreground + background: compõe o vídeo.
      //   - Se Etapa 1 produziu áudio limpo: mescla no vídeo (composto ou original).
      //   - wordTimestamps fica disponível para a Etapa 4.
      // ─────────────────────────────────────────────────────────────────────

      let wordTimestamps: WordTimestamp[] = [];

      const runAudioClean = data.pipelineOptions.enable_audio_clean;
      const runMatting    = data.pipelineOptions.enable_matting && !!data.pipelineOptions.niche;

      // Probe de dimensões — leve (apenas metadados), dispara antes do paralelo
      const { width, height } = runMatting
        ? await this.ffmpeg.probeVideoDimensions(currentPath)
        : { width: 0, height: 0 };
      const outW = data.pipelineOptions.output_width  ?? width;
      const outH = data.pipelineOptions.output_height ?? height;

      this.logger.log(
        `[${data.renderJobId}] Iniciando Etapas 1-3 em paralelo` +
        ` (audioClean=${runAudioClean}, matting=${runMatting})…`,
      );

      // Dispara as três tarefas ao mesmo tempo
      const [audioResult, foregroundPath, backgroundImagePath] = await Promise.all([
        // ── Etapa 1: Audio Clean & Sync ───────────────────────────────────
        runAudioClean
          ? this.audioClean
              .process(currentPath, {
                runIsolation: true,
                runTranscription: true,
                language: data.pipelineOptions.language ?? 'pt',
              })
              .catch((err) => {
                this.logger.warn(`[${data.renderJobId}] Etapa 1 falhou (não crítico): ${(err as Error).message}`);
                return null;
              })
          : Promise.resolve(null),

        // ── Etapa 2: Video Matting (RVM) ──────────────────────────────────
        runMatting
          ? this.videoMatting
              .extractForeground(currentPath)
              .catch((err) => {
                this.logger.warn(`[${data.renderJobId}] Etapa 2 (RVM) falhou (não crítico): ${(err as Error).message}`);
                return null;
              })
          : Promise.resolve(null),

        // ── Etapa 3: Background Generation (Flux) ────────────────────────
        runMatting
          ? this.nichePreset
              .generateBackground(this.nichePreset.getConfig(data.pipelineOptions.niche as NicheType), outW, outH)
              .catch((err) => {
                this.logger.warn(`[${data.renderJobId}] Etapa 3 (Flux) falhou (não crítico): ${(err as Error).message}`);
                return null;
              })
          : Promise.resolve(null),
      ]);

      this.logger.log(`[${data.renderJobId}] Etapas 1-3 concluídas em paralelo.`);

      // ── Pós-paralelo: compõe os resultados na sequência correta ──────────

      // Etapa 2+3 → composição foreground + background
      if (foregroundPath && backgroundImagePath) {
        tmpPaths.push(foregroundPath, backgroundImagePath);

        const compositedPath = await this.videoMatting
          .compositeOverBackground({
            foregroundGreenScreenPath: foregroundPath,
            backgroundImagePath,
            outputWidth: outW,
            outputHeight: outH,
          })
          .catch((err) => {
            this.logger.warn(`[${data.renderJobId}] Composição matting falhou (não crítico): ${(err as Error).message}`);
            return null;
          });

        if (compositedPath) {
          tmpPaths.push(compositedPath);
          currentPath = compositedPath;
          this.logger.log(`[${data.renderJobId}] Etapas 2+3: composição concluída.`);
        }
      } else if (foregroundPath) {
        tmpPaths.push(foregroundPath);
      } else if (backgroundImagePath) {
        tmpPaths.push(backgroundImagePath);
      }

      // Etapa 1 → mescla áudio limpo no vídeo atual (composto ou original)
      if (audioResult) {
        wordTimestamps = audioResult.wordTimestamps;

        if (audioResult.cleanedAudioPath) {
          tmpPaths.push(audioResult.cleanedAudioPath);
          const mergedPath = await this.ffmpeg.mergeAudioTrack(currentPath, audioResult.cleanedAudioPath);
          tmpPaths.push(mergedPath);
          currentPath = mergedPath;
          this.logger.log(`[${data.renderJobId}] Etapa 1: áudio limpo mesclado no vídeo.`);
        }
      }

      // ─────────────────────────────────────────────────────────────────────
      // ETAPA 4 — Motion & Legendas (word-level sync via FFmpeg drawtext)
      // Só roda se: subtitles_style != 'none' E wordTimestamps disponíveis.
      // O estilo visual é controlado pelo nicho (se informado) ou pelo padrão.
      // ─────────────────────────────────────────────────────────────────────
      const subtitlesStyle = data.pipelineOptions.subtitles_style ?? 'none';
      if (subtitlesStyle !== 'none' && wordTimestamps.length > 0) {
        this.logger.log(`[${data.renderJobId}] Etapa 4: Motion & Legendas (${wordTimestamps.length} palavras)…`);

        const nicheConfig = data.pipelineOptions.niche
          ? this.nichePreset.getConfig(data.pipelineOptions.niche as NicheType)
          : null;

        const subtitledPath = await this.motionLegends.renderSubtitles({
          videoPath: currentPath,
          wordTimestamps,
          style: nicheConfig?.subtitleStyle,
        }).catch((err) => {
          this.logger.warn(`[${data.renderJobId}] Etapa 4 (legendas) falhou (não crítico): ${(err as Error).message}`);
          return null;
        });

        if (subtitledPath) {
          tmpPaths.push(subtitledPath);
          currentPath = subtitledPath;
          this.logger.log(`[${data.renderJobId}] Etapa 4: legendas renderizadas.`);
        }
      }

      // ─────────────────────────────────────────────────────────────────────
      // ETAPA 5 — Quality Director (loop iterativo Diagnóstico → Correção)
      // Preservado 100% do código original.
      // ─────────────────────────────────────────────────────────────────────
      let lastDiagnosis: DiagnosisReport | null = null;
      let iterationCount = 0;

      for (let iteration = 1; iteration <= MAX_CORRECTION_ITERATIONS + 1; iteration++) {
        iterationCount = iteration;
        const frameBuf = await this.ffmpeg.extractMiddleFrame(currentPath);
        const frameStats = await this.fidelity.measureFrame(frameBuf);

        const sampledFrames = await this.ffmpeg.extractSampledFrames(currentPath, 5);
        const stabilizationJitter = await this.fidelity.measureStabilizationJitter(sampledFrames);
        const audioLoudness = await this.ffmpeg.analyzeAudioLoudness(currentPath);

        const diagnosis = this.qualityDirector.diagnose({
          frame: frameStats,
          reference: referenceStats,
          audio: audioLoudness,
          stabilizationJitter,
          brandKit: data.brandKit,
          scriptText: data.scriptText,
        });
        lastDiagnosis = diagnosis;

        // Persiste a iteração para rastreabilidade (QualityIteration entity)
        const colorCorrection = diagnosis.passed
          ? null
          : this.qualityDirector.decideColorCorrection(frameStats, referenceStats);
        const denoiseStrength = diagnosis.passed ? null : this.qualityDirector.decideDenoiseStrength(frameStats.noise);
        const normalizeAudio = !diagnosis.passed && audioLoudness !== null;

        await this.qualityIterations.record({
          renderJobId: data.renderJobId,
          iterationNumber: iteration,
          diagnosis,
          correctionApplied:
            diagnosis.passed || iteration > MAX_CORRECTION_ITERATIONS
              ? null
              : { colorCorrection, denoiseStrength, normalizeAudio },
        });

        if (diagnosis.passed) {
          this.logger.log(
            `[${data.renderJobId}] Etapa 5 (Quality Director): PASSOU na iteração ${iteration} (score=${diagnosis.overallScore}).`,
          );
          break;
        }

        if (iteration > MAX_CORRECTION_ITERATIONS) {
          this.logger.warn(
            `[${data.renderJobId}] Etapa 5 (Quality Director): esgotou ${MAX_CORRECTION_ITERATIONS} iterações (score=${diagnosis.overallScore}).`,
          );
          break;
        }

        // Aplica correções e avança para a próxima iteração.
        // Passes intermediários usam preset 'ultrafast' (~70% mais rápido
        // que 'medium'); apenas o último passe de correção usa 'medium',
        // pois seu resultado pode ser o output final se passar no
        // diagnóstico seguinte.
        const isLastCorrectionPass = iteration === MAX_CORRECTION_ITERATIONS;
        const correctedPath = await this.ffmpeg.processVideo({
          inputPath: currentPath,
          denoise: denoiseStrength,
          colorCorrection,
          normalizeAudio,
          encodingPreset: isLastCorrectionPass ? 'medium' : 'ultrafast',
        });
        tmpPaths.push(correctedPath);
        currentPath = correctedPath;
      }

      // Salva o artefato final no S3
      const outputBuffer = await this.ffmpeg.readAndCleanup(currentPath);
      tmpPaths.splice(tmpPaths.indexOf(currentPath), 1); // já foi lido + apagado pelo readAndCleanup

      const outputKey = `${data.tenantId}/m8/output/${data.renderJobId}.mp4`;
      await this.storage.putObject(outputKey, outputBuffer, 'video/mp4');

      const outputAsset = this.assets.create({
        tenant_id: data.tenantId,
        engine_source: 'M8',
        file_type: 'video/mp4',
        s3_bucket: this.storage.bucketName,
        s3_key: outputKey,
        file_size_bytes: outputBuffer.length,
        metadata: {
          render_job_id: data.renderJobId,
          quality_score: lastDiagnosis?.overallScore ?? null,
          quality_passed: lastDiagnosis?.passed ?? false,
          iterations: iterationCount,
          niche: data.pipelineOptions.niche ?? null,
          matting_enabled: data.pipelineOptions.enable_matting ?? false,
          audio_clean_enabled: data.pipelineOptions.enable_audio_clean ?? false,
          word_timestamps_count: wordTimestamps.length,
        },
      });
      const savedAsset = await this.assets.save(outputAsset);

      // Atualiza o RenderJob com o resultado
      renderJob.output_asset_id = savedAsset.id;
      renderJob.status = 'DONE';
      await this.jobs.save(renderJob);

      // Persiste os Audit Gates oficiais
      const gatesPassed = lastDiagnosis
        ? await this.persistOfficialGates(data.tenantId, savedAsset.id, lastDiagnosis)
        : false;

      return { outputAssetId: savedAsset.id, gatesPassed, iterations: iterationCount };
    } catch (err) {
      renderJob.status = 'FAILED';
      renderJob.error_message = (err as Error).message;
      await this.jobs.save(renderJob);
      throw err;
    } finally {
      // Limpa todos os temporários que ainda não foram removidos
      for (const p of tmpPaths) {
        await this.ffmpeg.readAndCleanup(p).catch(() => undefined);
      }
    }
  }

  /**
   * Persiste os 3 gates oficiais de auditoria (Brand, Quality, Tone/Text)
   * e retorna true somente se todos passaram.
   */
  private async persistOfficialGates(tenantId: string, assetId: string, diagnosis: DiagnosisReport): Promise<boolean> {
    const avAxes = diagnosis.axes.filter(
      (a) => a.implemented && ['EXPOSICAO_ILUMINACAO', 'NITIDEZ', 'RUIDO', 'ESTABILIZACAO', 'AUDIO'].includes(a.axis),
    );
    const avResult: GateResult = {
      score: avAxes.length ? Math.round((avAxes.reduce((acc, a) => acc + (a.score ?? 0), 0) / avAxes.length) * 100) / 100 : 0,
      passed: avAxes.every((a) => a.ok !== false),
      measured: true,
      checks: avAxes.map((a) => ({ label: a.axis, ok: a.ok ?? false, detail: a.justification, weight: 1 / (avAxes.length || 1) })),
    };
    await this.audit.logGateResult({ tenantId, assetId, stage: 'AUDIOVISUAL_QUALITY', result: avResult });

    let brandPassed = true;
    const brandAxis = diagnosis.axes.find((a) => a.axis === 'COMPLIANCE_MARCA');
    if (brandAxis) {
      brandPassed = !!brandAxis.ok;
      await this.audit.logGateResult({
        tenantId,
        assetId,
        stage: 'BRAND_COMPLIANCE',
        result: {
          score: brandAxis.score ?? 0,
          passed: brandPassed,
          measured: true,
          checks: [{ label: brandAxis.axis, ok: brandPassed, detail: brandAxis.justification, weight: 1 }],
        },
      });
    }

    let tonePassed = true;
    const toneAxis = diagnosis.axes.find((a) => a.axis === 'TOM_ROTEIRO');
    if (toneAxis) {
      tonePassed = !!toneAxis.ok;
      await this.audit.logGateResult({
        tenantId,
        assetId,
        stage: 'TONE_TEXT',
        result: {
          score: toneAxis.score ?? 0,
          passed: tonePassed,
          measured: true,
          checks: [{ label: toneAxis.axis, ok: tonePassed, detail: toneAxis.justification, weight: 1 }],
        },
      });
    }

    return avResult.passed && brandPassed && tonePassed;
  }
}
