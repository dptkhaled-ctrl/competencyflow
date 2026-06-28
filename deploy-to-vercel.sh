#!/bin/bash
# One-click deploy to Vercel. Paste token into .vercel-token first.
set -e
cd "$(dirname "$0")"
export PATH="/Users/mk/CompetencyFlow-Workspace/.tools/node/bin:$PATH"

if [ ! -f .vercel-token ]; then
  echo ""
  echo "  Missing .vercel-token"
  echo "  Paste your Vercel token into that file, then run this again."
  echo "  Get a token at: https://vercel.com/account/settings/tokens"
  echo ""
  exit 1
fi

TOKEN=$(tr -d '[:space:]' < .vercel-token)
if [ -z "$TOKEN" ]; then
  echo "Error: .vercel-token is empty."
  exit 1
fi

if [ -f .vercel-admin-password ]; then
  ADMIN_PW=$(tr -d '[:space:]' < .vercel-admin-password)
else
  ADMIN_PW="CompetencyFlow2026!"
fi

export VERCEL_TOKEN="$TOKEN"

echo "Linking Vercel project..."
npx vercel link --yes --project competencyflow --token "$TOKEN" 2>/dev/null \
  || npx vercel link --yes --token "$TOKEN"

echo "Setting admin password on Vercel..."
npx vercel env add ADMIN_PASSWORD production --token "$TOKEN" --yes --force --value "$ADMIN_PW" 2>/dev/null || true
npx vercel env add ADMIN_PASSWORD preview --token "$TOKEN" --yes --force --value "$ADMIN_PW" 2>/dev/null || true

if [ -f .env.local ]; then
  SUPABASE_URL=$(grep '^NEXT_PUBLIC_SUPABASE_URL=' .env.local | cut -d= -f2- | tr -d '[:space:]' || true)
  SUPABASE_KEY=$(grep '^NEXT_PUBLIC_SUPABASE_ANON_KEY=' .env.local | cut -d= -f2- | tr -d '[:space:]' || true)
  SITE_URL=$(grep '^NEXT_PUBLIC_SITE_URL=' .env.local | cut -d= -f2- | tr -d '[:space:]' || true)
  if [ -n "$SITE_URL" ]; then
    echo "Setting site URL on Vercel..."
    npx vercel env add NEXT_PUBLIC_SITE_URL production --token "$TOKEN" --yes --force --value "$SITE_URL" 2>/dev/null || true
    npx vercel env add NEXT_PUBLIC_SITE_URL preview --token "$TOKEN" --yes --force --value "$SITE_URL" 2>/dev/null || true
  fi

  if [ -n "$SUPABASE_URL" ] && [ -n "$SUPABASE_KEY" ]; then
    echo "Setting Supabase keys on Vercel..."
    npx vercel env add NEXT_PUBLIC_SUPABASE_URL production --token "$TOKEN" --yes --force --value "$SUPABASE_URL" 2>/dev/null || true
    npx vercel env add NEXT_PUBLIC_SUPABASE_URL preview --token "$TOKEN" --yes --force --value "$SUPABASE_URL" 2>/dev/null || true
    npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production --token "$TOKEN" --yes --force --value "$SUPABASE_KEY" 2>/dev/null || true
    npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY preview --token "$TOKEN" --yes --force --value "$SUPABASE_KEY" 2>/dev/null || true
  fi

  SERVICE_KEY=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | cut -d= -f2- | tr -d '[:space:]' || true)
  if [ -n "$SERVICE_KEY" ]; then
    echo "Setting Supabase service role on Vercel..."
    npx vercel env add SUPABASE_SERVICE_ROLE_KEY production --token "$TOKEN" --yes --force --value "$SERVICE_KEY" 2>/dev/null || true
    npx vercel env add SUPABASE_SERVICE_ROLE_KEY preview --token "$TOKEN" --yes --force --value "$SERVICE_KEY" 2>/dev/null || true
  fi

  OPENAI_KEY=$(grep '^OPENAI_API_KEY=' .env.local | cut -d= -f2- | tr -d '[:space:]' || true)
  if [ -n "$OPENAI_KEY" ] && [ "$OPENAI_KEY" != "sk-proj-your-openai-key-here" ]; then
    echo "Setting OpenAI key on Vercel..."
    npx vercel env add OPENAI_API_KEY production --token "$TOKEN" --yes --force --value "$OPENAI_KEY" 2>/dev/null || true
    npx vercel env add OPENAI_API_KEY preview --token "$TOKEN" --yes --force --value "$OPENAI_KEY" 2>/dev/null || true
  fi
fi

echo "Deploying to Vercel (this takes 1-2 minutes)..."
URL=$(npx vercel deploy --prod --yes --token "$TOKEN" 2>&1 | tail -1)

echo ""
echo "Done! Your site is live at:"
echo "  $URL"
echo ""
echo "Admin password: $ADMIN_PW"
echo "(Change it anytime by editing .vercel-admin-password and re-running this script)"