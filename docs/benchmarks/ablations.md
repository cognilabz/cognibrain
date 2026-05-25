# CogniCodeBench Ablations

CogniCodeBench reports measured synthetic ablations from the same scenario set.

| Mode | What is removed or isolated |
| --- | --- |
| `no_memory` | No correction, procedure, temporal, graph or tool-outcome memory |
| `raw_chat_history` | Nearby text without scoped engineering structure |
| `keyword_only` | Exact-token matching without full evidence gates |
| `semantic_only` | Semantic similarity without structured correction state |
| `vector_only` | Vector-style similarity without graph or temporal policy |
| `graph_only` | Relations without full correction/procedure handling |
| `temporal_only` | Freshness without full engineering context |
| `procedure_only` | Procedures without review-correction carryover |
| `cognibrain_without_temporal` | Full loop without temporal freshness |
| `cognibrain_without_corrections` | Full loop without reviewer corrections |
| `cognibrain_full` | Full Engineering Memory loop |

Claim ID: `CB-CLAIM-ABLATION`.
