# Commercial Operator UI Boundary

Status: superseded by ADR-0062.

Cognibrain keeps the CLI, API, SDK, connectors, harness templates, and docs in
the MIT-licensed open-source package, but the browser Operator UI is a
separately licensed commercial add-on. This prevents the paid control-plane
experience from being accidentally redistributed through the OSS package while
still letting licensed checkouts run the Next.js UI against the same local
runtime.
