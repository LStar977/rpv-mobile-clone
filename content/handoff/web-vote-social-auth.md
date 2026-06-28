# Add Google + Apple sign-in to the web vote flow (`/p/:id` overlay)

This is everything needed to add **Continue with Google** and **Continue with Apple**
to the `step-auth` section of the browser voting overlay. Frontend integrates with the
existing overlay state (`localStorage` key `rp_web_jwt`, `showStep()`,
`checkAuthAndAdvance()`). Backend adds two endpoints that mirror the existing
`/api/auth/{google,apple}/mobile` handlers.

**Design note:** social buttons sit ABOVE the email/password block with an "or"
divider, because OAuth authenticates the same way whether the user is "logging in"
or "signing up" — it find-or-creates the account either way. The Log in / Sign up
tabs stay, but only govern the email path.

---

## 1. Frontend — markup (drop into `step-auth`, above the tabs)

```html
<!-- SOCIAL SIGN-IN (place directly under the STEP 1 eyebrow, above the Log in / Sign up tabs) -->
<div class="rp-social">
  <button type="button" class="rp-sbtn rp-sbtn-google" onclick="window.rpGoogleSignIn()">
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
    Continue with Google
  </button>
  <button type="button" class="rp-sbtn rp-sbtn-apple" onclick="window.rpAppleSignIn()">
    <svg width="19" height="19" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M17.05 12.04c-.03-2.85 2.33-4.22 2.44-4.28-1.33-1.94-3.4-2.21-4.13-2.24-1.76-.18-3.43 1.03-4.32 1.03-.88 0-2.26-1-3.72-.98-1.91.03-3.68 1.11-4.66 2.82-1.99 3.45-.51 8.55 1.42 11.35.94 1.37 2.07 2.91 3.54 2.85 1.42-.06 1.96-.92 3.68-.92 1.71 0 2.2.92 3.71.89 1.53-.03 2.5-1.4 3.43-2.78 1.08-1.59 1.53-3.13 1.55-3.21-.03-.02-2.98-1.15-3.01-4.5zM14.23 3.78c.78-.95 1.31-2.27 1.16-3.58-1.13.05-2.49.75-3.3 1.69-.72.84-1.36 2.18-1.19 3.46 1.26.1 2.55-.64 3.33-1.57z"/></svg>
    Continue with Apple
  </button>
  <div class="rp-social-err" id="rp-social-err"></div>
</div>
<div class="rp-divider"><span></span><em>or</em><span></span></div>
<!-- existing Log in / Sign up tabs + email/password continue below this line -->
```

## 2. Frontend — CSS (match the overlay's dark/gold theme; rename vars to your tokens)

```css
.rp-social{display:flex;flex-direction:column;gap:11px;margin-top:16px;}
.rp-sbtn{display:flex;align-items:center;justify-content:center;gap:12px;height:54px;
  border-radius:13px;font-size:16px;font-weight:600;cursor:pointer;font-family:inherit;
  border:1px solid rgba(245,239,225,0.12);transition:filter .15s;}
.rp-sbtn:hover{filter:brightness(0.96);}
.rp-sbtn:disabled{opacity:.55;cursor:default;}
.rp-sbtn-google{background:#FFFFFF;color:#1A1A1A;border-color:transparent;}
.rp-sbtn-apple{background:#000000;color:#FFFFFF;border-color:rgba(255,255,255,0.22);}
.rp-social-err{min-height:0;color:#ff8c8c;font-size:13px;line-height:1.4;}
.rp-social-err:not(:empty){min-height:18px;margin-top:2px;}
.rp-divider{display:flex;align-items:center;gap:14px;margin:20px 0 18px;}
.rp-divider span{flex:1;height:1px;background:rgba(245,239,225,0.12);}
.rp-divider em{font-style:normal;font-size:12px;font-weight:600;letter-spacing:.1em;
  text-transform:uppercase;color:#9A958B;}
```

## 3. Frontend — JS (add inside the overlay IIFE, alongside the other window.* handlers)

Load the two provider SDKs once (put in `<head>` of the `/p/:id` page, or inject lazily):

```html
<script src="https://accounts.google.com/gsi/client" async defer></script>
<script src="https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js" async defer></script>
```

Handlers — popup mode so the vote overlay context is preserved:

```js
// ==== CONFIG (Replit: set these from env, injected into the page) ====
var GOOGLE_CLIENT_ID = "{{GOOGLE_WEB_CLIENT_ID}}";   // OAuth 2.0 Web client ID
var APPLE_CLIENT_ID  = "{{APPLE_SERVICES_ID}}";       // Apple Services ID (NOT the app bundle id)
var APPLE_REDIRECT   = "https://representportal.com/api/auth/apple/web/callback"; // must be whitelisted in Apple

function rpSocialErr(msg){ var e=document.getElementById('rp-social-err'); if(e) e.textContent=msg||''; }
function rpSocialBusy(b){ document.querySelectorAll('.rp-sbtn').forEach(function(x){x.disabled=b;}); }

// After any successful auth: store JWT and advance exactly like the email path.
function rpAuthSuccess(token){
  try{ localStorage.setItem('rp_web_jwt', token); }catch(_){}
  rpSocialErr('');
  // reuse the existing flow: verified users -> vote step, others -> verify step
  if (typeof checkAuthAndAdvance === 'function') checkAuthAndAdvance();
  else if (typeof showStep === 'function') showStep('verify');
}

// ---------- GOOGLE (popup, auth-code flow) ----------
var _gCode = null;
window.rpGoogleSignIn = function(){
  rpSocialErr('');
  if (!window.google || !google.accounts || !google.accounts.oauth2){
    rpSocialErr('Google sign-in is still loading — try again in a second.'); return;
  }
  _gCode = _gCode || google.accounts.oauth2.initCodeClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: 'openid email profile',
    ux_mode: 'popup',
    callback: function(resp){
      if (!resp || !resp.code){ rpSocialErr('Google sign-in was cancelled.'); rpSocialBusy(false); return; }
      apiFetch('/api/auth/google/web', { method:'POST', body: JSON.stringify({ code: resp.code }) })
        .then(function(r){
          if (r && r.d && r.d.token) rpAuthSuccess(r.d.token);
          else rpSocialErr((r && r.d && r.d.error) || 'Google sign-in failed.');
        })
        .catch(function(){ rpSocialErr('Google sign-in failed. Please try again.'); })
        .finally(function(){ rpSocialBusy(false); });
    }
  });
  rpSocialBusy(true);
  _gCode.requestCode();
};

// ---------- APPLE (popup) ----------
var _appleReady = false;
function rpAppleInit(){
  if (_appleReady || !window.AppleID) return;
  AppleID.auth.init({
    clientId: APPLE_CLIENT_ID,
    scope: 'name email',
    redirectURI: APPLE_REDIRECT,
    usePopup: true
  });
  _appleReady = true;
}
window.rpAppleSignIn = async function(){
  rpSocialErr('');
  if (!window.AppleID){ rpSocialErr('Apple sign-in is still loading — try again in a second.'); return; }
  rpAppleInit();
  rpSocialBusy(true);
  try{
    var res = await AppleID.auth.signIn();           // { authorization:{ id_token, code }, user? }
    var auth = res && res.authorization;
    if (!auth || !auth.id_token){ rpSocialErr('Apple sign-in was cancelled.'); return; }
    var payload = {
      id_token: auth.id_token,
      code: auth.code,
      // Apple returns name ONLY on first authorization — forward it if present
      name: (res.user && res.user.name) ? ((res.user.name.firstName||'') + ' ' + (res.user.name.lastName||'')).trim() : undefined
    };
    var r = await apiFetch('/api/auth/apple/web', { method:'POST', body: JSON.stringify(payload) });
    if (r && r.d && r.d.token) rpAuthSuccess(r.d.token);
    else rpSocialErr((r && r.d && r.d.error) || 'Apple sign-in failed.');
  }catch(e){
    // user closing the popup throws — treat as cancel, not error
    if (e && (e.error === 'popup_closed_by_user' || e.error === 'user_cancelled_authorize')) rpSocialErr('');
    else rpSocialErr('Apple sign-in failed. Please try again.');
  }finally{
    rpSocialBusy(false);
  }
};
```

> `apiFetch` is the helper the overlay already uses for `/api/auth/mobile/email/*`.
> If its return shape differs from `{ d: {...} }`, adjust the `.then` accordingly —
> the only contract that matters: on success the endpoint returns `{ token, user }`.

---

## 4. Backend — two new endpoints (mirror the existing mobile handlers)

Both do the same job as `/api/auth/google/mobile` and `/api/auth/apple/mobile`:
verify the provider token, find-or-create the user by verified email/sub, create a
custodial wallet if missing, and return the same JWT the email endpoints issue.
**Reuse the existing user-creation + JWT + wallet code paths** — only the token
verification differs.

```ts
// POST /api/auth/google/web   body: { code }
app.post("/api/auth/google/web", async (req, res) => {
  try {
    const { code } = req.body || {};
    if (!code) return res.status(400).json({ error: "Missing code" });

    // Exchange the popup auth code for tokens (server-side; uses the WEB client secret)
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_WEB_CLIENT_ID!,
        client_secret: process.env.GOOGLE_WEB_CLIENT_SECRET!,
        redirect_uri: "postmessage",   // required for GIS popup code flow
        grant_type: "authorization_code",
      }),
    });
    const tok = await tokenRes.json();
    if (!tok.id_token) return res.status(401).json({ error: "Google verification failed" });

    // Verify the id_token (reuse whatever the mobile handler uses, e.g. google-auth-library)
    const { OAuth2Client } = await import("google-auth-library");
    const client = new OAuth2Client(process.env.GOOGLE_WEB_CLIENT_ID);
    const ticket = await client.verifyIdToken({ idToken: tok.id_token, audience: process.env.GOOGLE_WEB_CLIENT_ID });
    const p = ticket.getPayload();
    if (!p?.email || !p.email_verified) return res.status(401).json({ error: "Google email not verified" });

    // ↓↓↓ reuse the SAME find-or-create + wallet + JWT logic as /api/auth/google/mobile ↓↓↓
    const { token, user } = await findOrCreateUserAndIssueJwt({
      provider: "google", providerSub: p.sub, email: p.email, name: p.name,
    });
    return res.json({ token, user });
  } catch (e: any) {
    log(`google/web error: ${e?.message || e}`);
    return res.status(401).json({ error: "Google sign-in failed" });
  }
});

// POST /api/auth/apple/web   body: { id_token, code, name? }
app.post("/api/auth/apple/web", async (req, res) => {
  try {
    const { id_token, name } = req.body || {};
    if (!id_token) return res.status(400).json({ error: "Missing id_token" });

    // Verify Apple id_token against Apple's JWKS (reuse the mobile handler's verifier).
    // audience MUST be the Services ID (APPLE_SERVICES_ID), not the app bundle id.
    const applePayload = await verifyAppleIdToken(id_token, process.env.APPLE_SERVICES_ID!);
    if (!applePayload?.email) return res.status(401).json({ error: "Apple email unavailable" });

    const { token, user } = await findOrCreateUserAndIssueJwt({
      provider: "apple", providerSub: applePayload.sub, email: applePayload.email, name,
    });
    return res.json({ token, user });
  } catch (e: any) {
    log(`apple/web error: ${e?.message || e}`);
    return res.status(401).json({ error: "Apple sign-in failed" });
  }
});
```

`findOrCreateUserAndIssueJwt` is shorthand for the block already inside the
`email/signup` + `google/mobile` handlers (create `email_…` user id, bcrypt skip for
social, generate smart wallet best-effort, `jwt.sign({sub,email}, JWT_SECRET)`).
Factor it out and call it from all auth paths so social and email return identical
`{ token, user }` objects (so `checkAuthAndAdvance()` works unchanged).

---

## 5. Replit config checklist (must do before this works in prod)

**Google**
- Google Cloud Console → Credentials → create/confirm an **OAuth 2.0 Web application** client.
- Authorized JavaScript origins: `https://representportal.com` (+ any preview domains).
- Add secrets: `GOOGLE_WEB_CLIENT_ID`, `GOOGLE_WEB_CLIENT_SECRET`.
- (The mobile app uses a different OAuth client — do NOT reuse the iOS client id for web.)

**Apple**
- Apple Developer → Identifiers → create a **Services ID** (e.g. `com.representwallet.web`)
  and enable "Sign in with Apple".
- Configure the Services ID: Web Domain `representportal.com`, Return URL
  `https://representportal.com/api/auth/apple/web/callback`.
- Create a **Sign in with Apple key** (.p8) if the verifier needs client-secret JWT signing.
- Add secrets: `APPLE_SERVICES_ID`, plus the key id / team id / .p8 if your Apple verifier
  signs a client secret (the mobile handler may already have these — check).

**Page**
- Inject `GOOGLE_WEB_CLIENT_ID` and `APPLE_SERVICES_ID` into the `/p/:id` HTML
  (replace the `{{...}}` placeholders) the same way `pdata` is injected.
- Add the two `<script>` SDK tags to the page `<head>`.

**Test after deploy** (fresh, never-verified account):
1. Click Continue with Google → popup → consent → lands back, advances to verify/vote.
2. Same for Apple.
3. Confirm a `users` row is created and the returned JWT authorizes `/api/voting/submit`.
4. Confirm an existing email user who later uses Google with the same address is
   matched, not duplicated (decide policy: link by verified email).
