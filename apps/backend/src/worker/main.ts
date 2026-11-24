import { BackendClient } from "./backend-client";
import { AnthropicBatchProvider, MockBatchProvider, type BatchProvider } from "./batch-provider";
import { AiWorker, type Logger } from "./worker";
import { loadWorkerConfig } from "./worker-config";

/**
 * AI worker jarayoni: `npm run worker` (build'dan keyin) yoki `npm run worker:dev`.
 * Backend'dan alohida ishlaydi (alohida konteyner/server) — video yuklash va ffmpeg backend'ni
 * sekinlashtirmasin. Kerak: ffmpeg/ffprobe, `AI_WORKER_TOKEN`, `ANTHROPIC_API_KEY`.
 */
const stamp = (): string => new Date().toISOString();
const logger: Logger = {
  log: (m) => console.log(`${stamp()} [ai-worker] ${m}`),
  warn: (m) => console.warn(`${stamp()} [ai-worker] OGOHLANTIRISH: ${m}`),
  error: (m) => console.error(`${stamp()} [ai-worker] XATO: ${m}`),
};

/**
 * Sozlanmagan (kalit yoki token yo'q) worker yiqilib qayta-qayta ishga tushmaydi — bir marta
 * sababini yozib, to'xtatilguncha kutadi (Docker `restart: unless-stopped` log'ni to'ldirmasin).
 */
function idle(reason: string): Promise<void> {
  logger.error(`AI tekshiruvi o'chiq: ${reason}. Sozlab, konteynerni qayta ishga tushiring.`);
  return new Promise((resolve) => {
    const keepAlive = setInterval(() => undefined, 60 * 60_000);
    const stop = () => {
      clearInterval(keepAlive);
      resolve();
    };
    process.once("SIGTERM", stop);
    process.once("SIGINT", stop);
  });
}

async function main(): Promise<void> {
  let options;
  try {
    options = loadWorkerConfig();
  } catch (err) {
    return idle((err as Error).message);
  }
  const provider: BatchProvider =
    options.provider === "mock"
      ? new MockBatchProvider(options.mockDelaySeconds * 1000)
      : new AnthropicBatchProvider(options.anthropicApiKey ?? "");
  const backend = new BackendClient(options.backendUrl, options.workerToken);
  const worker = new AiWorker(options, backend, provider, logger);

  // Kalit hech qachon chiqarilmaydi — faqat qaysi manba ishlatilayotgani.
  logger.log(
    `Ishga tushdi: provider=${provider.name}, backend=${options.backendUrl}, har ${options.pollSeconds} s, ` +
      `lease=${options.batchSize}, papka=${options.workDir}`,
  );

  // Videolarni tayyorlash bir necha daqiqa olishi mumkin — admin panel "Worker ishlayapti" deb
  // ko'rsatib tursin (3 daqiqa jim — o'chiq).
  const heartbeat = setInterval(() => {
    backend.heartbeat().catch(() => undefined);
  }, 60_000);

  let sleeping: (() => void) | null = null;
  const stop = () => {
    if (worker.stopping) return;
    worker.stopping = true;
    clearInterval(heartbeat);
    logger.log("To'xtatilmoqda — joriy ish tugagach chiqadi.");
    sleeping?.();
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);

  let failures = 0;
  while (!worker.stopping) {
    try {
      await worker.tick();
      failures = 0;
    } catch (err) {
      failures += 1;
      logger.error((err as Error).message);
    }
    if (worker.stopping) break;
    // Backend o'chiq bo'lsa — oraliq ko'payadi (5 daqiqagacha).
    const delay = Math.min(5 * 60_000, options.pollSeconds * 1000 * 2 ** Math.min(failures, 4));
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, delay);
      sleeping = () => {
        clearTimeout(timer);
        resolve();
      };
    });
    sleeping = null;
  }
  logger.log("To'xtadi.");
}

main().catch((err: unknown) => {
  logger.error((err as Error).message);
  process.exit(1);
});
