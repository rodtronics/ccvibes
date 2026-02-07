# Global Meta Story (Overarching Spine + Branch Ideas)

Purpose: this is the big, editable *under-story* that everything can point back to. It is not UI copy. It is not meant to be pasted into the game. Branch story files can contradict details here until you decide what's canon.

Core constraints (from `01_design_philosophy.md` + `07_lore_philosophy.md`):
- Progress is discovered, not explained.
- Consequences are friction (time loss, pressure), not annihilation.
- The world is interconnected, slightly opaque, and never fully mapped for the player.

---

## 0. The One-Sentence Premise (Pick One)
Write the whole game like *this* is true, then adjust:

1) **I learned crime the same way I learned reading: under a blanket, with stolen light.**
2) **I didn't become a criminal because I was evil. I became one because the method worked.**
3) **The city is a machine, and I learned where you can put your fingers without losing them.**
4) **My dad was a cop. He brought the rulebook home. I used it like a weapon.**

---

## 1. The Streets Is The Spine (Main Branch)
The Streets branch is the "main branch" because:
- It is where the protagonist is *socially located* (friends, rivals, mentor/fixer, cops).
- It is where the story can keep deepening even in late game (territory, crews, pressure, reputation, compromise).
- It is where other branches return as consequences: selling drugs means you need street-level protection; manufacturing means you need street-level distribution; grifts mean street-level fences; laundering means street-level fronts; corruption means street-level favors.

Think of other branches as **organs**. The Streets is the **circulatory system**.

Late-game Streets unlocks should feel like:
- you stop doing jobs and start **being asked**
- you stop moving through the city and start **owning routes**
- you stop fearing heat and start **budgeting it**
- you stop being a criminal and start being **infrastructure**

---

## 2. The Global Shape (Acts / Phases)
This is a scaffold, not a plot you must follow.

### Phase A: Primordial (Tutorial Origin)
- A kid learns that rules are not walls; they're costs.
- The first tool is a torch. The first framework is a cop's book.
- The first emotional "resource" is not courage. It's *control*.

### Phase B: Street-Level Apprenticeship (Early Game)
- The world expands from house-map to block-map.
- The protagonist learns: *people notice patterns*, and being noticed has a price.
- First crew-adjacent relationships: a friend who wants in, a friend who wants out, an adult who pretends they "used to be like you".

### Phase C: Specialization (Mid Game)
- New branches appear as temptations that look like solutions:
  - drugs = money
  - grifts = money without bruises
  - tech = money without faces
  - commerce = money that looks clean
  - corruption = money that looks legal
- The protagonist starts learning that every "clean" method has a dirtier dependency.

### Phase D: Infrastructure (Late Game)
- The protagonist stops "breaking rules" and starts learning **who writes them**.
- The city becomes legible as a set of bottlenecks:
  - transport
  - records
  - enforcement
  - money flow
  - fear
- The core question stops being "can I get away with it?" and becomes "what kind of person can live like this?"

### Phase E: The Endgame (No Final Moral, Just Final Leverage)
Offer endings as *stances*, not "good/bad":
- **The Ghost**: disappear, leave myths and loose ends.
- **The Manager**: run the machine, keep it boring, keep it profitable.
- **The Martyr (cheap version)**: burn something down and call it redemption.
- **The Legitimizer**: build fronts, become respectable, keep doing it anyway.
- **The Witness**: tell the truth in a way that still makes you complicit.

---

## 3. Global Threads (Pick 2-3 To Keep The Story Coherent)
These are recurring "main plot" ropes that can surface in any branch.

### Thread 1: The Cop Book (The Manual)
The stolen book becomes:
- a memory object (origin)
- a method object (craft)
- a moral object (hypocrisy)

Optional escalation ideas:
- The margins contain your dad's notes. His handwriting becomes a character.
- The book is tied to a case (a name that keeps returning).
- Later you obtain the "next book" (procedures, informants, surveillance), and you realize: the state runs a branch too.

### Thread 2: The City Remembers (The Ledger)
The city keeps receipts:
- shop owners
- security guards
- cameras
- gossip
- cops
- street kids who "didn't see anything" but saw everything

Your real enemy isn't police. It's memory.

### Thread 3: Your Father (The Mirror)
Pick the version that makes the most drama:
- **Honest cop**: he hates what you become, and it hurts because he's right.
- **Dirty cop**: he hates what you become, and it hurts because he's a hypocrite.
- **Burnt-out cop**: he sees you clearly and says nothing, which is worse.
- **Absent cop**: you fill the silence with methods and call it adulthood.

### Thread 4: Heat As A Weather System
Heat isn't a number. It's:
- neighbors closing curtains
- names being said too casually
- a door that used to open now needing a favor
- a cop who doesn't recognize you, but recognizes your *type*

### Thread 5: The Friend Who Becomes A Line
You need someone who grows into:
- a liability you love
- a rival you created
- an informant by accident
- the one person who saw you before you were "useful"

---

## 4. Cast Templates (Drop-In Characters)
Keep these as "roles"; names and details stay soft until needed.

- **Dad (cop)**: rules made flesh; can be mirror/antagonist/ghost.
- **Mum (civilian)**: normality as pressure; sees more than she says.
- **First Friend**: the one you teach; later they either surpass you or break.
- **Fence**: buys your loot, sells your future; speaks in prices, not morals.
- **Fixer/Mentor**: gives you a ladder with missing rungs.
- **Rival**: same hunger, different ethics (or none).
- **Cop You Keep Meeting**: not a mastermind; just persistent, tired, observant.
- **The Quiet Professional**: makes crime look like an office job; terrifying.

---

## 5. Branch Strategy: Split By Supply Chain (Yes, Great Idea)
Instead of one "Drugs" branch, split it into separate branches that feel different:
- **Production** (making the thing)
- **Distribution** (moving the thing)
- **Retail** (selling the thing)
- **Cleanup** (laundering, disposal, silencing)

This keeps each branch's story clean:
- Production is paranoia, chemicals, secrecy, "don't bring cops to the door."
- Retail is people, territory, violence-by-accident, "don't bring addicts to the door."
- Distribution is logistics, vehicles, routines, "don't bring strangers to the door."
- Cleanup is paperwork, fronts, respectability, "don't bring truth to the door."

Repeat this pattern anywhere it fits (counterfeits, weapons, stolen goods, info).

---

## 6. Branch Catalogue (Too Many On Purpose)
These are candidates. You can cut 70% later.

For each branch below:
- *Hook* = why it becomes possible/tempting
- *Signature cost* = the unique damage it does
- *Feeds Streets* = how it loops back into the main branch

### A) Streets (Main)
- `street_petty`: shoplifting, small thefts, first heat, first friends.
  - Hook: quick wins and private pride.
  - Signature cost: becoming known.
  - Feeds Streets: it *is* the Streets.
- `street_territory`: corners, routes, "who belongs where".
  - Hook: protection feels like love at first.
  - Signature cost: paranoia as identity.
  - Feeds Streets: unlocks late-game influence and crew slots.
- `street_crew`: recruitment, loyalty, betrayals, "teamwork" as risk.
  - Hook: work scales when you stop being alone.
  - Signature cost: other people become your heat.
  - Feeds Streets: enables parallel runs, specialists, wider access.

### B) Drugs (Split)
- `drugs_retail` (selling)
  - Hook: money with a constant customer base.
  - Signature cost: your empathy erodes, one bargain at a time.
  - Feeds Streets: territory conflicts, protection needs, street cred.
- `drugs_manufacturing` (making)
  - Hook: higher margins, fewer faces.
  - Signature cost: catastrophic risk from small mistakes.
  - Feeds Streets: creates product, demands distribution.
- `drugs_diversion` (stealing / re-routing legitimate supply)
  - Hook: "victimless" if you squint; it comes in labeled bottles.
  - Signature cost: paperwork becomes a crime scene.
  - Feeds Streets: opens corruption/commerce/laundering paths.

### C) Grift (Split)
- `grift_hustles` (small-time cons)
  - Hook: you can steal without touching anyone.
  - Signature cost: you start seeing strangers as wallets with legs.
  - Feeds Streets: funds gear, builds contacts, low heat with spikes.
- `grift_identity` (identity fraud)
  - Hook: one person becomes many people.
  - Signature cost: you forget which name you meant.
  - Feeds Streets: unlocks access to commerce, rentals, credit lines.
- `grift_blackmail` (leverage economy)
  - Hook: secrets are lighter to carry than goods.
  - Signature cost: everyone becomes disposable.
  - Feeds Streets: opens corruption, intel brokerage, "protection".

### D) Commerce (Split)
- `commerce_fencing` (selling stolen goods)
  - Hook: turning loot into cash feels like alchemy.
  - Signature cost: you start talking in percentages.
  - Feeds Streets: makes theft profitable; ties into logistics.
- `commerce_fronts` (legit businesses as cover)
  - Hook: respectability is armor.
  - Signature cost: you become the thing you used to mock.
  - Feeds Streets: reduces heat, enables laundering.
- `commerce_laundering` (money cleanup)
  - Hook: the real score is keeping it.
  - Signature cost: boredom; spreadsheets as handcuffs.
  - Feeds Streets: allows scaling without drowning in heat.

### E) Corruption (Split)
- `corruption_police`
  - Hook: the line between cop and criminal is a door, not a wall.
  - Signature cost: paranoia becomes rational.
  - Feeds Streets: heat control, jail mitigation, intel.
- `corruption_civic` (permits, inspectors, bureaucracy)
  - Hook: the city runs on stamps and favors.
  - Signature cost: you start believing you're entitled.
  - Feeds Streets: enables fronts, bigger jobs, less friction.

### F) Tech (Split)
- `tech_intrusion` (digital breaking-and-entering)
  - Hook: you can take without being seen.
  - Signature cost: you never feel finished; security is infinite.
  - Feeds Streets: intel, access, identity tools, laundering options.
- `tech_surveillance` (watching)
  - Hook: information removes fear.
  - Signature cost: you stop being surprised, then stop being human.
  - Feeds Streets: lowers risk, reveals opportunities, counters rivals.

### G) Logistics / Movement
- `logistics_smuggling`
  - Hook: borders are just policies with holes.
  - Signature cost: routines become liabilities.
  - Feeds Streets: supplies drugs, weapons, contraband.
- `logistics_vehicles` (boosting, chop shop, plates)
  - Hook: mobility is power.
  - Signature cost: every drive feels watched.
  - Feeds Streets: getaway capacity, distribution, heat management.
- `logistics_couriers` (runner networks)
  - Hook: other people carry the risk for you.
  - Signature cost: you become a boss without noticing.
  - Feeds Streets: parallel runs, scalable delivery.

### H) Theft Specializations (Optional Splits)
- `theft_burglary` (homes/shops)
  - Hook: quiet theft feels "clean".
  - Signature cost: you learn intimacy by violating it.
  - Feeds Streets: goods to fence; gear to upgrade.
- `theft_robbery` (force / intimidation)
  - Hook: speed beats planning.
  - Signature cost: violence becomes an input.
  - Feeds Streets: high cash, high heat, fast escalation.
- `theft_safecracking` (patience crime)
  - Hook: the lock is a puzzle that hates you back.
  - Signature cost: obsession.
  - Feeds Streets: big scores, prestige, specialist recruitment.

### I) Gambling / Fixing (From todo)
- `gambling_bookmaking` (running bets)
  - Hook: everyone wants to feel smart; you sell them that.
  - Signature cost: debts create enemies on timers.
  - Feeds Streets: steady income, leverage, corruption links.
- `gambling_rigging` (fixed games, insider edges)
  - Hook: "fair" is just a story you can edit.
  - Signature cost: once you cheat once, you must keep cheating.
  - Feeds Streets: intel, blackmail, commerce.

### J) Forgery / Counterfeit
- `forgery_documents` (IDs, permits, records)
  - Hook: paper opens doors.
  - Signature cost: you start living inside lies.
  - Feeds Streets: enables access, laundering, logistics.
- `counterfeit_goods` (fake products)
  - Hook: people buy what they want to believe.
  - Signature cost: guilt by a thousand small harms.
  - Feeds Streets: commerce/fronts; money with a long tail.

### K) Intel Economy
- `intel_brokerage` (information market)
  - Hook: secrets weigh nothing and sell forever.
  - Signature cost: you stop having friends; only sources.
  - Feeds Streets: unlocks opportunities, reduces risk, drives plots.
- `intel_informants` (recruiting snitches)
  - Hook: everyone has a price, even if it's not money.
  - Signature cost: self-disgust.
  - Feeds Streets: heat control, rival disruption.

### L) Enforcement / Pressure
- `pressure_extortion` (protection rackets)
  - Hook: stability can be rented.
  - Signature cost: you become the threat you used to fear.
  - Feeds Streets: territory control, recurring income.
- `pressure_enforcement` (muscle as a service)
  - Hook: violence looks like a shortcut.
  - Signature cost: it stops feeling like a choice.
  - Feeds Streets: solves problems but creates heat and enemies.

### M) Prison / Court (Consequences As Content)
- `prison_economy`
  - Hook: getting locked up becomes networking.
  - Signature cost: your "normal life" erodes.
  - Feeds Streets: mitigates jail, unlocks hardened contacts.
- `court_bail_lawyers`
  - Hook: the system has handles if you can afford them.
  - Signature cost: you start paying for mercy.
  - Feeds Streets: jail reduction, corruption ties, laundering.

### N) Forbidden (If You Want A Slightly Unsettling Late Game)
Keep it grounded; "forbidden" can mean taboo networks, not magic.
- `forbidden_cults` (belief as leverage)
  - Hook: people will do anything for meaning.
  - Signature cost: you start believing your own lies.
  - Feeds Streets: money laundering, intimidation, cover stories.
- `forbidden_black_sites` (private power)
  - Hook: the worst crimes look like administrative decisions.
  - Signature cost: nausea.
  - Feeds Streets: endgame plot hooks, high-stakes leverage.

---

## 7. How Branches Interlock (Simple Rules)
To keep the web feeling real:
- Every "high profit" branch should require something street-level: protection, territory, fences, or crew.
- Every "clean" branch should hide a "dirty" dependency: coercion, paperwork fraud, or corruption.
- Every "low heat" method should have occasional catastrophic spikes (learnable, influenceable).
- Every new branch should create *at least one new kind of problem*, not just new rewards.

---

## 8. Quick Prompts (So You Can Rewrite This To Taste)
Answering any of these will snap the whole meta story into focus:
- Is Dad honest, dirty, burnt-out, or absent?
- Is the city generic (soft canon) or named and mapped (hard canon)?
- Is the protagonist trying to prove something, escape something, or build something?
- Is the main enemy police, rivals, poverty, boredom, or the protagonist themself?
- Do you want the endgame to feel like tragedy, dark comedy, or cold realism?
