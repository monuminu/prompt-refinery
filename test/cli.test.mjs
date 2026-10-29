import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, readFile, mkdir, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

function run(args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, options);
    let stdout = '', stderr = '';
    child.stdout.on('data', data => { stdout += data; });
    child.stderr.on('data', data => { stderr += data; });
    child.on('error', reject);
    child.on('close', code => resolve({ code, stdout, stderr }));
  });
}

test('CLI makes a real provider request and writes machine-readable JSON', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'refinery-test-')); t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(join(dir, 'prompt.txt'), 'Summarize {{doc}}');
  let actual;
  const provider = createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    actual = JSON.parse(JSON.parse(Buffer.concat(chunks).toString('utf8')).input[0].content);
    res.end(JSON.stringify({ status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text',
      text: JSON.stringify({ optimizedPrompt: 'Summarize {{doc}} in 3 bullets.', changes: ['Added format.'], assumptions: [], checks: ['Try a long doc.'] }) }] }] }));
  });
  await new Promise(resolve => provider.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { provider.closeAllConnections(); provider.close(resolve); }));
  const env = { ...process.env, OPENAI_API_KEY: 'test-secret-key', OPENAI_BASE_URL: `http://127.0.0.1:${provider.address().port}/v1`,
    OPENAI_MODEL: 'test-model', OPENAI_REASONING_EFFORT: '', OPENAI_TIMEOUT_MS: '1000', PORT: '3000' };
  const cli = fileURLToPath(new URL('../src/cli.mjs', import.meta.url));
  const output = await run([cli, 'prompt.txt', 'writing'], { cwd: dir, env });
  assert.equal(output.code, 0); assert.equal(output.stderr, '');
  assert.equal(JSON.parse(output.stdout).optimizedPrompt, 'Summarize {{doc}} in 3 bullets.');
  assert.deepEqual(actual, { prompt: 'Summarize {{doc}}', context: '', category: 'writing' });
  const missing = await run([cli, 'missing.txt'], { cwd: dir, env });
  assert.equal(missing.code, 1); assert.equal(missing.stdout, ''); assert.doesNotMatch(missing.stderr, /test-secret-key/);
});

test('setup creates a local .env once and preserves user edits', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'refinery-setup-')); t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, 'scripts'));
  await copyFile(new URL('../scripts/setup.mjs', import.meta.url), join(dir, 'scripts/setup.mjs'));
  await writeFile(join(dir, '.env.example'), 'OPENAI_API_KEY=\n');
  const first = await run([join(dir, 'scripts/setup.mjs')]);
  assert.equal(first.code, 0); assert.equal(await readFile(join(dir, '.env'), 'utf8'), 'OPENAI_API_KEY=\n');
  await writeFile(join(dir, '.env'), 'OPENAI_API_KEY=user-configured-value\n');
  const second = await run([join(dir, 'scripts/setup.mjs')]);
  assert.equal(second.code, 0); assert.equal(await readFile(join(dir, '.env'), 'utf8'), 'OPENAI_API_KEY=user-configured-value\n');
  assert.doesNotMatch(second.stdout + second.stderr, /user-configured-value/);
});
