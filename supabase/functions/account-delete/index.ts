// account-delete: email-OTP account deletion (anonymize-and-close, 7-day grace).
// Actions (POST JSON): send_otp | verify  (customer JWT)   ·   purge (service-role key, or the x-cron-secret header from pg_cron)
// Secrets: RESEND_API_KEY, OTP_PEPPER (random 32+ chars), optional RESEND_FROM.
// Always answers HTTP 200 with {ok, ...} so the browser client can read the reason.
import { createClient } from "jsr:@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const PEPPER = Deno.env.get("OTP_PEPPER") ?? "";
// Until a domain is verified in Resend, only onboarding@resend.dev works (and only to the Resend account owner's email).
const FROM = Deno.env.get("RESEND_FROM") ?? "SuppVerse BD <onboarding@resend.dev>";

const admin = createClient(SB_URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

function genCode(): string {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / 1_000_000) * 1_000_000; // rejection sampling: no modulo bias
  do crypto.getRandomValues(buf); while (buf[0] >= limit);
  return String(buf[0] % 1_000_000).padStart(6, "0");
}
async function hashCode(customerId: string, code: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(PEPPER), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${customerId}:${code}`));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function shell(title: string, body: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f2f6fb;font-family:Arial,Helvetica,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table width="100%" style="max-width:440px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #dbe6f2" cellpadding="0" cellspacing="0">
<tr><td style="background:#0b2447;padding:18px 24px;color:#ffffff;font-size:18px;font-weight:800;letter-spacing:.5px">SUPPVERSE <span style="color:#2dbef5">BD</span></td></tr>
<tr><td style="padding:24px"><div style="font-size:18px;font-weight:800;color:#0b2447;margin-bottom:10px">${title}</div>${body}</td></tr>
<tr><td style="padding:14px 24px;background:#f7f9fc;color:#8392a5;font-size:11px">This is an automated security email from SuppVerse BD.</td></tr>
</table></td></tr></table></body></html>`;
}
async function sendMail(to: string, subject: string, html: string, text: string): Promise<boolean> {
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject, html, text }),
    });
    if (!r.ok) console.error("resend failed", r.status, await r.text());
    return r.ok;
  } catch (e) { console.error("resend error", e); return false; }
}
const otpMail = (name: string, code: string) => shell("Confirm account deletion",
  `<p style="color:#4a5b70;font-size:14px;line-height:1.5;margin:0 0 16px">Hi ${esc(name || "there")}, use this code to permanently delete your SuppVerse BD account. It expires in 10 minutes.</p>
   <div style="font-size:34px;font-weight:800;letter-spacing:10px;text-align:center;color:#0b2447;background:#eef5fc;border-radius:12px;padding:16px 0;margin-bottom:16px">${code}</div>
   <p style="color:#c0392b;font-size:13px;font-weight:700;line-height:1.5;margin:0">Didn't request this? Ignore this email and change your password. Never share this code with anyone.</p>`);
const doneMail = (name: string, when: string) => shell("Your account is scheduled for deletion",
  `<p style="color:#4a5b70;font-size:14px;line-height:1.5;margin:0 0 12px">Hi ${esc(name || "there")}, your account has been deactivated and your personal data will be permanently removed on <b>${esc(when)}</b>.</p>
   <p style="color:#4a5b70;font-size:14px;line-height:1.5;margin:0">Changed your mind? Log in before that date and your account is restored automatically. Past orders are kept in anonymized form for accounting.</p>`);

async function purge() {
  const { data, error } = await admin.rpc("sv_del_purge_due");
  if (error) { console.error("purge rpc", error); return json({ ok: false, error: "purge_failed" }); }
  const rows = (data ?? []) as { customer_id: string; auth_id: string | null; avatar_url: string | null }[];
  const done: string[] = [];
  for (const r of rows) {
    if (r.auth_id) {
      const { error: de } = await admin.auth.admin.deleteUser(r.auth_id);
      if (de && !/not.?found/i.test(de.message)) { console.error("deleteUser", r.customer_id, de.message); continue; } // retried on the next run
    }
    const m = r.avatar_url?.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/([^?]+)/);
    if (m) await admin.storage.from(m[1]).remove([decodeURIComponent(m[2])]).catch(() => {});
    done.push(r.customer_id);
  }
  if (done.length) await admin.rpc("sv_del_finalize", { p_ids: done });
  return json({ ok: true, purged: done.length });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "method" });
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  let body: { action?: string; code?: string } = {};
  try { body = await req.json(); } catch { /* empty */ }

  if (body.action === "purge") {
    if (token === SERVICE) return await purge();
    const cron = req.headers.get("x-cron-secret") ?? ""; // daily pg_cron job: password lives in Vault, checked by the DB
    if (cron) { const { data: okc } = await admin.rpc("sv_del_verify_cron", { p_secret: cron }); if (okc === true) return await purge(); }
    return json({ ok: false, error: "forbidden" });
  }

  const { data: u, error: ue } = await admin.auth.getUser(token);
  if (ue || !u?.user) return json({ ok: false, error: "unauthorized" });
  const { data: cust } = await admin.from("customers").select("id,email,full_name,anonymized_at").eq("auth_id", u.user.id).maybeSingle();
  if (!cust || cust.anonymized_at || !cust.email) return json({ ok: false, error: "no_customer" });
  if (!PEPPER || !RESEND_KEY) return json({ ok: false, error: "not_configured" });

  if (body.action === "send_otp") {
    const { data: bl } = await admin.rpc("sv_del_blockers", { p_customer: cust.id });
    if (Array.isArray(bl) && bl.length) return json({ ok: false, error: "blocked", blocking: bl });
    const code = genCode();
    const issued = await admin.rpc("sv_del_issue_otp", { p_customer: cust.id, p_code_hash: await hashCode(cust.id, code) });
    if (issued.error || !issued.data?.ok) return json(issued.data ?? { ok: false, error: "send_failed" });
    const sent = await sendMail(cust.email, "Your SuppVerse BD account deletion code", otpMail(cust.full_name, code),
      `Your SuppVerse BD account deletion code is ${code}. It expires in 10 minutes. If you didn't request this, ignore this email and change your password.`);
    return sent ? json(issued.data) : json({ ok: false, error: "send_failed" });
  }

  if (body.action === "verify") {
    if (!/^\d{6}$/.test(body.code ?? "")) return json({ ok: false, error: "invalid", attempts_left: null });
    const v = await admin.rpc("sv_del_verify_otp", { p_customer: cust.id, p_code_hash: await hashCode(cust.id, body.code!) });
    if (v.error || !v.data) return json({ ok: false, error: "verify_failed" });
    if (v.data.ok) {
      const when = new Date(v.data.purge_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
      await sendMail(cust.email, "Your SuppVerse BD account is scheduled for deletion", doneMail(cust.full_name, when),
        `Your account is deactivated and your personal data will be permanently removed on ${when}. Log in before then to restore it.`);
      await admin.auth.admin.signOut(token, "global").catch(() => {});
    }
    return json(v.data);
  }
  return json({ ok: false, error: "bad_action" });
});
