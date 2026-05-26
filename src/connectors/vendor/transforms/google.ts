import type { MemoryExtractionEvent } from "../../../core";
import { arr, obj, str } from "../http";

export function gmailMessageItem(message: Record<string, unknown>): Record<string, unknown> {
  return {
    externalId: str(message.id, ""),
    threadId: str(message.threadId, undefined),
    account: process.env.MEMORY_GMAIL_ACCOUNT ?? "me",
    title: str(message.subject, `Gmail message ${message.id ?? ""}`),
    updatedAt: str(message.internalDate, undefined)
  };
}

export function gmailMessageEvent(item: Record<string, unknown>): MemoryExtractionEvent & { externalId?: string } {
  return {
    role: "user",
    content: `Gmail message ${str(item.externalId, "")} in ${str(item.account, "me")} is ready for memory review.`,
    externalId: str(item.externalId, ""),
    source: { kind: "human", confidence: 0.78 },
    metadata: { vendor: "gmail", eventType: "email_decision", account: item.account, threadId: item.threadId, visibility: "private", reviewRequired: true }
  };
}

export function googleDriveFileItem(file: Record<string, unknown>): Record<string, unknown> {
  const owner = arr(file.owners).map(obj)[0];
  return {
    externalId: str(file.id, ""),
    title: str(file.name, "Untitled Drive file"),
    mimeType: str(file.mimeType, undefined),
    url: str(file.webViewLink, undefined),
    updatedAt: str(file.modifiedTime, undefined),
    author: str(owner.displayName, str(owner.emailAddress, undefined)),
    description: str(file.description, "")
  };
}

export function googleDriveFileEvent(item: Record<string, unknown>): MemoryExtractionEvent & { externalId?: string } {
  return {
    role: "tool",
    content: `Google Drive file ${str(item.title, "Untitled file")}: ${str(item.description, "metadata changed").slice(0, 1000)}`,
    externalId: str(item.externalId, ""),
    uri: str(item.url, undefined),
    timestamp: str(item.updatedAt, undefined),
    source: { kind: "import", confidence: 0.84 },
    metadata: { vendor: "google-drive", eventType: /runbook|adr|decision/i.test(`${item.title ?? ""} ${item.description ?? ""}`) ? "architecture_decision" : "doc_decision", mimeType: item.mimeType, author: item.author, visibility: "org" }
  };
}

export function googleCalendarEventItem(event: Record<string, unknown>): Record<string, unknown> {
  return {
    externalId: str(event.id, ""),
    title: str(event.summary, "Untitled calendar event"),
    description: str(event.description, ""),
    url: str(event.htmlLink, undefined),
    start: str(obj(event.start).dateTime, str(obj(event.start).date, undefined)),
    updatedAt: str(event.updated, undefined),
    organizer: str(obj(event.organizer).email, undefined)
  };
}

export function googleCalendarEvent(item: Record<string, unknown>): MemoryExtractionEvent & { externalId?: string } {
  return {
    role: "tool",
    content: `Google Calendar event ${str(item.title, "Untitled event")}: ${str(item.description, "no description").slice(0, 1000)}`,
    externalId: str(item.externalId, ""),
    uri: str(item.url, undefined),
    timestamp: str(item.start, str(item.updatedAt, undefined)),
    source: { kind: "human", confidence: 0.82 },
    metadata: { vendor: "google-calendar", eventType: /incident|postmortem|decision|architecture/i.test(`${item.title ?? ""} ${item.description ?? ""}`) ? "architecture_decision" : "calendar_decision", calendarId: process.env.MEMORY_GOOGLE_CALENDAR_ID, organizer: item.organizer, visibility: "org" }
  };
}
