# Storycast

Bookstore-style catalog for multi-character audio stories. Listen in narrator or cast mode, swap character names and voices, search the full text, and manage titles from Admin.

18+ titles require an age check before the catalog opens.

## Features

- Catalog search across titles, series, categories, character names (fuzzy), and story text
- Cast vs narrator playback with gender-filtered voices
- Name substitution and pronounce-as fields, with a name preview
- Resume, queue, playback speed, and episode download
- Admin: structured editor, JSON paste, JSON file upload, bulk import validation, Grok draft helper
- Site administration portal for owners: users and roles, content moderation, billing/finance, system health, and settings
- Database-backed catalog with protected Admin writes and revision history
- Eight xAI cloud voices plus compatible voices installed on the listener's device
- Site-wide age gate (default birth date can be changed in the gate)

## Run locally

```bash
npm install
cp .env.example .env
# add DATABASE_URL for durable stories and XAI_API_KEY for cloud voices
npm run dev
```

Then open the app in your browser. Preview build:

```bash
npm run build
npm run preview
```

## Story JSON

Each title is a JSON object with `config` (title, series, chapter, genre, age, characters) plus `beats` (`speaker` + `text`). Use `{{characterId}}` in beats so name changes stay consistent.

See [docs/STORIES-GROK.md](docs/STORIES-GROK.md) for the full layout used when drafting stories.

Admin → Import accepts one file, many files, a single object, an array, or fenced JSON.

## Voices

Voices come from the xAI TTS API. Set `XAI_API_KEY` on the server. Male and female IDs live in `src/lib/tts-catalog.ts`.
Compatible browser/device voices are discovered at runtime. Kokoro and Sherpa-ONNX can be connected through the
optional adapter URLs in `.env.example`. The player ranks equivalent voices by gender, American/British accent, and
tone (warm, clear, soft, deep, bright, or dramatic). Device voices play locally and cannot be included in WAV exports;
select xAI, Kokoro, or Sherpa voices when downloading an episode.

For reusable rendered beats, configure both `STORY_AUDIO_ROOT` and `STORY_AUDIO_PUBLIC_URL`, then serve that directory
from nginx or a media host. StoryCast hashes the story revision, beat text, character, voice, model, pronunciation, and
render settings; unchanged beats reuse the same asset while relevant edits create a new one. Render metadata is stored
in Postgres when the story exists in the catalog. Without these settings, playback retains the in-memory Base64 fallback.

## Data

Story edits are stored in Postgres when `DATABASE_URL` is configured. Every save creates an immutable revision before
updating the live catalog record. Without `DATABASE_URL`, local development uses temporary in-memory PGLite storage.

## Accounts, tiers, and sharing

StoryCast supports email/password registration alongside configured OAuth providers. New users start on the Free tier.
Managed stories are owner-scoped and may be private, unlisted, or public; only public stories appear in the catalog.
Owners can create random, expiring share links for private or unlisted stories. Only token hashes are stored, so the
original link cannot be recovered from the database. Tier limits live in `src/lib/account-tiers.ts`; billing can update
the `user_tiers` record later without changing ownership or sharing behavior.

Paid-plan gifting is provider-neutral. A verified billing webhook calls `issuePaidPlanGift` after payment; StoryCast
stores only a hash of the one-time code. Gifts can target an email, expire after one year, and atomically extend Creator
or Studio access when redeemed. Connecting checkout still requires choosing and configuring a payment provider.

Anime-inspired stories are first-class StoryCast content. The editor supports book or anime presentation, demographic
and visual-style metadata, anime-aware cover presets, and an anime rewrite mode that creates original episodic structure
without copying existing franchises. The same cast, voice matching, privacy, sharing, and audio pipeline work in both modes.

Hybrid billing writes Stripe and Paddle webhook results into one idempotent ledger using minor currency units. Finance
reports return three views—Combined, Stripe, and Paddle—for each currency, with gross, refunds, disputes, processor
fees, tax, net, and transaction count. Combined values are derived from the two provider views and include an automatic
reconciliation result. Financial reporting is an Owner capability.

Platform authorization has four roles: Owner, Developer, Moderator, and User. Owners are permanent root administrators
and are bootstrapped through `STORYCAST_OWNER_EMAILS`. An owner is not bound by Free/Creator/Studio story, share-link,
or TTS quotas. Developers and Moderators can request capability-scoped temporary administrator access with a reason.
An Owner must approve it for 15 minutes to 4 hours and may revoke it immediately. Temporary access can cover
moderation, system health, integrations, finance, or billing, but can never assign permanent roles, create another
Owner, or grant unlimited account limits. Requests, approvals, expiration, and revocation are retained for audit.
The `/admin` portal is a site administration console for owners and elevated staff; regular users still manage only
their own stories there.

## Local story rewrite model

StoryCast can analyze prose, Markdown, legacy scripts, or off-schema JSON and rewrite it into a validated unpublished
v2 cast draft. The default lightweight model is `qwen3:4b`, served through Ollama's OpenAI-compatible endpoint.

```bash
docker compose -f docker-compose.story-ai.yml up -d
```

Then set `STORY_MODEL_BASE_URL=http://127.0.0.1:11434/v1` and `STORY_MODEL_NAME=qwen3:4b`. The rewrite preserves the
source's lawful adult themes and classifies explicit work as `18+`; it does not automatically publish the result.

## License

Private project files unless you add a license.
