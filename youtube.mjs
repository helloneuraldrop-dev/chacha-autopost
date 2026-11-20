// Uploads due schedule.json items that have a "yt" block to the Chacha Kanjoos YouTube channel as Shorts.
// State lives in data/youtube.json (separate from Instagram's posted.json), so nothing goes up twice.
//   node youtube.mjs           upload what is due
//   node youtube.mjs --check   test the login and show what is due (uploads nothing)
// Needs YT_AUTH (JSON: client_id, client_secret, refresh_token) from yt-token.mjs, in .env or a GitHub secret.
// shortcut: until Google's API audit passes, every API upload is locked to private, so uploads only run when YT_LIVE=1
// (set it as a repo variable after the audit). Until then episodes are scheduled by hand in YouTube Studio.
import fs from "node:fs";
import { env, log, p, readJson, writeJson } from "./lib.mjs";

const CHECK = process.argv.includes("--check");
const WINDOW_H = 6;
const stateFile = p("data", "youtube.json");
const state = readJson(stateFile, {});
const due = readJson(p("schedule.json"), []).filter((it) => {
  const age = (Date.now() - Date.parse(it.at)) / 3600e3;
  return it.yt && it.video && !state[it.id]?.videoId && age >= 0 && age < WINDOW_H;
});

async function accessToken() {
  const a = JSON.parse(env("YT_AUTH", true));
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body: new URLSearchParams({ client_id: a.client_id, client_secret: a.client_secret, refresh_token: a.refresh_token, grant_type: "refresh_token" }) });
  const j = await r.json();
  if (!j.access_token) throw new Error(`YouTube login failed: ${j.error} ${j.error_description ?? ""}`);
  return j.access_token;
}
const api = async (tok, url, init = {}) => {
  const r = await fetch(url, { ...init, headers: { Authorization: `Bearer ${tok}`, ...init.headers } });
  if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 400)}`);
  return r;
};

async function upload(tok, it) {
  const bytes = fs.readFileSync(p(it.video));
  const meta = {
    snippet: { title: it.yt.title, description: it.yt.description ?? it.caption, tags: it.yt.tags ?? ["Chacha Kanjoos", "Hindi cartoon", "desi comedy"], categoryId: "23", defaultLanguage: "hi", defaultAudioLanguage: "hi" },
    status: { privacyStatus: "public", selfDeclaredMadeForKids: false },
  };
  const start = await api(tok, "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST", body: JSON.stringify(meta),
    headers: { "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Length": String(bytes.length), "X-Upload-Content-Type": "video/mp4" },
  });
  const v = await (await api(tok, start.headers.get("location"), { method: "PUT", body: bytes, headers: { "Content-Type": "video/mp4" } })).json();
  return { videoId: v.id, url: `https://youtube.com/shorts/${v.id}`, privacy: v.status?.privacyStatus };
}

const tok = await accessToken();
const me = await (await api(tok, "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true")).json();
const name = me.items?.[0]?.snippet?.title;
if (name !== "Chacha Kanjoos") throw new Error(`YT_AUTH is for channel "${name}", not Chacha Kanjoos`); // never upload to another channel
if (CHECK) { log(`login ok: ${name}; due now: ${due.map((it) => it.id).join(", ") || "nothing"}; YT_LIVE=${env("YT_LIVE") || "off"}`); process.exit(0); }
if (env("YT_LIVE") !== "1") { log(`YouTube uploads off until the API audit passes (YT_LIVE). Due: ${due.map((it) => it.id).join(", ") || "nothing"}`); process.exit(0); }
if (!due.length) { log("YouTube: nothing due"); process.exit(0); }

let failed = 0;
for (const it of due) {
  try {
    const res = await upload(tok, it);
    state[it.id] = { ...res, at: new Date().toISOString() };
    writeJson(stateFile, state);
    log(`YouTube: ${it.id} -> ${res.url} (${res.privacy})`);
    if (res.privacy !== "public") throw new Error(`uploaded but ${res.privacy}: the API audit may not have passed yet`);
  } catch (e) {
    failed++;
    log(`✗ YouTube ${it.id} failed: ${e.message}`);
    if (process.env.GITHUB_ACTIONS) console.log(`::error::YouTube ${it.id} failed: ${e.message.slice(0, 500)}`);
  }
}
if (failed) process.exit(1);
