# The First Morning — Experience Design

**Status:** Draft — awaiting Alex's approval
**Drives:** spec-0004
**Rule:** The experience described here drives the implementation, not the other way around.

---

## 1. Design goal

The First Morning is not a briefing feature. It is the first moment where AIOS proves it is a
trusted operating partner that already understands Alex's world.

**The 30-second contract:** Within 30 seconds of opening AIOS, Alex knows

1. the shape of his day (calm / loaded / surprising),
2. what actually needs him,
3. what he can safely ignore,
4. what to decide first.

If cognitive load is not noticeably lower after 30 seconds, the slice has failed —
regardless of technical correctness.

The morning ends when Alex **starts his first task**, not when he finishes reading.

---

## 2. The scene

Tuesday, 07:42. Alex opens AIOS. One screen, no scrolling for the core. The briefing speaks
German (user-facing language policy). Illustrative copy:

> **AIOS — Dienstag, 21. Juli, 07:42**
>
> Ruhige Nacht. Seit gestern Abend haben sich drei Dinge verändert — eines davon braucht
> dich vor deinem 10-Uhr-Termin.
>
> **Braucht dich heute (2)**
> 1. **Angebot IMH** — Frist heute. Gestern kam eine Rückfrage von Dr. Weber zu den
>    Lizenzkosten; ohne deine Antwort geht das Angebot nicht raus.
> 2. **10:00 Call B8** — gestern von 14:00 vorverlegt; du hast dadurch 2 h weniger
>    Vorbereitung als geplant.
>
> **Entscheide zuerst:** die IMH-Antwort — sie blockiert den Versand, und dein
> 10-Uhr-Slot frisst sonst die Frist.
>
> **Verändert seit gestern (3):** Call vorverlegt · Weber-Rückfrage · Rechnung 2026-114
> bezahlt (erledigt sich selbst)
>
> **Blockiert (1):** LinkedIn-Serie wartet auf Eddys Feedback — nicht dein Zug.
>
> **Beobachte ich für dich (11):** Newsletter, CC-Mails, zwei Terminbestätigungen —
> nichts davon braucht dich heute. [zeigen]
>
> **Was ich nicht sehe:** Notion und GitHub kenne ich noch nicht; E-Mails erst seit
> gestern 18:00. Dort können blinde Flecken liegen.
>
> Womit fängst du an?

---

## 3. Structure and rationale

| Element | Rule | Why |
|---|---|---|
| Opening line | One sentence that proves understanding: shape of day + the single most time-critical fact. Never "Good morning! Here is your briefing." | The first 3 seconds must demonstrate that AIOS has already processed the world. |
| Needs you today | Max 3 items. Each: what + one-sentence why + what changed. | More than 3 is a todo list, not a judgment. The *why* is what makes it a partner. |
| Decide first | Exactly one, only if a real decision exists. | Sequencing is the COO's job. Two "first" decisions = zero. |
| Changed since yesterday | Delta, not state. Items already acknowledged are never repeated. | A partner tells you what's new; a report dumps state. Delta is the core load reducer. |
| Blocked | Split "waiting on you" (goes to Needs you) vs "not your move" (rests here). | "Not your move" is explicit permission to let go. |
| Ignorable | Collapsed by default: count + one summarizing line + expandable list. | The trust move: the list is *available*, not shown. Showing it would recreate the load AIOS exists to remove. |
| Blind spots | One honest line about what AIOS cannot see (sources, time coverage). | Admitted uncertainty is what makes the confident claims credible. |
| Close | An open question: "Womit fängst du an?" — with context ready for the likely answer. | Hands over agency. AIOS proposes, Alex decides. |

### Emphasis order

Time-critical before important · decisions before information · changes before standing state.

### What AIOS deliberately does NOT say

- No inbox counts, no full lists, no raw feeds ("you have 47 emails" is forbidden).
- No repetition of anything Alex already saw and acknowledged.
- No recommendation without a stated reason.
- No motivational filler, no praise, no emoji. Partner, not app.
- Nothing about items with no change and no deadline proximity — silence is information.

### Confidence and uncertainty

- Confidence is expressed through phrasing, not scores: "braucht dich" (confident) vs
  "vermutlich ignorierbar — sag mir, wenn das falsch ist" (uncertain).
- A surprise slot exists but is empty by default; it appears only for genuine anomalies.
- Blind spots are always one line, always honest, never apologetic.

---

## 4. It is a conversation

The briefing accepts answers. Minimal verb set for v1:

| Alex says | AIOS does |
|---|---|
| "warum?" | Shows the reasoning behind one judgment. |
| "ignorier das" / "dauerhaft" | Moves item to ignorable; permanent → learning event. |
| "das ist wichtiger als du denkst" | Promotes item; records correction as learning event. |
| "zeig mir die ignorierten" | Expands the ignorable list. |
| names a task | AIOS confirms and surfaces the relevant context (handoff to work). |

Every correction is a first-class learning event — the seed of the Coach loop. Corrections
per week trending down = AIOS is learning.

### The one-question rule

AIOS may ask at most **one** question per morning (e.g. "Was ist diese Woche das
Wichtigste?"). Never an onboarding wizard. The first mornings, this question seeds the
goal linkage that triage needs.

### First-run honesty

On the literal first morning, AIOS says what it is: early, seeing only calendar and email,
not yet goals or projects — and asks its one question. It never fakes a maturity it
does not have.

---

## 5. Success criteria (product, not technical)

1. Alex no longer opens Outlook/calendar *first* in the morning.
2. Time from opening AIOS to starting the first task shrinks.
3. Corrections per week trend down.
4. The subjective test: after 30 seconds, "Yes. This is exactly why I wanted to build AIOS."

---

## 6. Constraints for spec-0004 (derived, not designed here)

- Real data is part of the normal dev workflow: Outlook ICS feed live (env already exists),
  email as real as trivially possible.
- Triage judgment lives in Deliberation; folded back via events (ADR-0017); all surfaces
  render the same SituationView.
- First real model behind the MAL seam; golden tests stay on MockModel; triage contract
  tests assert structure, never wording.
- Acknowledged/seen state and corrections need persistence — expected architecture
  learning: where does "what Alex already saw" live (Memory vs Situation)?
