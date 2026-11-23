import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Post, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";

import { ApiException } from "../common/api-exception";
import { Public, TelegramAuthGuard, TgUser, TgUserOptional } from "../miniapp/telegram-auth.guard";
import type { TelegramIdentity } from "../telegram/init-data";
import { StoriesService, type StoryGroup } from "./stories.service";

/** Istoriya id — 24 belgili hex (`randomBytes(12)`). */
const STORY_ID = /^[a-f0-9]{24}$/;

/**
 * Mini App → istoriyalar (Instagram'dagidek). Ro'yxat va video — ochiq (mehmonlar ham ko'radi),
 * joylash va o'chirish — ro'yxatdan o'tgan faol ishtirokchi. Kontrakt — `apps/miniapp/src/lib/api.ts`
 * dagi `getStories`, `uploadStory`, `deleteStory`, `storyVideoUrl`.
 */
@Controller("miniapp/stories")
@UseGuards(TelegramAuthGuard)
export class MiniappStoriesController {
  constructor(private readonly stories: StoriesService) {}

  /** `GET /miniapp/stories` — faol istoriyalar ishtirokchilar bo'yicha (o'zimniki birinchi). */
  @Public()
  @Get()
  list(@TgUserOptional() user: TelegramIdentity | null): StoryGroup[] {
    return this.stories.groups(user?.telegramId ?? null);
  }

  /**
   * `POST /miniapp/stories` — so'rov tanasi videoning o'zi (raw), turi `Content-Type` da
   * (`video/mp4`, `video/quicktime`, `video/webm`; `main.ts` dagi raw body parser). Javob — yangi ro'yxat.
   */
  @Post()
  @HttpCode(201)
  upload(
    @TgUser() user: TelegramIdentity,
    @Headers("content-type") contentType: string | undefined,
    @Body() body: unknown,
  ): StoryGroup[] {
    this.stories.add(user.telegramId, contentType, body);
    return this.stories.groups(user.telegramId);
  }

  /** `DELETE /miniapp/stories/:id` — o'z istoriyasini o'chirish. */
  @Delete(":id")
  @HttpCode(204)
  remove(@TgUser() user: TelegramIdentity, @Param("id") id: string): void {
    if (!STORY_ID.test(id)) throw new ApiException(404, "NOT_FOUND");
    this.stories.removeOwn(user.telegramId, id);
  }

  /**
   * `GET /miniapp/stories/:id/video` — video fayl (Range so'rovlari bilan: iOS/Android `<video>`
   * shusiz o'ynamaydi). Id taxmin qilib bo'lmaydigan tasodifiy qator; muddati o'tgan — 404.
   */
  @Public()
  @Get(":id/video")
  video(@Param("id") id: string, @Res() res: Response): void {
    const video = STORY_ID.test(id) ? this.stories.video(id) : null;
    if (!video) throw new ApiException(404, "NOT_FOUND");
    // Istoriya 24 soat yashaydi — brauzer shu muddatgacha keshlashi mumkin.
    res.setHeader("Cache-Control", "public, max-age=86400, immutable");
    if ("path" in video) {
      res.sendFile(video.path, { headers: { "Content-Type": video.mime } });
      return;
    }
    res.type(video.mime).send(video.data);
  }
}
