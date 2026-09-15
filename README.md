# Storycast

Bookstore-style catalog for multi-character audio stories. Listen in narrator or cast mode, swap character names and voices, search the full text, and manage titles from Admin.

18+ titles require an age check before the catalog opens.

## Features

- Catalog search across titles, series, categories, character names (fuzzy), and story text
- Cast vs narrator playback with gender-filtered voices
- Name substitution and pronounce-as fields, with a name preview
- Resume, queue, playback speed, and episode download
- Admin: structured editor, JSON paste, JSON file upload, bulk import validation, Grok draft helper
- Site-wide age gate (default birth date can be changed in the gate)

## Run locally

```bash
npm install
cp .env.example .env
# add XAI_API_KEY for voices
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

## License

Private project files unless you add a license.
