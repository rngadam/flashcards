// Lightweight speech tester helper used only in the browser.
// Exposes a createSpeechTester() factory that returns an object with
// start() and stop() methods and accepts callbacks for interim/final
// transcripts and audio level updates.

import logger from '../core/logger.js';

export function createSpeechTester({ lang = 'en-US', onInterim = () => {}, onResult = () => {}, onError = () => {}, onLevel = () => {}, onState = () => {} } = {}) {
    if (typeof window === 'undefined') {
        throw new Error('Speech tester must run in a browser environment');
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;
    let recognition = null;
    let audioStream = null;
    let audioContext = null;
    let analyser = null;
    let rafId = null;
    let running = false;

    function logEvent(event, meta = {}) {
        try { logger.log('speech', event, meta); } catch (e) { /* ignore */ }
    }

    function startLevelMeter(stream) {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const source = audioContext.createMediaStreamSource(stream);
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 2048;
            source.connect(analyser);
            const data = new Uint8Array(analyser.fftSize);

            const tick = () => {
                analyser.getByteTimeDomainData(data);
                // compute normalized RMS
                let sum = 0;
                for (let i = 0; i < data.length; i++) {
                    const v = (data[i] - 128) / 128;
                    sum += v * v;
                }
                const rms = Math.sqrt(sum / data.length);
                onLevel(Math.min(1, rms * 1.5)); // scale slightly for visibility
                rafId = requestAnimationFrame(tick);
            };
            tick();
        } catch (e) {
            // If audio context setup fails, still continue without levels
            onError(e);
        }
    }

    async function start() {
        if (running) return;
        running = true;
        onState('starting');
        logEvent('speechTest.starting');

        // Start audio capture for level meter
        try {
            audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            startLevelMeter(audioStream);
        } catch (err) {
            onError(err);
            logEvent('speechTest.microphoneError', { error: String(err) });
        }

        if (SpeechRecognition) {
            recognition = new SpeechRecognition();
            recognition.lang = lang || 'en-US';
            recognition.continuous = true;
            recognition.interimResults = true;

            recognition.onstart = () => { onState('listening'); logEvent('speechTest.listening'); };
            recognition.onend = () => { onState('stopped'); logEvent('speechTest.ended'); };
            recognition.onerror = (e) => { onError(e); logEvent('speechTest.error', { error: e.error || e.message }); };
            recognition.onresult = (evt) => {
                let interim = '';
                let final = '';
                for (let i = evt.resultIndex; i < evt.results.length; i++) {
                    const r = evt.results[i];
                    if (r.isFinal) final += r[0].transcript;
                    else interim += r[0].transcript;
                }
                if (interim) onInterim(interim);
                if (final) onResult(final);
                logEvent('speechTest.result', { interim, final });
            };

            try {
                recognition.start();
            } catch (e) {
                // Some browsers throw if start() called twice; ignore
            }
        } else {
            onError(new Error('SpeechRecognition not supported in this browser'));
            logEvent('speechTest.unsupported');
        }
    }

    function stop() {
        if (!running) return;
        running = false;
        onState('stopping');
        logEvent('speechTest.stopping');
        try { if (recognition) recognition.stop(); } catch (e) { /* ignore */ }
        try {
            if (audioStream) {
                audioStream.getTracks().forEach(t => t.stop());
                audioStream = null;
            }
        } catch (e) { /* ignore */ }
        try { if (rafId) cancelAnimationFrame(rafId); rafId = null; } catch (e) { /* ignore */ }
        try { if (audioContext) { audioContext.close(); audioContext = null; } } catch (e) { /* ignore */ }
        onState('stopped');
        logEvent('speechTest.stopped');
    }

    return { start, stop, isRunning: () => running };
}
