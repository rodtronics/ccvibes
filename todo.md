and agent can ADD to this but CANNOT edit what is already here. this is for me to add my ideas into, as I am sometimes thinking of ideas fastedr than AI can implement them.

when I hit repeat, the box that tells me how many repeats there are left, instead of saying 3/3 then 2/3 which is confusing, can it just say "3 runs left" and perhaps give an estimated time to completion. and that makes me think, is it a good idea not to just only have the time countdown, but if the time is over 1 hour, we ALSO state "will be finished at" and give the actual time, and for repeats it'll state when that set of repeats finish.

I dont like the | in between the % and the time left. its not like that on the activites screen but it is still like that on the crew/active runs window

is there a way to indicate to the player that a crime cant be done and why? eg "not enough people" or "not enough money". at the very least the start button should be dimmed or have no rollover

need a way to buy crew .

the font in the main tab menu ("activities","crew","resources" etc) doesn't use the same font as the game.

font selection, can the font selection be a sub menu?

settings should come after log.. in fact can settings be right aligned?

## Passive Crimes / Persistent Operations System

Implement passive income mechanics like "Install Skimmer" - crimes that generate ongoing effects over time rather than single completion rewards.

**Skimmer Example:**
- Activity: "Install Card Skimmer" (one-time installation crime)
- Once installed, creates a persistent "active skimmer" state
- Generates passive events with three possible outcomes:
  1. **Success**: Random cash reward generated at intervals
  2. **Removed**: Skimmer discovered and removed (ends passive income)
  3. **Compromised**: Removed + heat increase

**Design Considerations:**
- How to represent "active installations" in state (separate from runs)
- Tick-based or time-based passive reward checks
- Risk factors: heat level affects discovery chance
- Maintenance/monitoring options to extend lifespan
- Visual indication of active passive operations
- Limit on number of concurrent passive operations
- Different passive operation types (skimmers, drops, lookouts, etc.)

**Schema Requirements:**
- New state object for active persistent operations
- Option flag for "creates persistent operation" vs "one-time completion"
- Passive outcome tables (similar to weighted outcomes but time-triggered)
- Duration/lifespan mechanics
- Discovery/removal probability modifiers
