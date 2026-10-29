const $ = id => document.getElementById(id);
const form = $('optimizer-form');
let configured = false;
let busy = false;

const samples = {
  writing: 'Summarize {{document}} for a busy executive. Keep it short and include the important details.',
  coding: 'Review this code for bugs and suggest fixes. Explain what you would change.\n\n{{code}}',
  agentic: 'Help me research {{topic}} and prepare a briefing. You can use the tools provided by the environment. Ask if you need anything.',
};

function updateInput() {
  $('char-count').textContent = `${$('prompt').value.length.toLocaleString()} / 30,000`;
  $('optimize-button').disabled = busy || !configured || !$('prompt').value.trim();
}

function renderList(id, items, fallback) {
  $(id).replaceChildren();
  for (const text of items.length ? items : [fallback]) {
    const item = document.createElement('li'); item.textContent = text; $(id).append(item);
  }
}

function setBusy(value) {
  busy = value;
  $('optimized-prompt').readOnly = value;
  document.querySelector('.revision').setAttribute('aria-busy', String(value));
  $('optimize-button').textContent = value ? 'Refining…' : 'Refine prompt ↗';
  for (const control of form.querySelectorAll('input, select, #prompt, #context, [data-sample]')) control.disabled = value;
  updateInput();
}

$('prompt').addEventListener('input', updateInput);
$('optimized-prompt').addEventListener('input', () => {
  const empty = !$('optimized-prompt').value.trim();
  $('copy-button').disabled = empty; $('download-button').disabled = empty;
});

for (const button of document.querySelectorAll('[data-sample]')) {
  button.addEventListener('click', () => {
    if ($('prompt').value.trim() && !window.confirm('Replace your current input with this example?')) return;
    const category = button.dataset.sample;
    $('prompt').value = samples[category]; $('category').value = category; updateInput(); $('prompt').focus();
  });
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (busy || !configured || !$('prompt').value.trim()) return;
  $('error-message').hidden = true;
  $('copy-button').disabled = true; $('download-button').disabled = true;
  if (!$('optimized-prompt').hidden) $('output-hint').textContent = 'Previous revision. A new one is running.';
  $('status').textContent = 'Refining your prompt with the bundled playbook…';
  setBusy(true);
  const started = Date.now();
  const timer = setInterval(() => { $('elapsed').textContent = `${Math.floor((Date.now() - started) / 1000)}s elapsed`; }, 1000);
  try {
    const res = await fetch('/api/optimize', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: $('prompt').value, context: $('context').value, category: $('category').value }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'The revision could not be completed.');
    $('optimized-prompt').value = data.optimizedPrompt;
    $('optimized-prompt').hidden = false; $('empty-state').hidden = true;
    $('output-hint').textContent = 'Review and edit before using.';
    $('copy-button').disabled = false; $('download-button').disabled = false;
    renderList('changes', data.changes, 'No material edits were needed.');
    renderList('assumptions', data.assumptions, 'No additional assumptions reported.');
    renderList('checks', data.checks, 'Compare both prompts on a representative input.');
    $('revision-notes').hidden = false;
    $('status').textContent = 'Revision ready. Review the prompt and assumptions, then try it on a real input.';
  } catch (error) {
    $('error-message').textContent = error instanceof TypeError ? 'Could not reach the local app. Check that the server is running.' : error.message;
    $('error-message').hidden = false; $('status').textContent = 'The revision did not finish. Your original prompt is still here.';
    if (!$('optimized-prompt').hidden) $('output-hint').textContent = 'Previous revision retained.';
  } finally {
    clearInterval(timer); $('elapsed').textContent = ''; setBusy(false);
    const hasOutput = !$('optimized-prompt').hidden && Boolean($('optimized-prompt').value.trim());
    $('copy-button').disabled = !hasOutput; $('download-button').disabled = !hasOutput;
  }
});

$('copy-button').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('optimized-prompt').value);
    $('status').textContent = 'Refined prompt copied to the clipboard.';
  } catch {
    $('optimized-prompt').focus(); $('optimized-prompt').select();
    $('status').textContent = 'Clipboard access is unavailable. The prompt is selected; copy it with your keyboard.';
  }
});

$('download-button').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([$('optimized-prompt').value], { type: 'text/markdown;charset=utf-8' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'refined-prompt.md';
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  $('status').textContent = 'Refined prompt downloaded.';
});

async function initialize() {
  try {
    const res = await fetch('/api/config');
    if (!res.ok) throw new Error('Configuration unavailable.');
    const config = await res.json(); configured = config.configured;
    $('model-name').textContent = config.model;
    if (!configured) {
      $('setup-message').textContent = 'One-time setup: run npm run setup, add OPENAI_API_KEY and your API base URL to .env, then restart npm start.';
      $('setup-message').hidden = false;
      $('status').textContent = 'Add your API key to enable refinement. You can explore the examples now.';
    }
  } catch {
    $('setup-message').textContent = 'Could not load configuration. Start the server with npm start, then reload this page.';
    $('setup-message').hidden = false;
  }
  updateInput();
}
initialize();
