# Flashcards

A rich, single-page web application for practicing flashcards using spaced repetition.

## Overview

This web-app allows users to practice from custom data sources (TSV or CSV) with flexible configuration options. It saves your configurations and card statistics to local browser storage, so your decks and progress are always ready for you. On startup, the app automatically loads your last-used configuration.

## Features

### Data and Configuration
*   **Load from any URL:** Practice from any publicly accessible TSV or CSV file.
*   **Flexible Columns:** The first row of your data source is interpreted as column names. You can select multiple columns for both the front and back of your cards, and their content will be combined and displayed on separate lines.
*   **Named Configurations:** Save your settings (URL, columns, font, TTS, etc.) under a specific name for quick access later. The current configuration's name is always displayed at the top of the screen.
*   **Settings Panel:** All configuration is handled in a clean, modal overlay, accessible via the gear icon (⚙️) in the upper-right corner.

### Display and Interaction
*   **Adaptive Font Size:** The font size automatically adjusts to maximize the use of the card's space, accommodating long text.
*   **Configurable Font:** Choose from several fonts to suit your preference.
*   **Mobile-Friendly Controls:** The app is designed for a great experience on mobile devices.
    *   **Tap-to-Flip:** Simply tap the card to flip it over.
    *   **Swipe Navigation:** Swipe the card to the right to mark it as "known" (✅) and to the left to mark it as "unknown" (❌).
    *   **Large Buttons with Icons:** The on-screen controls are large and use clear icons for easy tapping.

### Full Hotkey Support
*   **Previous (←):** Go to the previously viewed card. This is history-aware, not just the previous card in the list.
*   **Flip (Space):** Press and release to flip the card.
*   **Hold Space:** Hold the spacebar to see the back of the card; release to flip back to the front.
*   **Next (→):** Go to the next card based on the spaced repetition algorithm.
*   **I know this (k):** Mark the card as known and advance to the next card.
*   **I don't know this (j):** Mark the card as not known and advance to a different low-score card.
*   **Slow Replay (f):** Replay the card's audio at a slower speed. Each press gets progressively slower.

### History and Persistence
*   **Persistent Progress:** All your interactions with each card (retention score, view count, last seen time) are saved to your browser's local storage. Your progress is automatically loaded when you load a deck.
*   **History View:** Click the history button (📜) in the upper-right corner to see a complete, interactive table of all cards in the current deck, along with their detailed statistics.

### Spaced Repetition
*   **Intelligent Practice:** The app tracks which cards you know and which you don't. It prioritizes showing you cards you have the most trouble with.
*   **Smart "Don't Know" Logic:** When you mark a card as not known, its score is reset, and the app will show you a *different* card from the pool of least-known cards, preventing immediate repeats.
*   **Card Statistics:** See the retention score, view count, and last seen time for each card displayed below the controls.

### Text-to-Speech (TTS)
*   **Optional TTS:** Enable text-to-speech for the front and/or back of the cards.
*   **Configurable Languages:** Select the specific language and voice for both the front and back of the cards independently from a list of available system voices.
*   **Adjustable Speed:** Control the reading speed of the TTS.
*   **Uppercase-Aware Pronunciation:** When the "Alternate Uppercase" option is enabled, the TTS system still receives the original, lowercase text to ensure correct pronunciation.

### Advanced Options
*   **Disable Flip Animation:** Turn off the card flipping animation for a faster, more minimal experience.
*   **Alternate Uppercase:** An option to alternate the casing on the front of the card between the original and all-uppercase, to help with memorization.
*   **Audio-Only Front:** For listening comprehension practice, you can choose to hide the text on the front of the card and only hear the audio. A speech icon (🔊) will be displayed instead of the text.
*   **On-Demand TTS:** An option to only have text-to-speech play when the 'f' hotkey is pressed.

## Deployment to Render

This application includes a backend server and is configured for easy deployment to [Render](https://render.com/). The existing GitHub Pages deployment for the frontend remains unaffected.

### One-Click Deploy

You can deploy your own instance of this application to Render by clicking the button below.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/your-username/your-repo-name)

*Note: You will need to replace the repository URL with your own after forking.*

### Manual Deployment Steps

1.  **Fork the Repository:** Start by forking this repository to your own GitHub account.
2.  **Create a New Web Service on Render:**
    *   Go to the [Render Dashboard](https://dashboard.render.com/).
    *   Click **New +** and select **Web Service**.
    *   Connect your GitHub account and select your forked repository.
3.  **Configure the Service:**
    *   **Name:** Give your service a name (e.g., `flashcards-app`).
    *   **Region:** Choose a region close to you.
    *   **Branch:** `main`.
    *   **Build Command:** `npm install`
    *   **Start Command:** `node server.js`
    *   **Instance Type:** `Free` (or your preferred plan).
4.  **Add Environment Variables:**
    *   Before the first deploy, go to the **Environment** tab.
    *   Add the secrets and keys you obtained from the OAuth providers (see instructions below). You must create an environment variable for each key listed in the table.
5.  **Deploy:**
    *   Click **Create Web Service**. Render will automatically build and deploy your application.

### Environment Variables

You will need to configure the following environment variables in your Render service.

| Variable                 | Description                                                                  | Example                               |
| :----------------------- | :--------------------------------------------------------------------------- | :------------------------------------ |
| `SESSION_SECRET`         | A long, random string for securing sessions. Render can generate this for you. | `your_super_secret_session_key`       |
| `GITHUB_CLIENT_ID`       | Your GitHub OAuth App Client ID.                                             | `iv1.1234567890abcdef`                |
| `GITHUB_CLIENT_SECRET`   | Your GitHub OAuth App Client Secret.                                         | `a1b2c3d4e5f6...`                     |
| `GOOGLE_CLIENT_ID`       | Your Google OAuth 2.0 Client ID.                                             | `12345...apps.googleusercontent.com`  |
| `GOOGLE_CLIENT_SECRET`   | Your Google OAuth 2.0 Client Secret.                                         | `GOCSPX-...`                          |
| `LINKEDIN_CLIENT_ID`     | Your LinkedIn OAuth 2.0 Client ID.                                           | `77a1b2c3d4e5`                        |
| `LINKEDIN_CLIENT_SECRET` | Your LinkedIn OAuth 2.0 Client Secret.                                       | `XyZ123...`                           |
| `RENDER_EXTERNAL_URL`    | The public URL of your service. **Render sets this automatically.**          | `https://flashcards-app.onrender.com` |

### Obtaining OAuth Credentials

You must configure at least one OAuth provider for the login system to work.

#### GitHub

1.  Navigate to **GitHub Settings** > **Developer settings** > **OAuth Apps**.
2.  Click **New OAuth App**.
3.  **Application name:** `Flashcards App` (or your choice).
4.  **Homepage URL:** Your Render app's URL (e.g., `https://your-app-name.onrender.com`).
5.  **Authorization callback URL:** Your Render app's URL followed by `/auth/github/callback` (e.g., `https://your-app-name.onrender.com/auth/github/callback`).
6.  Click **Register application**.
7.  Copy the **Client ID** and generate/copy a new **Client Secret**. Add these to your Render environment variables.

#### Google

1.  Go to the [Google Cloud Console](https://console.cloud.google.com/).
2.  Create a new project or select an existing one.
3.  Navigate to **APIs & Services** > **Credentials**.
4.  Click **+ CREATE CREDENTIALS** > **OAuth client ID**.
5.  If prompted, configure the **OAuth consent screen**:
    *   **User Type:** External.
    *   Fill in the required app name, user support email, and developer contact information.
    *   Click **SAVE AND CONTINUE** through the Scopes and Test Users pages.
6.  Return to the **Credentials** page to create the OAuth client ID:
    *   **Application type:** Web application.
    *   **Authorized JavaScript origins:** Add your Render app's URL (e.g., `https://your-app-name.onrender.com`).
    *   **Authorized redirect URIs:** Add your Render app's URL followed by `/auth/google/callback` (e.g., `https://your-app-name.onrender.com/auth/google/callback`).
7.  Click **CREATE** and copy the **Client ID** and **Client Secret**. Add these to your Render environment variables.

#### LinkedIn

1.  Go to the [LinkedIn Developer Portal](https://www.linkedin.com/developers/apps/new) and click **Create app**.
2.  Fill in the app details. You will need to associate it with a company page.
3.  Once created, navigate to the **Auth** tab.
4.  Under **OAuth 2.0 settings**, add an **Authorized redirect URL**: `https://your-app-name.onrender.com/auth/linkedin/callback`.
5.  Copy the **Client ID** and **Client Secret** from this page and add them to your Render environment variables.
6.  Navigate to the **Products** tab and request access for `Sign In with LinkedIn using OpenID Connect`. This is required to retrieve user profile information.
