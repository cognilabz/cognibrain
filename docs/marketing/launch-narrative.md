# Launch Narrative

## Opening

AI coding agents are getting faster, but teams still keep correcting the same mistakes: the wrong test command, the wrong package manager, stale migration rules, generated files edited by accident, and review feedback forgotten on the next patch.

## Problem

Generic memory does not solve engineering behavior on its own. A coding agent needs scoped, current, cited context: which repo rule applies, which correction superseded an old action, which command failed last time, which procedure should run before the next change, and which source is allowed to influence the patch.

Claim IDs: `CB-CLAIM-CONTEXT`, `CB-CLAIM-GUARD`.

## Product

cognibrain captures corrections, reviews, tool outcomes, procedures and repo policies as Engineering Memory. It then builds evidence-grade context packs and patch trails so operators can inspect why memory was used before it shapes a code change.

Claim IDs: `CB-CLAIM-EVIDENCE`, `CB-CLAIM-PATCH-EVIDENCE`.

## Proof

CogniCodeBench measures the exact loop: mistake -> correction -> memory -> next change -> correct action. The public artifact is synthetic and deterministic, with ablations for no memory, raw chat history, keyword, semantic/vector, graph, temporal, procedure-only and full cognibrain.

Claim IDs: `CB-CLAIM-COGNICODE`, `CB-CLAIM-ABLATION`.

## Launch Boundary

This launch is self-hosted and local-first. Teams can run it with their own API keys, durable storage, TLS ingress, backup process and connector credentials. Managed SaaS uptime, billing, SSO, autoscaling and hosted support remain future/deployment-specific claims.

Claim ID: `CB-CLAIM-PRODUCTION`.

## CTA

Run the five-minute demo, inspect the EvidencePack, then run CogniCodeBench and `npm run release:check` before making production claims.
