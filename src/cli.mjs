import { readFile } from 'node:fs/promises';
import { readEnv } from './config.mjs';
import { AppError, optimize } from './optimizer.mjs';

const [file, category = 'general', contextFile] = process.argv.slice(2);
if (!file || file === '--help') {
  console.log('Usage: npm run optimize -- prompt.txt [general|writing|coding|agentic] [context.txt]');
  process.exitCode = file === '--help' ? 0 : 1;
} else {
  try {
    const input = { prompt: await readFile(file, 'utf8'), category,
      context: contextFile ? await readFile(contextFile, 'utf8') : '' };
    console.log(JSON.stringify(await optimize(input, readEnv()), null, 2));
  } catch (error) {
    console.error(error instanceof AppError ? error.message :
      ['ENOENT', 'EACCES', 'EISDIR'].includes(error.code) ? 'Could not read the prompt or context file.' : 'Check your .env configuration and input files.');
    process.exitCode = 1;
  }
}
