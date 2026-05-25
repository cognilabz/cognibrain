Plan1_4 tracks the product-readiness and marketing foundation pass after PR #321 was merged.

GitHub tracking issue: https://github.com/cognilabz/cognibrain/issues/322

The issue text below is the source plan for the implementation branch. The work is complete only when the repo contains the implementation, docs, connector proof, release checks and fresh validation artifacts described here.

---

# Issue Title

```text
Strategic Gap Analysis: Production-Ready Engineering Memory OS, Marketing Positioning, Docs, Benchmarks & Platform Workpackages
```

# Issue Body

## Summary

cognibrain has made significant progress toward becoming a real **Engineering Memory OS for coding agents**. The current repository is no longer a simple memory prototype: the README now clearly positions cognibrain as a local-first TypeScript Engineering Memory OS that captures corrections, repo policies, architecture decisions, review feedback and tool outcomes as evidence-grade memory, then injects the right context before the next code change. It also explicitly tracks implementation status, claim evidence and production readiness boundaries.

The repository now includes scripts and surfaces for CogniCodeBench, answer-generation benchmarks, load benchmarks, Postgres verification, connector verification, vendor connector verification, status verification and multiple plan audits. The `package.json` shows that the project has moved beyond a basic MVP and now includes CLI, MCP, dashboard, benchmarks, SDK packaging, connector install helpers and production/self-hosted verification scripts.

However, the next phase should not be “add more random memory features”. The next phase should be to turn cognibrain into a **production-grade, market-legible, benchmark-backed Engineering Memory OS** with clear product positioning, professional documentation, verified claims, stable APIs, connector distribution and a strong public benchmark story.

The strongest strategic claim should be:

> **cognibrain is the Engineering Memory OS that helps coding agents stop repeating the same mistake twice.**

Or, in product language:

> **cognibrain captures corrections, repo rules, review feedback and tool outcomes as evidence-grade memory, then injects the right context before the next code change.**

---

## Current Repo State

### What is already strong

The README already has a much stronger product narrative than before. It uses the phrase **Engineering Memory OS for coding agents**, describes the core loop around corrections, repo policies, architecture decisions, review feedback and tool outcomes, and frames the project as a memory system that can route, govern, cite and audit memory before injection.

The README also includes a production readiness section that distinguishes local development from team/networked deployments. It says local development can run with JSON storage and no keys, while team/networked use must enable auth, durable storage, backup and transport controls. It lists gates such as `verify:nextgen`, `verify:status`, `benchmark:cognicode`, `verify:postgres`, connector checks and `doctor --publish`.

The implementation status matrix is now a strong governance surface. It distinguishes code, API, CLI, MCP, dashboard, tests, docs and production readiness for many features. It also documents that MemoryRecordV2, SQLite/Postgres-compatible storage, API-key auth, policy engine, EvidencePack, Engineering Memory object model, coding context packs, query planner, graph path explanation, BM25/FTS, vector backend hooks, connector SDK, GitHub/Slack/Discord connectors, MCP v2 tools, SDKs, OpenAPI, CogniCodeBench and load benchmarks are tracked against evidence gates.

The claims document is especially valuable because it maps public claims to evidence gates and clearly separates real claims from non-claims. This is important for professional marketing because it prevents overclaiming and makes the project more trustworthy.

The production readiness document is also much more mature now. It explicitly says cognibrain is a **self-hosted production candidate**, not a managed SaaS certification, and lists what is ready today, what requires target-environment verification, and what must not be claimed yet.

### What is still risky or unclear

Despite the progress, we need to keep a strict line between:

* **implemented locally**
* **verified by synthetic or hermetic tests**
* **self-hosted production candidate**
* **real customer production proof**
* **managed SaaS readiness**
* **market leadership**

The docs already acknowledge some of these boundaries. The main remaining work is to make these boundaries more visible, more polished and more productized.

Key risk areas:

1. **Marketing is improved but still not fully productized.**
   README is better, but we still need a coherent marketing/doc structure: landing-page narrative, comparison pages, demo script, benchmark page, claims page, production page, and status matrix all tied together.

2. **CogniCodeBench exists, but should become the flagship proof.**
   `package.json` now has `benchmark:cognicode:generate` and `benchmark:cognicode`, and the implementation status claims 100 deterministic synthetic coding-agent scenarios with correction carryover, repeated mistake rate, procedure recall, patch correctness, evidence completeness and wrong-memory suppression.
   This should become the central public benchmark story.

3. **Synthetic proof must be marketed honestly.**
   The claims file correctly states that CogniCodeBench is synthetic benchmark proof and should not be used to claim real customer repo performance.
   This boundary should remain visible in README, benchmark docs and market pages.

4. **Production readiness is self-hosted, not SaaS.**
   The production readiness doc correctly says not to claim managed SaaS uptime, autoscaling, SSO, billing or hosted support without deployment-specific proof.
   Marketing and docs must keep this clear.

5. **The public issue tracker currently does not show a matching open issue.**
   A new strategic issue should track the next productization phase.

---

## Market Positioning

### Recommended category

```text
Engineering Memory OS for AI Coding Agents
```

### Recommended hero claim

```text
Stop fixing the same agent mistake twice.
```

### Recommended product description

```text
cognibrain is the Engineering Memory OS for coding agents. It captures corrections, repo policies, review feedback, architecture decisions and tool outcomes as evidence-grade memory, then injects the right context before the next code change.
```

### Recommended long-form positioning

```text
cognibrain turns agent experience into reusable engineering memory. Instead of storing vague summaries or generic user facts, it captures what matters for software work: repo-specific policies, previous corrections, PR review feedback, tool outcomes, procedures, architecture decisions, forbidden actions and codebase evolution. Every context pack is scoped, cited, policy-checked and explainable before it reaches the agent.
```

---

## Market Comparison Narrative

### vs Mem0

**Mem0:** strong general-purpose memory API, managed-service story, broad SDKs/integrations, strong public benchmarks.

**cognibrain:** should win on engineering-specific memory, evidence-grade context packs, correction carryover, repo/branch scope, tool outcome memory, action guards and explainability.

Suggested positioning:

```text
Mem0 remembers user facts. cognibrain helps coding agents stop repeating engineering mistakes.
```

### vs GBrain

**GBrain:** strong personal markdown brain, ownership, compounding loops, hybrid search, great for personal OpenClaw/Hermes workflows.

**cognibrain:** should win on team/agent/harness memory, coding-specific corrections, EvidencePacks, policy-aware context injection, benchmark proof and production-oriented API/SDK/MCP.

Suggested positioning:

```text
GBrain is a personal markdown brain. cognibrain is engineering memory for coding agents and teams.
```

### vs Hindsight

**Hindsight:** strong production memory infrastructure, observations/mental models, multi-strategy retrieval and broad integrations.

**cognibrain:** should win on the coding-agent-specific loop: corrections → memory → next patch → better action, plus evidence-grade patch trails and CogniCodeBench proof.

Suggested positioning:

```text
Hindsight builds general agent memory. cognibrain specializes in evidence-grade engineering memory.
```

### vs Zep / Graphiti

**Zep / Graphiti:** strong temporal knowledge graph for conversational AI and temporal facts.

**cognibrain:** should win on engineering temporal truth: repo rule validity, branch/commit context, migration notes, superseded test commands, and next-change correctness.

Suggested positioning:

```text
Zep knows when facts changed. cognibrain knows which engineering rule applies before the next code change.
```

### vs Cognee

**Cognee:** strong graph/vector memory and data-source positioning.

**cognibrain:** should win on engineering-agent action loops: review correction, command outcome, procedure recall, forbidden action guard, evidence trail.

Suggested positioning:

```text
Cognee connects knowledge. cognibrain turns engineering feedback into better agent behavior.
```

---

## Strategic Gap Analysis

### Gap 1 — Marketing story needs final polish

The README is already better, but the product story should be repeated consistently across README, PRODUCT.md, docs, benchmarks and comparison pages.

**Need:**

* one-liner
* short pitch
* long pitch
* value props
* proof points
* comparison copy
* FAQ
* screenshots/GIFs
* demo script

### Gap 2 — CogniCodeBench must become the flagship benchmark

CogniCodeBench is the most differentiated proof surface. It should become the central public benchmark because it directly tests the target use case:

```text
Codebase → change → mistake/correction → memory → next change → correct action
```

This is much stronger than generic recall.

### Gap 3 — Comparison pages should be product-grade

We need polished pages for:

* cognibrain vs Mem0
* cognibrain vs GBrain
* cognibrain vs Hindsight
* cognibrain vs Zep
* cognibrain vs Cognee

Each should be fair, factual, bounded by claims, and tied to evidence.

### Gap 4 — Documentation structure should become professional

The docs should be reorganized into a more product-grade structure:

```text
docs/
  getting-started/
  concepts/
  integrations/
  benchmarks/
  production/
  api/
  sdk/
  compare/
  marketing/
  status.md
```

### Gap 5 — Claims need to remain machine-verifiable

The current `docs/claims.md` is a very strong start. We should extend it so every public marketing sentence maps to a claim ID and every claim ID maps to an artifact or test.

### Gap 6 — Production-ready story must stay honest

The current production-readiness doc is honest and useful. It should be expanded into a full production docs section, but should preserve its current boundary: self-hosted production candidate, not managed SaaS.

### Gap 7 — Real-world proof beyond synthetic benchmarks

CogniCodeBench synthetic proof is excellent, but it should be complemented by:

* real demo repos
* example PRs
* recorded agent runs
* harness-specific golden paths
* real GitHub PR review correction examples
* real connector smoke examples

---

## Proposed Workpackages

## Epic 1 — Product Narrative & Marketing Foundation

### WP 1.1 — Finalize canonical messaging pack

**Goal:**
Create a reusable messaging source of truth.

**Deliverables:**

* `docs/marketing/messaging.md`
* one-liner
* 30-second pitch
* long product description
* value props
* proof points
* FAQ
* comparison snippets
* approved claims list

**Acceptance criteria:**

* README, PRODUCT.md and docs use the same canonical phrasing.
* Every public claim references a claim ID from `docs/claims.md`.
* No “best on market” or “production ready” claim appears without boundary.

---

### WP 1.2 — Rewrite README around the core demo

**Goal:**
Turn README into a conversion-focused product page.

**Recommended structure:**

1. Hero: “Stop fixing the same agent mistake twice.”
2. One-paragraph product explanation.
3. Short demo flow.
4. Why Agent Memory OS.
5. Why Engineering Memory.
6. CogniCodeBench proof.
7. Quickstart.
8. Production boundary.
9. Integrations.
10. Docs/status/claims links.

**Acceptance criteria:**

* A new visitor understands the product within 30 seconds.
* CogniCodeBench is visible above the fold or near the top.
* README links to status matrix, claims and production readiness.

---

### WP 1.3 — Build comparison pages

**Goal:**
Create fair market comparisons.

**Files:**

* `docs/compare/mem0.md`
* `docs/compare/gbrain.md`
* `docs/compare/hindsight.md`
* `docs/compare/zep.md`
* `docs/compare/cognee.md`

**Each page should contain:**

* who the competitor is best for
* where cognibrain differs
* feature table
* benchmark/proof boundary
* honest limitations
* call to action

**Acceptance criteria:**

* No unfair competitor bashing.
* Claims are tied to evidence IDs.
* Pages can be linked from README.

---

## Epic 2 — Documentation Overhaul

### WP 2.1 — Reorganize docs information architecture

**Goal:**
Make the docs professional and navigable.

**Proposed structure:**

```text
docs/
  getting-started/
    quickstart.md
    local-install.md
    self-hosted-install.md
    first-engineering-memory.md
  concepts/
    engineering-memory.md
    evidence-pack.md
    context-pack.md
    corrections.md
    tool-outcomes.md
    procedure-memory.md
    temporal-belief-graph.md
    policy-aware-retrieval.md
  integrations/
    claude-code.md
    codex.md
    cursor.md
    github.md
    slack-discord.md
    mcp.md
  benchmarks/
    cognicodebench.md
    methodology.md
    results.md
    ablations.md
  production/
    overview.md
    storage.md
    auth.md
    policy.md
    backup-restore.md
    observability.md
    migrations.md
    security.md
  compare/
    mem0.md
    gbrain.md
    hindsight.md
    zep.md
    cognee.md
  marketing/
    messaging.md
    claims.md
  implementation-status.md
```

**Acceptance criteria:**

* Existing docs are mapped to the new structure.
* No broken links.
* README points to the new docs entry points.

---

### WP 2.2 — Expand production docs

**Goal:**
Make production readiness credible.

**Docs to add or expand:**

* self-hosted architecture
* storage backends
* auth and API keys
* tenant isolation
* policy engine
* backup and restore
* connector credential handling
* observability and metrics
* upgrade/migration
* release checklist
* “not managed SaaS” boundary

**Acceptance criteria:**

* Docs explain local vs team vs production.
* Production setup is executable.
* `doctor --publish` references the docs.

---

### WP 2.3 — Add architecture diagrams

**Goal:**
Make the system easier to understand.

**Diagrams:**

* Agent → Memory Router → Evidence Graph → Context Pack
* Correction → Engineering Memory → Next Change
* Connector → SourceRef → Memory → EvidencePack
* Dream/Reflection lifecycle
* Policy enforcement path
* CogniCodeBench scenario lifecycle

**Acceptance criteria:**

* Mermaid diagrams render in GitHub.
* Diagrams are included in concepts and README.
* Diagrams match current code surfaces.

---

## Epic 3 — CogniCodeBench as Public Flagship

### WP 3.1 — Create CogniCodeBench landing doc

**Goal:**
Make CogniCodeBench understandable as a market proof.

**File:**

```text
docs/benchmarks/cognicodebench.md
```

**Sections:**

* What it measures
* Why existing memory benchmarks are insufficient
* Scenario lifecycle
* Metrics
* Ablation modes
* How to run
* How to interpret results
* Claim boundaries

**Acceptance criteria:**

* A reader understands why CogniCodeBench exists.
* Synthetic proof boundary is clear.
* Commands match `package.json`.

---

### WP 3.2 — Publish baseline table

**Goal:**
Show why cognibrain is different.

**Baselines:**

* no memory
* raw chat history
* keyword only
* semantic/vector only
* graph only
* temporal only
* procedure only
* full cognibrain

**Acceptance criteria:**

* Results generated from `artifacts/cognicodebench/run.json`.
* README links to benchmark results.
* Claims use `CB-CLAIM-COGNICODE` and `CB-CLAIM-ABLATION`.

---

### WP 3.3 — Add real demo repo scenarios

**Goal:**
Complement synthetic benchmark with concrete examples.

**Demo repos:**

* TypeScript API
* React app
* Python FastAPI service
* Monorepo
* legacy app

**Acceptance criteria:**

* Each demo has before/after task.
* Each demo has correction and next-change validation.
* Results can be replayed.

---

## Epic 4 — Productized Evidence Experience

### WP 4.1 — EvidencePack UI polish

**Goal:**
Make evidence-grade memory tangible.

**UI should show:**

* why memory was selected
* source and citation
* trust/confidence
* policy decision
* graph path
* temporal validity
* contradiction/supersession state
* retrieval profile

**Acceptance criteria:**

* User can inspect every context item.
* UI uses plain language, not only JSON.
* Export is available.

---

### WP 4.2 — Patch Evidence Trail

**Goal:**
Show which memories influenced a code change.

**Output:**

* context pack ID
* memories used
* corrections applied
* procedures recalled
* forbidden actions avoided
* commands run
* tool outcomes
* stale memories excluded

**Acceptance criteria:**

* Available via CLI/API/MCP.
* Used in CogniCodeBench artifact.
* Displayed in dashboard.

---

### WP 4.3 — “Why was this memory used?” demo

**Goal:**
Create a short flagship demo.

**Demo flow:**

1. Agent makes mistake.
2. User corrects.
3. cognibrain stores correction.
4. Agent performs next change correctly.
5. UI shows why context was injected.

**Acceptance criteria:**

* Demo can be run locally.
* README includes GIF/screenshot.
* Demo artifacts are checked into docs or generated.

---

## Epic 5 — Engineering Memory Model Completion

### WP 5.1 — Verify Engineering Memory Types across surfaces

**Goal:**
Ensure all Engineering Memory types are exposed consistently.

**Types:**

* repo policy
* architecture decision
* review correction
* tool outcome
* procedure
* forbidden action
* migration note
* test strategy
* dependency rule
* generated file rule

**Acceptance criteria:**

* Core type exists.
* API exposes type.
* CLI can filter by type.
* MCP can return type.
* Dashboard can filter type.
* Tests cover at least one full loop per type.

---

### WP 5.2 — Correction-to-procedure pipeline

**Goal:**
Turn corrections into future behavior.

**Example:**

```text
"Use npm test, not pnpm"
```

becomes:

* repo policy
* forbidden action
* procedure
* wrong action supersession
* future guard

**Acceptance criteria:**

* Pipeline is covered in tests.
* CogniCodeBench uses it.
* EvidencePack shows the transformation.

---

### WP 5.3 — Tool outcome memory

**Goal:**
Make tool results first-class.

**Stored fields:**

* command
* cwd
* exit code
* output summary
* failure reason
* success reason
* files touched
* duration
* environment hints

**Acceptance criteria:**

* Tool outcomes become retrievable.
* Failed actions can be avoided.
* Successful commands can become procedure candidates.

---

## Epic 6 — Integrations & Distribution

### WP 6.1 — Connector package docs

**Goal:**
Make connector installation feel first-party.

**Targets:**

* Claude Code
* Codex
* Cursor
* GitHub Copilot
* VS Code
* OpenCode
* LangGraph
* CrewAI

**Acceptance criteria:**

* Each connector has a dedicated docs page.
* Each page has install, verify, troubleshoot.
* Each page states current maturity level.

---

### WP 6.2 — GitHub connector product demo

**Goal:**
Show PR review feedback becoming memory.

**Demo:**

1. PR review requests change.
2. cognibrain ingests review.
3. Review correction becomes memory.
4. Next patch uses it.

**Acceptance criteria:**

* Demo uses built-in GitHub connector.
* EvidencePack links back to PR comment.
* README/Docs include result.

---

### WP 6.3 — Connector maturity matrix

**Goal:**
Prevent overclaiming connector readiness.

**Matrix columns:**

* manifest
* install helper
* auth lifecycle
* poll/list
* webhook
* writeback
* real vendor smoke
* docs
* production certified

**Acceptance criteria:**

* Matrix included in docs.
* `verify:vendor-connectors` updates artifact.
* Production claims reference matrix.

---

## Epic 7 — Production & Release Readiness

### WP 7.1 — Release checklist automation

**Goal:**
One command should verify release readiness.

**Command:**

```bash
npm run release:check
```

**Should run:**

* test
* build
* verify:status
* audit:plan1_3
* benchmark:cognicode
* verify:postgres
* verify:compatibility
* doctor --publish
* npm pack --dry-run

**Acceptance criteria:**

* Fails with actionable error messages.
* Produces release artifact summary.
* Used before tagging.

---

### WP 7.2 — Production boundary badges

**Goal:**
Make maturity visible.

**Badges/labels:**

* local-ready
* self-hosted candidate
* deployment-verified
* vendor-smoke required
* managed SaaS future

**Acceptance criteria:**

* Each major feature has maturity label.
* Docs explain labels.
* README avoids ambiguous production language.

---

### WP 7.3 — Observability docs and endpoint proof

**Goal:**
Make operations credible.

**Docs should cover:**

* metrics
* logs
* request IDs
* connector lag
* dream duration
* policy denials
* benchmark drift
* repeated mistake rate

**Acceptance criteria:**

* `/metrics` or equivalent documented.
* Dashboard shows key operational metrics.
* Production docs explain monitoring.

---

## Epic 8 — Market Pages & Launch Assets

### WP 8.1 — Create `/docs/market/` pages

**Pages:**

* `why-engineering-memory-os.md`
* `stop-fixing-same-agent-mistake.md`
* `cognicodebench-proof.md`
* `evidence-grade-memory.md`

**Acceptance criteria:**

* Pages use marketing language.
* Claims link to `docs/claims.md`.
* Pages are readable by non-experts.

---

### WP 8.2 — Launch narrative

**Goal:**
Prepare first public launch narrative.

**Structure:**

1. AI coding agents repeat mistakes.
2. Generic memory does not solve engineering behavior.
3. cognibrain captures corrections/reviews/tool outcomes.
4. CogniCodeBench measures next-change correctness.
5. EvidencePacks make memory inspectable.
6. Self-hosted launch, managed SaaS not claimed.

**Acceptance criteria:**

* `docs/marketing/launch-narrative.md`
* Can be reused for blog/product page.
* Avoids unsupported “best” claims.

---

### WP 8.3 — Social / README snippets

**Deliverables:**

* GitHub repo description.
* Product tagline.
* 3 tweet-style posts.
* 3 Hacker News style blurbs.
* 1 LinkedIn post.
* 1 launch email intro.

**Acceptance criteria:**

* Each snippet maps to claim IDs.
* No benchmark overclaim.
* Clear CTA to CogniCodeBench demo.

---

## Prioritized Next Steps

### P0 — Issue to create now

This issue itself should track the marketing/docs/platform productization push.

### P1 — Documentation and marketing polish

* WP 1.1 Messaging pack
* WP 1.2 README rewrite
* WP 2.1 Docs architecture
* WP 8.2 Launch narrative

### P2 — Benchmark proof productization

* WP 3.1 CogniCodeBench landing doc
* WP 3.2 Baseline table
* WP 4.3 Why-used demo

### P3 — Evidence UX

* WP 4.1 EvidencePack UI polish
* WP 4.2 Patch Evidence Trail
* WP 5.2 Correction-to-procedure pipeline

### P4 — Distribution proof

* WP 6.1 Connector package docs
* WP 6.2 GitHub connector demo
* WP 6.3 Connector maturity matrix

### P5 — Production release polish

* WP 7.1 Release checklist automation
* WP 7.2 Production boundary badges
* WP 7.3 Observability docs

---

## Definition of Done

This strategic issue is done when:

* README communicates the Engineering Memory OS positioning clearly.
* `docs/marketing/messaging.md` exists and is used consistently.
* `docs/benchmarks/cognicodebench.md` explains the flagship benchmark.
* Comparison pages exist for Mem0, GBrain, Hindsight, Zep and Cognee.
* Implementation status and claims docs remain aligned with code.
* Production readiness docs clearly separate local-ready, self-hosted candidate and managed SaaS future.
* EvidencePack/Why-used demo is visible in README or docs.
* Connector maturity matrix exists.
* Launch narrative is prepared.
* All public marketing claims map to claim IDs and evidence gates.

---

## Notes

The repo is already in a much stronger state than previous reviews. The next risk is no longer “missing features”; the risk is **feature sprawl without a crisp product story**.

The recommended focus is:

> **Make the category, benchmark and proof story obvious.**

The product should not be marketed as “another memory layer”.

It should be marketed as:

```text
The Engineering Memory OS that helps coding agents stop repeating the same mistake twice.
```
