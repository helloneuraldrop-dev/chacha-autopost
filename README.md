# Chacha Kanjoos autopost

Posts the finished reels to the channel's Instagram on schedule, with the pinned-style first comment.
GitHub Actions runs `publish.mjs` at 19:30 IST, plus a backup run at 20:00. Nothing is posted twice (`data/posted.json`).
Copied from the Pencilbird autopost, which is already live; only the handle check and the slot changed.

| File | What it does |
|---|---|
| `schedule.json` | One entry per reel: id, time (UTC `at` + `ist`), caption, first comment, video, cover |
| `media/` | Upload copies: `epNN.mp4` (re-encoded to about 3 Mbps, under 20 MB) and `epNN-cover.jpg` (from `../brand/`) |
| `publish.mjs` | Posts what is due (time passed, less than 6 h ago). `--check` posts nothing. `--now=<id>` posts one now |
| `instagram.mjs` | Graph API calls: resumable reel upload, carousel, comment |
| `token.mjs` | Turns a Graph API Explorer token into a never-expiring Page token and saves it to `.env` |

## Setup (once)

1. **Meta app.** developers.facebook.com → My Apps → Create App → use case **Other**, type **Business**, name
   `Chacha Publisher`. App settings → Basic: note the **App ID** and **App Secret**. Development mode is enough: posting to
   your own account needs no App Review.
2. **Token.** The Instagram account must be Creator (or Business) and linked to the Chacha Kanjoos Facebook Page.
   developers.facebook.com/tools/explorer → pick the app → Get User Access Token with
   `instagram_basic`, `instagram_content_publish`, `instagram_manage_comments`, `pages_show_list`, `pages_read_engagement`,
   `business_management` → Generate → tick the Chacha Kanjoos Page and the Instagram account.
   Copy `.env.example` to `.env`, fill `IG_HANDLE`, `FB_APP_ID`, `FB_APP_SECRET`, `FB_SHORT_TOKEN`, then run `node token.mjs`.
   `node publish.mjs --check` must then print `token ok: @<handle>`.
3. **GitHub repo.** Create a **public** repo (Instagram fetches the cover from `raw.githubusercontent.com`; the token
   lives in GitHub secrets, never in the repo). Push this folder to it. Settings → Secrets and variables → Actions → add
   `IG_USER_ID` and `IG_ACCESS_TOKEN` (values from `.env`).
   Public means a reel's file is visible in the repo before its slot: push each reel on its posting day if that matters.
4. **Test.** Actions → Post to Instagram → Run workflow → tick `check_only`: it must say `token ok`.

## Adding a reel

1. Encode the final render:
   `ffmpeg -i <final>.mp4 -c:v libx264 -preset slow -crf 21 -maxrate 3000k -bufsize 6000k -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart media/epNN.mp4`
2. Put its cover in `media/epNN-cover.jpg` and add an entry to `schedule.json` (19:30 IST = 14:00 UTC).
3. `git pull` (the bot commits `data/posted.json`), `node publish.mjs --check`, commit and push.

GitHub's schedule can start late or skip a run. If that happens, add the Cloudflare timer Worker from the Pencilbird autopost
(`G:\Pencilbird\autopost\timer`), which starts the workflow on time.
