import type { MemoryExtractionEvent } from "../../../core";
import { arr, obj, str } from "../http";
import { htmlText } from "./helpers";

export function teamsMessageItem(message: Record<string, unknown>): Record<string, unknown> {
  return {
    externalId: str(message.id, ""),
    channel: process.env.MEMORY_TEAMS_CHANNEL_ID,
    team: process.env.MEMORY_TEAMS_TEAM_ID ?? process.env.MEMORY_TEAMS_TENANT_ID,
    text: htmlText(str(obj(message.body).content, str(message.summary, ""))),
    author: str(obj(obj(message.from).user).displayName, str(obj(obj(message.from).application).displayName, undefined)),
    createdAt: str(message.createdDateTime, undefined),
    url: str(message.webUrl, undefined)
  };
}

export function teamsMessageEvent(item: Record<string, unknown>): MemoryExtractionEvent & { externalId?: string } {
  return {
    role: "user",
    content: `Microsoft Teams message in ${str(item.channel, "")}: ${str(item.text, "")}`,
    externalId: str(item.externalId, ""),
    uri: str(item.url, undefined),
    timestamp: str(item.createdAt, undefined),
    source: { kind: "transcript", confidence: 0.86 },
    metadata: { vendor: "teams", eventType: "thread_decision", team: item.team, channel: item.channel, author: item.author, reviewRequired: true, visibility: "org" }
  };
}
