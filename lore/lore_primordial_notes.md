# Primordial - Notes (Integration + Canon)

Purpose: keep the `primordial` stage aligned across story + data. Actual in-voice story text lives in `lore/lore_primordial_story.md`.

## Canon (Hard vs Soft)
Hard-canon:
- You are a kid in a house that has rules.
- Your dad is a cop.
- You start learning crime via methods: small tests, small results.

Soft-canon (keep blurry unless the game needs it):
- Age, town, year, exact family dynamics.
- The book title(s), dad's specific job/unit.

Emotional truth:
- You are not brave. You're curious.
- The thrill is not "evil". It's control.
- Every close call teaches you: the world doesn't end, it just gets tense.

## The House As The First City
- Hallway = exposure
- Bedroom = safehouse
- Cupboards/drawers = loot tables
- Adult footsteps = heat
- Light = evidence

## Anchor Beats + Game Mapping
### Beat A: Staying Up Late (First Crime)
- Activity: `bedtime`
- Option: `bedtime_default`
- Reward vibe: `kids_cred` (identity shift from "kid" to "kid with a secret")
- Story section: "Staying Up Late"

### Beat B: Raiding The House (First Tool)
- Activity: `kids_home_raid`
- Option: `kids_home_raid_default`
- Loot vibe: `torch`
- Pressure vibe: heat-as-footsteps, jail-as-being-sent-back-to-bed
- Story section: "Raiding the House"

### Beat C: Reading Under Covers (First Private Skill)
- Activity: `bedtime`
- Option: `reading_under_covers`
- Reward vibe: `can_read`
- Story section: "Under the Covers"

### Beat D: The Cop's Book (First Framework)
- Resource vibe: `kid_crime_knowledge`
- Reveal vibe (future): next branch door opens because you now have language for methods, not just impulses
- Story section: "The Cop's Book"

## Modal/Copy Hooks (Suggested)
Keep these short enough to paste into `data/modals.json` without surgery:
- After first success: "What a Naughty Child" (maps to existing modal id `naughtyboy`)
- On obtaining `torch`: "Torch" (could become a resource modal later)
- On jail/sent-to-bed: "Bed" (used when a run results in jail)

## Exit Condition (When Primordial Disappears)
Primordial should end like this:
- you stop thinking of rules as walls and start thinking of them as costs
- the house becomes small enough to leave
- you carry the first lesson forward: the system is real, but it can be studied
