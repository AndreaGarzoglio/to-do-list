# GitHub Pages Setup Instructions

Your To Do List app has been pushed to GitHub! To enable GitHub Pages:

## Steps to Complete GitHub Pages Setup:

1. Go to your repository: https://github.com/AndreaGarzoglio/to-do-list
2. Click **Settings** (top right)
3. Scroll to **Pages** section (left sidebar under "Code and automation")
4. Under **Source**, select:
   - Branch: **main**
   - Folder: **/docs**
5. Click **Save**

Your site should now be live at: **https://andreagarZoglio.github.io/to-do-list/**

## What Was Done:

✅ App tested - no errors found
✅ Initialized fresh Git repo in To Do List folder
✅ Added remote origin pointing to your to-do-list GitHub repo
✅ Committed all source files (webpack config, src/, package.json, etc.)
✅ Built webpack bundle to `dist/` folder
✅ Copied `dist/` contents to `docs/` folder for GitHub Pages
✅ Pushed everything to main branch on GitHub

## To Deploy Future Changes:

1. Make changes to source files in `src/`
2. Run `npm run build` to update `dist/`
3. Copy new files to `docs/` (or update your build script)
4. Commit and push:
   ```bash
   git add .
   git commit -m "Update app"
   git push origin main
   ```

The GitHub Pages site will automatically refresh!
