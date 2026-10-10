# Drive My Portfolio

A playable 3D portfolio. Visitors pick a ride in the **Garage**: a sports coupe, hypercar, classic cruiser, dune buggy or motorbike, in any colour, or explore **on foot** (walk, run and jump). Each moves at a realistic relative speed. They drive around an island: a fountain plaza, ramps, a river bridge you can also drive *under*, boost pads, a timed lap on the outer ring and stars floating above the jumps. Parking on a glowing pad opens that section (About, Projects, Journey, Skills, Work Style, Recognition, Contact).

Beyond the lap ring:
- **North:** a market street of food stalls and shops
- **South:** a village with homes and huts
- **East and west:** tent camps round campfires
- **North-west:** a park with benches and a gazebo
- **On the beach:** a Sunrise Point (east) and a Sunset Point (west)

The sea surrounds everything. On foot, the island fills with people who shop, stroll, sit on benches and greet you.

Seasons change on their own: spring blossom, summer, autumn leaves, then winter snow with a frozen river you can drive across. The game starts in the real-world season for the current month. Weather comes and goes with the season (rain showers with thunder, or snowfall), and wet or snowy roads are more slippery. Day turns into night automatically (a 4-minute cycle). At night the street lamps, headlights, fireflies, moon, stars, planets, the Milky Way and a black hole come out. Built with plain HTML/JS + Three.js — no build step, no internet needed.

The page opens with the same particle-ring loader as the website (it shares `../Portfolio/js/loader.js`). Then it asks how to explore: **Normal view** opens the website, and **Game view** starts the game on foot with the chase camera. The website's "Play mode" link adds `?play`, which skips the question and goes straight into the game.

## Run it
- **Locally:** double-click `index.html` (works offline, even from `file://`).
- **Online:** upload the whole folder to any static host — GitHub Pages, Netlify (drag & drop), Vercel, Cloudflare Pages, S3, or Nginx.

## Edit your content
Open `js/data.js` — all text lives there (kept in sync with the website in `../Portfolio`).
- Each entry in `sections` becomes a stop in the world — add or remove sections and the world re-arranges itself.
- `body` is plain HTML (use `<div class="chips">`, `<div class="card">`, `<div class="timeline">` for styled blocks).
- `color` sets the pad, sign and panel accent.

## Controls
| Key | Action |
|---|---|
| W A S D / arrows | Drive |
| Shift | Boost (run, on foot) |
| Space | Handbrake / drift (jump, on foot) |
| Enter | Open the section you're parked on |
| C | Switch camera (chase / isometric / top-down / first person) |
| Enter (at a stall) | Shop: pay with the Island Bank card |
| I | Bag: your card, purchases, eat / drink / apply / wear |
| X / Z | Sit down / lie down (snaps onto a free bench if you're next to one) |
| L | Lights: auto → on → off (headlights / torch) |
| P | Pet: none → dog → cat (also in the Garage) |
| G | Garage (car + paint, saved in the browser) |
| N | Fast-forward to day / night |
| E | Next season |
| Q | Weather: auto → clear → rain → snow |
| Drag mouse | Look around (eases back when released) |
| R | Reset car · M mute · Esc close panel |

Phones/tablets get on-screen buttons automatically. “Website mode” / “View the website” open the full portfolio site (`../Portfolio/index.html`) for visitors who don't want to play.

## Files
```
index.html        page, HUD, styles
js/data.js        YOUR CONTENT
js/game.js        world, car physics, collisions, minimap, sound
js/three.min.js   Three.js r160 (MIT, see THREE_LICENSE.txt)
```

## Island life (on foot)
- **Money:** you start with ₹10,000 on an Island Bank debit card (balance top-left). There's an ATM by the Market Street arch with a mini statement and a top-up.
- **Shopping:** every stall and shop has a real menu. Paying by card puts the item in your Bag. The balance and Bag are saved in the browser (`drive-life`).
- **Health:** running hard into things or falling from a height hurts you. Below full health the screen shows "Need healing", and below 35 you limp. At 0 you faint and wake at the plaza.
- **Pharmacy:** sells medicine (full heal) and bandages (+30), and refuses to sell anything while you're at full health.
- **Voices:** sellers, the pharmacist, the ATM, the race announcer and the islanders speak with **recorded AI voices**: 120 clips generated with ElevenLabs into `audio/voices/` (about 2.2 MB). The manifest is `js/voices.js`. If a clip can't load, the game falls back to the browser's built-in voice.
  - **Script:** the lines, the cast and which seller speaks for each shop live in `tools/voice-script.mjs`.
  - **Regenerate:** run `ELEVENLABS_API_KEY=... node tools/generate-voices.mjs` from this folder. It skips clips that already exist, so delete a file to regenerate it. On a paid plan it uses the Indian-English library voices listed in the script; on the free plan it uses ElevenLabs' built-in voices.
  - **Credit:** made with the ElevenLabs free plan. The free plan requires attribution ("Voices by ElevenLabs" in the help panel) and is for non-commercial use.
- **Toys:**
  - **Kite:** buy one at a TOYS stall, then choose Fly in the Bag (or press K). It climbs about 20 m on a string from your hand and swings round as you turn. It works while walking or sitting; press K again to reel it in.
  - **Spinning top:** Spin drops it on the ground, where it whirrs and wobbles to a stop. Toys stay in your Bag.
- **Sound effects:** dog barks (happy, alert, worried), cat meows and purr, kite wind and spinning top are real recordings from ElevenLabs Sound Effects in `audio/sfx/`. They're regenerated with `tools/generate-sfx.mjs`.
- **Food and drink:** you eat bite by bite and sip by sip, each with a small health boost. T-shirts from the clothes stall change your shirt.

## Work, sports and island life (on foot)
- **Money:** everyone starts with ₹1,000 (saved as `drive-life-v2`). Open any shop and choose **Work for this shop**: while you stay nearby, customers come to buy, and every sale pays you 30% commission plus a tip.
- **Shoppers:** islanders shop at the stalls on their own and walk off with their bags.
- **Night lights:** stalls and shops have lanterns that glow after dark.
- **Kids and kites:** children play around the park, plaza, village, beach and cricket ground, and some people fly kites.
- **Sports ground (north-east):**
  - ⚽ football 2-a-side: run into the ball to kick
  - 🏀 basketball: grab the ball, Enter to shoot; 3-pointers count
  - 🏏 cricket: bat one over, Space to swing; best score saved as `drive-cricket`
  - 🏸 beach badminton (south-west beach): first to 7, Space to hit
  - 💪 outdoor gym: treadmill, bench press, pull-up bar and dumbbells, each a small health boost
- **Leaving an activity:** Esc, or walk away.

## Pets and racing (on foot)
- **Pets:** a dog or cat follows you and sits when you sit. The dog barks at people wearing hats; the cat meows now and then.
- **Dog rescue:** if you collapse with the dog, it drags you to the pharmacy so you can buy medicine and heal. Without a dog, an islander carries you to the plaza.
- **Foot race:** walk up to the START gate and a "Wanna race?" popup appears. Choose a sprint (Start → Checkpoint 2) or a full lap against 4 runners, with a countdown, live position, a podium and personal bests (`drive-foot-race`). Gates must be passed in order, so shortcuts don't count.

## Spoiler: the secret
A rock outcrop in the west woods hides the map's only cave entrance. Runes glow on it after dark, and a hint appears once all seven sections have been explored. The cave leads down to **THE CORE**: a glowing tunnel, a cavern with an AI-brain hologram, four exhibits (Smart India Hackathon, the non-invasive BP device, the AGV Maze Solver, and the electronics & robotics roots) and a hidden Core Crystal. You leave the same way you came in, back up the tunnel toward the light.

## Tweaks in game.js
- Rides: `MODELS` (look in `build()`, handling in `spec`; `human: true` switches to on-foot controls). The default colour is `#5b5cf6`, and none of the cars carry brand marks.
- Day length: `CYCLE` (seconds) and `DAY_PART` (fraction of the cycle that is daylight)
- Seasons: `SEASONS` (colours, rain chance) and `SEASON_LEN` (seconds per season)
- The island's neighbourhoods: the `DISTRICTS` section (stall names in `STALLS`); islanders' lines are in `GREET`
- Exhibits in the cave: the `items` array in the THE CORE section
- Number of stars: `N_STARS`; trees: `species[...].count`
