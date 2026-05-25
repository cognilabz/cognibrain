# Benchmark Proof Levels

cognibrain benchmark pages use explicit proof levels so public copy cannot blur a replayed local result into a vendor-certified or hosted-SaaS claim.

| Level | Meaning | Allowed claim |
| --- | --- | --- |
| `same-run-full` | The adapter ran the same scenario stream through the local product pipeline in this checkout. | Product behavior in this checkout. |
| `same-run-api-shape` | The adapter ran the same scenario stream through a local compatibility model that mirrors the target product shape and declares gaps. | Comparable local runner behavior with documented limitations. |
| `artifact-import` | A result was imported from a prior artifact and normalized into the report. | Historical artifact comparison only. |
| `planned` | The system is tracked in the matrix but did not run. | Roadmap or compatibility target only. |

Same-run means same scenario ids, same metric definitions, same process, and one generated report. It does not mean the competitor's managed cloud was called unless the artifact says so.

Claim IDs: `CB-CLAIM-BENCHMARK-ARENA`, `CB-CLAIM-MARKET`.
