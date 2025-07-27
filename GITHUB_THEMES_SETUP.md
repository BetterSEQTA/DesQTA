# GitHub Themes Setup

This document explains how to set up the GitHub themes repository and configure the backend to fetch themes from it.

## Repository Structure

Your GitHub repository should have the following structure:

```
desqta-themes/
├── theme-1/
│   ├── manifest.json
│   ├── theme.css
│   └── thumbnail.png
├── theme-2/
│   ├── manifest.json
│   ├── theme.css
│   └── thumbnail.png
└── ...
```

## Theme Manifest Format

Each theme folder must contain a `manifest.json` file with the following structure:

```json
{
  "name": "Theme Name",
  "version": "1.0.0",
  "description": "A beautiful theme for DesQTA",
  "author": "Your Name",
  "preview": {
    "thumbnail": "thumbnail.png"
  },
  "customProperties": {
    "primaryColor": "#3b82f6",
    "secondaryColor": "#1e40af",
    "backgroundColor": "#ffffff"
  },
  "features": {
    "glassmorphism": false,
    "gradients": true
  },
  "fonts": {
    "body": "Inter, sans-serif",
    "heading": "Inter, sans-serif"
  },
  "animations": {
    "transition": "all 0.2s ease"
  },
  "settings": {
    "defaultAccentColor": "#3b82f6",
    "defaultTheme": "light"
  }
}
```

## Configuration

1. **Update the repository URL** in `src/routes/api/themes/github/+server.ts`:
   ```typescript
   const GITHUB_REPO = 'your-username/desqta-themes'; // Replace with your actual repo
   ```

2. **Optional: Add GitHub Token** for higher rate limits:
   Create a `.env` file in your project root and add:
   ```
   GITHUB_TOKEN=your_github_personal_access_token
   ```

## How It Works

1. The API endpoint `/api/themes/github` fetches the repository contents from GitHub API
2. It looks for directories (theme folders) in the repository
3. For each directory, it fetches the `manifest.json` file
4. It constructs download URLs for theme assets
5. The frontend displays these themes in the "Get More Themes" modal
6. Users can download and apply themes directly from GitHub

## Example Theme Repository

You can create a public repository with some example themes to test the functionality. Make sure each theme folder contains:
- `manifest.json` - Theme metadata and configuration
- `theme.css` - CSS styles for the theme
- `thumbnail.png` - Preview image (16x16 or larger)

## Rate Limits

Without a GitHub token, you're limited to 60 requests per hour per IP. With a token, you get 5,000 requests per hour. For production use, consider adding a GitHub token to your environment variables. 