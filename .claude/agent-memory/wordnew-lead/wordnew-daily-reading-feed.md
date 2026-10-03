---
name: wordnew-daily-reading-feed
description: Daily Reading redesign (2026-10-03): day-scoped cursor feed + calendar + server read state; where the pieces live and known gaps
metadata:
  type: project
---

Daily Reading = week date strip (`WordNewDailyReadingDateStrip`) + day feed hook (`useDailyReadingFeed`) + compact row cards with a read-check. Laravel AppQyV1: public `GET /app_qy_v1/daily-reading/feed|calendar` (read flags only with a Bearer token, via `$request->user('sanctum')`), authed `POST /app_qy_v1/user/daily-reading/reads` and `/{articleId}/read`; table `user_daily_reading_reads` (unique user_id+article_id) ensured by `AppQyV1BookReadingProgressTableService`.

**Why:** the old list was offset-paged across all days with no per-user read state.

**How to apply:** guests keep read marks in localStorage (`wfnew.dailyReading.guestReads`) and push them to Laravel on the next authed load; guest calendar read counts stay 0. Client GETs that carry per-user fields must use `optionalAuthFreshJSON` (the plain `getJSON` strips the Bearer and the resource mirror caches). Day = `COALESCE(reading_date, created_at::date)` in server time, strip uses device-local dates. Authed read endpoints were not exercised against the live server (no sanctum token from the CLI).
