/** Unit tests for the .eml email adapter's parsing + thread folding (spec-0003) — no DB. */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  cleanBody,
  foldSubject,
  foldThreads,
  parseEmlMessage,
  threadContentHash,
  toSnippet,
  type EmlMessage,
} from "../src/contexts/perception/eml-dir-adapter.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const SAMPLES = path.join(DIR, "..", "fixtures", "sample-emails");

const noWarn = () => undefined;

async function parseSample(file: string): Promise<EmlMessage> {
  const msg = await parseEmlMessage(readFileSync(path.join(SAMPLES, file)), file, noWarn);
  expect(msg).not.toBeNull();
  return msg!;
}

async function parseAllSamples(): Promise<EmlMessage[]> {
  const files = readdirSync(SAMPLES).filter((f) => f.endsWith(".eml")).sort();
  const out: EmlMessage[] = [];
  for (const f of files) out.push(await parseSample(f));
  return out;
}

describe("eml parsing (spec-0003)", () => {
  it("converts the Date header (+02:00) to UTC ISO", async () => {
    const msg = await parseSample("01-deployment-window.eml");
    expect(msg.date).toBe("2026-07-19T06:15:00.000Z"); // 08:15 Berlin (CEST)
  });

  it("strips the signature block from a plain-text mail", async () => {
    const msg = await parseSample("01-deployment-window.eml");
    expect(msg.text).toContain("lock the deployment window");
    expect(msg.text).not.toContain("CTO, D&W IT Consulting");
  });

  it("converts an HTML-only mail to text", async () => {
    const msg = await parseSample("02-infra-status.eml");
    expect(msg.text).toContain("Monitoring-Umbau");
    expect(msg.text).toContain("Postgres Backup");
    expect(msg.text).not.toContain("<p>");
    expect(msg.text).not.toContain("<b>");
  });

  it("decodes quoted-printable UTF-8 umlauts in subject and body", async () => {
    const msg = await parseSample("03-rueckfrage-foerdermittel.eml");
    expect(msg.subject).toBe("Rückfrage Fördermittel");
    expect(msg.text).toContain("Fördermitteln");
    expect(msg.text).toContain("für die Energieberater-Pakete");
    expect(msg.text).toContain("Grüße");
  });

  it("strips quoted reply tails (German 'Am ... schrieb:' marker)", async () => {
    const msg = await parseSample("11-imh-offer-2.eml");
    expect(msg.text).toContain("raise the PDF report block");
    expect(msg.text).not.toContain("schrieb Eduard Dinges");
    expect(msg.text).not.toContain("> first draft");
  });

  it("strips quoted reply tails (English 'On ... wrote:' marker)", async () => {
    const msg = await parseSample("12-imh-offer-3.eml");
    expect(msg.text).toContain("updated to 13 days total");
    expect(msg.text).not.toContain("wrote:");
    expect(msg.text).not.toContain("> Numbers look good");
  });

  it("parses a mail with an attachment but skips the attachment content", async () => {
    const warnings: string[] = [];
    const raw = readFileSync(path.join(SAMPLES, "30-invoice-draft.eml"));
    const msg = await parseEmlMessage(raw, "30-invoice-draft.eml", (m) => warnings.push(m));
    expect(msg).not.toBeNull();
    expect(msg!.attachmentCount).toBe(1);
    expect(msg!.text).toContain("Q3 invoice draft");
    expect(msg!.text).not.toContain("JVBERi0"); // base64 body never leaks
    expect(warnings.some((w) => w.includes("attachment content skipped"))).toBe(true);
  });

  it("extracts From/To display names as participants", async () => {
    const msg = await parseSample("20-workshop-anfrage.eml");
    expect(msg.from).toBe("Petra Lindner");
    expect(msg.participants).toEqual(["Petra Lindner", "Alex"]);
    expect(msg.subject).toBe("Anfrage: KI-Workshop für unser Team");
  });

  it("rejects a file without any email headers with a warning", async () => {
    const warnings: string[] = [];
    const msg = await parseEmlMessage("this is not an email at all", "garbage.eml", (m) =>
      warnings.push(m),
    );
    expect(msg).toBeNull();
    expect(warnings.some((w) => w.includes("malformed"))).toBe(true);
  });
});

describe("thread folding (spec-0003)", () => {
  it("folds subject prefixes Re:/Fwd:/AW:/WG: case-insensitively", () => {
    expect(foldSubject("Re: Budget Q3")).toBe("Budget Q3");
    expect(foldSubject("AW: Re: Budget Q3")).toBe("Budget Q3");
    expect(foldSubject("WG: fwd: FW: Budget Q3")).toBe("Budget Q3");
    expect(foldSubject("Budget Q3")).toBe("Budget Q3");
  });

  it("groups the 3-message thread via References into ONE thread", async () => {
    const messages = await parseAllSamples();
    const threads = foldThreads(messages);
    const imh = threads.find((t) => t.threadId === "imh-offer-0001@dw-itconsulting.de");
    expect(imh).toBeDefined();
    expect(imh!.messageCount).toBe(3);
    expect(imh!.latest.messageId).toBe("imh-offer-0003@dw-itconsulting.de");
    // one thread per single mail + one for the 3-message chain
    expect(threads).toHaveLength(6);
  });

  it("uses the latest message for title and snippet (prefix-stripped)", async () => {
    const messages = await parseAllSamples();
    const imh = foldThreads(messages).find(
      (t) => t.threadId === "imh-offer-0001@dw-itconsulting.de",
    )!;
    expect(imh.title).toBe("IMH Angebot: Klassifizierungs-Webapp Phase 2");
    expect(imh.snippet).toContain("updated to 13 days total");
    expect(imh.snippet.length).toBeLessThanOrEqual(200);
  });

  it("collects mentions from From/To across the whole thread", async () => {
    const messages = await parseAllSamples();
    const imh = foldThreads(messages).find(
      (t) => t.threadId === "imh-offer-0001@dw-itconsulting.de",
    )!;
    expect(imh.mentions).toEqual(["Eddy", "Alex"]);
  });

  it("groups messages WITHOUT threading headers by normalized subject", async () => {
    const a = await parseEmlMessage(
      [
        "Message-ID: <fb-1@example.org>",
        "Date: Sat, 18 Jul 2026 10:00:00 +0200",
        "From: Eddy <e@example.org>",
        "Subject: Budget Q3",
        "",
        "Initial budget numbers.",
      ].join("\n"),
      "fb-1.eml",
      noWarn,
    );
    const b = await parseEmlMessage(
      [
        "Message-ID: <fb-2@example.org>",
        "Date: Sun, 19 Jul 2026 10:00:00 +0200",
        "From: Alex <a@example.org>",
        "Subject: AW: Budget Q3",
        "",
        "Looks fine to me.",
      ].join("\n"),
      "fb-2.eml",
      noWarn,
    );
    const threads = foldThreads([a!, b!]);
    expect(threads).toHaveLength(1);
    expect(threads[0]!.threadId).toBe("fb-1@example.org");
    expect(threads[0]!.messageCount).toBe(2);
    expect(threads[0]!.title).toBe("Budget Q3");
  });

  it("keeps different subjects in different threads (fallback does not over-merge)", async () => {
    const messages = await parseAllSamples();
    const threads = foldThreads(messages);
    const singles = threads.filter((t) => t.messageCount === 1);
    expect(singles).toHaveLength(5);
  });

  it("content hash changes when a new reply arrives (count + latest id)", async () => {
    const messages = await parseAllSamples();
    const imh = foldThreads(messages).find(
      (t) => t.threadId === "imh-offer-0001@dw-itconsulting.de",
    )!;
    const before = threadContentHash(imh);
    const reply = { ...imh.latest, messageId: "imh-offer-0004@dw-itconsulting.de" };
    const grown = {
      ...imh,
      messages: [...imh.messages, reply],
      latest: reply,
      messageCount: imh.messageCount + 1,
    };
    expect(threadContentHash(grown)).not.toBe(before);
    expect(threadContentHash({ ...imh })).toBe(before);
  });
});

describe("content reduction helpers (spec-0003)", () => {
  it("cleanBody cuts at the first quoted line", () => {
    expect(cleanBody("New content.\n> old quoted line\n> more")).toBe("New content.");
  });

  it("cleanBody cuts at the signature delimiter", () => {
    expect(cleanBody("Real text.\n-- \nEddy\nCTO")).toBe("Real text.");
  });

  it("toSnippet collapses whitespace and caps at ~200 chars", () => {
    const long = "word ".repeat(100);
    const snip = toSnippet(long);
    expect(snip.length).toBeLessThanOrEqual(200);
    expect(snip.endsWith("…")).toBe(true);
    expect(toSnippet("short  text\n\nhere")).toBe("short text here");
  });
});
