import "reflect-metadata";

import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";

import { AppModule } from "./app.module";
import { config } from "./config/config";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.disable("x-powered-by");
  // Shikoyat skrinshoti JSON ichida (`data:` URL, ≤ 2 MB rasm) keladi — standart 100 KB yetmaydi.
  app.useBodyParser("json", { limit: "3mb" });
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
