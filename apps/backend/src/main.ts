import "reflect-metadata";

import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";

import { AppModule } from "./app.module";
import { config } from "./config/config";
import { MAX_RULES_VIDEO_BYTES } from "./rules/rules-video.service";
import { MAX_STORY_BYTES, STORY_MIMES } from "./stories/story-file";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.disable("x-powered-by");
  // Shikoyat skrinshoti JSON ichida (`data:` URL, ≤ 2 MB rasm) keladi — standart 100 KB yetmaydi.
  app.useBodyParser("json", { limit: "3mb" });
  // Istoriya (50 MB) va qoida videosi (100 MB) so'rov tanasining o'zida (raw) keladi. Chegara
  // kattasidan biroz ko'p — aniq hajmni har bir servis o'zi tekshirib, o'z xato kodi bilan javob beradi.
  app.useBodyParser("raw", {
    type: [...STORY_MIMES],
    limit: Math.max(MAX_STORY_BYTES, MAX_RULES_VIDEO_BYTES) + 1024 * 1024,
  });
  // Admin panel va Mini App ikkalasi shu prefiks bilan murojaat qiladi.
  app.setGlobalPrefix("api/v1");
  app.enableCors({
    origin: config.corsOrigins,
    // Authorization — admin panel (Bearer token), X-Telegram-Init-Data — Mini App.
    allowedHeaders: ["Content-Type", "Authorization", "X-Telegram-Init-Data"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    // Veb-sayt sessiyasi cookie'da — lokal ishlab chiqishda sayt (3002) va API (3000) alohida portda.
    credentials: true,
  });
  app.enableShutdownHooks();
  await app.listen(config.port);
  new Logger("Bootstrap").log(`Backend: http://localhost:${config.port}/api/v1`);
}

void bootstrap();
