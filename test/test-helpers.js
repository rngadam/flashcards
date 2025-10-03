import { JSDOM } from 'jsdom';

/**
 * Sets up a JSDOM environment for tests that need a DOM.
 * @param {string} [html=''] - Optional HTML content to initialize the document.
 */
export function setupDOM(html = '') {
    const dom = new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`, {
        url: 'http://localhost',
        pretendToBeVisual: true,
    });

    global.window = dom.window;
    global.document = dom.window.document;
    Object.defineProperty(global, 'navigator', {
        value: dom.window.navigator,
        writable: true,
        configurable: true,
    });
    global.HTMLElement = dom.window.HTMLElement;
    global.customElements = dom.window.customElements;
    global.SpeechRecognition = dom.window.SpeechRecognition;
    global.webkitSpeechRecognition = dom.window.webkitSpeechRecognition;
    global.speechSynthesis = {
        getVoices: () => [],
        speak: () => {},
        cancel: () => {},
    };
    global.Diff = {
        diffChars: (a, b) => [{ value: b, added: a !== b, removed: a !== b && a.length > 0 }]
    };
}

/**
 * Tears down the JSDOM environment.
 */
export function teardownDOM() {
    delete global.window;
    delete global.document;
    delete global.navigator;
    delete global.HTMLElement;
    delete global.customElements;
    delete global.SpeechRecognition;
    delete global.webkitSpeechRecognition;
    delete global.speechSynthesis;
    delete global.Diff;
}