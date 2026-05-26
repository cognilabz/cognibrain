import { normalizeRetrievalWeights, type IdentityLink, type LearnedProfileReport, type Memory, type RetrievalProfile, type RetrievalTrainingSample, type RetrievalWeights, type SearchResult } from "../../core";
import { baseSignalTemplate, memoryMatchesProfileScope, profileLoss, safeGet, sampleMatchesProfileScope } from "./helpers";

export function addTrainingSample(service: any, sample: RetrievalTrainingSample): RetrievalTrainingSample {
    const saved = { ...sample, timestamp: sample.timestamp ?? new Date().toISOString() };
    service.trainingSamples.push(saved);
    service.persist();
    return saved;
  }

export function setRetrievalProfile(service: any, profile: Omit<RetrievalProfile, "updatedAt" | "weights"> & { weights: Partial<RetrievalWeights>; updatedAt?: string }): RetrievalProfile {
    const saved: RetrievalProfile = {
      ...profile,
      weights: normalizeRetrievalWeights(profile.weights),
      updatedAt: profile.updatedAt ?? new Date().toISOString()
    };
    service.retrievalProfiles.set(saved.id, saved);
    service.persist();
    return saved;
  }

export function getRetrievalProfiles(service: any): RetrievalProfile[] {
    return [...service.retrievalProfiles.values()];
  }

export function learnRetrievalProfile(service: any, id = "learned", label = "Learned feedback profile", options: { scope?: RetrievalProfile["scope"] } = {}): LearnedProfileReport {
    const positiveSignals: Partial<RetrievalWeights> = {};
    const negativeSignals: Partial<RetrievalWeights> = {};
    let samples = 0;
    for (const event of service.feedbackEvents) {
      const memory = safeGet(service.store, event.memoryId);
      if (!memory) continue;
      if (!memoryMatchesProfileScope(memory, options.scope)) continue;
      const bucket = event.kind === "helpful" || event.kind === "always_include" ? positiveSignals : event.kind === "wrong" || event.kind === "never_include" ? negativeSignals : undefined;
      if (!bucket) continue;
      samples += 1;
      bucket.trust = (bucket.trust ?? 0) + memory.trust;
      bucket.entity = (bucket.entity ?? 0) + Math.min(1, memory.entities.length / 5);
      bucket.temporal = (bucket.temporal ?? 0) + (memory.lastAccessedAt ? 0.6 : 0.2);
      bucket.access = (bucket.access ?? 0) + Math.min(1, Math.log1p(memory.accessCount) / 4);
    }
    const trainingSamples = (service.trainingSamples as RetrievalTrainingSample[]).filter((sample) => sampleMatchesProfileScope(sample, options.scope));
    for (const sample of trainingSamples) {
      const bucket = sample.outcome === "helpful" || sample.outcome === "accepted" ? positiveSignals : negativeSignals;
      samples += 1;
      for (const key of Object.keys(baseSignalTemplate()) as Array<keyof RetrievalWeights>) {
        bucket[key] = (bucket[key] ?? 0) + (sample.signals?.[key] ?? 0);
      }
    }
    const base = service.retrievalProfiles.get("default")?.weights ?? normalizeRetrievalWeights();
    const lossBefore = profileLoss(base, trainingSamples);
    const learned = { ...base };
    if (samples) {
      for (const key of Object.keys(base) as Array<keyof RetrievalWeights>) {
        learned[key] = Math.max(0.01, base[key] + ((positiveSignals[key] ?? 0) - (negativeSignals[key] ?? 0)) / Math.max(20, samples * 10));
      }
    }
    const profile = service.setRetrievalProfile({
      id,
      label,
      weights: learned,
      scope: options.scope,
      learned: true,
      trainingSamples: samples,
      benchmarkDelta: 0,
      provenance: "feedback coordinate update"
    });
    return { profile, samples, positiveSignals, negativeSignals, lossBefore, lossAfter: profileLoss(profile.weights, trainingSamples) };
  }

export function linkIdentity(service: any, primaryUserId: string, linkedUserId: string, consentToken: string, consent: IdentityLink["consent"] = "user"): IdentityLink {
    const link = service.identities.link(primaryUserId, linkedUserId, consentToken, consent);
    service.recordAudit("memory.consent", { userId: primaryUserId, metadata: { resource: "identity-link", linkedUserId, consent, linkId: link.id, hashedSubject: link.hashedSubject } });
    service.persist();
    return link;
  }

export function unlinkIdentity(service: any, id: string): IdentityLink {
    const link = service.identities.unlink(id);
    service.recordAudit("memory.consent", { userId: link.primaryUserId, metadata: { resource: "identity-link", linkedUserId: link.linkedUserId, linkId: link.id, revoked: true } });
    service.persist();
    return link;
  }
