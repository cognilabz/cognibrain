import type { IdentityLink } from "./types";

export class IdentityResolver {
  private links = new Map<string, IdentityLink>();

  link(primaryUserId: string, linkedUserId: string, consentToken: string, consent: IdentityLink["consent"] = "user"): IdentityLink {
    const link: IdentityLink = {
      id: `link_${hashSubject(`${primaryUserId}:${linkedUserId}:${consentToken}`).slice(0, 16)}`,
      primaryUserId,
      linkedUserId,
      hashedSubject: hashSubject(consentToken),
      consent,
      createdAt: new Date().toISOString()
    };
    this.links.set(link.id, link);
    return link;
  }

  unlink(id: string): IdentityLink {
    const link = this.links.get(id);
    if (!link) throw new Error(`Identity link not found: ${id}`);
    const updated = { ...link, revokedAt: new Date().toISOString() };
    this.links.set(id, updated);
    return updated;
  }

  resolve(userId: string): string[] {
    const ids = new Set([userId]);
    for (const link of this.links.values()) {
      if (link.revokedAt) continue;
      if (link.primaryUserId === userId) ids.add(link.linkedUserId);
      if (link.linkedUserId === userId) ids.add(link.primaryUserId);
    }
    return [...ids];
  }

  import(links: IdentityLink[]): void {
    this.links.clear();
    for (const link of links) this.links.set(link.id, link);
  }

  export(): IdentityLink[] {
    return [...this.links.values()];
  }
}

function hashSubject(value: string): string {
  let hash = 5381;
  for (const char of value) hash = ((hash << 5) + hash) ^ char.charCodeAt(0);
  return `h_${(hash >>> 0).toString(36)}`;
}
