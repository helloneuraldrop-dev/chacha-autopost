// One-time YouTube login for the Chacha Kanjoos channel. Saves YT_AUTH into .env and copies it to the clipboard
// for the GitHub secret of the same name. Never prints the token.
//   node yt-token.mjs <path to the client_secret_....json downloaded from Google Cloud>
import fs from "node:fs";
import http from "node:http";
import { execSync } from "node:child_process";
import { p } from "./lib.mjs";

const file = process.argv[2];
if (!file || !fs.existsSync(file)) { console.log("usage: node yt-token.mjs <client_secret_....json>"); process.exit(1); }
const c = JSON.parse(fs.readFileSync(file, "utf8")).installed;
if (!c?.client_id) { console.log("That file is not a Desktop app OAuth client."); process.exit(1); }
const SCOPES = "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly";

const srv = http.createServer();
await new Promise((r) => srv.listen(0, "127.0.0.1", r));
const redirect = `http://127.0.0.1:${srv.address().port}`;
const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({ client_id: c.client_id, redirect_uri: redirect, response_type: "code", scope: SCOPES, access_type: "offline", prompt: "consent", login_hint: "chachakanjoos.official@gmail.com" })}`;
console.log("Opening the Google sign-in page. Pick the Chacha Kanjoos channel and click Allow.");
execSync(`start "" "${authUrl}"`, { shell: "cmd.exe" });

const code = await new Promise((resolve, reject) => srv.on("request", (req, res) => {
  const q = new URL(req.url, redirect).searchParams;
  res.end(q.get("code") ? "Done. You can close this tab." : `Failed: ${q.get("error")}`);
  q.get("code") ? resolve(q.get("code")) : reject(new Error(q.get("error") ?? "no code"));
}));
srv.close();

const t = await (await fetch("https://oauth2.googleapis.com/token", { method: "POST", body: new URLSearchParams({ code, client_id: c.client_id, client_secret: c.client_secret, redirect_uri: redirect, grant_type: "authorization_code" }) })).json();
if (!t.refresh_token) { console.log(`✗ no refresh token: ${t.error ?? ""} ${t.error_description ?? ""}`); process.exit(1); }
const me = await (await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", { headers: { Authorization: `Bearer ${t.access_token}` } })).json();
const name = me.items?.[0]?.snippet?.title;
if (name !== "Chacha Kanjoos") { console.log(`✗ signed in as channel "${name}", not Chacha Kanjoos. Run again and pick the Chacha Kanjoos channel.`); process.exit(1); }

const val = JSON.stringify({ client_id: c.client_id, client_secret: c.client_secret, refresh_token: t.refresh_token });
const envFile = p(".env");
let text = fs.existsSync(envFile) ? fs.readFileSync(envFile, "utf8") : "";
text = text.replace(/^YT_AUTH=.*\r?\n?/m, "");
text += (text && !text.endsWith("\n") ? "\n" : "") + `YT_AUTH=${val}\n`;
fs.writeFileSync(envFile, text);
execSync("clip", { input: val });
console.log(`✓ ${name}: YT_AUTH saved in .env and copied to the clipboard (paste it as the GitHub secret YT_AUTH).`);
