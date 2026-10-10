/*
 * Voice script for the island: who says what.
 * `node tools/generate-voices.mjs` turns this into audio/voices/*.mp3 + js/voices.js (needs ELEVENLABS_API_KEY in the environment).
 * Voices: `lib` = ElevenLabs Voice Library (Indian-English, needs a paid plan for API use) [voice_id, public_owner_id];
 *         `premade` = built-in ElevenLabs voice used automatically on the free plan.
 */
export const SPEAKERS = {
  chaiwala: { lib: ['nwj0s2LU9bDWRKND5yzA', '7398804d9eaf2f463899a907587c33a390591775784f87857b6d0e1e4e3e66f6'], name: 'Bunty', style: 0.55 , premade: 'TX3LPaxmHKxFdv7VOQHJ' },
  dosa:     { lib: ['sXXU5CoXEMsIqocfPUh2', 'f87f057c2250691953ac2e6227859706764bd08c88a055a18c74261957885a51'], name: 'Yash', style: 0.4 , premade: 'iP95p4xoKVk53GoZ742B' },
  elder:    { lib: ['LrnwgcdTLxc99sutUxGU', 'f87f057c2250691953ac2e6227859706764bd08c88a055a18c74261957885a51'], name: 'Shiv', style: 0.3 , premade: 'pqHfZKP75CvOlQylNhV4' },
  aunty:    { lib: ['4O1sYUnmtThcBoSBrri7', 'f87f057c2250691953ac2e6227859706764bd08c88a055a18c74261957885a51'], name: 'Maya', style: 0.5 , premade: 'XrExE9yKIg1WjnnlVkGX' },
  simran:   { lib: ['1ea3IFhmSWgw8sJkSvfJ', '7398804d9eaf2f463899a907587c33a390591775784f87857b6d0e1e4e3e66f6'], name: 'Simran', style: 0.55 , premade: 'cgSgspJ2msm6clMCkdW9' },
  pharma:   { lib: ['MwUMLXurEzSN7bIfIdXF', '7398804d9eaf2f463899a907587c33a390591775784f87857b6d0e1e4e3e66f6'], name: 'Tripti', style: 0.25 , premade: 'EXAVITQu4vr4xnSDxMaL' },
  atm:      { lib: ['90ipbRoKi4CpHXvKVtl0', 'f87f057c2250691953ac2e6227859706764bd08c88a055a18c74261957885a51'], name: 'Anika', style: 0.15 , premade: 'Xb7hH8MSUJpSbSDYk0k2' },
  announcer:{ lib: ['BZ7QSotEmGyFMP8nbbhC', 'f87f057c2250691953ac2e6227859706764bd08c88a055a18c74261957885a51'], name: 'Jackie', style: 0.7 , premade: 'IKne3meq5aSn9XLyUdCD' },
  arjun:    { lib: ['iLrek0aeAREetkK9NhwJ', '7398804d9eaf2f463899a907587c33a390591775784f87857b6d0e1e4e3e66f6'], name: 'Siddhu', style: 0.45 , premade: 'bIHbv24MWmeRgasZH58o' },
  m1:       { lib: ['pzxut4zZz4GImZNlqQ3H', '7398804d9eaf2f463899a907587c33a390591775784f87857b6d0e1e4e3e66f6'], name: 'Raju', style: 0.4 , premade: 'cjVigY5qzO86Huf0OWal' },
  m2:       { lib: ['2iAXJEMO2o0PqUHzvZwQ', '7398804d9eaf2f463899a907587c33a390591775784f87857b6d0e1e4e3e66f6'], name: 'Ranbir', style: 0.35 , premade: 'JBFqnCBsd6RMkjVDRZzb' },
  f1:       { lib: ['EaBs7G1VibMrNAuz2Na7', 'f87f057c2250691953ac2e6227859706764bd08c88a055a18c74261957885a51'], name: 'Monika', style: 0.45 , premade: 'FGY2WhTYpPnrIDTdsKH5' },
  narrator: { lib: ['mCQMfsqGDT6IDkEKR20a', 'f87f057c2250691953ac2e6227859706764bd08c88a055a18c74261957885a51'], name: 'Jeevan', style: 0.45, premade: 'nPczCjzI2devNBz1zQrb' },
  f2:       { lib: ['QTKSa2Iyv0yoxvXY2V8a', '7398804d9eaf2f463899a907587c33a390591775784f87857b6d0e1e4e3e66f6'], name: 'Neha', style: 0.45 , premade: 'pFZP5JQG7iQjIQuC4Bku' },
};

// which seller speaks for each shop
export const SHOP_SPEAKER = {
  'CHAI': 'chaiwala', 'JUICE': 'chaiwala', 'PANI PURI': 'chaiwala', 'TOYS': 'chaiwala',
  'MASALA DOSA': 'dosa', 'BIRYANI': 'dosa', 'FILTER COFFEE': 'dosa', 'BAKERY': 'dosa',
  'SPICES': 'elder', 'CRAFTS': 'elder', 'BOOKS': 'elder', 'TEA HOUSE': 'elder',
  'FRESH FRUITS': 'aunty', 'FLOWERS': 'aunty', 'GROCERY': 'aunty',
  'ICE CREAM': 'simran', 'CLOTHES': 'simran', 'CAFÉ': 'simran',
  'PHARMACY': 'pharma',
};

const SHOP_LINES = {
  'MASALA DOSA': ['Hot masala dosa, straight off the tawa! Nice and crispy for you.', 'Come again tomorrow! The dosa will be even crispier.'],
  'CHAI': ['Garam garam chai! Cutting chai, freshly brewed. Come, come!', 'Come back for another chai anytime, my friend!'],
  'FRESH FRUITS': ['Fresh fruits, beta! Sweet mangoes, bananas, straight from the farm.', 'Eat healthy, and visit again! Fresh stock every morning.'],
  'SPICES': ['Smell that? Pure spices, ground this morning. Very good quality.', 'Your kitchen will smell wonderful. Do come again.'],
  'ICE CREAM': ['Kulfi and ice cream! Perfect for this weather, no?', 'Stay cool! Come back and try a new flavour next time.'],
  'JUICE': ['Sugarcane juice, ice cold! One glass and you will feel fresh.', 'Stay fresh! Come back when the sun is hot.'],
  'BIRYANI': ['Biryani, my friend! The queue is long, but trust me, it is worth it.', 'Hope you loved it! Come back hungry next time.'],
  'BOOKS': ['Welcome, welcome. Old books, new stories. Take your time.', 'Happy reading! Come back and tell me how it ends.'],
  'TOYS': ['Kites, tops, toys! The kids love them. Big kids too!', 'Have fun! Come back and show me your kite flying.'],
  'FLOWERS': ['Fresh jasmine garlands! They smell lovely, take one.', 'May your day smell as sweet. Please visit again!'],
  'PANI PURI': ['Pani puri! Spicy, tangy, full of flavour. How many plates?', 'Spicy enough? Come back for round two!'],
  'FILTER COFFEE': ['Strong filter coffee, nice and frothy. Just how you like it.', 'Strong coffee, strong day. See you tomorrow morning!'],
  'BAKERY': ['Fresh puffs and buns, still warm from the oven!', 'Fresh puffs come out at four o\'clock. Do visit again!'],
  'CRAFTS': ['Everything here is handmade. Each piece has a story.', 'Thank you so much. Please come again!'],
  'CLOTHES': ['Shirts, sarees, scarves. The new collection just arrived!', 'You will look great in that! Visit again for the new collection.'],
  'GROCERY': ['Welcome to the grocery! Water, snacks, chocolates, all here.', 'Thank you for shopping with us. See you soon!'],
  'CAFÉ': ['Hi, welcome in! The coffee is fresh and the cake is lovely today.', 'Thanks for stopping by. Your table will be waiting!'],
  'TEA HOUSE': ['Come, sit back and relax. The tea is fresh.', 'Peace and tea. Come back whenever you need both.'],
  'PHARMACY': ['Oh, you are hurt. Don\'t worry, let\'s get you fixed up.', 'Take care of yourself. And hopefully I won\'t see you too soon!'],
};
const THANKS = {
  chaiwala: ['Here you go, boss!', 'Thank you, thank you!', 'Enjoy!'],
  dosa: ['Here you go, enjoy it hot!', 'Thank you so much!', 'Good choice!'],
  elder: ['Here you are.', 'Thank you, dear.', 'A fine choice.'],
  aunty: ['Here you go, beta!', 'Thank you so much!', 'Enjoy!'],
  simran: ['Here you go!', 'Yay, thank you!', 'Great choice!'],
  pharma: ['Here you are.', 'Thank you.', 'Use it right away.'],
};
export const ISLANDER_LINES = {
  base: ['Hi there!', 'Hello, traveller!', 'Welcome to the island!', 'Have you tried the dosa stall? It\'s really good.', 'The sunset point is lovely in the evening.', 'Lost? The map shows every stop.', 'Nice shirt!'],
  rain: ['Better find some shelter!', 'Lovely rain, isn\'t it?'],
  snow: ['Brr, it\'s freezing!', 'Snowball fight later?'],
  night: ['Good evening!', 'Look at all those stars!'],
};

export const NARRATION = {
  intro: "Welcome to the island, explorer! This whole world is Sachayanthan's portfolio. Walk or drive to the glowing pads around the fountain to discover his story, his projects and his skills. Up north is Market Street, full of food stalls and shops, where you can even work a shift. To the south is the village, there are tent camps to the east and west, and the sports ground waits in the north-east. Catch the sunrise and sunset points on the beach. And one more thing... somewhere on this island hides a secret cave. Only one percent of explorers ever find it. Good luck!",
  caveFound: "Incredible! You found the secret cave. Only one percent of explorers ever make it this far. Welcome to The Core.",
};
export const CUSTOMER_LINES = ['Hi! One of those, please.', 'Can I get one, please?', 'Thank you so much!'];

export function buildJobs() {
  const jobs = [];
  const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  for (const [shop, [greet, bye]] of Object.entries(SHOP_LINES)) {
    const sp = SHOP_SPEAKER[shop];
    jobs.push({ key: `shop.${shop}.greet`, speaker: sp, text: greet, file: `shop-${slug(shop)}-greet` });
    jobs.push({ key: `shop.${shop}.bye`, speaker: sp, text: bye, file: `shop-${slug(shop)}-bye` });
  }
  jobs.push({ key: 'shop.PHARMACY.healthy', speaker: 'pharma', text: 'You look perfectly healthy! I can\'t sell you medicine. Come back if you get hurt.', file: 'shop-pharmacy-healthy' });
  jobs.push({ key: 'shop.PHARMACY.rescue', speaker: 'pharma', text: 'Oh no! Your loyal dog brought you here. Don\'t worry, I\'ll help you.', file: 'shop-pharmacy-rescue' });
  for (const [sp, lines] of Object.entries(THANKS)) lines.forEach((t, i) => jobs.push({ key: `thanks.${sp}.${i}`, speaker: sp, text: t, file: `thanks-${sp}-${i}` }));
  jobs.push({ key: 'atm.welcome', speaker: 'atm', text: 'Welcome to Island Bank. Your account summary is on the screen.', file: 'atm-welcome' });
  jobs.push({ key: 'race.invite', speaker: 'arjun', text: 'Hey! We\'re about to race. Want to join us?', file: 'race-invite' });
  [['marks', 'On your marks!'], ['set', 'Get set!'], ['go', 'Go!'], ['place1', 'Amazing! You won the race!'], ['place2', 'Well run! You finished second.'],
   ['place3', 'Well run! You finished third.'], ['place4', 'You finished fourth. Better luck next time!'], ['place5', 'You finished fifth. Better luck next time!']]
    .forEach(([k, t]) => jobs.push({ key: `race.${k}`, speaker: 'announcer', text: t, file: `race-${k}` }));
  for (const sp of ['m1', 'm2', 'f1', 'f2']) for (const [pool, lines] of Object.entries(ISLANDER_LINES)) lines.forEach((t, i) =>
    jobs.push({ key: `isl.${sp}.${pool}.${i}`, speaker: sp, text: t, file: `isl-${sp}-${pool}-${i}` }));
  jobs.push({ key: 'narrator.intro', speaker: 'narrator', text: NARRATION.intro, file: 'narrator-intro' });
  jobs.push({ key: 'narrator.caveFound', speaker: 'narrator', text: NARRATION.caveFound, file: 'narrator-cave-found' });
  for (const sp of ['m1', 'm2', 'f1', 'f2']) CUSTOMER_LINES.forEach((t, i) => jobs.push({ key: `cust.${sp}.${i}`, speaker: sp, text: t, file: `cust-${sp}-${i}` }));
  return jobs;
}
