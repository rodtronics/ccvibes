# Primordial (Tutorial Origin) - Story Notes

Purpose: narrative spine + reusable text blocks for the `primordial` stage. This is not a "how to play" tutorial. It's the first time you notice you can bend reality by ignoring a rule.

## 1. The Kid (Protagonist)
Keep details soft-canon. The player can project.

What is hard-canon:
- You are a kid in a house that has rules.
- Your dad is a cop.
- You learn crime the way people learn any craft: by collecting methods and testing them.

What matters emotionally:
- You are not brave. You're curious.
- The thrill isn't "evil". It's control.
- Every close call teaches you the same lesson: the world doesn't end, it just gets tense.

## 2. The House (First Map)
The house is the first "city":
- Hallway = exposure.
- Bedroom = safehouse.
- Cupboards/drawers = loot tables.
- Adult footsteps = heat.
- Light = evidence.

The torch is the first tool because it changes what is possible without asking permission.

## 3. Anchor Beats (In Order)
### Beat A: Staying Up Late (First Crime)
You don't start with theft. You start with time.

You lie still. You listen. You learn the rhythm of the house: the TV turning off, the sink running, the small ceremonies adults do so they can pretend tomorrow is guaranteed.

You wait past your bedtime and nothing explodes.

That is the first upgrade.

In-game mapping:
- Activity: `bedtime`
- Option: `bedtime_default`
- Reward vibe: `kids_cred` (because even a private crime changes how you see yourself)

### Beat B: Raiding The House (First Tool)
You want to read under the covers. You need light. You can't ask for it.

The kitchen is a different country at night. Every surface is a witness. The cupboard door is loud in a way that feels personal.

You learn to move slowly. You learn to touch things like you were never there.

If you get caught, it's not death. It's time. It's being put back in your place.

In-game mapping:
- Activity: `kids_home_raid`
- Option: `kids_home_raid_default`
- Loot vibe: `torch`
- Pressure vibe: heat-as-footsteps, jail-as-being-sent-back-to-bed

### Beat C: Reading Under Covers (First Private Skill)
Under the blanket, the torch turns your world into a small, contained stage.

The page is warm. Your heart is loud. Every sentence feels illicit because it belongs to you.

Sometimes you get away with it.
Sometimes the hallway light clicks on and you learn how quickly you can pretend to be asleep.

You do not become a reader because you love stories. You become a reader because reading is a locked door and you found a way in.

In-game mapping:
- Activity: `bedtime`
- Option: `reading_under_covers`
- Reward vibe: `can_read`

### Beat D: The Cop's Book (First Framework)
The book isn't hidden well. It's just placed in a room you're not meant to enter without a reason.

Your dad keeps it like a trophy and like a warning.

The first thing you learn about crime is that the law writes it down carefully. The enemy will hand you a manual if you look serious enough to deserve one.

Stealing the book feels different from stealing a torch. The torch is a thing. The book is permission, taken.

In-game mapping (future):
- Resource vibe: `kid_crime_knowledge`
- Reveal vibe: next branch door opens because you now have language for methods, not just impulses

## 4. Reusable Modal Drafts (Optional Copy)
These are short, paste-friendly blocks intended for `data/modals.json` later.

### "Naughty Boy" (after first success)
You did something you weren't meant to. The ceiling didn't collapse. Nobody died.

You feel sick with relief.

You feel worse when you realize you want to do it again.

### "Torch" (when obtained)
A cheap torch from a kitchen cupboard.

It isn't a weapon. It isn't a key.

It just makes the dark negotiable.

### "Caught" (when jailed/sent to bed)
Adults don't call it jail. They call it "bed".

Same architecture. Different branding.

Time passes. You don't.

## 5. Exit Condition (When Primordial Disappears)
Primordial should end like this:
- you stop thinking of rules as walls and start thinking of them as costs
- the house becomes small enough to leave
- you carry the first lesson forward: the system is real, but it can be studied
