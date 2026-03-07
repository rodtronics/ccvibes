/**
 * names.js
 *
 * A procedural name generation engine that uses morphological blending,
 * syllabic segmentation, and chaotic heuristics to synthesize names.
 *
 * USAGE:
 * import { NameSynthesizer } from './data/names.js';
 * const synth = new NameSynthesizer(namesJsonData);
 * const weirdName = synth.newName();
 */

export class NameSynthesizer {
  constructor(namesData) {
    this.raw = namesData;
    this.heads = [];
    this.tails = [];
    this.mids = [];

    // "Annotated" logic: Manual overrides for specific split points [head_length, tail_start_index]
    // [3, 3] means take first 3 chars as head, and from index 3 onwards as tail.
    // [3, 4] means skip the 4th letter (index 3) entirely.
    // [4, 3] means overlap the 4th letter.
    this.primeDirectives = {
      Jennifer: [3, 3], // Jen - nifer
      Christopher: [5, 5], // Chris - topher
      Jonathan: [3, 3], // Jon - athan
      Elizabeth: [5, 5], // Eliza - beth
      William: [4, 4], // Will - iam
      Benjamin: [3, 3], // Ben - jamin
      Timothy: [3, 3], // Tim - othy
      Stephanie: [5, 5], // Steph - anie
      Alexander: [4, 4], // Alex - ander
      Sebastian: [5, 5], // Sebas - tian
      Katherine: [4, 4], // Kath - erine
      Victoria: [3, 3], // Vic - toria
      Gabriel: [4, 4], // Gabr - iel
      Nicholas: [4, 4], // Nich - olas
      Samuel: [3, 3], // Sam - uel
      Anthony: [4, 4], // Anth - ony
      Margaret: [4, 4], // Marg - aret
      Deborah: [3, 3], // Deb - orah
      Kenneth: [3, 3], // Ken - neth
      Kimberly: [3, 3], // Kim - berly
      Richard: [4, 4], // Rich - ard
      Joseph: [3, 3], // Jos - eph
      Thomas: [3, 3], // Tho - mas
      Daniel: [3, 3], // Dan - iel
      Matthew: [4, 4], // Matt - hew
      Donald: [3, 3], // Don - ald
      Andrew: [3, 3], // And - rew
      Edward: [2, 2], // Ed - ward
      Ronald: [3, 3], // Ron - ald
      Jeffrey: [4, 4], // Jeff - rey
      Gregory: [4, 4], // Greg - ory
      Joshua: [4, 4], // Josh - ua
      Patrick: [3, 3], // Pat - rick
      Raymond: [3, 3], // Ray - mond
      Douglas: [4, 4], // Doug - las
      Walter: [4, 4], // Walt - er
      Harold: [3, 3], // Har - old
      Arthur: [3, 3], // Art - hur
      Nathan: [4, 4], // Nath - an
      Pamela: [3, 3], // Pam - ela
    };

    this._digest();
  }

  /**
   * Ingests the raw name data and breaks it down into constituent DNA.
   */
  _digest() {
    const source = this.raw.firstNames || [];

    source.forEach((name) => {
      // 1. Check Prime Directives (The "Annotated" path)
      if (this.primeDirectives[name]) {
        const [cutA, cutB] = this.primeDirectives[name];
        const h = name.substring(0, cutA);
        const t = name.substring(cutB);

        this.heads.push({ text: h, source: name, tags: ["prime"] });
        this.tails.push({ text: t, source: name, tags: ["prime"] });

        // Also add the "middle" if there's a gap (e.g. if we did 3, 5)
        if (cutB > cutA) {
          this.mids.push({ text: name.substring(cutA, cutB), source: name });
        }
      }

      // 2. The "Syllabic Chunker" (Procedural fallback)
      // Breaks names into phonetic components automatically.
      // e.g. "Timothy" -> ["Ti", "mo", "thy"]
      const chunks = this._syllabize(name);
      if (chunks.length > 1) {
        // Head is the first chunk
        this.heads.push({ text: chunks[0], source: name, tags: ["syllabic"] });

        // Tail is the last chunk
        this.tails.push({ text: chunks[chunks.length - 1], source: name, tags: ["syllabic"] });

        // Mids are everything in between
        for (let i = 1; i < chunks.length - 1; i++) {
          this.mids.push({ text: chunks[i], source: name, tags: ["syllabic"] });
        }
      }
    });
  }

  /**
   * Breaks a name into phonetic syllables/chunks.
   * Uses a heuristic: Consonants + Vowels + (EndConsonants OR ConsonantBeforeConsonant)
   */
  _syllabize(name) {
    // Regex explanation:
    // [^aeiouy]*           : Start with any number of consonants (e.g. "St" in "Stan")
    // [aeiouy]+            : Followed by at least one vowel
    // (?: ... )?           : Optional closing consonant cluster
    // [^aeiouy]*$          : Match all remaining consonants if at end of word ("rt" in "bert")
    // |                    : OR
    // [^aeiouy](?=[^aeiouy]) : Match ONE consonant if it is followed by another consonant ("n" in "Jen" before "n")
    const regex = /[^aeiouy]*[aeiouy]+(?:[^aeiouy]*$|[^aeiouy](?=[^aeiouy]))?/gi;
    return name.match(regex) || [name];
  }

  /**
   * The main generator function.
   * Uses a convoluted set of heuristics to assemble a name.
   */
  newName() {
    const r = Math.random();

    // Strategy A: The "Bennifer" (Prime Head + Prime Tail)
    // High quality, recognizable blends.
    if (r < 0.4) {
      const h = this._pick(this.heads.filter((x) => x.tags.includes("prime")));
      const t = this._pick(this.tails.filter((x) => x.tags.includes("prime")));
      return this._assemble(h.text, t.text);
    }

    // Strategy B: The "Phonetic Smash" (Any Head + Any Tail)
    // Chaos mode.
    if (r < 0.7) {
      const h = this._pick(this.heads);
      const t = this._pick(this.tails);
      return this._assemble(h.text, t.text);
    }

    // Strategy C: The "Double Barrel" (Head + Head)
    // e.g. "Jimtom", "Robdon"
    if (r < 0.9) {
      const h1 = this._pick(this.heads);
      const h2 = this._pick(this.heads);
      return this._assemble(h1.text, h2.text);
    }

    // Strategy D: The "Frankenstein" (Head + Mid + Tail)
    // e.g. "Jen" + "mo" + "thy" -> "Jenmothy"
    if (r < 0.95 && this.mids.length > 0) {
      const h = this._pick(this.heads);
      const m = this._pick(this.mids);
      const t = this._pick(this.tails);
      return this._assemble(h.text + m.text, t.text);
    }

    // Strategy E: The "Recursive Nightmare"
    // Take a generated name, split it, and add a tail.
    const base = this.newName(); // Recursion!
    const t = this._pick(this.tails);
    return this._assemble(base.substring(0, Math.min(3, base.length)), t.text);
  }

  _pick(arr) {
    if (!arr || arr.length === 0) return { text: "Bob", source: "Fallback" };
    return arr[Math.floor(Math.random() * arr.length)];
  }

  _assemble(partA, partB) {
    let raw = partA + partB;

    // Post-processing heuristics for "cleaner" garbage

    // 1. Triple consonant reduction (e.g. "Robbbert" -> "Robert")
    raw = raw.replace(/([b-df-hj-np-tv-z])\1\1+/gi, "$1$1");

    // 2. Capitalization
    return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  }
}
