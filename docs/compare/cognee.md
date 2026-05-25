# cognibrain vs Cognee

## Best For

Cognee-style systems are strong when the main job is connecting knowledge sources through graph/vector memory.

## Where cognibrain Differs

cognibrain starts from the coding-agent action loop. It captures feedback from reviews, commands, generated-file mistakes, procedures and source connectors, then exposes why that evidence influenced a patch.

Claim IDs: `CB-CLAIM-CONTEXT`, `CB-CLAIM-PATCH-EVIDENCE`, `CB-CLAIM-CONNECTORS`.

| Area | Knowledge graph/vector memory | cognibrain |
| --- | --- | --- |
| Main value | Connect and retrieve knowledge | Turn engineering feedback into safer agent action |
| Source handling | Product-dependent | SourceRef, connector sync records and EvidencePack |
| Coding behavior | General | Corrections, procedures, guards and patch evidence |
| Proof | Product-dependent | CogniCodeBench, connector verifiers and release gates |
| Deployment | Product-dependent | Local-first self-hosted candidate |

## Benchmark Boundary

cognibrain does not claim better graph/vector retrieval in the abstract. The claim is engineering-memory behavior under the documented synthetic benchmark and local verifier gates.

Claim IDs: `CB-CLAIM-COGNICODE`, `CB-CLAIM-MARKET`.

## Same-Run Arena

Benchmark Arena runs a Cognee API-shape adapter on the same synthetic engineering-memory scenario stream as Cognibrain. Current local result: Cognibrain `same-run-full` 97.22%, Cognee `same-run-api-shape` 44.45%. The measured advantage is not "better knowledge graph"; it is correction-to-next-patch behavior with evidence.

Claim ID: `CB-CLAIM-BENCHMARK-ARENA`.

## Honest Limitations

If the job is broad knowledge ingestion without coding-agent behavior, Cognee-style tools may be a better category fit.

## CTA

Choose cognibrain when the proof you need is: did the next patch use the right correction and avoid the repeated mistake?
