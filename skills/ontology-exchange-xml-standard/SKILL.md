---
name: ontology-exchange-xml-standard
description: Author, review, validate, or evolve an FS-native XML exchange standard for ontology import and export, especially depa-ontology.ts/cozo-om ObjectType/Mixin/Property/inheritance representation with embedded members, plus DomainSemantics, operation request presets, evidence, bindings, mappings, and evolution records.
---

# Ontology Exchange XML Standard

Use this skill when the task is about FS-native XML resource layout, Kind/Catalog governance, ontology-domain authoring, review, validation, migration, or projection. XML resource files are canonical authoring and exchange artifacts; runtime rows, generated code, diagrams, UI workbench state, and prose are projections.

For TypeScript/Bun OM behavior, use `/Users/kongweixian/infra-dev/ontology/depa-ontology.ts/packages/depa-ontology` as the source of truth. Older `cozo-lib-bun` paths are historical unless a task explicitly asks for archaeology.

## Progressive Disclosure

Read only the references needed for the current task:

- For resource organization, KindDefinition registries, Catalog routing, identity, refs, containment, diagnostics, or validation pipeline, read `system/foundation/`, then `system/std/`, then the focused file in `system/spec/`.
- For ontology semantics, read `ontology-domain/foundation/`, then `ontology-domain/std/`, then the focused file in `ontology-domain/spec/`.
- Read `ontology-domain/spec/type-and-relation-resource.md` and `ontology-domain/spec/cozo-om-projection.md` first for ObjectType/Mixin/Property/inheritance authoring and depa-ontology.ts `cozo-om` import/export; read the rule and lifecycle specs only when those mechanisms matter.
- Read `ontology-domain/spec/business-object-resource.md` for the BusinessObject manifest and its owned Action, Mutation, Interceptor, ComputedFunction, ConstraintHandler, and Lifecycle resources. Read `ontology-domain/spec/domain-semantics-resource.md` for DomainSemantics resources.
- Read `ontology-domain/spec/operation-catalog-resource.md` for Operation definitions, RuntimeBinding references, InvocationPreset request JSON, selection, batch, complete `ExecuteOperationRequest v1`, and capability responsibilities.
- Read `ontology-domain/spec/evidence-resource.md`, `ontology-domain/spec/runtime-binding-resource.md`, `ontology-domain/spec/implementation-mapping-resource.md`, and `ontology-domain/spec/schema-evolution-resource.md` for projection, runtime, evidence, and governance resources.
- Read `ontology-domain/spec/csharp-om-projection.md` only when C# OM projection behavior matters.
- Use `system/examples/` only as compact FS-native system examples. Use `ontology-domain/examples/` only as domain examples and rejection fixtures. Examples are illustrative, not authority.
- Keep bundled examples domain-neutral. Use MakerSpace or another fresh neutral domain; do not reuse prior thread-specific business examples in skill documentation or fixtures.
- Run `scripts/validate-ontology-xml.ts`, `scripts/validate-ontology-xml-security-test.ts`, and `tests/validate-ontology-xml.test.ts` for mechanical validation; `package.json` exposes matching scripts.

## Hard Rules

- `Ontology` is a manifest Kind. Its direct children may use any FS-native Catalog shape allowed by the referenced KindDefinition; TypeSystem and DomainModel object resources are manifest-shaped resources, while catalog/governance aggregates remain file-shaped.
- `<Resources>`, `<Modules>`, and `href` are rejection-only legacy markers. Do not add compatibility entry points for them.
- TypeSystem and DomainModel resources own structural facts: `ScalarType`, `EnumType`, `Mixin`, `ObjectType`, `UnionType`, `CollectionType`, `BusinessObject`, `Relation`, `Rule`, and `StateMachine`.
- Treat ObjectType/Mixin XML as a language, not a graph of tiny resources: Property and ComputedProperty are embedded local members without authored global IDs; use `OwnerFqn#localName` only when another resource must address a member.
- Preserve `cozo-om` inheritance behavior: Mixin contributions are lower precedence than ancestors and the current ObjectType or BusinessObject; an override may tighten requiredness but may not change value type or loosen a required property.
- Preserve Mixin author order in XML for readable and deterministic generation, but do not use order to resolve incompatible Mixin Property collisions: current `cozo-om` stores membership without an ordinal.
- A `BusinessObject` is a DomainModel object-type manifest that directly declares identity, properties, computed properties, inheritance/Mixin application, and BO-local Action, Mutation, Interceptor, ComputedFunction, ConstraintHandler, and Lifecycle membership. Do not create a shadow structural ObjectType just to hold BO properties.
- DomainSemantics resources add semantic roles by reference. They must not redeclare relation endpoints, rule predicates, lifecycle state machines, or code bodies.
- `OperationCatalog` defines callable semantics with five orthogonal dimensions: `owner`, `behavior`, `subject`, `invocation`, and `effect`.
- `selection` is a logical subject chosen by a selector. `batch` is multiple keyed invocations in one request; the dimensions are independent.
- Operation definition capabilities, binding actual capabilities, and request execution choices are three separate layers. Definition declares requestable atomicity and observation sets; a request chooses one supported execution mode.
- InvocationPreset request JSON is one complete `ExecuteOperationRequest v1` preview that is posted unchanged. Reject the former simplified envelope.
- Cozo OM import/export is bidirectional only through explicit projection policies. Import XML into depa-ontology.ts with declared API/manifest mappings; export from OM snapshots/manifests into XML without inventing non-OM facts such as BusinessObject, Operation, Evidence, policy, or lifecycle declarations.
- Evidence, runtime bindings, implementation mappings, and evolution records are independent resources.
- XML is declarative. Do not embed executable JavaScript, TypeScript, C#, SQL, CozoScript, callbacks, module paths, or arbitrary host instructions.
