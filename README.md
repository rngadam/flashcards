# Flashcards

A rich, single-page web application for practicing flashcards using spaced repetition.

## Overview

This web-app allows users to practice from custom data sources (TSV or CSV) with flexible configuration options. It saves your configurations to local browser storage, so your decks are always ready for you. On startup, the app automatically loads your last-used configuration. If no configurations are saved, the settings panel will appear, prompting you to create one.

## Features

### Data and Configuration
*   **Load from any URL:** Practice from any publicly accessible TSV or CSV file.
*   **Flexible Columns:** The first row of your data source is interpreted as column names, which you can then select for the front and back of your cards.
*   **Named Configurations:** Save your settings (URL, columns, font, TTS) under a specific name for quick access later. The current configuration's name is always displayed at the top of the screen.
*   **Settings Panel:** All configuration is handled in a clean, modal overlay, accessible via the gear icon (⚙️) in the upper-right corner.

### Display and Interaction
*   **Maximized View:** Cards use the maximum available screen real estate for a focused experience.
*   **Configurable Font:** Choose from several fonts to suit your preference.
*   **Full Hotkey Support:**
    *   **Previous (←):** Go to the previously viewed card. This is history-aware, not just the previous card in the list.
    *   **Flip (Space):** Flip the current card.
    *   **Next (→):** Go to the next card based on the spaced repetition algorithm.
    *   **I know this (k):** Mark the card as known and advance to the next card.
    *   **I don't know this (j):** Mark the card as not known and advance to a different low-score card.

### Spaced Repetition
*   **Intelligent Practice:** The app tracks which cards you know and which you don't. It prioritizes showing you cards you have the most trouble with.
*   **Smart "Don't Know" Logic:** When you mark a card as not known, its score is reset, and the app will show you a *different* card from the pool of least-known cards, preventing immediate repeats.

### Text-to-Speech (TTS)
*   **Optional TTS:** Enable text-to-speech for the front and/or back of the cards.
*   **Configurable Languages:** Select the specific language and voice for both the front and back of the cards independently from a list of available system voices. This is perfect for language learning (e.g., a Greek voice for the front and an English voice for the back).
