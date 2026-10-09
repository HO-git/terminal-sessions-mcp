// Regression test for the glued-prompt output loss (newline-less command output
// vanished when the next prompt arrived in the same PTY read as the exit marker).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { commandOutputFromBuffer } = require('../dist/src/server/output');
const { cleanTerminalOutput } = require('../dist/src/utils/ansi-clean');

const PROMPT = '\x1b[?2004h\x1b]0;u@h: /w\x07\x1b[01;32mu@h\x1b[00m:\x1b[01;34m/w\x1b[00m$ ';
const JSON_REPLY = '{"ok":true,"keys":{"tripo":true}}';
// bash echoes the command, toggles bracketed paste off, curl prints JSON with
// no trailing newline, bash re-enables paste mode and prints the prompt, then
// echoes the typed marker command and its result.
const base =
  'curl -s http://127.0.0.1:8420/api/health\r\n\x1b[?2004l\r' + JSON_REPLY + PROMPT +
  'echo "<<<EXIT:$?>>>"\r\n\x1b[?2004l\r<<<EXIT:0>>>\r\n';

test('output survives when the marker is the last thing in the buffer', () => {
  const out = cleanTerminalOutput(commandOutputFromBuffer(base, '<<<EXIT:', '>>>'));
  assert.ok(out.includes(JSON_REPLY), out);
});

test('output survives when the NEXT prompt arrived in the same read as the marker', () => {
  const glued = base + PROMPT; // the race: prompt lands before resolve
  const out = cleanTerminalOutput(commandOutputFromBuffer(glued, '<<<EXIT:', '>>>'));
  assert.ok(out.includes(JSON_REPLY), out);
  assert.ok(!out.includes('<<<EXIT'), out);
});

test('the old strip-everything approach loses the JSON on the glued buffer (documents the bug)', () => {
  const glued = base + PROMPT;
  const old = glued
    .replace(/echo "<<<EXIT:\$\?>>>"\r?\n?/g, '')
    .replace(/<<<EXIT:\d+>>>\r?\n?/g, '')
    .trim();
  assert.ok(!cleanTerminalOutput(old).includes(JSON_REPLY));
});

test('buffer without a marker is returned whole', () => {
  assert.equal(commandOutputFromBuffer('hello\r\n', '<<<EXIT:', '>>>'), 'hello');
});
