// The articles each knob turns through: offbeat ones, picked so that each
// list spans its slot's whole range, from one end of the sound to the other,
// in order. Turning clockwise goes sine → sawtooth, dark → bright, short →
// long and steady → wobbly.
//
// They were chosen by their signals in November 2026 (contributors,
// references, page views over 30 days, days since the last edit; see
// SoundMap in wiki.ts). The sound always comes from the live
// signals, so as articles are read and edited a choice can drift; the
// effect list drifts most, as it follows the last edit.
//
// Titles stay short (at most 20 characters), so two corners fit side by
// side on the screen.

export const CHOICES = {
  // Contributors → waveform: under 100 sine, then triangle, square, and 1,500+ sawtooth.
  waveform: [
    'Hair ice', // ~40 contributors
    'Eternal Flame Falls',
    'Spotted Lake',
    'Daxophone', // ~100: triangle
    'Hydraulophone',
    'Bog snorkelling',
    'Musical saw', // ~470: square
    'Air guitar',
    'Zorbing',
    'Yawn', // ~1,800: sawtooth
    'Sneeze',
    'Hiccup',
  ],
  // References → filter cutoff, 250 Hz (none) to 7 kHz (400+).
  filter: [
    'Ham sandwich theorem', // 0
    'Sea organ',
    'Optigan',
    'Brown note',
    'Lithophone',
    'Flanging',
    'UVB-76',
    'Doomsday Clock',
    'Platypus',
    'Stonehenge',
    'Bigfoot', // ~350
  ],
  // Page views (30 days) → decay, a short pluck to a long ring.
  envelope: [
    'Poème symphonique', // ~200 views
    'Toe wrestling',
    'Vexations',
    'Wife-carrying',
    'Gurn',
    'Amen break',
    'Hypnic jerk',
    'Kākāpō',
    'Emu War',
    'Axolotl', // ~115,000
  ],
  // Days since the last edit → vibrato: a year or more steady, today a wide fast wobble.
  effect: [
    'Slide whistle', // over a year
    'Aeolian harp',
    'Nyckelharpa',
    'Kazoo',
    'Ring modulation',
    'Carrington Event',
    'Fruitcake',
    'Fugu',
    'Vocoder',
    "Roko's basilisk",
    'The Hum',
    'Extreme ironing',
    'Tetris',
    'Sun dog', // edited today
  ],
};
