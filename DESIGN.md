# DESIGN.md

## Tokens

- Neutral surface: `oklch(96.5% 0.01 285)`
- Warm page tint: `oklch(94% 0.016 86)`
- Paper surface: `oklch(98.2% 0.007 285)`
- Raised surface: `oklch(100% 0.004 285)`
- Ink: `oklch(18% 0.03 282)`
- Soft ink: `oklch(34% 0.035 280)`
- Muted ink: `oklch(52% 0.026 282)`
- Line: `oklch(86% 0.02 282)`
- Blue accent: `oklch(60% 0.22 252)`
- Violet accent: `oklch(55% 0.24 292)`
- Cyan success accent: `oklch(70% 0.15 220)`
- Dark proof surface: `oklch(14% 0.026 286)`

## Typography

Use a product UI system stack: Aptos, Segoe UI, system-ui, and sans-serif fallbacks. Keep type fixed and predictable. Use weight, spacing, and layout for hierarchy rather than display-font drama.

## Components

- App shell with real navigation anchors.
- Logo mark plus `cognibrain` product wordmark.
- Compact health metrics.
- Query input and explicit search action.
- Evidence rows with score, citation, and trust.
- Lifecycle cards for dream-cycle outputs.
- Benchmark cards for certified proof.
- Artifact inspector for local JSON validation.

## Layout

Product register. Use predictable grids, restrained surfaces, and high scanability. Cards are allowed only for distinct inspectable units. Avoid nested cards. Related controls stay tight; unrelated proof groups get more separation.

## Interaction

Every clickable row or button needs visible hover/focus states. Navigation links must point to actual sections. Dream cycle must visibly update lifecycle state. Search must be obvious and keyboard friendly.

## Do

- Keep the product name as `cognibrain`.
- Use Cognilabz logo as the mark.
- Make proof and evidence easy to scan.
- Use tinted neutrals and restrained accents.
- Test desktop and mobile in a real browser.

## Do Not

- Use `Open Memory` or `Open Memory Harness` in public or app UI.
- Use `by Cognilabz` inside the app menu or main product chrome.
- Add decorative panels without a proof or workflow purpose.
- Use gradient text, glassmorphism, side-stripe accents, or generic AI SaaS tropes.
