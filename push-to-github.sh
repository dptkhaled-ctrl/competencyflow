#!/bin/bash
# One-click push to GitHub. Paste your token into .github-token first.
set -e
cd "$(dirname "$0")"

if [ ! -f .github-token ]; then
  echo ""
  echo "  STEP 1: Create a file named .github-token in this folder"
  echo "  STEP 2: Paste your GitHub token into it (just the token, nothing else)"
  echo "  STEP 3: Run this script again:  bash push-to-github.sh"
  echo ""
  exit 1
fi

TOKEN=$(cat .github-token | tr -d '[:space:]')
if [ -z "$TOKEN" ]; then
  echo "Error: .github-token is empty. Paste your token and try again."
  exit 1
fi

echo "Pushing to GitHub..."
git push https://dptkhaled-ctrl:${TOKEN}@github.com/dptkhaled-ctrl/competencyflow.git main --force

echo ""
echo "Done! Your code is on GitHub:"
echo "  https://github.com/dptkhaled-ctrl/competencyflow"
echo ""
echo "Next: deploy on Vercel (see DEPLOY-SIMPLE.txt)"