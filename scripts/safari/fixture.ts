/**
 * @file Creates local Safari injection fixtures and serves a target page.
 */

/* eslint-disable no-console */

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT_PATH = path.resolve(import.meta.dirname, '../..');
const FIXTURE_PATH = path.join(ROOT_PATH, 'build/safari/manual-fixtures/scope/scripts');
const JS_PATH = path.join(FIXTURE_PATH, 'inject.js');
const CSS_PATH = path.join(FIXTURE_PATH, 'inject.css');
const PORT = 4174;

fs.mkdirSync(FIXTURE_PATH, { recursive: true });
fs.writeFileSync(JS_PATH, [
    'document.documentElement.dataset.kodeInjectorSafari = "ready";',
    'const showInjection = () => {',
    '    document.querySelector("h1").textContent = "Safari JavaScript injected";',
    '};',
    'if (document.readyState === "loading") {',
    '    document.addEventListener("DOMContentLoaded", showInjection, { once: true });',
    '} else {',
    '    showInjection();',
    '}',
    '',
].join('\n'));
fs.writeFileSync(CSS_PATH, [
    'body { background: rgb(224, 247, 239) !important; }',
    'h1 { color: rgb(0, 125, 92) !important; }',
    '',
].join('\n'));

const server = http.createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end('<!doctype html><html><body><h1>Safari injection fixture</h1></body></html>');
});

server.listen(PORT, '127.0.0.1', () => {
    console.log('Safari manual fixture is ready:');
    console.log(`Site: http://localhost:${PORT}`);
    console.log(`JavaScript: ${pathToFileURL(JS_PATH).href}`);
    console.log(`CSS: ${pathToFileURL(CSS_PATH).href}`);
    console.log('Press Ctrl+C to stop the server.');
});
