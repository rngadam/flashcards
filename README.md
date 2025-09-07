# Flashcards

A rich, single-page web application for practicing flashcards using spaced repetition.

## Overview

This web-app allows users to practice from custom data sources (TSV or CSV) with flexible configuration options. It saves your configurations to local browser storage, so your decks are always ready for you. On startup, the app automatically loads your last-used configuration. If no configurations are saved, the settings panel will appear, prompting you to create one.

## Features

### Data and Configuration
*   **Load from any URL:** Practice from any publicly accessible TSV or CSV file.
*   **Flexible Columns:** The first row of your data source is interpreted as column names. You can select multiple columns for both the front and back of your cards, and their content will be combined and displayed on separate lines.
*   **Named Configurations:** Save your settings (URL, columns, font, TTS, etc.) under a specific name for quick access later. The current configuration's name is always displayed at the top of the screen.
*   **Settings Panel:** All configuration is handled in a clean, modal overlay, accessible via the gear icon (⚙️) in the upper-right corner.

### Display and Interaction
*   **Adaptive Font Size:** The font size automatically adjusts to maximize the use of the card's space, accommodating long text.
*   **Configurable Font:** Choose from several fonts to suit your preference.
*   **Full Hotkey Support:**
    *   **Previous (←):** Go to the previously viewed card. This is history-aware, not just the previous card in the list.
    *   **Flip (Space):** Press and release to flip the card.
    *   **Hold Space:** Hold the spacebar to see the back of the card; release to flip back to the front.
    *   **Next (→):** Go to the next card based on the spaced repetition algorithm.
    *   **I know this (k):** Mark the card as known and advance to the next card.
    *   **I don't know this (j):** Mark the card as not known and advance to a different low-score card.
    *   **Slow Replay (f):** Replay the card's audio at a slower speed. Each press gets progressively slower.

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
