# Rebranding: Intent Engineering → Narrative Intelligence

**Date**: April 11, 2026
**Status**: In Progress

---

## Terminology Changes

| Old Term | New Term |
|----------|----------|
| Intent Engineering | Narrative Intelligence |
| Intent Unit | Narrative Unit |
| Intent Graph | Narrative Graph |
| Intent Client | Narrative Client |
| Intent Validator | Narrative Validator |
| organizational intent | organizational narrative |
| queryIntent() | queryNarrative() |
| intentChain | narrativeChain |
| intent.db | narrative.db |

---

## Why "Narrative Intelligence"?

**Better Positioning:**
- ✅ "Narrative" is more approachable than "Intent"
- ✅ "Intelligence" suggests smart/adaptive system
- ✅ More memorable brand name
- ✅ Clearer value proposition

**"Narrative" Resonates:**
- Organizations tell stories about themselves
- Narrative = the story an organization tells
- More human, less abstract than "intent"

---

## Files to Update

### High Priority (User-Facing)
- [x] `static/demo.html` - Interactive demo
- [ ] `README.md` - Main documentation (in progress)
- [ ] `QUICKSTART.md` - Tutorial
- [ ] `CLI_GUIDE.md` - CLI documentation
- [ ] `DOGFOODING.md` - Case study
- [ ] `VALIDATION_INTEGRATION.md` - Technical proof

### Medium Priority (Examples)
- [ ] `examples/healthcare-saas-intent-units.json` → `narrative-units.json`
- [ ] `examples/narrative-agentv2-intent-units.json` → `narrative-units.json`

### Low Priority (Internal)
- [ ] Package names (can stay as @narrative/*)
- [ ] TypeScript interfaces (IntentUnit → NarrativeUnit)
- [ ] Database schema (intent_units → narrative_units)
- [ ] Function names across codebase

---

## Migration Strategy

### Phase 1: User-Facing (Today)
Update all documentation, demos, and marketing materials to use "Narrative Intelligence"

### Phase 2: API Surface (Next)
Update SDK method names:
- `queryIntent()` → `queryNarrative()`
- `IntentClient` → `NarrativeClient`
- `IntentUnit` → `NarrativeUnit`

### Phase 3: Internal (Later)
Update database schema, internal variables, file names

---

## Backward Compatibility

**Option 1: Aliases**
```typescript
// Keep old names as aliases
export const IntentClient = NarrativeClient;
export type IntentUnit = NarrativeUnit;
```

**Option 2: Clean Break**
```typescript
// Deprecate old names, force migration
@deprecated("Use NarrativeClient instead")
export class IntentClient { }
```

**Recommendation**: Clean break - this is alpha, no users yet

---

## Marketing Impact

**Old tagline:**
> "Intent Engineering - Making organizational intent machine-readable"

**New tagline:**
> "Narrative Intelligence - Making organizational narrative machine-readable"

**Better because:**
- Shorter (17 chars vs 19 chars)
- More memorable
- "Intelligence" implies sophistication
- "Narrative" is more relatable than "Intent"

---

## Status

✅ Demo HTML updated
🔄 README.md updating
⏳ Other docs pending

**Next**: Complete README, update QUICKSTART, then batch-update all other docs.
