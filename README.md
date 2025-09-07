# flashcards

Flashcards practice

## Overview

Rich web-app that can use spaced repetition to practice from user-specified CSV or TSV source with flexible configuration.

## Features

Data sources:

* Take an arbitrary URL to a TSV or CSV file
  * Example: https://docs.google.com/spreadsheets/d/e/2PACX-1vQ2HFUKCizfGsGyyMBuv1SzKryj0v-86BfUughqEUhJ3OCHVSLFNqXWSYE_YhwS8cFWFnRgFsK2mnoV/pub?gid=1054010468&single=true&output=tsv
* Interpret TSV/CSV file as a table where the first row defines column-names

Card deck configuration:

* Name configuration (for quick selection)
* Data source URL
* Selected column to show on the front of the cards
* Selected column to show on the back of the card
* Configurable font
* Optionally text-to-speech front and/or back using Web Speech API

Display:

* Maximize use of screen real estate to show centered, full-size
* Use of hotkeys to flip card, navigation, etc

Spaced repetition

* Track cards that were successfully recognized versus those that were not (use front value as the key
* Present cards at regular time spacing, prioritizing older cards first.

 Config is saved to local browser storage.
