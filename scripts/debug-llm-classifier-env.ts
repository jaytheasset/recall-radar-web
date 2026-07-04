import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getLocalEnvValue,
  hasLocalEnvValue,
  loadLocalEnv,
  maskSecret
} from './load-local-env.ts';
import { getProviderSettingsFromEnv } from './llm-recall-classifier-provider.ts';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

async function gitignoreContains(value: string): Promise<boolean> {
  try {
    const text = await readFile(resolve(projectRoot, '.gitignore'), 'utf8');
    return text.split(/\r?\n/).map((line) => line.trim()).includes(value);
  } catch {
    return false;
  }
}

async function runDebug(): Promise<void> {
  const envLoad = await loadLocalEnv();
  const settings = getProviderSettingsFromEnv();
  const geminiKey = getLocalEnvValue('GEMINI_API_KEY');
  const openAiKey = getLocalEnvValue('OPENAI_API_KEY');
  const hasGeminiKey = hasLocalEnvValue('GEMINI_API_KEY');
  const hasOpenAiKey = hasLocalEnvValue('OPENAI_API_KEY');
  const outputsIgnored = await gitignoreContains('outputs/llm-classifier/');
  const envLocalIgnored = await gitignoreContains('.env.local');

  console.log(JSON.stringify({
    envFilesLoaded: envLoad.loadedFiles,
    envFilesMissing: envLoad.missingFiles,
    provider: settings.provider,
    model: settings.model,
    limit: settings.limit,
    sampleStrategy: settings.sampleStrategy,
    outputDir: settings.outputDir,
    keys: {
      GEMINI_API_KEY: {
        exists: hasGeminiKey,
        masked: hasGeminiKey ? maskSecret(geminiKey) : ''
      },
      OPENAI_API_KEY: {
        exists: hasOpenAiKey,
        masked: hasOpenAiKey ? maskSecret(openAiKey) : ''
      }
    },
    pricing: {
      inputUsdPer1M: settings.inputUsdPer1M ?? null,
      outputUsdPer1M: settings.outputUsdPer1M ?? null
    },
    gitignore: {
      envLocalIgnored,
      outputsClassifierIgnored: outputsIgnored
    },
    readiness: {
      mockReady: true,
      geminiReady: hasGeminiKey,
      openaiReady: hasOpenAiKey,
      missingGeminiKey: !hasGeminiKey,
      missingOpenAiKey: !hasOpenAiKey
    }
  }, null, 2));
}

runDebug().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
