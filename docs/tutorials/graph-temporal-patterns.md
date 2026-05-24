# Graph, Time, And Pattern Tutorial

This path exercises the memory features that differentiate cognibrain from a plain vector store: typed graph recall, temporal summaries, and behavioural pattern extraction.

## 1. Add A Small Timeline

```bash
export MEMORY_DB_PATH=/tmp/cognibrain-graph-time.json
./bin/cognibrain.mjs memory add "Atlas depends on the payments SDK and imports the billing client."
./bin/cognibrain.mjs memory add "On Monday, Mira reviewed the payments SDK migration."
./bin/cognibrain.mjs memory add "On Friday, Mira usually asks for release-risk summaries."
```

## 2. Inspect Graph Recall

```bash
./bin/cognibrain.mjs memory graph
./bin/cognibrain.mjs memory graph-activate "payments SDK billing client"
./bin/cognibrain.mjs memory graph-query "payments SDK depends on billing"
```

Use graph activation when retrieval should explain why related entities were selected. Use graph query when an operator needs a structured edge view for debugging or dashboard display.

## 3. Inspect Time And Behaviour

```bash
./bin/cognibrain.mjs memory timeline
./bin/cognibrain.mjs memory timeline-summarize week
./bin/cognibrain.mjs memory patterns
```

Timeline summaries keep long-running sessions inspectable without scanning every raw event. Pattern extraction turns repeated observations into reviewable higher-order memories instead of silently injecting them.

## 4. Publish Proof

```bash
npm run verify:nextgen
npm run leaderboard
```

The verification loop proves graph/path activation, temporal summaries, behavioural pattern scoring, benchmark trends, and the public-safe leaderboard artifact.
