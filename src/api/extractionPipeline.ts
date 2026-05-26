import type { EnrichmentCandidate, ExtractionReport, Memory, MemoryExtractionEvent, MemoryInput } from "../core";

export function ruleExtractionFailures(events: MemoryExtractionEvent[]): ExtractionReport["failures"] {
  return events.flatMap((event, index) => {
    const failures: ExtractionReport["failures"] = [];
    const mediaType = event.mediaType ?? "text";
    if (event.content.trim().length <= 8) {
      failures.push({
        eventIndex: index,
        stage: "rules",
        reason: "content too short for deterministic fact extraction",
        mediaType,
        language: event.language,
        contentPreview: preview(event.content)
      });
    }
    if ((mediaType === "audio" || mediaType === "image" || mediaType === "video") && !hasLocalMediaExtraction(event)) {
      failures.push({
        eventIndex: index,
        stage: "rules",
        reason: `deterministic ${mediaType} extraction requires provider OCR/ASR/vision adapter`,
        mediaType,
        language: event.language,
        contentPreview: preview(event.content)
      });
    }
    return failures;
  });
}

export function normalizeMediaExtractionEvent(event: MemoryExtractionEvent): MemoryExtractionEvent {
  const mediaType = event.mediaType ?? "text";
  if (mediaType !== "audio" && mediaType !== "image" && mediaType !== "video" && mediaType !== "document") return event;
  const metadata = event.metadata ?? {};
  if (typeof metadata.mediaExtraction === "object" && metadata.mediaExtraction !== null) return event;
  const transformations = Array.isArray(metadata.transformations) ? metadata.transformations.map(String) : [];
  if (mediaType === "audio" && typeof metadata.asrText === "string" && metadata.asrText.trim()) {
    return {
      ...event,
      content: metadata.asrText.trim(),
      metadata: { ...metadata, originalMediaContent: event.content, transformations: [...transformations, "local-asr"], mediaExtraction: { mode: "local", task: "asr" } }
    };
  }
  if ((mediaType === "image" || mediaType === "document") && typeof metadata.ocrText === "string" && metadata.ocrText.trim()) {
    const labels = Array.isArray(metadata.imageLabels) ? ` Labels: ${metadata.imageLabels.map(String).join(", ")}.` : "";
    const transform = mediaType === "document" ? "local-document-ocr" : "local-ocr";
    return {
      ...event,
      content: `${metadata.ocrText.trim()}${labels}`,
      metadata: { ...metadata, originalMediaContent: event.content, transformations: [...transformations, transform], mediaExtraction: { mode: "local", task: "ocr" } }
    };
  }
  if (mediaType === "video" && Array.isArray(metadata.frames) && metadata.frames.length) {
    const frames = metadata.frames
      .filter((frame): frame is Record<string, unknown> => typeof frame === "object" && frame !== null)
      .map((frame) => {
        const at = typeof frame.at === "string" ? `Frame ${frame.at}: ` : "Frame: ";
        const text = typeof frame.text === "string" ? frame.text : "";
        const description = typeof frame.description === "string" ? frame.description : "";
        return `${at}${[description, text].filter(Boolean).join(" ")}`.trim();
      })
      .filter(Boolean);
    if (frames.length) {
      return {
        ...event,
        content: frames.join("\n"),
        metadata: { ...metadata, originalMediaContent: event.content, transformations: [...transformations, "local-video-frames"], mediaExtraction: { mode: "local", task: "video_frames", frames: frames.length } }
      };
    }
  }
  return event;
}

export function hasLocalMediaExtraction(event: MemoryExtractionEvent): boolean {
  const metadata = event.metadata ?? {};
  if (event.mediaType === "audio") return typeof metadata.asrText === "string" && metadata.asrText.trim().length > 0;
  if (event.mediaType === "image" || event.mediaType === "document") return typeof metadata.ocrText === "string" && metadata.ocrText.trim().length > 0;
  if (event.mediaType === "video") return Array.isArray(metadata.frames) && metadata.frames.length > 0;
  return false;
}

export function markExtractionStage(input: MemoryInput, stage: "rules" | "provider"): MemoryInput {
  return {
    ...input,
    tags: [...new Set([...(input.tags ?? []), stage === "provider" ? "provider-extracted" : "rule-extracted"])],
    metadata: {
      ...(input.metadata ?? {}),
      extraction: {
        ...((input.metadata?.extraction as Record<string, unknown> | undefined) ?? {}),
        stage
      }
    }
  };
}

export function extractionConfidence(events: MemoryExtractionEvent[], extracted: number): number {
  if (!events.length) return 0;
  const mediaPenalty = events.some((event) => event.mediaType === "audio" || event.mediaType === "image" || event.mediaType === "video") ? 0.25 : 0;
  const languagePenalty = events.some((event) => event.language && !/^en/i.test(event.language)) ? 0.08 : 0;
  return clamp01((extracted ? 0.82 : 0.24) - mediaPenalty - languagePenalty);
}

export function enrichmentCandidatesFor(memories: Memory[]): EnrichmentCandidate[] {
  const byEntity = new Map<string, Memory[]>();
  for (const memory of memories) {
    for (const entity of memory.entities) {
      const current = byEntity.get(entity) ?? [];
      current.push(memory);
      byEntity.set(entity, current);
    }
  }
  return [...byEntity.entries()]
    .map(([entity, support]) => {
      const mentionCount = support.length;
      const trusted = support.reduce((sum, memory) => sum + memory.trust * memory.importance, 0);
      const attention = clamp01(mentionCount / 4 + trusted / Math.max(1, mentionCount * 2));
      const suggestedAction: EnrichmentCandidate["suggestedAction"] = attention >= 0.9 ? "full_pipeline" : mentionCount >= 2 ? "enrich" : "stub";
      return {
        entity,
        mentionCount,
        attention,
        suggestedAction,
        reason:
          suggestedAction === "full_pipeline"
            ? "high mention count and trust merit external enrichment"
            : suggestedAction === "enrich"
              ? "repeated mentions merit metadata enrichment"
              : "first mention creates a lightweight entity stub",
        memoryIds: support.map((memory) => memory.id)
      };
    })
    .filter((candidate) => candidate.suggestedAction !== "stub" || candidate.mentionCount >= 1)
    .sort((a, b) => b.attention - a.attention || b.mentionCount - a.mentionCount)
    .slice(0, 25);
}

export function learnedRuleSuggestions(events: MemoryExtractionEvent[], failures: ExtractionReport["failures"]): ExtractionReport["learnedRules"] {
  const suggestions: ExtractionReport["learnedRules"] = [];
  const mediaFailures = new Map<string, string[]>();
  for (const failure of failures) {
    if (failure.mediaType === "audio" || failure.mediaType === "image" || failure.mediaType === "video") {
      const current = mediaFailures.get(failure.mediaType) ?? [];
      current.push(failure.contentPreview);
      mediaFailures.set(failure.mediaType, current);
    }
    if (failure.reason.includes("too short")) {
      suggestions.push({
        kind: "regex",
        pattern: "\\b(confirm(ed)?|verified|decided|prefers|uses)\\b",
        reason: "short events may still contain durable confirmations when domain verbs are present",
        examples: [failure.contentPreview].filter(Boolean),
        confidence: 0.48
      });
    }
  }
  for (const [mediaType, examples] of mediaFailures) {
    suggestions.push({
      kind: "provider",
      reason: `configure a ${mediaType} extractor adapter for OCR/ASR/vision before rule extraction`,
      examples: examples.filter(Boolean).slice(0, 3),
      confidence: 0.78
    });
  }
  const languages = [...new Set(events.map((event) => event.language).filter((language): language is string => Boolean(language && !/^en/i.test(language))))];
  for (const language of languages) {
    suggestions.push({
      kind: "translation",
      reason: `add ${language} normalization or translation before contradiction/extraction rules`,
      examples: events.filter((event) => event.language === language).map((event) => preview(event.content)).slice(0, 3),
      confidence: 0.62
    });
  }
  return suggestions;
}

function preview(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 160);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
