import { DOMAIN_MODULES, type ConnectorManifest, type MarketplaceInstallPlan, type MarketplaceModule, type MarketplaceReview, type MarketplaceSubmission, type PersonaProfile, type RetrievalProfile } from "../../core";
import { averageRating, clampRating, contentHash, marketplaceRisks, securityScanFor } from "./helpers";

export function installMarketplaceModule(service: any, module: MarketplaceModule): MarketplaceModule {
    const plan = service.marketplaceInstallPlan(module);
    if (!plan.valid) throw new Error(`Marketplace module failed validation: ${plan.risks.join(", ")}`);
    const current = service.marketplaceModules.get(module.id);
    const installed = {
      ...module,
      security: module.security ?? securityScanFor(module),
      installState: "installed" as const,
      trustSignals: {
        ...(module.trustSignals ?? current?.trustSignals),
        securityStatus: (module.security ?? current?.security)?.status ?? securityScanFor(module).status,
        installCount: (current?.trustSignals?.installCount ?? module.trustSignals?.installCount ?? 0) + 1
      }
    };
    service.marketplaceModules.set(installed.id, installed);
    if (installed.kind === "persona") {
      const manifest = installed.manifest as Partial<PersonaProfile>;
      if (manifest.id && manifest.label) {
        service.setPersona({
          id: manifest.id,
          label: manifest.label,
          summaryStyle: manifest.summaryStyle ?? "concise",
          retrievalWeights: manifest.retrievalWeights,
          privacyDefault: manifest.privacyDefault,
          domain: manifest.domain
        });
      }
    }
    if (installed.kind === "connector") {
      service.registerConnectorManifest(installed.manifest as unknown as ConnectorManifest);
    }
    if (installed.kind === "domain") {
      const manifest = installed.manifest as { id?: string };
      const domain = DOMAIN_MODULES.find((item) => item.id === manifest.id);
      if (domain) {
        if (domain.aliases) service.entities.configureAliases(domain.aliases);
        if (domain.retrievalWeights) {
          service.setRetrievalProfile({
            id: `domain:${domain.id}`,
            label: `${domain.label} Domain`,
            weights: domain.retrievalWeights,
            provenance: "marketplace"
          });
        }
      }
    }
    if (installed.kind === "retrieval_profile") {
      const manifest = installed.manifest as Partial<RetrievalProfile>;
      if (manifest.id && manifest.weights) service.setRetrievalProfile({ id: manifest.id, label: manifest.label ?? installed.name, weights: manifest.weights, provenance: "marketplace" });
    }
    service.recordAudit("marketplace.install", { metadata: { moduleId: installed.id, kind: installed.kind, actions: plan.actions, risks: plan.risks } });
    service.persist();
    return installed;
  }

export function installMarketplaceModuleById(service: any, moduleId: string): MarketplaceModule {
    const module = service.marketplaceModules.get(moduleId);
    if (!module) throw new Error(`Marketplace module not found: ${moduleId}`);
    return service.installMarketplaceModule(module);
  }

export function marketplaceInstallPlan(service: any, moduleOrId: MarketplaceModule | string): MarketplaceInstallPlan {
    const module = typeof moduleOrId === "string" ? service.marketplaceModules.get(moduleOrId) : moduleOrId;
    if (!module) return { moduleId: String(moduleOrId), valid: false, actions: [], risks: ["module not found"] };
    const risks = marketplaceRisks(module);
    const actions = [`record ${module.kind} module ${module.id}`];
    actions.push("verify module signature metadata");
    actions.push("check cognibrain version compatibility");
    if (module.security?.permissions?.length) actions.push(`request permissions: ${module.security.permissions.join(", ")}`);
    if (module.kind === "persona") actions.push("materialize persona defaults");
    if (module.kind === "connector") actions.push("register connector manifest");
    if (module.kind === "retrieval_profile") actions.push("save retrieval profile");
    if (module.kind === "domain") actions.push("make domain module available for runtime config");
    return { moduleId: module.id, valid: risks.every((risk) => !risk.startsWith("blocked:")), actions, risks };
  }

export function listMarketplaceModules(service: any): MarketplaceModule[] {
    return [...service.marketplaceModules.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

export function submitMarketplaceModule(service: any, input: { module: MarketplaceModule; submitter: string; sourceUrl?: string }): MarketplaceSubmission {
    const id = `submission_${contentHash(`${input.module.id}:${input.module.version}:${input.submitter}`).slice(2, 14)}`;
    const submittedAt = new Date().toISOString();
    const submission: MarketplaceSubmission = {
      id,
      module: {
        ...input.module,
        installState: "available",
        trustSignals: {
          ...(input.module.trustSignals ?? {}),
          publisher: input.submitter,
          sourceUrl: input.sourceUrl
        }
      },
      submitter: input.submitter,
      sourceUrl: input.sourceUrl,
      status: "submitted",
      submittedAt,
      reviewNotes: [],
      reviews: []
    };
    service.marketplaceSubmissions.set(id, submission);
    service.recordAudit("marketplace.submit", { actorId: input.submitter, metadata: { submissionId: id, moduleId: input.module.id, sourceUrl: input.sourceUrl } });
    service.persist();
    return submission;
  }

export function scanMarketplaceSubmission(service: any, submissionId: string): MarketplaceSubmission {
    const submission = service.requireMarketplaceSubmission(submissionId);
    const scan = securityScanFor(submission.module);
    const updated: MarketplaceSubmission = {
      ...submission,
      status: scan.status === "blocked" ? "changes_requested" : "scanned",
      scannedAt: new Date().toISOString(),
      scan,
      module: {
        ...submission.module,
        security: scan,
        trustSignals: { ...(submission.module.trustSignals ?? {}), securityStatus: scan.status }
      },
      reviewNotes: [...submission.reviewNotes, ...scan.risks]
    };
    service.marketplaceSubmissions.set(submissionId, updated);
    service.recordAudit("marketplace.scan", { actorId: "security-scan", metadata: { submissionId, moduleId: updated.module.id, status: scan.status, risks: scan.risks } });
    service.persist();
    return updated;
  }

export function reviewMarketplaceSubmission(service: any, submissionId: string, review: { reviewer: string; rating: number; comment?: string; approve?: boolean; requestChanges?: boolean; reject?: boolean }): MarketplaceSubmission {
    const submission = service.requireMarketplaceSubmission(submissionId);
    const normalizedReview: MarketplaceReview = {
      reviewer: review.reviewer,
      rating: clampRating(review.rating),
      comment: review.comment,
      createdAt: new Date().toISOString()
    };
    const reviews = [...submission.reviews, normalizedReview];
    const status = review.reject
      ? "rejected"
      : review.requestChanges
        ? "changes_requested"
        : review.approve
          ? "approved"
          : submission.status;
    const updated: MarketplaceSubmission = {
      ...submission,
      status,
      reviewedAt: normalizedReview.createdAt,
      reviews,
      reviewNotes: review.comment ? [...submission.reviewNotes, review.comment] : submission.reviewNotes,
      module: {
        ...submission.module,
        trustSignals: {
          ...(submission.module.trustSignals ?? {}),
          ratingAverage: averageRating(reviews),
          ratingCount: reviews.length,
          reviewCount: reviews.length,
          lastReviewedAt: normalizedReview.createdAt
        }
      }
    };
    service.marketplaceSubmissions.set(submissionId, updated);
    service.recordAudit("marketplace.review", { actorId: review.reviewer, metadata: { submissionId, moduleId: updated.module.id, status, rating: normalizedReview.rating } });
    service.persist();
    return updated;
  }

export function publishMarketplaceSubmission(service: any, submissionId: string): MarketplaceModule {
    const submission = service.requireMarketplaceSubmission(submissionId);
    if (submission.status !== "approved" && submission.status !== "scanned") throw new Error(`Marketplace submission ${submissionId} must be scanned or approved before publish`);
    const scan = submission.scan ?? securityScanFor(submission.module);
    if (scan.status === "blocked") throw new Error(`Marketplace submission ${submissionId} is blocked by security scan`);
    const publishedAt = new Date().toISOString();
    const published: MarketplaceModule = {
      ...submission.module,
      security: scan,
      installState: "available",
      trustSignals: {
        ...(submission.module.trustSignals ?? {}),
        securityStatus: scan.status,
        publisher: submission.submitter,
        publishedAt,
        sourceUrl: submission.sourceUrl,
        ratingAverage: averageRating(submission.reviews),
        ratingCount: submission.reviews.length,
        reviewCount: submission.reviews.length
      }
    };
    const updated: MarketplaceSubmission = { ...submission, status: "published", publishedAt, module: published, scan };
    service.marketplaceSubmissions.set(submissionId, updated);
    service.marketplaceModules.set(published.id, published);
    service.recordAudit("marketplace.publish", { actorId: submission.submitter, metadata: { submissionId, moduleId: published.id, securityStatus: scan.status } });
    service.persist();
    return published;
  }

export function listMarketplaceSubmissions(service: any, status?: MarketplaceSubmission["status"]): MarketplaceSubmission[] {
    return [...service.marketplaceSubmissions.values()]
      .filter((submission) => !status || submission.status === status)
      .sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)));
  }

export function rateMarketplaceModule(service: any, moduleId: string, review: { reviewer: string; rating: number; comment?: string }): MarketplaceModule {
    const module = service.marketplaceModules.get(moduleId);
    if (!module) throw new Error(`Marketplace module not found: ${moduleId}`);
    const priorCount = module.trustSignals?.ratingCount ?? 0;
    const priorAverage = module.trustSignals?.ratingAverage ?? 0;
    const rating = clampRating(review.rating);
    const ratingCount = priorCount + 1;
    const updated: MarketplaceModule = {
      ...module,
      trustSignals: {
        ...(module.trustSignals ?? {}),
        ratingAverage: ((priorAverage * priorCount) + rating) / ratingCount,
        ratingCount,
        reviewCount: (module.trustSignals?.reviewCount ?? 0) + (review.comment ? 1 : 0),
        lastReviewedAt: new Date().toISOString()
      }
    };
    service.marketplaceModules.set(moduleId, updated);
    service.recordAudit("marketplace.review", { actorId: review.reviewer, metadata: { moduleId, rating, comment: review.comment } });
    service.persist();
    return updated;
  }
