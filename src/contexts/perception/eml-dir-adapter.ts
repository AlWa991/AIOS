/**
 * EmlDirAdapter (spec-0003): first read-only email integration.
 * Reads a directory of RFC 822 `.eml` files, parses them with mailparser,
 * folds messages into threads (In-Reply-To/References, fallback normalized
 * subject) and emits ONE observation per new/changed thread — watermark-based
 * idempotency via the existing perception_watermarks table (source "email").
 *
 * Perception normalizes, it does not relay: HTML → text, quoted reply tails
 * and signature blocks stripped, body reduced to a snippet, Date header → UTC.
 */
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { simpleParser, type AddressObject } from "mailparser";
import type { Db } from "../../platform/db/pool.js";
import type { Clock } from "../../platform/scheduler/clock.js";
import type { Observation, PerceptionAdapter } from "./adapter.js";

const WATERMARK_SOURCE = "email";
const SNIPPET_MAX = 200;

type Warn = (msg: string, detail: Record<string, unknown>) => void;

const structuredLog =
  (level: "warn" | "error") => (msg: string, detail: Record<string, unknown>) =>
    console.error(JSON.stringify({ level, msg, adapter: "email-eml", ...detail }));

/** One parsed email message, already normalized (UTC, cleaned body). */
export type EmlMessage = {
  file: string;
  /** Message-ID without angle brackets; fallback `file:<basename>`. */
  messageId: string;
  /** True when the Message-ID came from the header (not the file fallback). */
  hasRealMessageId: boolean;
  /** Referenced message ids (References + In-Reply-To), normalized. */
  references: string[];
  subject: string;
  /** Subject with Re:/Fwd:/AW:/WG: prefixes stripped (original case). */
  foldedSubject: string;
  /** Lowercased folded subject — grouping key for the subject fallback. */
  normalizedSubject: string;
  /** Sender display name (falls back to the address). */
  from: string;
  /** From/To/Cc display names (fallback address) in header order. */
  participants: string[];
  /** Date header converted to UTC ISO; null when absent/invalid. */
  date: string | null;
  /** Body text (HTML already converted), quotes + signature stripped. */
  text: string;
  attachmentCount: number;
};

/** One folded thread — the unit that becomes a single observation. */
export type EmlThread = {
  /** Stable thread id: earliest message's Message-ID (root of the chain). */
  threadId: string;
  /** Messages sorted by date ascending (undated first). */
  messages: EmlMessage[];
  latest: EmlMessage;
  title: string;
  snippet: string;
  mentions: string[];
  messageCount: number;
};

/** Strip Re:/Fw:/Fwd:/AW:/WG: prefixes (repeated, case-insensitive). */
export function foldSubject(subject: string): string {
  return subject.replace(/^\s*(?:(?:re|aw|fw|fwd|wg)(?:\[\d+\])?\s*:\s*)+/i, "").trim();
}

const QUOTE_INTRO = [
  /^\s*>/, // quoted line
  /^On\b.+\bwrote:/, // "On Sat, 18 Jul 2026 ... Alex wrote:"
  /^Am\b.+\bschrieb\b.*:/, // "Am 18.07.2026 um 09:12 schrieb Eduard Dinges:"
  /^-{2,}\s*(Original Message|Ursprüngliche Nachricht)/i,
  /^Von:\s.+/, // Outlook-style forwarded header block
];

/** Remove quoted reply tails and signature blocks ("-- " delimiter). */
export function cleanBody(text: string): string {
  const lines = text.split(/\r?\n/);
  let end = lines.length;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (/^--\s*$/.test(line) || QUOTE_INTRO.some((re) => re.test(line))) {
      end = i;
      break;
    }
  }
  return lines.slice(0, end).join("\n").trim();
}

/** Whitespace-collapsed snippet, at most ~SNIPPET_MAX chars. */
export function toSnippet(text: string, max: number = SNIPPET_MAX): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.length <= max ? collapsed : `${collapsed.slice(0, max - 1).trimEnd()}…`;
}

function normalizeId(raw: string): string {
  return raw.trim().replace(/^</, "").replace(/>$/, "");
}

function addressNames(addr: AddressObject | AddressObject[] | undefined): string[] {
  if (!addr) return [];
  const list = Array.isArray(addr) ? addr : [addr];
  const names: string[] = [];
  for (const a of list) {
    for (const v of a.value) {
      const name = v.name?.trim() || v.address?.trim();
      if (name) names.push(name);
    }
  }
  return names;
}

/** Very small fallback in case mailparser yields no text for an HTML mail. */
function htmlToTextFallback(html: string): string {
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .trim();
}

/**
 * Parse one raw `.eml` buffer into an EmlMessage. Returns null (with a
 * structured warning) for files that carry no email headers at all.
 * Attachment content is skipped by design (spec-0003 non-goal).
 */
export async function parseEmlMessage(
  raw: Buffer | string,
  file: string,
  warn: Warn = structuredLog("warn"),
): Promise<EmlMessage | null> {
  const mail = await simpleParser(raw);
  const base = path.basename(file);

  const rawMessageId = mail.messageId ? normalizeId(mail.messageId) : null;
  const hasHeaders = Boolean(rawMessageId || mail.subject || mail.from);
  if (!hasHeaders) {
    warn("skipping malformed .eml (no email headers found)", { file: base });
    return null;
  }

  const references: string[] = [];
  const refRaw = mail.references;
  for (const r of Array.isArray(refRaw) ? refRaw : refRaw ? [refRaw] : []) {
    references.push(normalizeId(r));
  }
  if (mail.inReplyTo) {
    const id = normalizeId(mail.inReplyTo);
    if (!references.includes(id)) references.push(id);
  }

  const attachmentCount = mail.attachments?.length ?? 0;
  if (attachmentCount > 0) {
    warn("attachment content skipped (spec-0003 non-goal)", {
      file: base,
      attachments: mail.attachments.map((a) => a.filename ?? "unnamed"),
    });
  }

  // mailparser derives .text from HTML when no plain part exists; keep a
  // deterministic fallback so HTML-only mails never yield an empty body.
  const rawText =
    (mail.text ?? "").trim() ||
    (typeof mail.html === "string" ? htmlToTextFallback(mail.html) : "");

  const subject = (mail.subject ?? "").trim();
  const foldedSubject = foldSubject(subject);
  const fromNames = addressNames(mail.from);
  const participants = [
    ...fromNames,
    ...addressNames(mail.to as AddressObject | AddressObject[] | undefined),
    ...addressNames(mail.cc as AddressObject | AddressObject[] | undefined),
  ];

  return {
    file: base,
    messageId: rawMessageId ?? `file:${base}`,
    hasRealMessageId: rawMessageId !== null,
    references,
    subject,
    foldedSubject,
    normalizedSubject: foldedSubject.toLowerCase(),
    from: fromNames[0] ?? "",
    participants,
    date: mail.date && !Number.isNaN(mail.date.getTime()) ? mail.date.toISOString() : null,
    text: cleanBody(rawText),
    attachmentCount,
  };
}

/** Minimal union-find over string keys. */
class UnionFind {
  private parent = new Map<string, string>();
  find(x: string): string {
    let root = this.parent.get(x) ?? x;
    if (root !== x) {
      root = this.find(root);
      this.parent.set(x, root);
    }
    return root;
  }
  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(rb, ra);
  }
}

/**
 * Fold messages into threads: connected components over Message-ID /
 * References; messages without any header linkage fall back to grouping by
 * normalized subject. Thread id = earliest message's Message-ID (stable when
 * later replies arrive). Result sorted by threadId for determinism.
 */
export function foldThreads(messages: EmlMessage[]): EmlThread[] {
  const uf = new UnionFind();
  const referenced = new Set<string>();
  for (const m of messages) for (const r of m.references) referenced.add(r);

  for (const m of messages) {
    for (const r of m.references) uf.union(m.messageId, r);
  }
  for (const m of messages) {
    const linked = m.references.length > 0 || referenced.has(m.messageId);
    if (!linked && m.normalizedSubject) {
      uf.union(m.messageId, `subject:${m.normalizedSubject}`);
    }
  }

  const groups = new Map<string, EmlMessage[]>();
  for (const m of messages) {
    const root = uf.find(m.messageId);
    const list = groups.get(root) ?? [];
    list.push(m);
    groups.set(root, list);
  }

  const threads: EmlThread[] = [];
  for (const group of groups.values()) {
    group.sort((a, b) => {
      const ka = `${a.date ?? ""}|${a.file}`;
      const kb = `${b.date ?? ""}|${b.file}`;
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
    const earliest = group[0]!;
    const latest = group[group.length - 1]!;
    const mentions: string[] = [];
    for (const m of group) {
      for (const p of m.participants) {
        if (!mentions.includes(p)) mentions.push(p);
      }
    }
    threads.push({
      threadId: earliest.messageId,
      messages: group,
      latest,
      title: latest.foldedSubject || earliest.foldedSubject || "(no subject)",
      snippet: toSnippet(latest.text),
      mentions,
      messageCount: group.length,
    });
  }
  threads.sort((a, b) => (a.threadId < b.threadId ? -1 : a.threadId > b.threadId ? 1 : 0));
  return threads;
}

/** Content hash per spec-0003: latest message id + message count + subject. */
export function threadContentHash(thread: EmlThread): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        threadId: thread.threadId,
        latestMessageId: thread.latest.messageId,
        messageCount: thread.messageCount,
        title: thread.title,
      }),
    )
    .digest("hex");
}

export class EmlDirAdapter implements PerceptionAdapter {
  readonly source = "email" as const;

  constructor(
    private readonly db: Db,
    private readonly clock: Clock,
    private readonly dir: string,
  ) {}

  async collect(day: string): Promise<Observation[]> {
    const warn = structuredLog("warn");

    let files: string[];
    try {
      files = (await fs.readdir(this.dir)).filter((f) => f.toLowerCase().endsWith(".eml")).sort();
    } catch (err) {
      // Unreadable directory is non-fatal: other sources continue (spec-0003).
      structuredLog("error")("email .eml directory unreadable, skipping email ingest", {
        dir: this.dir,
        error: String(err),
      });
      return [];
    }

    const messages: EmlMessage[] = [];
    for (const file of files) {
      try {
        const raw = await fs.readFile(path.join(this.dir, file));
        const msg = await parseEmlMessage(raw, file, warn);
        if (msg) messages.push(msg);
      } catch (err) {
        warn("skipping unparseable .eml file", { file, error: String(err) });
      }
    }

    const threads = foldThreads(messages);

    const res = await this.db.query(
      `SELECT item_uid, content_hash FROM perception_watermarks WHERE source = $1`,
      [WATERMARK_SOURCE],
    );
    const seen = new Map<string, string>(
      res.rows.map((r) => [r.item_uid as string, r.content_hash as string]),
    );

    const observations: Observation[] = [];
    const now = this.clock.now().toISOString();
    for (const thread of threads) {
      const hash = threadContentHash(thread);
      if (seen.get(thread.threadId) === hash) {
        await this.db.query(
          `UPDATE perception_watermarks SET last_seen_at = $3
           WHERE source = $1 AND item_uid = $2`,
          [WATERMARK_SOURCE, thread.threadId, now],
        );
        continue;
      }
      observations.push({
        source: this.source,
        externalId: thread.threadId,
        title: thread.title,
        body: thread.snippet,
        from: thread.latest.from || undefined,
        mentions: thread.mentions,
        occursAt: thread.latest.date ?? undefined,
        horizon: thread.latest.date?.slice(0, 10) === day ? "today" : "week",
        sourceUid: thread.latest.messageId,
        threadId: thread.threadId,
        messageCount: thread.messageCount,
      });
      await this.db.query(
        `INSERT INTO perception_watermarks (source, item_uid, content_hash, last_seen_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (source, item_uid)
         DO UPDATE SET content_hash = EXCLUDED.content_hash, last_seen_at = EXCLUDED.last_seen_at`,
        [WATERMARK_SOURCE, thread.threadId, hash, now],
      );
    }
    return observations;
  }
}
