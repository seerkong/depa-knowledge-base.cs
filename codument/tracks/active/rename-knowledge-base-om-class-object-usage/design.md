# Design: knowledge-base OM rename migration

## Boundary

This track is a dependent-project convergence step. The ontology-core package has already moved to a no-compatibility contract, so knowledge-base must migrate as a consumer rather than bridge old and new APIs.

## Rename policy

Apply the mission-approved mapping only when a term refers to ontology OM:

| Legacy OM term | New term |
|---|---|
| Type | Class |
| Entity | Object |
| Attribute | Field |
| Property | FieldValue when persisted on an Object |
| Computed / ComputedDef | ComputedProp |
| Edge | RelationLink when it is an explicit OM link |
| RelDef | RelationDef |
| Action | Operation |
| PermAction | PermOperation |

Unrelated domain terms are preserved. For example, code-knowledge graph edges, programming-language types, JSON properties, and C# properties are not automatically renamed unless they are part of the ontology object model contract.

## Implementation order

1. Make the test contract express the new ontology API and storage vocabulary.
2. Update production source to compile against ontology-core.
3. Update skills, prompts, validators, examples, and current docs so generated guidance matches the new model.
4. Run builds/tests and scan source/tests/docs/skills for accidental active legacy OM vocabulary.

## Verification

The final scan must cover:

- `src/`
- `tests/`
- `skills/`
- `codument/behaviors`
- current non-archived `codument/modeling` and track files

Allowed findings must be classified explicitly as unrelated domain language, historical deny-list strings, or archived/historical material.
