# Primordial - Notes (Integration + Canon)

Purpose: keep the `primordial` stage aligned across story + data. Actual in-voice story text lives in `lore_primordial_story.md`.

## Canon (Hard vs Soft)

Hard-canon:

- You are a kid in a house that has rules.
- Your dad is a cop.
- You start learning crime via methods: small tests, small results.

Soft-canon (keep blurry unless the game needs it):

- Age, town, year, exact family dynamics.
- The book title(s), dad's specific job/unit.

Emotional truth:

- You are not brave. You are analytical.
- The thrill is not 'evil'. It is access.
- The police aren't magic; they just have a manual. You can read it too.

## The House As The First System

- Hallway = patrol route
- Bedroom = safe zone
- Kitchen Drawer = loot container (requires skill check)
- Adult footsteps = proximity alarm
- Light = detection radius

## Anchor Beats + Game Mapping

### Beat A: Staying Up Late (First Breach)

- Activity: `bedtime`
- Option: `bedtime_default`
- Reward vibe: `kids_cred` (realizing the rules are voluntary)
- Story section: 'The Firewall'

### Beat B: Raiding The House (First Tool)

- Activity: `kids_home_raid`
- Option: `kids_home_raid_default`
- Loot vibe: `torch`
- Pressure vibe: heat-as-footsteps, jail-as-being-sent-back-to-bed
- Story section: 'The Tool'

### Beat C: Reading Under Covers (First Private Space)

- Activity: `bedtime`
- Option: `reading_under_covers`
- Reward vibe: `can_read`
- Story section: 'The Bunker'

### Beat D: The Cop's Book (First Framework)

- Resource vibe: `kid_crime_knowledge`
- Reveal vibe (future): understanding that 'crime' is just a set of mechanics that can be optimized.
- Story section: 'The Manual'

## Modal/Copy Hooks (Suggested)

Keep these short enough to paste into `data/modals.json` without surgery:

- After first success: 'System Breach' (maps to `naughtyboy`)
- On obtaining `torch`: 'Illumination'
- On jail/sent-to-bed: 'Reset'

## Exit Condition (When Primordial Disappears)

Primordial should end like this:

- you stop fearing the house and start mapping it
- you realize the adults are just other users with higher privileges
- the house becomes small enough to leave
- you carry the first lesson forward: everything is a system, and systems have exploits
- Story section: 'The Manual'

## Modal/Copy Hooks (Suggested)

Keep these short enough to paste into `data/modals.json` without surgery:

- After first success: 'What a Naughty Child' (maps to existing modal id `naughtyboy`)
- On obtaining `torch`: 'Torch' (could become a resource modal later)
- On jail/sent-to-bed: 'Bed' (used when a run results in jail)
- After first success: 'System Breach' (maps to `naughtyboy`)
- On obtaining `torch`: 'Illumination'
- On jail/sent-to-bed: 'Reset'

## Exit Condition (When Primordial Disappears)

Primordial should end like this:

- you stop thinking of rules as walls and start thinking of them as costs
- you stop fearing the house and start mapping it
- you realize the adults are just other users with higher privileges
- the house becomes small enough to leave
- you carry the first lesson forward: the system is real, but it can be studied
- you carry the first lesson forward: everything is a system, and systems have exploits
