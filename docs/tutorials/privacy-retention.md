# Privacy And Retention Tutorial

Use this flow before wiring cognibrain into a new harness or shared workspace.

## 1. Start With A Disposable Store

```bash
export MEMORY_DB_PATH=/tmp/cognibrain-privacy.json
./bin/cognibrain.mjs memory add "Atlas staging API key is sk-test-redacted-example."
./bin/cognibrain.mjs memory privacy-insights
```

The default redaction layer detects secret-shaped content before it can become a trusted long-term memory.

## 2. Set Consent And Retention

```bash
MEMORY_ID=$(./bin/cognibrain.mjs memory add "User wants release notes shared with the platform team." | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>console.log(JSON.parse(d).id))')
./bin/cognibrain.mjs memory consent "$MEMORY_ID" org
./bin/cognibrain.mjs memory retention-rule "team notes" 30 archive '{"visibility":"org"}'
./bin/cognibrain.mjs memory retention-enforce
```

Consent flags decide whether a memory can be used privately, by the user, by the org, or publicly. Retention rules demote or delete stale memories by scope.

## 3. Enforce Policy Rules

```bash
./bin/cognibrain.mjs memory policy-rule "legal hold" deny retrieve,dream,export,delete '{"tag":"legal"}'
./bin/cognibrain.mjs memory policy-rules
./bin/cognibrain.mjs memory policy-evaluate retrieve "$MEMORY_ID"
```

Policy rules are enforced during retrieval, dream/reflection, export/delete, and writes. Denials are visible as `policy.violation` audit events so operators can prove why a memory did not enter context.

## 4. Export And Audit

```bash
./bin/cognibrain.mjs memory compliance-export
./bin/cognibrain.mjs memory audit
```

Use these endpoints for GDPR-style export/delete workflows, operator review, and partner security checks.
