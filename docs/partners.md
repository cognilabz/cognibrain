# Partner Integration Playbook

Partners and harness vendors can integrate through the CLI, HTTP API, TypeScript SDK, or MCP server.

Use `.github/ISSUE_TEMPLATE/partner-integration.yml` when proposing an official integration so scope, identity, privacy, and proof artifacts are reviewed together.

## Integration Checklist

1. Choose a scope model: user, session, app, project, org, brain, or source.
2. Start local with `./bin/cognibrain.mjs setup --all-harnesses`.
3. Add a connector manifest or marketplace module.
4. Run `npm run verify:nextgen`.
5. Export a migration bundle if a managed deployment is planned.

## Case Study Template

- Integration surface:
- Memory scope:
- Connector events:
- Privacy controls:
- Benchmark artifact:
- Operator dashboard screenshots:
- Known limitations:
