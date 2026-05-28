# Cognibrain Operator UI

This is the commercial, opt-in operator frontend for Cognibrain. It is designed
for licensed local or hosted deployments and intentionally stays outside the MIT
package file list.

Run it from a checkout that includes this directory:

```bash
npm run operator-ui:dev
```

The UI is a Next.js app. It reads `NEXT_PUBLIC_API_URL` and falls back to
`http://localhost:8787`. If the API is offline, it keeps a local demo store so
the interface can still be reviewed.
