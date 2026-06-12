# Harness Judgment Checkpoints

Cognibrain will allow the harness to pause an agent workflow at named Judgment Checkpoints, not only at coarse lifecycle calls such as context, guard, outcome, and patch evidence. This keeps semantic memory decisions close to the evidence that triggered them while preventing arbitrary interruption: every pause must be a typed Judgment Request with an expected verdict and fallback behavior.
