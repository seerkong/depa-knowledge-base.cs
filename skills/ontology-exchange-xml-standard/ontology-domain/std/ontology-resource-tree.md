# Ontology resource tree standard

An ontology tree is an FS-native manifest resource. The root exact PascalCase `Manifest.xml` owns ontology identity, version, description, and direct resource catalogs. Ontology declarations live in self-describing resources discovered by those catalogs.

## Canonical shape

```text
MakerSpace/
  Manifest.xml
  TypeSystem/
    ScalarTypes/*/ScalarType.xml
    EnumTypes/*/EnumType.xml
    Mixins/*/Mixin.xml
    Classes/*/Class.xml
    TypeExpressions/
      UnionTypes/*/UnionType.xml
      CollectionTypes/*/CollectionType.xml
  DomainModel/
    BusinessObjects/
      */BusinessObject.xml
      */Operations/*/Operation.xml
      */Mutations/*/Mutation.xml
      */Interceptors/*/Interceptor.xml
      */ComputedFunctions/*/ComputedFunction.xml
      */ConstraintHandlers/*/ConstraintHandler.xml
      */Lifecycles/*/Lifecycle.xml
    RelationDefs/*/RelationDef.xml
    Rules/*/Rule.xml
    StateMachines/*/StateMachine.xml
  DomainSemantics/
    Associations/*.xml
    Policies/*.xml
    ConstraintHandlers/*.xml
    Processes/*.xml
    Capabilities/*.xml
    Events/*.xml
  Operations/*.xml
  Evidence/*.xml
  Bindings/*.xml
  Mappings/*.xml
  Evolution/*.xml
```

Directory names are conventional, not identity. Catalog `kind` and each member descriptor decide resource kind and identity. Each ontology-domain resource root provides FS-native identity through `fqn`; `id` is the independent semantic identity carried by the resource.

Composite concepts are represented by manifest resource nodes. A BusinessObject, Class, Mixin, RelationDef, Rule, or StateMachine may own a local subtree and declare child catalogs relative to its own manifest boundary. The filesystem hierarchy is the explicit containment fact; global `id`/`fqn` remains identity and must not be used as the only signal for nested ownership.

Examples in this skill must use neutral domains such as MakerSpace. Do not reuse prior thread-specific business examples in skill documentation or fixtures.

## Root manifest

The root must be an `Ontology` manifest Kind:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Ontology fqn="ontology.maker-space" id="MakerSpace.Ontology" version="1.0.0">
  <Description>Maker space workshop scheduling ontology.</Description>
  <ManifestResourceCatalog id="scalar-types" kind="ScalarType" root="vfs://@/TypeSystem/ScalarTypes/" entry="ScalarType.xml" />
  <ManifestResourceCatalog id="enum-types" kind="EnumType" root="vfs://@/TypeSystem/EnumTypes/" entry="EnumType.xml" />
  <ManifestResourceCatalog id="mixins" kind="Mixin" root="vfs://@/TypeSystem/Mixins/" entry="Mixin.xml" />
  <ManifestResourceCatalog id="classes" kind="Class" root="vfs://@/TypeSystem/Classes/" entry="Class.xml" />
  <ManifestResourceCatalog id="union-types" kind="UnionType" root="vfs://@/TypeSystem/TypeExpressions/UnionTypes/" entry="UnionType.xml" />
  <ManifestResourceCatalog id="collection-types" kind="CollectionType" root="vfs://@/TypeSystem/TypeExpressions/CollectionTypes/" entry="CollectionType.xml" />
  <ManifestResourceCatalog id="business-objects" kind="BusinessObject" root="vfs://@/DomainModel/BusinessObjects/" entry="BusinessObject.xml" />
  <ManifestResourceCatalog id="relation-defs" kind="RelationDef" root="vfs://@/DomainModel/RelationDefs/" entry="RelationDef.xml" />
  <ManifestResourceCatalog id="rules" kind="Rule" root="vfs://@/DomainModel/Rules/" entry="Rule.xml" />
  <ManifestResourceCatalog id="state-machines" kind="StateMachine" root="vfs://@/DomainModel/StateMachines/" entry="StateMachine.xml" />
  <FileResourceCatalog id="associations" kind="AssociationCatalog" root="vfs://@/DomainSemantics/Associations/" />
  <FileResourceCatalog id="policies" kind="DomainPolicyCatalog" root="vfs://@/DomainSemantics/Policies/" />
  <FileResourceCatalog id="constraint-handlers" kind="ConstraintHandlerCatalog" root="vfs://@/DomainSemantics/ConstraintHandlers/" />
  <FileResourceCatalog id="processes" kind="BusinessProcessCatalog" root="vfs://@/DomainSemantics/Processes/" />
  <FileResourceCatalog id="capabilities" kind="CapabilityCatalog" root="vfs://@/DomainSemantics/Capabilities/" />
  <FileResourceCatalog id="events" kind="EventContractCatalog" root="vfs://@/DomainSemantics/Events/" />
  <FileResourceCatalog id="operations" kind="OperationCatalog" root="vfs://@/Operations/" />
  <FileResourceCatalog id="evidence" kind="EvidenceCatalog" root="vfs://@/Evidence/" />
  <FileResourceCatalog id="bindings" kind="RuntimeBindingCatalog" root="vfs://@/Bindings/" />
  <FileResourceCatalog id="mappings" kind="ImplementationMappingCatalog" root="vfs://@/Mappings/" />
  <FileResourceCatalog id="evolution" kind="SchemaEvolutionModule" root="vfs://@/Evolution/" />
</Ontology>
```

Catalog discovery is first-level and shape-aware. File catalogs scan direct XML files. Manifest catalogs scan direct child directories and load only the declared entry. A discovered manifest may then declare its own catalogs relative to that manifest boundary. Files deeper than a declared catalog's first level are invisible.

## Authority layers

| Layer | Resource kinds | Owns | Must not own |
| --- | --- | --- | --- |
| L0 TypeSystem | manifest `ScalarType`, `EnumType`, `Mixin`, `Class`, `UnionType`, `CollectionType` | scalar aliases, enum types, neutral object/value kinds, unions, collections, mixins, embedded fields, computed field declarations | BO purpose, relation-def endpoints, predicates, lifecycle states, handlers |
| L1 DomainModel mechanisms | manifest `BusinessObject`, `RelationDef`, `Rule`, `StateMachine`, and BO-owned `Operation`, `Mutation`, `Interceptor`, `ComputedFunction`, `ConstraintHandler`, `Lifecycle` | BO class identity/fields, local behavior membership, relation-def endpoints/cardinality/edge fields, typed predicates/violations, states/transitions/derivations/effects | policy grouping, capability grouping, host code |
| L2 DomainSemantics | file catalogs for associations, policies, constraint handlers, processes, capabilities, and events | semantic roles, participants, grouping, purpose, evidence, references to declared facts | relation-def endpoints, rule predicate bodies, lifecycle state machines, executable callbacks |
| L3 operation definitions | `OperationCatalog` | operation identity, five dimensions, schemas, requestable capability sets, composition refs, complete `ExecuteOperationRequest v1` presets | lower structural facts, runtime implementation bodies, execution state or default execution choices |
| L4 projection/governance | `EvidenceCatalog`, `RuntimeBindingCatalog`, `ImplementationMappingCatalog`, `SchemaEvolutionModule` | source material, runtime-supported capability sets, binding contracts, implementation crosswalks, aliases, migrations, generation provenance | executable code, duplicate current declarations, runtime data |

The validator may sort discovered resources by this dependency order before semantic passes. Filesystem order is not authority.

## Ownership rules

- `Manifest.xml` owns only ontology resource identity, ontology semantic identity, semantic version, description, and catalog declarations.
- A TypeSystem or DomainModel resource owns the reusable structure it declares even when a DomainSemantics resource is the common human entry point.
- A BusinessObject owns a local class manifest: identity, fields, computed fields, optional parent/Mixins, and BO-local Operation, Mutation, Interceptor, ComputedFunction, ConstraintHandler, and Lifecycle concepts.
- A BusinessObject subtree does not need or imply a shadow structural Class with the same fields.
- DomainSemantics resources reference declared facts through explicit `typeRef`, `fieldRef`, `relationDefRef`, `ruleRef`, and `stateMachineRef` fields.
- `DomainPolicy@ownerKind`, `ConstraintHandler@ownerKind`, and `Operation@owner` share the owner target-kind table in [naming-and-references.md](naming-and-references.md).
- `OperationCatalog` references semantic owner identities and lower types. It is the authority for callable operation membership and does not make referenced facts its own.
- An Operation's requestable capability set, a binding's runtime-supported subset, and a preset's execution choice are separate facts.
- `InvocationPreset/RequestJson` owns one complete preview and POST object. A workbench must not maintain or synthesize a second request envelope.
- Evidence, bindings, mappings, and evolution records are independent. They may reference semantic declarations but must not restate declarations as alternate truth.

## Source and projection

Use this one-way flow:

```text
FS-native ontology XML -> Resource Registry -> normalized ontology IR
                                           -> validators and catalogs
                                           -> generated code / OM calls / HTTP schema
                                           -> runtime rows and workbench views
```

Runtime snapshots may be compared against XML to detect drift. They are not editable ontology source.

## Rejection rules

Validators must reject:

- any `Ontology` child named `Resources`;
- any `Ontology` child named `Modules`;
- legacy per-resource assembly entries using `href`;
- old grouped root assembly such as `BusinessObjects` under root assembly wrappers;
- duplicate semantic IDs or evidence IDs;
- any non-BO DomainSemantics resource that declares TypeSystem or DomainModel structural facts inline, and any BusinessObject field written as `Field@ref`;
- any semantic owner ref that substitutes an `Class`, `RelationDef`, or `Rule` for a matching `BusinessObject`, `Association`, or `ConstraintHandler` owner resource identity;
- `Operation@atomicity`, `RuntimeBinding@atomicity`, a default atomicity, or unstructured generic capabilities that impersonate standard atomicity or observation sets;
- an invocation preset using a simplified request envelope instead of a complete `ExecuteOperationRequest v1`;
- any TypeSystem or DomainModel structural resource that references `Association`, `DomainPolicy`, `ConstraintHandler`, `BusinessProcess`, `Capability`, `EventContract`, or `Operation` in order to define its own structure;
- any XML element or field that embeds executable code, callback bodies, arbitrary query strings, module paths for execution, or target-platform invocation instructions.
