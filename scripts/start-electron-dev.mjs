import waitOn from 'wait-on';
import { spawn } from 'node:child_process';
import electron from 'electron';

const DEV_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';

async function main() {
  try {
    await waitOn({ resources: [DEV_URL], timeout: 30000 });
  } catch (err) {
    console.error('Vite dev server not reachable at', DEV_URL);
    process.exit(1);
  }
  const electronBinary = /** @type {string} */ (electron);
  const child = spawn(electronBinary, ['.'], {
    stdio: 'inherit',
    env: { ...process.env, VITE_DEV_SERVER_URL: DEV_URL },
  });
  child.on('exit', (code) => process.exit(code ?? 0));
}

main();


