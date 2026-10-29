# Prompt Refinery design

Build a public, self-contained repository for people who want to revise an existing prompt using a bundled GPT-6 playbook. The app must preserve intent and constraints rather than answer the submitted prompt. The supplied OpenAI guide is the research source; the repository contains an original concise adaptation, not a reproduction or a runtime link dependency.

## Approach

Use a Node.js 22+ local server and a plain HTML/CSS/JavaScript interface, with no runtime packages. A CLI reuses the same optimizer. This is the implementer's choice: it makes setup small and keeps credentials on the server. A framework app adds a build pipeline without helping this single-screen workflow; a CLI alone makes prompt comparison less accessible.

## Behavior

Accept a prompt (1–30,000 characters), optional context (up to 10,000), and a task category. Return an editable optimized prompt, change notes, assumptions, and suggested evaluation checks. Preserve the submitted language, placeholders, tool names, and output requirements. Do not invent capabilities, execute the submitted task, or claim measured quality improvement. Render model output as text. Provide copy/download controls and sample prompts. Show setup errors and provider errors clearly.

## Configuration and boundaries

Read OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL, optional reasoning effort, timeout and port from an ignored .env. Supply .env.example plus a non-overwriting setup command. Default model: gpt-6-astra, verified 2026-10-29. Use Responses API with strict structured output, store:false, bounded input and request timeout. Reject credential-bearing URLs, redirects, non-HTTPS remote endpoints, foreign origins and hosts. Bind to 127.0.0.1. Do not save prompt history or expose the key to the browser. Public hosting, authentication and arbitrary provider API adapters are outside scope.

## Verification and publication

Use Node's test runner with a local fake Responses server, covering real HTTP serialization, validation, refusals, malformed output, timeouts and secret-safe errors. Exercise the browser on desktop/mobile and the CLI. Live model quality cannot be established without a configured key; report this precisely. Publish under the authenticated personal GitHub account as requested, after tests and independent code review.
