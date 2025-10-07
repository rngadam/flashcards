# Technical Specification and AI Development Prompt for the 'Alphabet' Educational Web Application

## I. Foundational Architecture and Technology Stack

This document outlines the complete technical specification for the development of `alphabet.html`, an educational web application. The primary objective is to create a robust, offline-capable, single-page application (SPA) for learning alphabets, with a focus on character recognition, pronunciation, and handwriting stroke order. The architecture and technology stack have been selected to ensure performance, extensibility, and a high-quality user experience, all while adhering to the constraint of a pure in-browser HTML and JavaScript implementation.

### 1.1. Architectural Paradigm: The Offline-First SPA

The application will be engineered as a pure client-side SPA. This architectural choice is dictated by the requirement for an in-browser solution that is fully functional after the initial load, without reliance on a persistent network connection. The core of this paradigm is the use of the browser's native IndexedDB API, which allows for the persistent storage of substantial amounts of structured data, including alphabet definitions, character details, and user progress.[1]

This offline-first approach yields several significant advantages beyond simple network independence. Firstly, it ensures user privacy by design, as all data, including learning progress, remains exclusively on the user's device and is never transmitted to a remote server. Secondly, the architecture is inherently extensible. The application logic will be designed to be data-driven, meaning new alphabets can be introduced into the system by simply providing a new, correctly formatted data file. This modularity allows for future expansion to encompass any writing system without requiring modifications to the core application code, representing a substantial long-term architectural benefit.

### 1.2. Data Persistence Layer: Dexie.js over Native IndexedDB

While IndexedDB is the foundational storage technology, its native API is notoriously verbose, event-driven, and susceptible to inconsistencies across different browser implementations.[1] To mitigate these challenges and accelerate development, the application will leverage **Dexie.js**, a high-performance wrapper library for IndexedDB.[2]

Dexie.js is selected over other wrappers, such as JsStore [3] or db.js [4], for several compelling reasons. It provides a clean, modern, and intuitive promise-based API that dramatically simplifies database operations like adding, retrieving, and querying data, contrasting sharply with the cumbersome `onsuccess` and `onerror` event listeners of the native API.[2, 5] Furthermore, Dexie.js is engineered for exceptional performance, utilizing IndexedDB's bulk operation capabilities to maximize data throughput.[2] It also provides a crucial layer of stability by abstracting away and internally managing known bugs and inconsistencies in browser IndexedDB implementations, ensuring a more reliable user experience.[2, 6] The library's active maintenance and widespread adoption further solidify its position as the optimal choice for the application's data persistence layer.[2, 5]

### 1.3. Handwriting Animation Engine: GSAP (GreenSock Animation Platform)

The animated demonstration of handwriting strokes is a central feature of the user experience. To implement this, the application will use the **GreenSock Animation Platform (GSAP)**, an industry-standard JavaScript animation library, in conjunction with its specialized **DrawSVGPlugin**.[7, 8]

This choice is based on a comparative analysis of available animation technologies. While libraries like Vara.js are capable of handwriting effects, they often rely on proprietary JSON-based font formats, which would complicate the process of adding new, arbitrary alphabets.[9, 10] General-purpose libraries like Anime.js are powerful but lack the specialized tooling for this specific task.[11]

GSAP's DrawSVGPlugin is purpose-built for the required effect: progressively revealing or hiding the stroke of an SVG `<path>` element.[8, 12] The plugin works by animating the `stroke-dasharray` and `stroke-dashoffset` CSS properties of an SVG path, a technique widely recognized as the most effective method for creating "line drawing" animations.[13, 14, 15] This provides precise, performant, and reliable control over the animation of each character stroke. GSAP's reputation for high performance, cross-browser consistency, and its powerful timeline features for sequencing complex animations make it the definitive choice for this critical application component.[7, 16]

### 1.4. Auditory Feedback System: The Web Speech API

To fulfill the requirement of "reading out loud" the names of the alphabet characters, the application will utilize the browser's native **Web Speech API**.[17] Specifically, it will employ the speech synthesis (Text-to-Speech) interface, which allows JavaScript to generate speech from text. This approach is highly efficient as it leverages built-in browser functionality, obviating the need for any external libraries or dependencies.

However, browser support and implementation details for the Web Speech API can vary. While speech synthesis is widely supported across modern browsers, the availability of specific voices and languages is platform-dependent.[18, 19] To ensure the application is robust and provides the best possible experience, the implementation will be encapsulated within a dedicated "Speech Service" module. This module will incorporate graceful degradation by first verifying the existence of `window.speechSynthesis` before attempting to use it, preventing errors on unsupported browsers. Furthermore, it will contain logic to query the available voices using `speechSynthesis.getVoices()` and select the most appropriate one based on the language code of the current alphabet (e.g., selecting a voice with a `lang` property of 'el-GR' for Greek). This proactive feature detection and intelligent voice selection will ensure the application functions correctly and uses the most suitable voice available on the user's system.

### Table: Technology Stack Justification

The following table provides a consolidated summary of the selected technologies and the core rationale for their inclusion in the application's architecture.

| Component | Technology | Rationale | Supporting Sources |
| :--- | :--- | :--- | :--- |
| Data Persistence | Dexie.js | Simplifies IndexedDB, abstracts browser bugs, offers superior performance, and provides a modern, intuitive promise-based API. | [2, 5] |
| Handwriting Animation | GSAP + DrawSVGPlugin | Industry-standard, high-performance library with a dedicated plugin specifically designed for the required SVG stroke animation effect, ensuring precise control and reliability. | [7, 8] |
| Auditory Feedback | Web Speech API | Native browser API for text-to-speech functionality, requiring no external libraries and allowing for efficient, built-in audio feedback. | [17] |
| CDN Provider | jsDelivr | A highly reliable, fast, and globally distributed open-source CDN that ensures permanent caching and high availability for the required libraries. | [20, 21] |

---

## II. Data Architecture and Schema Definition

A well-defined data architecture is fundamental to the application's functionality and extensibility. This section details the IndexedDB database schema and the universal data structure for storing character information. This model will serve as the application's single source of truth.

### 2.1. IndexedDB Database Schema

The application's database, managed by Dexie.js, will be named `AlphabetDB`. It will be versioned and will contain three distinct object stores (analogous to tables in a relational database) to manage alphabets, characters, and user progress. The schema will be defined using Dexie.js's concise `db.version().stores()` syntax.[22]

*   **`alphabets`**: This store will contain metadata for each alphabet available in the application.
    *   **Schema:** `++id, name, languageCode`
    *   **Fields:**
        *   `id`: An auto-incrementing primary key.
        *   `name`: The display name of the alphabet (e.g., "Greek", "Spanish").
        *   `languageCode`: The IETF language tag (e.g., 'el-GR', 'es-ES') used for selecting the correct voice in the Web Speech API.

*   **`characters`**: This is the primary data store, holding all information for every character across all alphabets.
    *   **Schema:** `++id, &characterId, alphabetId, name, order`
    *   **Fields:**
        *   `id`: An auto-incrementing primary key.
        *   `characterId`: A unique, human-readable string identifier (e.g., 'greek-alpha'). This field is indexed and must be unique.
        *   `alphabetId`: A foreign key (indexed) linking to the `id` in the `alphabets` store, enabling efficient retrieval of all characters for a given alphabet.
        *   `name`: The official name of the character (e.g., "Alpha").
        *   `order`: The numerical position of the character in its alphabet.
        *   The remaining character data (uppercase, lowercase, pronunciation key, and stroke data) will be stored as properties of the object but do not require indexing.

*   **`userProgress`**: This store will track user performance in the testing mode, allowing for personalized learning and progress tracking.
    *   **Schema:** `++id, characterId, lastTested, correctCount, incorrectCount`
    *   **Fields:**
        *   `id`: An auto-incrementing primary key.
        *   `characterId`: A foreign key linking to the `characterId` in the `characters` store.
        *   `lastTested`: A timestamp of the last time the user was tested on this character.
        *   `correctCount`: The number of times the user correctly identified/drew the character.
        *   `incorrectCount`: The number of times the user failed to identify/draw the character.

### 2.2. The Character Data Object: A Universal Schema

The core of the application's data model is the Character Data Object. This JSON object must be structured universally to accommodate any character from any writing system. Its design is inspired by the robust data format used in the open-source Hanzi Writer project, which separates character metadata from its graphical stroke data.[23, 24]

A critical challenge in fulfilling the project requirements is the lack of readily available, open-source SVG stroke path data for the specified Latin-based alphabets (Italian, Spanish, Turkish). While visual guides for Greek handwriting exist [25], and generic Latin letterforms are available [26, 27], there is no established, machine-readable dataset that breaks these letters down into ordered strokes for animation. Therefore, a key component of this specification is the pre-authoring of this data. A pedagogically sound stroke order (e.g., top-to-bottom, left-to-right, main body before diacritics) has been defined for each character, and this order has been translated into a sequence of SVG `<path>` data strings.[28, 29] This pre-created dataset, provided in the final prompt, is essential for the AI agent to build the application and its core animation feature successfully.

The following table formally defines the schema for each Character Data Object.

### Table: Character Data Object Schema

| Field Name | Data Type | Description | Example |
| :--- | :--- | :--- | :--- |
| `characterId` | String | A unique, human-readable identifier for the character. | `'greek-alpha'` |
| `alphabetId` | Number | Foreign key linking to the `alphabets` table's `id`. | `1` |
| `name` | String | The official name of the letter. | `'Alpha'` |
| `order` | Number | The letter's 1-indexed position in its alphabet. | `1` |
| `uppercase` | String | The uppercase representation of the character (Unicode). | `'Α'` |
| `lowercase` | String | The lowercase representation of the character (Unicode). | `'α'` |
| `pronunciationKey`| String | The text string to be passed to the Web Speech API for audio playback. | `'Alpha'` |
| `strokeSVGPaths` | Object | An object containing arrays of SVG path data strings for both uppercase and lowercase forms, ordered by stroke. | `{ "uppercase": ["M20 80 L80 80"], "lowercase": ["M50 20 C 20 20 20 80 50 80"] }` |

---

## III. Core Application Modules and Logic

The application's JavaScript code will be organized into logical modules to promote separation of concerns, maintainability, and clarity. This section outlines the primary modules and their respective responsibilities.

### 3.1. Data Seeding and Initialization Module (`data.js`)

This module serves as the initial data provider for the application. It will contain a comprehensive JSON object holding the complete, pre-authored data for the four required alphabets: Greek [25, 30], Italian [31], Spanish [32], and Turkish.[33] Its primary function is to populate the IndexedDB database on the user's first visit. The initialization logic will use Dexie.js to check if the database is already populated (e.g., by checking `db.alphabets.count()`). If the count is zero, it will perform a one-time seeding operation using Dexie's efficient `bulkAdd()` method to insert all alphabet and character data into their respective object stores.[6]

### 3.2. Handwriting Animation Engine (`animator.js`)

This module will encapsulate all logic related to the handwriting animation. It will expose a primary function, such as `animateCharacter(svgElement, strokePaths)`, which will take a target SVG container element and an array of SVG path data strings as input. For each path string in the array, the function will dynamically create an SVG `<path>` element and append it to the container. It will then leverage a GSAP Timeline (`gsap.timeline()`) to orchestrate the animation sequence.[7] Each path will be animated using the `DrawSVGPlugin` with a `from()` tween, such as `gsap.from(pathElement, { drawSVG: 0, duration: 1.5 })`.[8] The timeline will use GSAP's `stagger` functionality to introduce a natural, slight delay between the drawing of each consecutive stroke, creating a fluid and realistic handwriting effect.

### 3.3. Auditory Feedback System (`speech.js`)

This module will be a dedicated service for handling all text-to-speech functionality, abstracting the complexities of the Web Speech API. It will expose a single, simple function, `speak(text, langCode)`. Internally, this function will first perform a check for `window.speechSynthesis` to ensure the API is available. If it is, the function will create a `new SpeechSynthesisUtterance(text)`.[17] It will then iterate through the array of available voices returned by `speechSynthesis.getVoices()` to find the best match for the provided `langCode`. Once a suitable voice is found, it will be assigned to the utterance's `voice` property before the `speechSynthesis.speak()` method is called. If the API is not available, the function will fail silently, ensuring application stability.

### 3.4. UI Rendering and State Management (`app.js`)

This will be the main controller module for the entire application. It will be responsible for orchestrating the other modules, managing the application's state (e.g., selected alphabet, current character, active mode), and handling all direct interactions with the DOM. Its key responsibilities will be organized into distinct functions:
*   `initializeApp()`: The entry point of the application. It will initialize the Dexie.js database connection and trigger the data seeding process.
*   `renderAlphabetSelect()`: Will query the `alphabets` store in IndexedDB and dynamically generate UI elements (e.g., buttons) to allow the user to select an alphabet.
*   `renderCharacterGrid(alphabetId)`: Upon alphabet selection, this function will query the `characters` store for all characters matching the given `alphabetId` and render them as an interactive grid in the UI.
*   `displayCharacter(characterId)`: When a user selects a character, this function will fetch the full character object from the database, update the main display area with its name and forms, and then invoke the `animator.js` and `speech.js` modules to perform the animation and audio playback.
*   It will also contain all necessary event listeners to handle user input, such as clicks on alphabet selectors, character grid items, and mode-switching controls.

---

## IV. User Interaction Flow and Feature Specification

This section provides a detailed breakdown of the application's two primary operational modes, defining the specific logic and user experience for each.

### 4.1. Training Mode Logic

The Training Mode is a passive learning environment where the user is presented with information.

*   **User Flow:**
    1.  Upon application launch, the user is presented with a choice of available alphabets (e.g., "Greek", "Italian", "Spanish", "Turkish").
    2.  The user selects an alphabet. The UI updates to display a grid of all characters belonging to that alphabet.
    3.  The user clicks on a character in the grid (e.g., "Beta").
    4.  The main display area is populated with the character's detailed information: its name ("Beta"), its uppercase form ('Β'), and its lowercase form ('β').
    5.  The `animator.js` module is immediately invoked. It clears any previous content from the SVG canvas and begins to animate the drawing of the uppercase 'Β' strokes, followed by a brief pause, and then the animation of the lowercase 'β' strokes.
    6.  Concurrently, the `speech.js` module is called with the character's name and language code (e.g., `speak('Beta', 'el-GR')`), providing auditory reinforcement.
    7.  A "Replay Animation" button is available, allowing the user to re-trigger the animation and audio playback at will.

### 4.2. Testing Mode Logic

The Testing Mode is an interactive environment designed to validate the user's knowledge of character formation.

A core challenge for this mode is handwriting recognition. Implementing a full-fledged, machine-learning-based Optical Character Recognition (OCR) system is beyond the scope of this project. Instead, the application will employ a highly effective and achievable **simplified handwriting recognition** algorithm. This algorithm will not analyze the final image but will instead validate the user's drawing process in real-time. By capturing the user's input on an HTML `<canvas>` element (via `mousedown`, `mousemove`, and `mouseup` events), the application can compare the number, sequence, and general direction of the user's drawn strokes against the known correct data stored in the `strokeSVGPaths` object. This allows for a robust test of the user's knowledge of correct stroke order and formation without the complexity of traditional OCR.

*   **User Flow:**
    1.  The user selects an alphabet and switches to "Test Mode".
    2.  The application queries the `characters` store and randomly selects a character from the chosen alphabet that the user has either not been tested on or has previously answered incorrectly (based on data in the `userProgress` store).
    3.  The `speech.js` module speaks the name of the selected character (e.g., `speak('Zeta', 'el-GR')`), serving as the prompt.
    4.  A blank HTML `<canvas>` element is presented to the user for drawing.
    5.  The user attempts to draw the character on the canvas. The application's JavaScript captures the stroke data as a series of points.
    6.  Upon completion of the drawing (e.g., after a short pause or a "Submit" button click), the simplified recognition logic is executed. It compares the user's stroke count and order against the stored correct data.
    7.  Immediate feedback is provided to the user. If correct, a success message is shown, and the result is logged to the `userProgress` table in IndexedDB. If incorrect, a message like "Incorrect. Please try again." is displayed.
    8.  After a predefined number of incorrect attempts (e.g., three), the application provides a hint by showing the correct stroke animation, and the attempt is logged as incorrect.
    9.  The application then proceeds to the next randomly selected character, creating a continuous testing loop.

---

## V. The Definitive AI Agent Prompt for `alphabet.html`

# Role and Goal

You are an expert front-end web developer. Your goal is to create a single, self-contained HTML file named `alphabet.html`. This file will function as a pure Single Page Application (SPA) for learning various alphabets. The application must be fully functional offline after the initial load, using only HTML, CSS, and JavaScript, with IndexedDB as its persistent datastore.

# Core Requirements

1.  **Architecture:** A single `alphabet.html` file. All CSS and JavaScript must be embedded within this file.
2.  **Data Storage:** Use IndexedDB for all data persistence. Do not use `localStorage` or any server-side storage.
3.  **Functionality:** The app must teach alphabets, including:
    *   Displaying uppercase and lowercase forms of each letter.
    *   Displaying the name of each letter.
    *   Speaking the name of each letter out loud.
    *   Animating the correct handwriting stroke order for each letter.
4.  **Modes:** The application must have two distinct modes:
    *   **Training Mode:** Users can browse alphabets and letters, view the stroke animations, and hear the names.
    *   **Testing Mode:** The app prompts the user with a letter's name, and the user must draw the letter on a canvas. The app will validate the drawing based on stroke order.
5.  **Initial Data:** The application must be pre-loaded with data for the Greek, Italian, Spanish, and Turkish alphabets.

# Technology Stack & CDN Links

You must use the following JavaScript libraries. Include them in the `<head>` section of the HTML file using these exact CDN links.
```html
<script src="[https://cdn.jsdelivr.net/npm/dexie@4.0.1/dist/dexie.min.js](https://cdn.jsdelivr.net/npm/dexie@4.0.1/dist/dexie.min.js)"></script>
<script src="[https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js](https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js)"></script>
<script src="[https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/DrawSVGPlugin.min.js](https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/DrawSVGPlugin.min.js)"></script>
```
