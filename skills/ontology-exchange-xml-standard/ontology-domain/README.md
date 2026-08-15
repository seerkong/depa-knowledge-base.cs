# Ontology domain

`ontology-domain` is the ontology Kind package built on the generic FS-native `system`.
The system owns source shapes, catalogs, KindDefinition loading, containment, registry construction, and generic diagnostics. This package first defines a human-readable and machine import/export XML language for the depa-ontology.ts `cozo-om` Class/Mixin/Field/inheritance model, then layers BusinessObject class manifests, DomainSemantics, operations, evidence, runtime bindings, implementation mappings, and evolution over that type language.

The TypeScript/Bun source of truth for native OM capabilities is `/Users/kongweixian/infra-dev/ontology/depa-ontology.ts/packages/depa-ontology`. XML is the canonical authoring and exchange representation over that runtime surface, not a mirror of the older split-out repository path.

The type language is the primary modeling authority. BusinessObject reuses that language directly for domain classes; DomainSemantics resources reference declared facts and must not turn embedded Field members into independent resources.

## Layers

| Layer | Role |
| --- | --- |
| `foundation/` | Ontology-domain invariants that every spec must preserve. |
| `std/` | Authoring standards for ontology resource trees, identities, references, and execution contracts. |
| `spec/` | Resource grammars and machine-readable KindDefinitions. |
| `examples/` | Non-authoritative samples used for learning and tests. |

Examples are never authority. A conflict between an example and `foundation`, `std`, `spec`, or a KindDefinition is resolved in favor of the specification.
