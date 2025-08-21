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
  
  // Memory optimization flags for development
  // Note: V8 flags need to be passed via --js-flags for Electron
  const electronArgs = [
    '.',
    '--js-flags=--expose-gc --max-old-space-size=512 --optimize-for-size --gc-interval=100',
    '--memory-pressure-off',          // Electron-specific flag
    '--no-sandbox',                   // Reduce security overhead in dev
    '--disable-web-security',         // Allow local file access in dev
  ];
  
  const child = spawn(electronBinary, electronArgs, {
    stdio: 'inherit',
    env: { 
      ...process.env, 
      VITE_DEV_SERVER_URL: DEV_URL,
      NODE_ENV: 'development',
      ELECTRON_IS_DEV: '1'
    },
  });
  child.on('exit', (code) => process.exit(code ?? 0));
}

main();


