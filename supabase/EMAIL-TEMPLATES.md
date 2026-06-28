# Supabase email templates for CompetencyFlow

Paste these into **Supabase → Authentication → Email Templates**.

Set **Site URL** to `https://competencyflow.vercel.app`  
Set **Redirect URLs** to include `https://competencyflow.vercel.app/auth/callback`

---

## Magic Link (sign-in / activation)

**Subject:** Your CompetencyFlow secure sign-in link

**Body (HTML):**

```html
<h2>CompetencyFlow</h2>
<p>Hello,</p>
<p>You have been invited to access <strong>CompetencyFlow</strong> — the competency and compliance training platform for your healthcare organization.</p>
<p>Click the button below to activate your account or sign in securely. This link expires shortly and can only be used once.</p>
<p><a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Activate my account</a></p>
<p>If you did not expect this email, you can safely ignore it.</p>
<p style="color:#64748b;font-size:12px;">CompetencyFlow · Healthcare workforce training · Policy-grounded lessons & manager visibility</p>
```

---

## Invite user (admin/manager invites)

**Subject:** You're invited to CompetencyFlow

**Body (HTML):**

```html
<h2>Welcome to CompetencyFlow</h2>
<p>Your organization has invited you to join <strong>CompetencyFlow</strong>.</p>
<p>CompetencyFlow turns your facility's policies and SOPs into structured lessons, tracks staff competency, and gives managers real-time visibility for surveys and compliance.</p>
<p><a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Accept invitation & sign in</a></p>
<p>This secure link sets up your account — no password required.</p>
<p style="color:#64748b;font-size:12px;">Questions? Contact your administrator or reply to your manager.</p>
```