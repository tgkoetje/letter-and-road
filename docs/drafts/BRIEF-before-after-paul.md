# Brief: Before Paul + After Acts drop-in drafts

**Constraint (user, 2026-10-01 voice):** NOT a site revamp. No new sections, no redesign, no deploy. Site already has early-Paul and late-Paul invite entries that say essays are “still parked.” Goal: **content only** for those two existing slots, ready to drop in when approved.

## Existing slots (live IA)

| Slot | Invite card (InviteOverlay) | Current behavior | Parked promise |
|------|----------------------------|------------------|----------------|
| Early / Before Paul | “Jump to Damascus (Acts 7–9)” | `enterBeforePaul` → atlas + life timeline year ~34, city `damascus_road` | “full Before Paul essay still parked” |
| Late / After Acts | “Jump to Rome, end of Acts” | `enterAfterPaul` → atlas + life timeline year ~62, city `rome` | “full After Acts essay still parked” |

Concept outlines (reference, already parked):
- `docs/before-paul-concept.md`
- `docs/after-paul-concept.md`

## Deliverables (draft files only)

Write two markdown drafts under `docs/drafts/`:

1. `before-paul-essay.draft.md` — drop-in essay for the Before Paul slot  
2. `after-acts-essay.draft.md` — drop-in essay for the After Acts slot  

Each draft should include:
- Short title + 1–2 sentence card blurb (to replace the “still parked” subtitle when wired)
- Expandable-section ready body matching the concept outline
- Scripture citations (Acts primary spine; letters for Paul’s own voice)
- Clear Scripture vs tradition labels where needed
- Suggested deep-links to existing timeline event ids / cities already in content (e.g. `gamaliel-pharisee`, `stephen-persecution`, `damascus-road`, `release-spain-plan`, `final-imprisonment-2timothy`, `martyrdom-nero`, cities `damascus_road`, `rome`)

## Research / voice lens

- Traditional scholarship + what can be seen from **Acts** as primary
- Church **evangelical Protestant** tradition as the house framing
- Scripture authoritative; do not invent bio/dating; Consensus vs Wider only where the site already does
- Tone: honest, not hagiography; no cartoon villain / saint-in-waiting for Saul; no Nero beheading as “what the Bible says”

## Out of scope

- Voices on Paul / landing page / map redesign / new routes or pages
- Editing `src/**`, production `content/**`, or deploying

## Done when

Both draft files exist, self-contained, and a short note at the top of each says “READY FOR DROP-IN — awaiting approval; site not modified.”
