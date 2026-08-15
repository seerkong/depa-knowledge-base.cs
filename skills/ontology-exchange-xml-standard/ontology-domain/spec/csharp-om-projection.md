# C# OM projection

Project validated latest XML to C# facade calls. The generated file is executable output, not ontology source.

## Direct mappings

| XML source | C# OM facade or projection target |
| --- | --- |
| `Class` | `DefineClassAsync` |
| `Mixin` | `DefineMixinAsync` |
| `Mixin ref` on Mixin or Class | dependency-ordered mixin composition |
| Class/Mixin `Field` | `DefineFieldAsync` against the owning Class or Mixin |
| `RelationDef` | `DefineRelationDefAsync` |
| RelationDef edge `Field` | normalized projection metadata unless the target adds relation-def-field schema support |
| `ComputedProp` | computed contract metadata plus a referenced accepted `RuntimeBinding` |
| `Rule kind=conditional|cross-entity|computed-dependency|custom` | `DefineConstraintAsync` plus optional accepted runtime binding |
| `ExistsRelated` existential shape | `DefineExistentialRuleAsync` |
| `StateMachine`, `State`, `Transition`, `Derivation` | lifecycle projection metadata or target lifecycle facade when available |
| DomainSemantics resources | catalog/read-model metadata; no duplicate type or relation-def definitions |
| `Operation` | operation catalog entry with five dimensions, request schema, and requestable atomicity/observation sets |
| `InvocationPreset` | complete `ExecuteOperationRequest v1` preview/POST object, not execution state |
| `RuntimeBinding` | handler registry metadata plus runtime-supported atomicity/observation subsets and generic runtime capabilities |
| `EvidenceCatalog`, `ImplementationMappingCatalog` | projection registry metadata |
| `Alias` | supported type/field/relation-def alias facade calls or projection metadata |
| `Migration` supported operation subset | `SchemaMigrationSpec` plus explicit migration application |
| `GenerationSnapshot` | projection provenance metadata, not runtime schema version |

## Projection rules

- Generate in dependency order after FS-native catalog discovery: schema init, mixins, classes, fields, relation-defs, rules, lifecycles, DomainSemantics resources, operations, aliases, supported migrations, runtime registrations.
- Preserve XML IDs in generated metadata so runtime diagnostics map back to source resources.
- Do not generate enforcing callbacks for hypotheses.
- Reject unsupported predicates, lifecycle effects, operation dimensions, invocation modes, requestable capability sets, or runtime-supported capability sets instead of silently dropping them.
- Preserve structured `Atomicity` and `Observation` sets as sets. Do not project `Operation@atomicity`, `RuntimeBinding@atomicity`, a default atomicity, or a preferred source order.
- Parse every `InvocationPreset/RequestJson` as a complete `ExecuteOperationRequest v1`; generated workbench metadata must expose that same object for preview and unchanged POST.
- Validate request `operation` fields against the XML Operation, context against the assembled Ontology, and execution choices against definition and binding capability sets before projecting an executable preset.
- Cardinality, uniqueness, state-machine behavior, computed fields, custom rules, extension-point operations, and raw operations require explicit compiler/runtime support or accepted `RuntimeBinding` declarations.
- Keep implementation code outside generated schema files. Generated code may register named externally owned handlers from `RuntimeBindingCatalog`.
- After loading, compare the runtime schema snapshot against the normalized XML IR to detect projection drift.

## Version and provenance mapping

`Ontology@version` is a semantic string token. Cozo OM schema migration and snapshot APIs may use numeric runtime versions. A projection must receive or persist an explicit deterministic semantic-version-to-runtime-version mapping; it must not parse timestamps, commits, `GenerationSnapshot@id`, source revisions, or output digests into a runtime version.

`GenerationSnapshot` is not projected through runtime schema snapshot APIs as ontology meaning. It records generation provenance, while the OM snapshot records materialized runtime schema state. Store their correlation-def as projection metadata when needed.
