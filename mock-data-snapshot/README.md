# Mock-Data Snapshot

This folder is a frozen reference copy of key pages **exactly as they were before Supabase was wired in** (commit `ee397df`).

## Why this exists
Once real Supabase data replaces mock/hardcoded content in the live pages, this snapshot stays as the design reference — so we can always check "what did this screen originally look like, with what fields, in what layout" without digging through git history.

## What's here
- `login.html` — original mock login/signup (before real Supabase auth)
- `profile.html` — original mock profile (Hasan Ahmed / CU-1001 / fake orders)
- `store.html`, `orders.html`, `index.html`, `cart.html`, `buy_for_me.html`, `payment.html` — same idea

## Rules
- **Never edit these files.** They're a frozen reference, not live code.
- **Never load these in production** — they're not linked from anywhere, just sitting here for lookup.
- If you need to see original mock structure/copy/design for a field that's since gone live, check here first before searching git log.
