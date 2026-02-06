# Crime Committer VI - Lore Philosophy

Purpose: a single source for narrative intent and canon guardrails. Pair with `01_design_philosophy.md` (mechanics intent) and `04_lexicon.md` (tone/terminology).

This repo does **not** contain one giant linear story. Lore is modular: each major branch/system gets its own story that can stand alone, then links back to a small set of shared anchors.

## 1. What Lore Is (In This Game)
- **Lore is a map of pressure**, not a wiki. It should explain *why* you keep doing this, not *how* every system works.
- **Lore is discovered, not delivered**: hints, partial truths, rumors, redactions, plausible lies.
- **Lore is written to be re-used**: short blocks that can become modal text, activity descriptions, resource blurbs, logs.

## 2. Narrative Pillars
- **Transgression is the tutorial**: you learn by doing the thing you're not meant to do.
- **Competence is a drug**: every new method feels like a private upgrade to reality.
- **Consequences are friction, not annihilation**: you lose time, position, access, face. Not the save file.
- **Crime is craft**: tools, rituals, habits, and small optimizations that feel obscene in their normalcy.
- **Power is social**: cred, leverage, favors, and the quiet terror of being known.

## 3. Voice, Tone, and Point of View
Hard requirement: **dry, understated, cynical, never congratulatory**.

Defaults:
- **Second-person, present tense** for story modals ("you do X"). It keeps the UI and narrative aligned.
- **Short sentences**. Imply more than you say.
- Humor is allowed, but it should land like a dull knife: petty, bleak, a little stupid.

Avoid:
- Moral lectures, therapy-speak, explicit tutorial language ("now you will learn...").
- Grand fantasy epic framing. This is a practical world with ugly little miracles.

## 4. Canon Rules (So We Can Write Fast)
Treat canon as layered:
- **Hard canon**: things the game state can prove (resources gained, staff jailed, branches revealed).
- **Soft canon**: character details that support tone but can be left blurry (names, exact hometown, exact year).
- **Rumor**: in-world explanations and street myth (often wrong, sometimes useful anyway).

When in doubt, write as **soft canon** or **rumor**. Opacity is a feature.

## 5. Structure: Branch Stories That Link Back
Each branch/system story file should contain:
- **Entry point**: what makes the branch feel *possible* to the protagonist.
- **Escalation ladder**: 3-6 steps where methods become cleaner, colder, more professional.
- **Signature costs**: the specific kind of damage this branch does (paranoia, debt, dependency, boredom, shame).
- **Recurring cast**: 2-5 names/roles that can reappear elsewhere (mentor, fixer, rival, cop, civilian).
- **Cross-links**: 3-8 bullets that connect to other branches via shared resources, contacts, or consequences.

Keep cross-links *practical*. No "prophecies". Just cause and effect.

## 6. Mechanical Alignment (Do Not Break)
Lore should reinforce the design constraints:
- No irreversible punishment. The narrative equivalent of "game over" is **time loss** and **new pressure**.
- Heat is background pressure, not a hard wall. The world gets meaner; it doesn't shut off.
- Progress feels discovered, not explained. The protagonist does not own a system diagram.

## 7. Primordial As An Anchor (Not A Tutorial)
The first stage ("primordial") is your origin story: petty rule-breaking before you have language for it.

Anchor beats (canon-friendly, but keep details soft):
- Staying up late (the first crime: awareness).
- Raiding the house for a torch (the first tool).
- Reading under the covers (the first private skill).
- Stealing a cop's crime book (the first framework).

Primordial should feel small, intimate, and embarrassing in hindsight. It sets the emotional truth: you didn't become a criminal because you were evil. You became one because it worked.

## 8. File Conventions
- Location: `lore/`
- Naming: `00_` for philosophy/anchors, then `01_primordial.md`, then branch stories (`10_drugs.md`, `20_street.md`, etc.).
- When referencing in-game identifiers (branchId/activityId/resourceId/modalId), wrap them in backticks.
- Write in blocks that can be pasted into `data/modals.json` later without heavy editing.
