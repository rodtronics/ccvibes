# Crime Committer VI — Design Philosophy

Purpose: single source for mechanics philosophy and intent. Pair with `02_ui_spec.md` for presentation and `03_schema_engine.md` for data/logic.

## 1. Core Philosophy
- Progress is discovered, not explained; systems exist before the player fully understands them.
- Risk is optional but tempting; punishment is time loss, not deletion.
- The player is never hard-blocked; information is revealed gradually and often incompletely.
- The game should feel alive, slightly opaque, and interconnected, not linear or tutorialised.

## 2. Core Loop
- Pick an activity (crime, research, build, or other operation).
- Choose an execution option and assign an available worker.
- Each assignment creates an independent time-based run that continues offline.
- Rewards may include cash, heat, items, flags, or revelations; abandoning forfeits rewards.
- Multiple workers create parallel runs; they do not speed up a single run.

## 3. Fundamental Units
- **Activity**: UI container and conceptual grouping; has name/description, branch, visibility states; holds Options; never directly consumes resources, assigns staff, or resolves outcomes.
- **Option**: Specific way to perform an Activity; defines requirements/inputs/duration/XP/rewards/side effects/modifiers/cooldowns. Multiple Options can reach the same result with different efficiency, risk, speed, or reliability.

## 4. Staff, XP, and Stars
- Staff are assigned to Options, not Activities.
- XP comes from time spent or completed runs; stars are derived from XP thresholds.
- Stars improve reliability, efficiency, and access to safer/faster Options; stars do not directly unlock content.
- Skill bends probability; it never guarantees success.

## 5. Outcomes and Randomness
- Prefer weighted outcome tables over binary success/failure.
- Partial success, bad trades, lucky outcomes, and consequences are preferred; randomness must be learnable and influenceable.
- Modifiers include staff stars, tools/preparation, and current heat; risk is always telegraphed, even if imprecisely.

## 6. Heat System
- Heat is background pressure, not a hard limit.
- It rises with risky or noisy actions and decays naturally over time.
- Higher heat increases the chance and severity of negative outcomes; low heat enables safer execution.
- Heat never blocks an action outright.

## 7. Jail and Consequences
- Staff may become temporarily unavailable (time cost, not permanent loss).
- Duration scales with heat and severity; progress continues while staff are unavailable.
- Later systems may mitigate consequences (bail, corruption, upgrades).

## 8. Resources and Transformations
- Resources exist to enable recipes, not hoarding.
- Types: currencies (cash, heat, notoriety, cred), consumables (tools, supplies), loot, processed goods, abstract/meta (intel, contacts, flags).
- Many Activities are resource transformations; multiple recipes can yield the same output.

## 9. Discovery and Progression
- Branches or systems may be hidden at game start; revelation is distinct from unlocking capability.
- Progression relies on flags, reveals, and cross-branch effects; avoid explicit dependency chains in favor of discovery.

## 10. Tech Web and Research
- Reveals capabilities, methods, or opportunities; may expose new Activities, Options, roles, or resources.
- Should not function as a transparent linear tech tree; supports discovery, not full explanation.

## 11. Cred and Heat Philosophy
- **Cred (0–100)**: Reputation gate for crew recruitment and activity access; gains scale with risk, losses scale with current cred; recoverable through low-risk reputation jobs.
- **Heat (0+)**: Always rises from crimes and decays naturally; increases failure/discovery rates; never blocks actions directly; punishment is indirect risk.

## 12. RPG Crew Composition Philosophy
- **Brute force (early)**: Minimal required crew, fast, high heat, negative or minimal cred, unsustainable.
- **Strategic planning (mid/late)**: Optional specialists, slower, safer, positive cred, sustainable.
- Trade-offs: Opportunity cost of crew versus improved outcomes; players discover optimal compositions through experimentation.

## 13. Design Constraints (Do Not Break)
- No irreversible punishment or permanent dead ends.
- No mandatory waiting without player choice; no single linear progression path.
- No full system map or completion percentage.
- When in doubt, preserve curiosity over clarity.

## 14. Authoring Guidelines
- Respect the Activity + Option + Run structure; no custom per-activity code.
- Use conditions and effects, not bespoke logic; prefer adding Options over creating new Activities.
- Prefer flags and reveals over explicit unlocks; all content must be data-driven and expressible in the schema.
- Tone: dry, understated, cynical, never congratulatory.

## 15. Technical Architecture Principles
- **Event-driven design**: Engine emits events; UI subscribes and responds. No direct coupling between Engine and UI layers.
- **Unified repeat architecture**: All runs use a single `runsLeft` field (0 = single, N = countdown, -1 = infinite) rather than separate queue structures.
- **Smooth updates**: 50ms tick interval (20 updates/sec) for fluid countdown timers and progress bars.
- **Efficient rendering**: Partial UI updates on tick events; full renders only on state changes.
- **Backward compatibility**: State migration handles legacy save formats gracefully.
