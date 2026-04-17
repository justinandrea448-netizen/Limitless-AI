# Limitless AI

`Limitless AI` is a browser-first AI website with a ChatGPT-like interface, no login flow, and local-first storage.

## Included

- modern dark responsive UI with sidebar navigation
- chat history saved locally in the browser
- local-first persistence with `IndexedDB` and `localStorage` fallback
- file upload for `PDF`, `DOCX`, `TXT`, and images
- text extraction from uploaded files with browser-side libraries
- file-grounded answers using extracted local context
- voice input with browser speech recognition
- reply playback with browser speech synthesis
- image generation with a free public endpoint plus local fallback cards
- basic web search and summarization using public Wikipedia endpoints
- custom GPT builder with locally saved instructions
- simple agents for research, file investigation, and planning
- export and import for chats or the full workspace

## Run

Open [index.html](C:\Users\patri\Documents\New project\index.html) in a modern browser.

## Notes

- Files, chats, assistants, and settings stay in your browser.
- Some AI features use free public endpoints when local-only mode is off.
- If those providers are unavailable, the app falls back to local summarization and local concept visuals.
- `PDF`, `DOCX`, and OCR features rely on free browser libraries loaded from CDNs.
