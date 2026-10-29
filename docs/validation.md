# Initial release validation

Verified 2026-10-29.

- `npm test`: 18 passing tests, using Node.js 25.8.0 locally and a local fake Responses provider; no live API key required.
- `npm run check`: syntax checks pass.
- Real browser checks at 1440 × 1100 and 390 × 844: responsive layout, sample selection, submission, editable output, copy, Markdown download, and actionable provider errors.
- Model-produced HTML is displayed as literal text, not executed.
- Retry regression: generate a revision, edit it, then cause a provider failure. The edited revision and its notes remain visible, editable, copyable and downloadable.
- Independent code review identified the retry issue above; the fix received a follow-up review with no material issue remaining.
- `.env` is ignored. The public repository contains only the blank `.env.example` template.

GitHub Actions also checks syntax and runs the test suite on Node.js 22 and 24. Consult the Actions tab for the current result. The README screenshot shows the real unconfigured app, not fabricated model output.

No live OpenAI model generation or comparative prompt-quality evaluation was performed for this release. The API contract is integration-tested; real account access and revision quality must be checked using the user's own credentials and representative inputs.
