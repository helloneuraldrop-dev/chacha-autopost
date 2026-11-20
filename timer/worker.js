// Starts the "Post to Instagram" GitHub workflow on time. GitHub's own schedule ran 8 h late or not at all (19 Nov 2026 for Chacha);
// Cloudflare cron fires on time, and a run started this way is not delayed. GitHub's schedule stays on as a backup.
// Needs the secret GH_TOKEN: a fine-grained token for helloneuraldrop-dev/chacha-autopost with "Actions: Read and write".
const URL_ = "https://api.github.com/repos/helloneuraldrop-dev/chacha-autopost/actions/workflows/post.yml/dispatches";

async function start(env) {
  const r = await fetch(URL_, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.GH_TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "chacha-timer", "Content-Type": "application/json" },
    body: JSON.stringify({ ref: "main" }),
  });
  if (r.status !== 204) throw new Error(`GitHub dispatch failed: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return "started";
}

export default {
  async scheduled(event, env, ctx) { ctx.waitUntil(start(env)); }, // no public URL: the schedule is the only way in
};
