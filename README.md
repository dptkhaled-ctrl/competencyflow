# CompetencyFlow v0.1

A modern B2B staff training and competency platform. Turn policies and SOPs into micro-learning with manager visibility and a grounded policy chatbot.

## Quick start

```bash
export PATH="$HOME/.local/node/bin:$PATH"   # if using local Node install
cd competencyflow
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Demo users

Use the **role switcher** in the header to test different organizations:

| Organization | Staff | Manager |
|---|---|---|
| Apex Manufacturing | Sam Rivera, Taylor Kim, Morgan Patel | Jordan Lee |
| Harbor Health Clinic | Chris Nguyen, Avery Brooks | Dr. Elena Vasquez |
| Summit Retail Group | Jamie Ortiz, Casey Walsh | Riley Chen |

## Main flows to test

1. **Staff Coach (competency flow)** — `/staff` → tap Coach tab → AI teach + quiz loop builds mastery and updates competency records live. "Teach me something new" or review weakest.
2. **Staff lessons** (structured) — from Home dashboard card "Structured lessons" or `/staff/learn` → open a lesson → complete slides + quiz.
2. **AI chatbot (quick Ask)** — bottom-right Ask button or `/staff/chat` → ask "What PPE is required?" (answers cite org policies). Coach is the deep interactive tutor.
3. **Manager dashboard** — switch to a manager → `/manager` → view completion, at-risk staff, recommendations
4. **Incident → refresher** — `/manager/incidents/new` → log a near-miss → auto-generated lesson assigned to team

## Tech stack

- **Next.js 16** (App Router) + TypeScript
- **Tailwind CSS v4** + **shadcn/ui**
- **Zustand** (persisted client state for v0.1 demo data)
- **RAG-lite chatbot** — keyword search over policy chunks with citations (no API key required)

## Project structure

```
src/
├── app/
│   ├── (app)/staff/       # Learner experience
│   ├── (app)/manager/     # Manager dashboard
│   └── api/chat/          # Grounded chatbot API
├── components/            # UI + feature components
└── lib/
    ├── data/              # Seed data + policy documents
    ├── rag/               # Document search + chat
    ├── incidents/         # Auto-lesson generation
    ├── analytics/         # Team metrics
    └── store/             # App state
```

## Environment (optional)

For future LLM integration, add `OPENAI_API_KEY` to `.env.local`. v0.1 works fully offline with document-grounded responses.
## Deployment (GitHub + Vercel)

This project is ready for Vercel deployment.

### 1. Prepare the source

The zip you downloaded (or the `app/` folder) contains everything needed.

### 2. GitHub

```bash
# Unzip the downloaded file
unzip competencyflow-deploy.zip -d my-competencyflow
cd my-competencyflow

# Initialize git (if not already)
git init
git add .
git commit -m "Initial CompetencyFlow deploy"
git branch -M main

# Create repo on GitHub and push
git remote add origin https://github.com/YOUR_USERNAME/competencyflow.git
git push -u origin main
```

### 3. Vercel

1. Go to [vercel.com](https://vercel.com) → New Project → Import Git Repository (select your repo).
2. Vercel auto-detects Next.js.
3. **Important Environment Variables** (in Vercel dashboard → Settings → Environment Variables):
   - `ADMIN_PASSWORD` = (e.g. CompetencyFlow2026!)
   - `OPENAI_API_KEY` = sk-... (required for AI lesson generation and some chat features)
   - `OPENAI_MODEL` = gpt-4o-mini (optional)

4. Deploy. The site will be live at a `*.vercel.app` URL.

### 4. Post-deploy notes & limitations (v0.1 demo)

- **Data & uploads**: The app stores platform data (`data/platform.json`) and uploaded files in the local filesystem. Vercel serverless functions have **ephemeral storage** — data resets on new deployments or after periods of inactivity.
  - On first load it will seed demo organizations and data.
  - File uploads in Admin will work for the session but may not persist long-term.
  - For production persistence, replace `src/lib/server/data-store.ts` with a real database (Vercel Postgres, Supabase, PlanetScale, etc.).

- **Admin login**: Use the password you set in `ADMIN_PASSWORD`.

- **OpenAI**: Some features (lesson designer, advanced chat) require a valid key with credits.

- **Build**: `npm run build` should pass cleanly.

### 5. Local production test before deploy

```bash
npm run build
npm start
```

Open http://localhost:3000

Default demo access via role switcher on the landing page.

## What to customize before real use

- Update demo users / seed data in `src/lib/data/seed.ts` and `src/lib/server/seed-platform.ts`
- Connect a real database for multi-user persistent state
- Add authentication (currently simple password for admin + role switcher for demo)
- Configure custom domain on Vercel
- Set up OpenAI key + monitoring

---

**Ready for GitHub + Vercel!**
