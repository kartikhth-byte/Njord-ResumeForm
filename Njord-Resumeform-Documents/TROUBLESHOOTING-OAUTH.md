# Google OAuth Troubleshooting Guide - NjordHR

**Created:** March 16, 2026  
**Last Updated:** March 16, 2026  
**Version:** 1.0  
**Purpose:** Comprehensive guide for fixing Google OAuth login issues  

---

## 🎯 QUICK REFERENCE

**Problem:** Google OAuth login fails with 400 error  
**Solution:** Align Google/Supabase redirect URLs with `/auth/callback` and verify session detection is enabled  
**Time to Fix:** 5-10 minutes  

---

## 📋 TABLE OF CONTENTS

1. [Common Error Symptoms](#common-error-symptoms)
2. [Root Causes](#root-causes)
3. [Complete Fix Guide](#complete-fix-guide)
4. [Verification Steps](#verification-steps)
5. [Why It Worked Before](#why-it-worked-before)
6. [Common Mistakes](#common-mistakes)
7. [Port Changes](#port-changes)
8. [Browser Extensions](#browser-extensions)

---

## ❌ COMMON ERROR SYMPTOMS

### **Error 1: 400 Bad Request from Google**

**Screenshot:** Shows Google error page with "400. That's an error. The server cannot process the request because it is malformed."

**When:** After clicking "Sign in with Google", redirects to Google, then returns with error

**Cause:** Missing or incorrect redirect URI in Google Cloud Console

---

### **Error 2: ERR_BLOCKED_BY_CLIENT**

**Console Message:**
```
POST https://play.google.com/log?hasfast=true&auth=...
net::ERR_BLOCKED_BY_CLIENT
```

**Cause:** Browser extension (ad blocker, privacy tool) blocking Google analytics

**Solution:** Use incognito mode or disable ad blocker for localhost

**Note:** This is harmless - Google's analytics logging, not the OAuth flow itself

---

### **Error 3: Session Not Detected After OAuth**

**Symptom:** OAuth completes, redirects back to app, but user appears not logged in

**Cause:** `detectSessionInUrl` disabled or callback URLs not aligned with the app route

**Solution:** Change to `detectSessionInUrl: true`

---

### **Error 4: Origin Mismatch**

**Console Message:**
```
Access to XMLHttpRequest blocked by CORS policy
Origin 'http://localhost:3000' not allowed
```

**Cause:** OAuth configured for different port (e.g., 5173 vs 3000)

**Solution:** Update Google OAuth JavaScript origins to match current port

---

## 🔍 ROOT CAUSES

### **Root Cause 1: Missing Supabase Callback URL** (MOST COMMON)

**The Problem:**
- Google OAuth requires EXACT redirect URIs to be pre-registered
- Supabase uses a standard callback endpoint: `/auth/v1/callback`
- If this URL is missing from Google Cloud Console, OAuth fails with 400 error

**How to Check:**
1. Go to: https://console.cloud.google.com/apis/credentials
2. Click your OAuth 2.0 Client ID
3. Look for: `https://[YOUR-PROJECT].supabase.co/auth/v1/callback`
4. If missing → This is the problem

**The Fix:**
Add this exact URL to "Authorized redirect URIs":
```
https://btbqdviuqcpauojmorvx.supabase.co/auth/v1/callback
```

---

### **Root Cause 2: detectSessionInUrl Setting** (CRITICAL)

**The Problem:**
- After OAuth, Supabase needs to extract session tokens from URL hash
- URL looks like: `yourapp.com/#access_token=abc123&refresh_token=def456...`
- If `detectSessionInUrl: false`, Supabase ignores these tokens
- User appears not logged in even though OAuth succeeded

**How to Check:**
```javascript
// File: src/lib/supabase.js
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    detectSessionInUrl: false  // ❌ WRONG - OAuth won't work
  }
})
```

**The Fix:**
```javascript
// File: src/lib/supabase.js
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    detectSessionInUrl: true  // ✅ CORRECT - Required for OAuth
  }
})
```

---

### **Root Cause 3: Port Mismatch** (BREAKING)

**The Problem:**
- OAuth is configured for specific origins (protocol + domain + port)
- If your dev server port changes, OAuth breaks
- Example: Configured for `localhost:5173`, but running on `localhost:3000`

**How to Check:**
```bash
# What port is your dev server on?
npm run dev
# Output should show: http://localhost:3000/ or http://localhost:5173/

# What's in Google OAuth?
# Check JavaScript origins in Google Cloud Console
# Should match dev server port exactly
```

**The Fix:**
- Option A: Update Google OAuth to match new port
- Option B: Force dev server to use configured port (see Port Changes section)

---

## ✅ COMPLETE FIX GUIDE

### **Step 1: Update Google Cloud Console** (10 minutes)

#### **1.1 Navigate to Credentials**

1. Go to: https://console.cloud.google.com/apis/credentials
2. Select project: `njord-resumeform`
3. Click on your OAuth 2.0 Client ID
   - Should be named something like "Web application" or "OAuth client"

---

#### **1.2 Update Authorized JavaScript Origins**

**Find section:** "Authorized JavaScript origins"

**What to include:**
```
✅ https://btbqdviuqcpauojmorvx.supabase.co
✅ https://njord-resume-form.vercel.app
✅ http://localhost:3000
```

**Notes:**
- Must include protocol (`https://` or `http://`)
- No trailing slashes
- No paths (just origin, not `/auth/callback`)
- Port must match dev server (3000 or 5173)

---

#### **1.3 Update Authorized Redirect URIs**

**Find section:** "Authorized redirect URIs"

**Required URIs:**
```
✅ https://btbqdviuqcpauojmorvx.supabase.co/auth/v1/callback  ← CRITICAL
✅ https://njord-resume-form.vercel.app/auth/callback
✅ http://localhost:3000/auth/callback
✅ https://btbqdviuqcpauojmorvx.supabase.co/functions/v1/google-meet-callback
```

**Critical:** The first one is THE most important - without it, OAuth fails with 400 error.

**Notes:**
- Must include full path
- Must match EXACTLY (case-sensitive)
- No trailing slashes
- Port must match dev server

---

#### **1.4 Save Changes**

1. Scroll to bottom of page
2. Click **"SAVE"** button
3. **Wait 5 minutes** for Google to propagate changes
4. Google's cache needs time to update

---

### **Step 2: Update Supabase Client Config** (2 minutes)

#### **2.1 Open supabase.js**

```bash
# File location:
src/lib/supabase.js
```

#### **2.2 Find createClient Call**

```javascript
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    detectSessionInUrl: false  // ❌ Find this line
  }
})
```

#### **2.3 Verify It Is Set to true**

```javascript
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    detectSessionInUrl: true  // ✅ Required for OAuth callback handling
  }
})
```

#### **2.4 Save File (If Needed)**

In the current local codebase this setting is already `true`. Only change it if it has drifted.

---

### **Step 3: Verify Dev Server Port** (1 minute)

#### **3.1 Check Current Port**

```bash
# Start dev server
npm run dev

# Output should show:
# ➜  Local:   http://localhost:3000/
# OR
# ➜  Local:   http://localhost:5173/
```

#### **3.2 Ensure OAuth Matches Port**

**If running on port 3000:**
- Google JavaScript origins should have `http://localhost:3000`
- Google redirect URIs should have `http://localhost:3000/auth/callback`

**If running on port 5173:**
- Google JavaScript origins should have `http://localhost:5173`
- Google redirect URIs should have `http://localhost:5173/auth/callback`

**If ports don't match:** See [Port Changes](#port-changes) section below.

---

## ✅ VERIFICATION STEPS

### **Test 1: Clear Browser Cache**

```bash
# Chrome/Edge:
Cmd+Shift+Delete (Mac) or Ctrl+Shift+Delete (Windows)
→ Select "Cached images and files"
→ Select "Cookies and other site data"
→ Click "Clear data"
```

**Why:** Old cached OAuth redirects can cause issues.

---

### **Test 2: Test OAuth Flow**

```bash
# 1. Open browser to dev server
http://localhost:3000

# 2. Click "Sign in with Google" button

# 3. Should redirect to Google login

# 4. Login with your Google account

# 5. Should redirect back to your app

# 6. Should be logged in ✅
```

**Expected behavior:**
- Redirects to Google → Shows Google consent screen → Returns to app → Logged in

**If it fails:**
- Check browser console for errors
- Check network tab for failed requests
- Verify 5 minutes have passed since saving Google OAuth config

---

### **Test 3: Verify Session Persistence**

```bash
# 1. Login successfully
# 2. Refresh page (Cmd+R or Ctrl+R)
# 3. Should still be logged in
# 4. Session should persist across refreshes
```

**If session doesn't persist:**
- Check `detectSessionInUrl: true` in supabase.js
- Check browser console for Supabase errors
- Check localStorage for session tokens

---

### **Test 4: Try Incognito Mode**

```bash
# 1. Open incognito/private window
# 2. Navigate to: http://localhost:3000
# 3. Click "Sign in with Google"
# 4. Should work identically to normal browser
```

**Why:** Rules out browser extension interference.

---

## 🤔 WHY IT WORKED BEFORE

### **Most Likely: Existing Valid Session**

**What happened:**
- You logged in weeks/months ago
- Supabase issued a session token (valid 7-30 days)
- Token stored in browser localStorage
- App checked localStorage on each visit
- Found valid token → Auto-logged you in
- OAuth flow never executed

**Why it broke today:**
- Token finally expired OR
- You cleared browser cache OR
- You tried incognito mode OR
- You explicitly logged out

**Now OAuth runs → Discovers missing callback URL → Error**

---

### **Alternative Explanations**

#### **1. Google Tightened OAuth Security**

**Timeline:** January-March 2026

**What might have changed:**
- Google periodically updates OAuth requirements
- Redirect URI validation became stricter
- URLs that were "close enough" before now must be exact matches
- This would explain why old configs suddenly stopped working

---

#### **2. Supabase Updated OAuth Implementation**

**Possible scenario:**
- Supabase changed how they handle OAuth
- Old method: Direct redirect to your app
- New method: Redirect through `/auth/v1/callback` first
- Your old config worked with old method
- New method requires the standard callback URL

---

#### **3. Port Conflict**

**What happened:**
- Previously running on port 5173
- Another process started using 5173
- Vite auto-selected port 3000
- OAuth still configured for 5173
- Port mismatch → OAuth breaks

**Check:**
```bash
# See what's using port 5173
lsof -i :5173

# If you see a process, kill it
kill -9 [PID]
```

---

## ⚠️ COMMON MISTAKES

### **Mistake 1: Not Waiting 5 Minutes**

**Problem:** Saving Google OAuth config doesn't apply instantly

**Solution:**
- After clicking SAVE in Google Cloud Console
- Wait 5 full minutes before testing
- Google needs time to propagate changes across their servers

**Symptom if you don't wait:**
- OAuth still fails even after "fixing" config
- Changes appear in console but don't work yet

---

### **Mistake 2: Wrong Redirect URI Format**

**Wrong formats:**
```
❌ https://btbqdviuqcpauojmorvx.supabase.co (missing /auth/v1/callback)
❌ https://btbqdviuqcpauojmorvx.supabase.co/auth/v1/callback/ (trailing slash)
❌ http://btbqdviuqcpauojmorvx.supabase.co/auth/v1/callback (http vs https)
❌ https://btbqdviuqcpauojmorvx.supabase.co/auth/callback (missing v1)
```

**Correct format:**
```
✅ https://btbqdviuqcpauojmorvx.supabase.co/auth/v1/callback
```

**Rules:**
- Must use `https://` for Supabase URLs (not `http://`)
- Must include `/auth/v1/callback` path exactly
- No trailing slashes
- Case-sensitive
- No extra query parameters

---

### **Mistake 3: Wrong JavaScript Origin Format**

**Wrong formats:**
```
❌ http://localhost:3000/login (includes path)
❌ localhost:3000 (missing protocol)
❌ http://localhost:3000/ (trailing slash)
```

**Correct format:**
```
✅ http://localhost:3000
```

**Rules:**
- Must include protocol (`http://` or `https://`)
- No paths (just origin)
- No trailing slashes
- Port must match dev server exactly

---

### **Mistake 4: Not Saving supabase.js**

**Problem:** Changing `detectSessionInUrl` but not saving the file

**Solution:**
- After editing supabase.js
- Press Cmd+S (Mac) or Ctrl+S (Windows)
- Verify file saved (Vite should hot-reload)
- Check browser console for new Supabase client initialization

---

### **Mistake 5: Testing Too Soon**

**Problem:** Testing OAuth immediately after config changes

**Timeline:**
```
0 min: Save Google OAuth config ✅
1 min: Test OAuth ❌ Still failing (Google cache not updated)
2 min: Test OAuth ❌ Still failing
3 min: Test OAuth ❌ Still failing
4 min: Test OAuth ❌ Still failing
5 min: Test OAuth ✅ Now working!
```

**Solution:** Wait 5 full minutes before testing.

---

## 🔧 PORT CHANGES

### **Understanding Port Configuration**

**What is a port?**
- Part of the URL: `http://localhost:3000` ← Port 3000
- OAuth is port-specific: 3000 ≠ 5173
- Change port → Must update OAuth config

---

### **Why Port Might Change**

**Common reasons:**
1. Port already in use by another process
2. vite.config.js changed
3. Environment variable changed
4. Manual override in package.json

---

### **Option A: Keep New Port (3000)**

**If Vite is using port 3000:**

1. Update Google OAuth JavaScript origins:
   - Remove: `http://localhost:5173`
   - Add: `http://localhost:3000`

2. Update Google OAuth redirect URIs:
   - Remove: `http://localhost:5173/auth/callback`
   - Add: `http://localhost:3000/auth/callback`

3. Save changes
4. Wait 5 minutes
5. Test OAuth

---

### **Option B: Force Port Back to 5173**

**If you want to use port 5173:**

#### **B.1 Check What's Using Port 5173**

```bash
# Mac/Linux:
lsof -i :5173

# Windows:
netstat -ano | findstr :5173
```

**If you see a process:**
```bash
# Kill it
kill -9 [PID]
```

---

#### **B.2 Force Port in vite.config.js**

```javascript
// File: vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,        // Force this port
    strictPort: true,  // Fail if port taken (don't auto-increment)
    host: true         // Expose to network if needed
  }
})
```

---

#### **B.3 Restart Dev Server**

```bash
# Stop current server (Ctrl+C)

# Restart
npm run dev

# Should now show:
# ➜  Local:   http://localhost:5173/
```

---

### **Which Port Should You Use?**

**Port 3000:**
- ✅ Works if 5173 is taken
- ✅ Common port for React apps
- ❌ Requires updating OAuth config

**Port 5173:**
- ✅ Vite's default
- ✅ OAuth already configured for it (if done earlier)
- ❌ Might conflict with other apps

**Recommendation:** Stick with whichever port you choose, just make sure OAuth matches.

---

## 🚫 BROWSER EXTENSIONS

### **ERR_BLOCKED_BY_CLIENT Error**

**What it means:**
- Browser extension is blocking a network request
- Usually an ad blocker or privacy tool
- Blocking Google's analytics endpoint
- NOT a code error in your app

**Common culprits:**
- uBlock Origin
- AdBlock / AdBlock Plus
- Privacy Badger
- Ghostery
- Brave browser (built-in blocker)
- Firefox Enhanced Tracking Protection

---

### **Quick Test: Incognito Mode**

**Purpose:** Rule out extension interference

**Steps:**
```bash
# 1. Open incognito/private window
Cmd+Shift+N (Mac) or Ctrl+Shift+N (Windows)

# 2. Navigate to your app
http://localhost:3000

# 3. Try OAuth login

# Result:
- ✅ Works in incognito → Extension is blocking
- ❌ Fails in incognito → Different issue
```

---

### **Fix: Whitelist Localhost**

#### **uBlock Origin:**
1. Click uBlock icon in toolbar
2. Click blue power button
3. Refresh page

#### **AdBlock Plus:**
1. Click AdBlock icon
2. Select "Don't run on pages on this domain"
3. Refresh page

#### **Brave Browser:**
1. Click Brave shields icon (lion)
2. Toggle "Shields" to OFF for localhost
3. Refresh page

#### **Firefox:**
1. Click shield icon in address bar
2. Toggle "Enhanced Tracking Protection" OFF
3. Refresh page

---

## 📋 QUICK CHECKLIST

**Before testing OAuth:**

### **Google Cloud Console:**
- [ ] Project: `njord-resumeform` selected
- [ ] OAuth 2.0 Client ID exists
- [ ] JavaScript origins includes Supabase URL
- [ ] JavaScript origins includes production URL
- [ ] JavaScript origins includes `http://localhost:3000`
- [ ] Redirect URIs includes: `https://btbqdviuqcpauojmorvx.supabase.co/auth/v1/callback`
- [ ] Redirect URIs includes: `http://localhost:3000/auth/callback`
- [ ] Changes SAVED
- [ ] Waited 5+ minutes since saving

### **Supabase Config:**
- [ ] File `src/lib/supabase.js` verified
- [ ] `detectSessionInUrl: true` set
- [ ] File saved

### **Dev Environment:**
- [ ] Dev server running: `npm run dev`
- [ ] Port is 3000 (check terminal output)
- [ ] Port matches OAuth config

### **Browser:**
- [ ] Cache cleared
- [ ] Ad blocker disabled for localhost
- [ ] OR tested in incognito mode

---

## 🆘 STILL NOT WORKING?

### **Checklist:**

1. **Did you SAVE Google OAuth config?**
   - Click the SAVE button at bottom of page
   - Verify changes appear when you re-open the page

2. **Did you wait 5 minutes?**
   - Use a timer
   - Google's cache is slow to update

3. **Did you clear browser cache?**
   - Cmd+Shift+Delete → Clear data
   - Or use incognito mode

4. **Is detectSessionInUrl true?**
   - Check supabase.js
   - Verify it says `true` not `false`

5. **Do ports match?**
   - Check `npm run dev` output
   - Check Google OAuth JavaScript origins
   - They must match exactly

6. **Any console errors?**
   - Open DevTools → Console tab
   - Look for red errors
   - Share error messages for debugging

7. **Network tab errors?**
   - Open DevTools → Network tab
   - Try OAuth login
   - Look for failed requests (red)
   - Check response codes (401, 403, 400, etc.)

---

## 📞 GETTING HELP

**If OAuth still doesn't work after following this guide:**

1. **Collect diagnostics:**
   - Screenshot of Google OAuth config
   - Screenshot of browser console errors
   - Screenshot of Network tab during login
   - Contents of supabase.js (auth section)
   - Output of `npm run dev` (port confirmation)

2. **Check these docs:**
   - FEATURE-STATUS-POST-REDESIGN.md (OAuth section)
   - COMPLETED-FEATURES.md (OAuth configuration notes)
   - SMOKE-TESTING-CHECKLIST.md (Prerequisites)

3. **Common issues:**
   - Typo in redirect URI
   - Wrong protocol (http vs https)
   - Trailing slashes
   - Port mismatch
   - Not waiting 5 minutes
   - Browser cache not cleared

---

## 📚 ADDITIONAL RESOURCES

**Google Documentation:**
- [OAuth 2.0 Setup](https://developers.google.com/identity/protocols/oauth2)
- [Authorized Redirect URIs](https://developers.google.com/identity/protocols/oauth2/web-server#uri-validation)

**Supabase Documentation:**
- [Auth Configuration](https://supabase.com/docs/reference/javascript/initializing)
- [Google OAuth](https://supabase.com/docs/guides/auth/social-login/auth-google)

**NjordHR Documentation:**
- [FEATURE-STATUS-POST-REDESIGN.md](./FEATURE-STATUS-POST-REDESIGN.md)
- [COMPLETED-FEATURES.md](./COMPLETED-FEATURES.md)
- [SMOKE-TESTING-CHECKLIST.md](./SMOKE-TESTING-CHECKLIST.md)

---

**END OF TROUBLESHOOTING GUIDE**

**Last Updated:** March 16, 2026  
**Status:** OAuth working with fixes applied  
**Next Steps:** Complete Advanced Search smoke testing with recruiter login  
