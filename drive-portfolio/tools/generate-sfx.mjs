/*
 * Generates the pet and toy sound effects with ElevenLabs Sound Effects.
 *   ELEVENLABS_API_KEY=... node tools/generate-sfx.mjs        (from the drive-portfolio folder)
 * Existing files are skipped; delete one to regenerate it. Writes audio/sfx/*.mp3.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY) { console.error('Set ELEVENLABS_API_KEY first.'); process.exit(1); }
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'audio', 'sfx');
mkdirSync(OUT, { recursive: true });

const SFX = [
  ['dog-bark-1', 'A single loud bark from a medium-sized friendly dog, close up, outdoors, clean, no background noise', 0.8],
  ['dog-bark-2', 'Two quick barks, woof woof, from a medium-sized dog, close up, outdoors, clean, no background noise', 1.0],
  ['dog-bark-happy', 'An excited happy dog barking twice and panting, playful, close up, clean, no background noise', 1.4],
  ['dog-bark-alert', 'A medium-sized dog barking alertly at a stranger, three firm barks, close up, outdoors, clean, no background noise', 1.6],
  ['dog-whine', 'A worried dog whining softly, concerned, close up, clean, no background noise', 1.5],
  ['cat-meow-1', 'A short friendly cat meow, close up, clean, no background noise', 0.8],
  ['cat-meow-2', 'A curious cat meow with a rising tone, like asking a question, close up, clean, no background noise', 1.0],
  ['cat-meow-3', 'A long drawn-out cat meow, attention seeking, close up, clean, no background noise', 1.5],
  ['cat-purr', 'A contented cat purring steadily, close up, soft and warm, seamless, no background noise', 3.0],
  ['kite-wind', 'A paper kite fluttering and flapping in a steady breeze high in the sky, gentle wind, seamless loop', 3.0],
  ['ball-bounce', 'A rubber dog ball bouncing twice on grass, close up, clean, no background noise', 0.8],
  ['frisbee-throw', 'A plastic frisbee being thrown, a quick whoosh as it flies past, clean, no background noise', 1.0],
  ['coin-register', 'A cash register ching with coins, a successful sale, short and bright, clean', 1.0],
  ['beach-waves', 'Gentle ocean waves rolling onto a sandy beach and washing back, steady calm surf, natural, seamless loop, no music, no voices, no birds', 20],
  ['top-spin', 'A wooden spinning top whirring and humming as it spins on a stone floor, steady, clean', 3.0],
];
for (const [name, text, dur] of SFX) {
  const file = join(OUT, name + '.mp3');
  if (existsSync(file)) { console.log('  · skip', name); continue; }
  const res = await fetch('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_64', {
    method: 'POST', headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, duration_seconds: dur, prompt_influence: 0.6 }),
  });
  if (!res.ok) { console.error('  ✗', name, res.status, await res.text()); process.exitCode = 1; continue; }
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  console.log('  ✓', name + '.mp3');
}
