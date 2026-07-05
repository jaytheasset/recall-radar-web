// @ts-nocheck
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

const previewCommands = [
  ['preview:cpsc-classifier-input', 'scripts/preview-cpsc-classifier-input.ts'],
  ['preview:fda-food-classifier-input', 'scripts/preview-fda-food-classifier-input.ts'],
  ['preview:rappelconso-classifier-input', 'scripts/preview-rappelconso-classifier-input.ts'],
  ['preview:canada-classifier-input', 'scripts/preview-canada-classifier-input.ts'],
  ['preview:eu-safety-gate-classifier-input', 'scripts/preview-eu-safety-gate-classifier-input.ts'],
  ['preview:uk-fsa-classifier-input', 'scripts/preview-uk-fsa-classifier-input.ts'],
  ['preview:australia-product-safety-classifier-input', 'scripts/preview-australia-product-safety-classifier-input.ts'],
  ['preview:new-zealand-classifier-input', 'scripts/preview-new-zealand-classifier-input.ts'],
  ['preview:hong-kong-cfs-classifier-input', 'scripts/preview-hong-kong-cfs-classifier-input.ts'],
  ['preview:fsanz-classifier-input', 'scripts/preview-fsanz-classifier-input.ts']
] as const;

const results: Array<{ command: string; passed: boolean }> = [];

for (const [command, script] of previewCommands) {
  console.log(`\n> npm run ${command}`);
  try {
    execFileSync(process.execPath, ['--experimental-strip-types', script], {
      cwd: projectRoot,
      stdio: 'inherit'
    });
    results.push({ command, passed: true });
  } catch (error) {
    results.push({ command, passed: false });
    console.error(`Failed: npm run ${command}`);
    process.exitCode = 1;
    break;
  }
}

console.log(JSON.stringify({
  passed: results.length === previewCommands.length && results.every((result) => result.passed),
  previewCommands: results
}, null, 2));
