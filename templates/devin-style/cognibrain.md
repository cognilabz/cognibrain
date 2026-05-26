# Cognibrain External-Agent Memory Contract

Use the generated `.devin/cognibrain.json` command contract when this agent cannot call the Cognibrain MCP server directly.

Before multi-step coding or debugging:

- request a coding context pack for the task,
- run the pre-tool guard before shell or file edits,
- use the CLI command contract when MCP tools are unavailable,
- keep secrets out of memory and store only env var names or redacted refs.

After tool use:

- record commands, files, exit status and test outcome,
- capture reviewer or user corrections as durable code corrections,
- finish with a patch evidence trail that cites the memories used.

Do not claim parity, connector support or benchmark superiority unless a current artifact proves it.
