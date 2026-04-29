# RCA Toolkit for Service BME

A professional Root Cause Analysis tool for biomedical equipment engineers.

## Features
- 7 RCA templates: 5-Why, Fishbone, A3, Timeline, C&E Matrix, Checklist, Problem Solving
- Offline PWA – install on any device
- Version history for every template
- Cloud sync to GitHub Gist
- Custom branding (logo, name, signature)
- Dark mode
- Export/Import JSON backups

## Usage
1. Clone or download this repository.
2. Open `index.html` in your browser, or deploy to GitHub Pages.
3. For PWA: serve over HTTPS (GitHub Pages does this automatically).
4. To sync: provide a GitHub personal access token with `gist` scope.

## Deploy to GitHub Pages
- Push to `main` branch
- Go to Settings → Pages → Source: `Deploy from a branch`, select `main`, folder `/ (root)`
- Your site will be live at `https://yourusername.github.io/repo-name/`

## Cloud Sync Setup
- Create a GitHub personal access token (Settings → Developer settings → Tokens) with `gist` scope.
- In the app, click `☁️ Sync Gist` and enter the token when prompted.
- The first sync creates a private gist; subsequent syncs update it.