import { copyFile } from 'node:fs/promises';
import { constants } from 'node:fs';

try {
  await copyFile(new URL('../.env.example', import.meta.url), new URL('../.env', import.meta.url), constants.COPYFILE_EXCL);
  console.log('Created .env. Set OPENAI_API_KEY, OPENAI_BASE_URL and OPENAI_MODEL, then run npm start.');
} catch (error) {
  if (error.code === 'EEXIST') console.log('.env already exists. Your configuration was preserved.');
  else { console.error('Could not create .env. Copy .env.example to .env manually.'); process.exitCode = 1; }
}
