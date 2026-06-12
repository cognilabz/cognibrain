# Cognibrain

Cognibrain is a self-hosted engineering memory layer for repo-carried agent
memory, with a harness-native operator experience backed by the text-first CLI.

## Language

**Memory**:
A durable, scoped fact, correction, procedure, preference, or evidence item that
can be recalled before an agent or operator acts.
_Avoid_: note, snippet, random context

**Memory Ledger**:
The ordered history of observations, corrections, judgments, outcomes, and
evidence from which Cognibrain understands what is remembered.
_Avoid_: mutable memory row, notes table

**Ephemeral Working Memory**:
Short-lived task context, hypotheses, and in-progress notes that help an agent
reason during a task but are not durable unless promoted into the Memory Ledger.
_Avoid_: durable memory, trusted recall, archived notes

**Shared Working Memory**:
Ephemeral Working Memory shared across capable agents in the same repository, so
active mistakes and task-local signals can prevent repeat agent failures before
they become durable memory.
_Avoid_: private scratchpad, durable collaboration log, user-global memory

**Mistake Prevention Claim**:
The greenfield solution's hard market promise that a capable agent should not
repeat a corrected mistake once Cognibrain has observed, judged, or been
corrected about it.
_Avoid_: generic recall, nice-to-have context, passive notes

**Product Mistake**:
A corrected repeated or repeatable agent failure that caused, or would likely
cause, bad work if repeated.
_Avoid_: annoyance, suboptimal choice, generic feedback, test failure only

**Product Mistake Evidence**:
Evidence strong enough to create or strengthen a Product Mistake: an explicit
developer correction, failed verification tied to an agent action, or repeated
agent failure with clear evidence.
_Avoid_: any failed command, exploration failure, agent self-reflection alone

**Full-Spectrum Mistake Surface**:
The V1 category scope that Product Mistakes may involve code style,
preferences, architecture, commands, safety, docs, or developer-state signals,
as long as they still satisfy the Product Mistake and Product Mistake Evidence
bars.
_Avoid_: command-only mistakes, everything-is-a-mistake, mood surveillance

**Recurrence Prevention Bias**:
The greenfield product bias that, once a Product Mistake is identified, future
agent behavior should first prevent the mistake from recurring and only then
tune down noise.
_Avoid_: silent recording, smoothness first, ask every time

**Repo Brain Narrative**:
The product story that Cognibrain is a repo brain for agentic development,
anchored by the Mistake Prevention Claim rather than broad "remember
everything" language.
_Avoid_: personal memory OS, generic knowledge base, remember everything

**Market Leadership Standard**:
The product bar that Cognibrain should be judged by preventing repeat agent
mistakes in real work, not by matching the feature lists of other memory tools.
_Avoid_: feature parity, market clone, generic memory store

**Mistake Replay Proof**:
The V1 proof artifact that replays real corrected Product Mistakes through a
Certified Harness and shows the agent avoids repeating them.
_Avoid_: benchmark leaderboard, polished demo, generic recall showcase

**Trust-First Memory**:
The default product bias that protects the Mistake Prevention Claim even when
it adds some workflow friction.
_Avoid_: flow-first recall, interruption-free memory, passive notes

**Greenfield Rebuild Scope**:
The boundary that Cognibrain's next memory solution is designed from scratch
using the current solution as reference material, without treating excluded
features as deletion targets in the existing solution.
_Avoid_: legacy migration, cleanup mandate, delete old features

**Repo-Carried Memory Scope**:
The product boundary that Cognibrain stores memory with the repository so any
developer or capable agent working from that checkout can inherit the repo's
memory. This is technical portability, not a collaboration promise; Cognibrain
should not be positioned as a multi-developer product until distributed sync and
conflict handling exist.
_Avoid_: collaboration-ready claim, hosted workspace memory, tenant memory

**Memory Merge Risk**:
The risk that multiple developers changing repo-carried memory through normal
version control create conflicts, divergent memory histories, or confusing
merges. Until this risk is handled, repo-carried memory should not be marketed as
collaborative memory.
_Avoid_: invisible sync, team admin workflow, conflict-free collaboration

**Brain Lifecycle**:
The user-facing Cognibrain lifecycle: notice, remember, warn, reflect, dream,
improve, and forget.
_Avoid_: marketing metaphor, feature checklist, generic workflow

**Notice**:
The lifecycle step where Cognibrain detects a possible memory-worthy event, such
as a mistake, correction, contradiction, repeated failure, repo rule, risky
action, or preference.
_Avoid_: save, promote, silently remember

**Save**:
The act of capturing raw material into Shared Working Memory or the Memory
Ledger without making it trusted recall.
_Avoid_: remember, promote, approve

**Remember**:
The lifecycle step where Cognibrain promotes judged information into trusted
durable memory that can appear in the Current Memory View.
_Avoid_: save, store, raw capture

**Warn**:
The lifecycle step where Cognibrain delivers Mistake Signals or Action Guards
before an agent acts.
_Avoid_: unexplained block, passive note, silent context injection

**Reflect**:
The lifecycle step where Cognibrain reviews a meaningful task outcome soon after
it happens to decide what should become Candidate Evidence, a Mistake Signal, or
a later Judgment Request.
_Avoid_: background cleanup, dream cycle, passive logging

**Improve**:
The lifecycle step where Cognibrain changes future behavior based on memory,
such as strengthening a guard, improving a notice trigger, promoting a
correction, retiring noise, or adding a benchmark case.
_Avoid_: passive storage, cosmetic summary, untested learning

**Mistake Signal**:
An immediate repo-wide warning in Shared Working Memory that a mistake was
observed, corrected, or predicted, so capable agents can avoid repeating it
before durable promotion.
_Avoid_: durable rule, final memory, silent failure note

**Confirmed Mistake Signal**:
A Mistake Signal based on an observed failure or explicit correction.
_Avoid_: prediction, suspicion, weak warning

**Predicted Mistake Signal**:
A tentative Mistake Signal raised before execution when the harness judges that
an agent is likely to repeat a known mistake.
_Avoid_: confirmed failure, durable blocker, trusted memory

**Action Guard**:
A pre-action intervention that warns or blocks an agent operation based on
Cognibrain memory.
_Avoid_: background note, lint rule, passive reminder

**Promoted Guard**:
A high-authority Action Guard created from promoted memory that may block
through a Certified Harness when a predicted mistake matches a trusted risk.
_Avoid_: tentative signal, weak warning, prediction-only blocker

**Operator Block Override**:
An explicit Operator decision with an Override Reason to bypass a blocking
Action Guard. It is one-time by default; making it persistent requires a
separate reasoned Operator decision.
_Avoid_: silent unblock, reasonless bypass, hidden policy change

**Override Reason**:
A short Operator explanation attached to an Operator Block Override. It is
private local evidence by default; agents may only receive a sanitized summary
when needed.
_Avoid_: raw agent-facing rationale, secret leak, public explanation

**Sanitized Summary**:
A durable, harness-mediated, agent-facing summary of private local evidence that
removes unsafe details while preserving the useful lesson for future behavior.
The Harness-Mediated Judgment that creates it may approve it automatically; once
approved, it is stored silently by default with a link back to the private
evidence.
_Avoid_: raw evidence, deterministic-only redaction, re-summarized rationale

**Summary Exception**:
A correction, appeal, audit request, or suspected privacy or safety problem that
makes an automatically approved Sanitized Summary visible to the Operator and
marks it as a Contested Summary.
_Avoid_: routine review, notification, silent failure

**Contested Summary**:
A Sanitized Summary under active question after a Summary Exception. It remains
usable with contested status until later review, judgment, correction, or
retirement changes it.
_Avoid_: paused summary, retired summary, fully trusted summary

**Contested Marker**:
A concise agent-visible label attached when a Contested Summary is delivered,
showing that the summary is under question without exposing the private reason.
_Avoid_: private reason, reason category, silent contested status

**Contested Use**:
Agent use of a Contested Summary as cautionary context. A contested summary may
help, but it should not be the sole basis for risky actions or strong claims.
_Avoid_: prohibition, normal trust, sole authority

**Contested Risk Judgment**:
A Harness-Mediated Judgment that decides whether a planned Contested Use would
make a Contested Summary the sole basis for a risky action or strong claim.
Deterministic examples may guide the judgment but do not decide it.
_Avoid_: fixed risk list, regex authority, agent-only self-assessment

**Independent Support**:
Non-contested, task-relevant evidence judged sufficient to support a risky
action or strong claim when a Contested Risk Judgment is unavailable. Examples
include current file inspection, test output, operator input, and non-contested
memory.
_Avoid_: contested summary alone, stale second memory, unsupported claim

**Signal Outcome**:
The recorded response to a Mistake Signal, Action Guard, or Best-Effort Signal,
such as followed, ignored, seen, appealed, changed course, judged irrelevant, or
used Independent Support.
_Avoid_: untracked warning, silent override, assumed compliance

**Independent Support Outcome**:
A lightweight Signal Outcome recording that an agent used Independent Support
while acting on a Contested Summary. It records the summary, support type,
confidence, and brief rationale without storing the full evidence snapshot.
_Avoid_: heavy review item, untracked contested use, full evidence snapshot

**Signal Appeal**:
A recorded challenge to a Mistake Signal, Action Guard, or Best-Effort Signal
that becomes Candidate Evidence for Dream but does not weaken protection by
itself.
_Avoid_: automatic weakening, instant retirement, silent unblock

**Signal Noise Evidence**:
Candidate Evidence created from repeated ignored or judged irrelevant Signal
Outcomes that suggest a signal may be stale, too broad, or noisy.
_Avoid_: automatic deletion, proof of uselessness, user correction

**Signal Noise Threshold**:
A repo-local Operator setting that defines the minimum pattern of Signal Noise
Evidence required before Dream may propose retiring, weakening, or rewriting a
signal.
_Avoid_: single dismissal, hidden default, automatic deletion

**Signal Noise Threshold Override**:
An explicit repo-local change that raises or lowers the default Signal Noise
Threshold, recorded with the Operator's reason and direction.
_Avoid_: silent weakening, implicit tuning, global policy

**Certified Warning Noise Override**:
A separate Signal Noise Threshold Override that lets a lowered threshold apply to
Certified Harness warnings. It persists until the Operator retires it, and each
use must be visibly attributed when Dream proposes weakening trusted protection.
_Avoid_: implicit certified weakening, best-effort-only lowering, hidden downgrade

**Authority Level**:
The precedence carried by a Memory Ledger event that helps Cognibrain resolve
conflicts and explain why one memory should outweigh another.
_Avoid_: relevance score, confidence, recency

**Authority Ladder**:
The product-defined ordering of Authority Levels that gives Cognibrain a default
way to compare conflicting memory sources.
_Avoid_: repo preference list, scoring weights

**Authority Override**:
A rare repository-specific change to the Authority Ladder that must be explicit
and explain why the default source precedence does not fit the project.
_Avoid_: hidden config, ad hoc exception

**Current Memory View**:
The active interpretation of the Memory Ledger that agents use for recall,
guards, and follow-up work.
_Avoid_: source of truth, raw memory

**Promotion Event**:
A Memory Ledger event that makes a candidate memory safe to include in the
Current Memory View, with its judgment, authority basis, and confidence recorded.
_Avoid_: automatic save, silent trust, direct injection

**Retirement Event**:
A Memory Ledger event that removes a memory from the Current Memory View while
preserving the history that explains why it was once trusted.
_Avoid_: delete, erase, hide

**Forget**:
The user-facing request to stop using a memory, normally implemented by a
Retirement Event that preserves Memory Ledger history.
_Avoid_: erase when audit history should remain

**Erase**:
The destructive removal of memory content or ledger history for privacy,
security, or legal reasons.
_Avoid_: forget, retire, archive

**Candidate Evidence**:
A low-authority or unresolved memory item that can inform a Judgment Request but
should not directly steer agent behavior as recalled context.
_Avoid_: injected memory, trusted context, final answer support

**Operator**:
The developer currently responsible for inspecting, correcting, approving, and
maintaining Cognibrain memory state in a checkout.
_Avoid_: team admin, organization owner, workspace manager

**Operator Experience**:
The V1 workflow where the developer inspects, corrects, approves, and maintains
Cognibrain memory through Harness prompts, Action Guards, and Operator CLI
commands in the same work context.
_Avoid_: Operator UI, dashboard, browser control plane

**Operator CLI**:
The text-first command surface for setup, status, memory work, connectors,
proof, and automation.
_Avoid_: TUI, dashboard

**Connector**:
A configured integration source or sink that can ingest external events,
surface review queues, or write back memory-linked context.
_Avoid_: plugin when the component syncs external operational data

**Harness**:
An installable agent or shell lifecycle integration that asks Cognibrain for
context, guards actions, and records outcomes.
_Avoid_: connector when the component wraps an agent workflow

**Harness Trigger Contract**:
The required lifecycle event contract every supported Harness must implement so
agent integrations trigger the Brain Lifecycle at the right workflow moments.
_Avoid_: best-effort integration, optional callback, adapter convention

**Harness Trigger Point**:
A required workflow moment where a Harness must notify Cognibrain so the Brain
Lifecycle can run consistently across agent integrations.
_Avoid_: optional hook, adapter-specific event, background poll

**Unavailable Trigger Point**:
A required Harness Trigger Point that a host tool cannot expose to its Harness.
_Avoid_: optional trigger, skipped trigger, partial support

**Harness Trace**:
A recorded lifecycle trace from real Harness execution that shows trigger order,
timing, correlation, delivered Cognibrain responses, and recorded outcomes.
_Avoid_: fake transcript, mocked conversation, claimed behavior

**Harness Conformance**:
Trace-backed proof that a Harness correctly fires required lifecycle triggers and
handles the resulting context, warnings, judgments, outcomes, and failures.
_Avoid_: manual smoke test, claimed support, unverified adapter

**Certified Harness**:
A Harness that has passed Harness Conformance at least once for the Harness
Trigger Contract using real Harness Traces and Harness Mutation Tests.
_Avoid_: current certification, expiring certification, best-effort harness

**Certification Evidence**:
The historical Harness Trace and Harness Mutation Test record that show how a
Certified Harness originally earned certification.
_Avoid_: freshness proof, expiry marker, current conformance

**Best-Effort Harness**:
A Harness integration that can call Cognibrain but lacks trace-backed,
mutation-tested Harness Conformance or has an Unavailable Trigger Point, so it
cannot claim the full Brain Lifecycle or Mistake Prevention Claim.
_Avoid_: certified harness, full support, verified harness

**Best-Effort Signal**:
An Action Guard or warning-only intervention emitted through a Best-Effort
Harness that clearly carries best-effort status.
_Avoid_: certified guard, full-lifecycle warning, guaranteed prevention

**Harness Mutation Test**:
A conformance check that intentionally disables or corrupts one required Harness
Trigger Point to prove Harness Conformance fails when lifecycle triggering is
broken.
_Avoid_: happy-path trace, fake transcript, manual check

**Repo-Installed Harness**:
A Harness whose durable contract lives with the repository, so project-specific
memory behavior follows the codebase across capable agents and operators.
_Avoid_: global-only plugin, user preference, local convenience script

**Harness-Mediated Judgment**:
A memory decision made by the host agent through an installed Harness, so
Cognibrain can rely on model reasoning without owning an external LLM API key.
_Avoid_: provider call, built-in model, API-key-backed judge

**Judgment Request**:
A typed question Cognibrain asks the host agent to resolve a semantic memory
decision, such as relevance, contradiction, risk, or evidence support.
_Avoid_: heuristic, regex rule, hidden prompt

**Judgment Checkpoint**:
A named point in the agent workflow where Cognibrain may pause progress and ask
the host agent to answer a Judgment Request before continuing.
_Avoid_: arbitrary interruption, background prompt, unsolicited advice

**Agent Memory Loop**:
The core Cognibrain workflow in which an agent requests context, checks risky
actions, performs work, and records outcomes, corrections, or patch evidence.
_Avoid_: platform, control plane, dashboard when describing the core product

**Memory Operating Protocol**:
The repo-installed agent behavior package that defines when to recall, judge,
guard, store, and prove memory during work.
_Avoid_: CLI feature, API surface, optional helper

**Dream Cycle**:
A deeper memory maintenance pass that can propose promotions, retirements,
guard improvements, contradiction resolutions, and summaries.
_Avoid_: cleanup job, cron when discussing the domain behavior

## Example Dialogue

Developer: "Should Cognibrain have teams or workspaces?"

Domain expert: "No. Cognibrain memory is carried by the repository, so another
developer may inherit memory when they check out the repo. But until distributed
sync and conflict handling exist, that is technical portability, not a
multi-developer product claim."
