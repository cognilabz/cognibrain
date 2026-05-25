# Tool Outcomes

Tool outcomes store what actually happened when a harness, CLI or connector ran an action.

Stored fields include:

- command
- cwd
- exit code
- output summary
- failure reason
- success reason
- files changed or touched
- duration
- environment hints

Successful outcomes can become procedure candidates. Failed outcomes can be retrieved before repeating a command.

Claim IDs: `CB-CLAIM-CONTEXT`, `CB-CLAIM-PATCH-EVIDENCE`.
