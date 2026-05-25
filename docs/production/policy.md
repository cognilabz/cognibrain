# Policy And Tenant Isolation

Policy rules can allow or deny write, retrieve, dream, export and delete operations by scope, source kind, connector, memory type, tag or visibility.

Tenant isolation relies on explicit memory scope:

- user
- session
- app
- project
- org
- brain
- source
- agent

Denied policy decisions are recorded in audit events and EvidencePacks.

Claim IDs: `CB-CLAIM-EVIDENCE`, `CB-CLAIM-PRODUCTION`.
