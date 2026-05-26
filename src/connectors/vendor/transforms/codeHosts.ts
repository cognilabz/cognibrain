import type { MemoryExtractionEvent } from "../../../core";
import { arr, obj, str } from "../http";

export function gitlabMergeRequestItem(mergeRequest: Record<string, unknown>): Record<string, unknown> {
  return {
    externalId: `mr-${mergeRequest.iid ?? mergeRequest.id ?? ""}`,
    iid: mergeRequest.iid,
    title: str(mergeRequest.title, "Untitled GitLab merge request"),
    state: str(mergeRequest.state, undefined),
    url: str(mergeRequest.web_url, undefined),
    author: str(obj(mergeRequest.author).username, str(obj(mergeRequest.author).name, undefined)),
    updatedAt: str(mergeRequest.updated_at, undefined),
    labels: arr(mergeRequest.labels).filter((item): item is string => typeof item === "string")
  };
}

export function gitlabMergeRequestEvent(item: Record<string, unknown>): MemoryExtractionEvent & { externalId?: string } {
  const project = process.env.MEMORY_GITLAB_PROJECT ?? "";
  return {
    role: "tool",
    content: `GitLab merge request ${str(item.externalId, "")}: ${str(item.title, "untitled")} in ${project}.`,
    externalId: str(item.externalId, ""),
    uri: str(item.url, undefined),
    timestamp: str(item.updatedAt, undefined),
    source: { kind: "reviewed_code", confidence: 0.91 },
    metadata: { vendor: "gitlab", eventType: "pr_decision", project, mergeRequest: item.iid, author: item.author, labels: item.labels, state: item.state }
  };
}

export function azurePullRequestItem(pull: Record<string, unknown>): Record<string, unknown> {
  return {
    externalId: `pr-${pull.pullRequestId ?? pull.codeReviewId ?? ""}`,
    pullRequestId: pull.pullRequestId,
    repositoryId: str(obj(pull.repository).id, undefined),
    title: str(pull.title, "Untitled Azure DevOps pull request"),
    status: str(pull.status, undefined),
    url: str(pull.url, str(pull.remoteUrl, undefined)),
    author: str(obj(pull.createdBy).displayName, str(obj(pull.createdBy).uniqueName, undefined)),
    updatedAt: str(pull.creationDate, undefined)
  };
}

export function azurePullRequestEvent(item: Record<string, unknown>): MemoryExtractionEvent & { externalId?: string } {
  return {
    role: "tool",
    content: `Azure DevOps pull request ${str(item.externalId, "")}: ${str(item.title, "untitled")}.`,
    externalId: str(item.externalId, ""),
    uri: str(item.url, undefined),
    timestamp: str(item.updatedAt, undefined),
    source: { kind: "reviewed_code", confidence: 0.89 },
    metadata: { vendor: "azure-devops", eventType: "pr_decision", organization: process.env.MEMORY_AZURE_DEVOPS_ORG, project: process.env.MEMORY_AZURE_DEVOPS_PROJECT, pullRequest: item.pullRequestId, repositoryId: item.repositoryId, author: item.author, status: item.status }
  };
}

export function githubPullItem(pull: Record<string, unknown>): Record<string, unknown> {
  return {
    externalId: `pr-${pull.number}`,
    title: pull.title,
    state: pull.state,
    url: pull.html_url,
    author: (pull.user as Record<string, unknown> | undefined)?.login,
    updatedAt: pull.updated_at
  };
}

export function githubPullEvent(item: Record<string, unknown>): MemoryExtractionEvent & { externalId?: string } {
  const repo = process.env.MEMORY_GITHUB_REPO ?? "";
  return {
    role: "tool",
    content: `GitHub pull request ${item.externalId}: ${str(item.title, "untitled")} in ${repo}.`,
    externalId: String(item.externalId ?? ""),
    uri: str(item.url, undefined),
    timestamp: str(item.updatedAt, undefined),
    source: { kind: "reviewed_code", confidence: 0.93 },
    metadata: { vendor: "github", eventType: "pr_decision", repo, pullRequest: Number(String(item.externalId ?? "").replace(/^pr-/, "")), author: item.author, state: item.state }
  };
}
