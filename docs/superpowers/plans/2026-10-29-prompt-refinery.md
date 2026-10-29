# Prompt Refinery Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Publish a working local prompt optimizer on the user's GitHub account.

**Architecture:** A shared optimizer reads the bundled playbook and calls the Responses API. A localhost HTTP app and CLI consume it. Credentials live in ignored .env files.

**Tech Stack:** Node.js 22+, native fetch/http/test, vanilla browser JavaScript.

**Spec:** ../specs/2026-10-29-prompt-refinery-design.md

## Global Constraints

- No runtime dependencies; Node.js 22+.
- Original prompt: 1–30,000 characters; context: up to 10,000.
- Localhost only; no prompt persistence; .env ignored.
- Self-contained original playbook; no runtime documentation fetch.

## Review Focus

- A provider response may include reasoning items before its message.
- A provider can refuse, truncate, return invalid JSON, or return an invalid schema.
- Unicode input must fit the byte limit without reducing the character contract.
- Browser-origin requests must not spend the key from a different site.
- Errors, static paths and config responses must not reveal credentials.

## Task 1: Shared engine and configuration

**Files:** src/config.mjs, src/optimizer.mjs, knowledge/playbook.md, test/optimizer.test.mjs.

**Interfaces:** loadConfig(env) returns validated server configuration; optimize(input, config) returns {optimizedPrompt, changes, assumptions, checks}.

- [x] Write and run failing tests for configuration, bounded input, real local Responses requests, output validation and provider failures.
- [x] Implement the engine and embedded playbook, then run `node --test test/optimizer.test.mjs` until all pass.

## Task 2: Browser app and CLI

**Files:** src/server.mjs, src/cli.mjs, public/*, scripts/setup.mjs, test/server.test.mjs.

**Interfaces:** createApp(config) returns a Node HTTP server; browser POST /api/optimize consumes the Task 1 contract; CLI accepts a prompt file and prints JSON.

- [x] Write and run failing HTTP tests covering config, assets, origin/host checks, malformed input, size limits and errors.
- [x] Build the local server, accessible responsive interface, CLI and non-overwriting .env setup.
- [x] Run `npm test` and `npm run check`; exercise browser success/error/copy/download and CLI using a local fake provider.

## Task 3: Review and publish

**Files:** README.md, LICENSE, NOTICE.md, .github/workflows/ci.yml.

- [x] Document quickstart, endpoint requirements, limitations, data flow and playbook update procedure.
- [x] Request an independent review; fix material issues and rerun affected tests.
- [ ] Scan tracked files for secrets, commit, create public monuminu/prompt-refinery and push.
- [ ] Verify the remote visibility, source files and CI; share the repository URL.
