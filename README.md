# Spanish Pills Mobile App

This is the simplified mobile build. It is separate from the main planner/feedback app.

## Scope

- Tap-to-build pill exercises only.
- No planner.
- No feedback dashboard.
- No written-answer mode.
- Lessons are bundled in `data/lessons/`.
- The lesson dropdown is controlled by `data/lesson-index.json`.
- Results are saved in the phone browser with `localStorage`.
- Saved words/chunks are saved in the phone browser with `localStorage`.
- Saved words/chunks can be exported as TSV for Anki-style import or JSON for project reuse.

## Local Test

From `spanish-learning/mobile-app/`:

```sh
python3 -m http.server 5174
```

Then open:

```text
http://localhost:5174/
```

For phone testing on the same Wi-Fi, use the computer's local network IP:

```text
http://YOUR-LAPTOP-IP:5174/
```

## GitHub Pages Later

This folder can be published as a static site. For GitHub Pages, use this folder as the site root, or copy its contents into the publishing branch/folder.

The app expects these files to be available relative to `index.html`:

- `app.js`
- `styles.css`
- `data/lesson-index.json`
- `data/lessons/*.json`

When a new lesson is ready for mobile:

1. Copy the lesson JSON into `mobile-app/data/lessons/`.
2. Add it to `mobile-app/data/lesson-index.json`.
3. Deploy the folder again.

## Saved Words

During practice, submit an answer and use `Save useful chunks` to save any useful sentence chunk from the correct answer. You can also add your own word or chunk manually in the `Saved words` section.

Exports:

- `Export Anki TSV` downloads `spanish-saved-words.tsv`.
- `Export JSON` downloads `spanish-saved-words.json`.

The TSV columns are:

```text
front	back	example	tags	lesson	source
```

This is suitable for Anki import as a tab-separated file. The `front` field is the Spanish word/chunk, `back` is the note or English context, and `example` is the full Spanish sentence when available.
