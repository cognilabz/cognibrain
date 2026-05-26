# Benchmark Landscape

Cognibrain does not try to win every memory benchmark by stretching the claim. It separates conversational recall, long-context retrieval and engineering behavior change.

| Benchmark | What it measures | What it does not measure | Cognibrain role | Proof level |
| --- | --- | --- | --- | --- |
| LoCoMo | Long-term conversational memory over user sessions. | Whether a future code patch avoids a reviewed engineering mistake. | Useful context for assistant recall, not the primary product gate. | public-claim-only until imported or rerun. |
| LongMemEval | Long-memory QA and session recall. | Tool outcomes, patch evidence, connector writeback and action guards. | Useful retrieval landscape reference. | public-claim-only until imported or rerun. |
| BEAM | Retrieval nuggets and long-context evidence selection. | Whether memory changes coding-agent behavior. | Local suite available with `npm run benchmark:beam`. | local-baseline. |
| CogniCodeBench | Correction carry-over, repo-rule recall and next-patch correctness. | Customer-repo guarantees. | Core engineering-memory benchmark. | same-run-full for Cognibrain. |
| Benchmark Arena | Same scenario stream across Cognibrain and competitor adapters. | Vendor certification unless a native/cloud/CLI runner is configured. | Public comparison surface. | same-run-full plus adapter-specific levels. |
| Nextgen suites | Answer generation, temporal recall, calibration and evidence packs. | External vendor product certification. | Release-gate retrieval confidence. | local-baseline. |
| SocialMemBench and future social-memory suites | Social preference and relationship memory. | Engineering patch correctness. | Future landscape watch item. | planned. |

## Shared Proof Levels

| Level | Meaning |
| --- | --- |
| local-baseline | Local baseline or fixture that does not represent a product run. |
| public-claim-only | Public claim or documentation row without direct same-scenario execution. |
| artifact-import | Result imported from an artifact; useful, but not rerun in this checkout. |
| same-run-api-shape | Same scenario stream through a compatibility model with declared gaps. |
| same-run-native | Same scenario stream through a real local package, SDK or service. |
| same-run-cloud-api | Same scenario stream through a hosted API with operator-supplied credentials. |
| same-run-cli | Same scenario stream through a real CLI runner. |
| same-run-full | Full Cognibrain local implementation, not a compatibility model. |
| vendor-signed | Vendor-reviewed artifact for the same scenario contract. |
| real-customer-field | Anonymized field evidence from a real deployment. |

Recall is not enough. The next code change has to prove the memory worked.
