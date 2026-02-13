// Crime Committer VI - Crew Management
// Handles crew member generation, name generation, and uniqueness checking

// Name data (loaded from JSON)
let nameData = null;

/**
 * Loads name data from JSON file
 */
async function loadNameData() {
  if (nameData) return nameData;

  try {
    const response = await fetch('../data/names.json');
    nameData = await response.json();
    return nameData;
  } catch (err) {
    console.error('Failed to load name data:', err);
    // Fallback to minimal data if load fails
    nameData = {
      titles: ['Mr.', 'Ms.', 'Dr.'],
      firstNames: ['John', 'Jane', 'Alex'],
      lastNames: ['Smith', 'Johnson', 'Williams'],
      funnyTitles: ['Captain', 'Lord', 'Admiral'],
      funnyFirstNames: ['Boaty', 'Waffle', 'Pickle'],
      funnyLastNames: ['McBoatface', 'McPants', 'McGee']
    };
    return nameData;
  }
}

// Initialize name data on module load
const nameDataPromise = loadNameData();

/**
 * Helper to get random item from array
 */
function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generates a random name string.
 *
 * Variations:
 * - Title (10% chance normally, 30% if funny)
 * - First Last (50%)
 * - First Middle Last (20%)
 * - First M. Last (15%)
 * - First M. N. Last (10%)
 * - F. Middle Last (5%)
 *
 * @param {boolean} funnyMode - Whether to use funny names
 * @returns {string} Generated name
 */
export function generateName(funnyMode = false) {
  if (!nameData) {
    console.warn('Name data not loaded yet');
    return 'Unknown';
  }

  let nameParts = [];

  // 1. Title (10% chance normally, 30% if funny)
  if (Math.random() < (funnyMode ? 0.3 : 0.1)) {
    if (funnyMode && Math.random() < 0.6) {
      nameParts.push(getRandom(nameData.funnyTitles));
    } else {
      nameParts.push(getRandom(nameData.titles));
    }
  }

  // When funnyMode is on, draw from combined pools (normal + funny mixed together)
  const firstPool = funnyMode
    ? [...nameData.firstNames, ...nameData.funnyFirstNames]
    : nameData.firstNames;
  const lastPool = funnyMode
    ? [...nameData.lastNames, ...nameData.funnyLastNames]
    : nameData.lastNames;

  let first = getRandom(firstPool);
  let last = getRandom(lastPool);

  const middle = getRandom(nameData.firstNames); // Reuse first names for middle
  const middle2 = getRandom(nameData.firstNames);

  // Determine pattern
  const patternRoll = Math.random();
  let mainName = "";

  if (patternRoll < 0.5) {
    // First Last
    mainName = `${first} ${last}`;
  } else if (patternRoll < 0.7) {
    // First Middle Last
    mainName = `${first} ${middle} ${last}`;
  } else if (patternRoll < 0.85) {
    // First M. Last
    mainName = `${first} ${middle[0]}. ${last}`;
  } else if (patternRoll < 0.95) {
    // First M. N. Last (Two middle initials)
    mainName = `${first} ${middle[0]}. ${middle2[0]}. ${last}`;
  } else {
    // F. Middle Last (First initial, full middle)
    mainName = `${first[0]}. ${middle} ${last}`;
  }

  nameParts.push(mainName);
  return nameParts.join(" ");
}

/**
 * Extracts all crew member names currently in use (case-insensitive)
 * @param {Array} staff - Array of crew member objects with name property
 * @returns {Set<string>} Set of lowercase crew names
 */
export function getUsedCrewNames(staff) {
  return new Set(
    staff.map((member) => (member.name || '').toLowerCase())
  );
}

// Maximum name length for display purposes
const MAX_NAME_LENGTH = 30;

/**
 * Generates a unique crew member name, ensuring no collisions and respecting max length
 * @param {Set<string>} usedNames - Set of lowercase names already in use
 * @param {boolean} funnyNames - Whether to use funny name generation
 * @returns {string} A unique crew member name
 */
export function generateUniqueCrewName(usedNames, funnyNames = false) {
  let candidate = '';
  let attempts = 0;

  do {
    candidate = generateName(funnyNames);
    attempts += 1;
    // Re-roll if name is too long or already used
  } while ((candidate.length > MAX_NAME_LENGTH || usedNames.has(candidate.toLowerCase())) && attempts < 30);

  // Fallback to suffixing if we somehow hit too many duplicates
  if (usedNames.has(candidate.toLowerCase())) {
    const suffix = Math.floor(Math.random() * 9000) + 1000;
    candidate = `${candidate} ${suffix}`;
  }

  // Final length truncation if still too long (shouldn't happen often)
  if (candidate.length > MAX_NAME_LENGTH) {
    candidate = candidate.substring(0, MAX_NAME_LENGTH - 3) + '...';
  }

  usedNames.add(candidate.toLowerCase());
  return candidate;
}

/**
 * Ensures name data is loaded before game initialization
 * Call this during app startup
 */
export async function initCrewSystem() {
  await nameDataPromise;
  console.log('Crew system initialized with name data');
}
