# depa-ontology.ts import/export projection

This document defines the projection boundary between validated ontology XML and the TypeScript/Bun OM package at `/Users/kongweixian/infra-dev/ontology/depa-ontology.ts/packages/depa-ontology`. Use that package's `cozo-om.d.ts`, `cozo-om.js`, and portability tests as the source of truth for native runtime capability.

XML remains the canonical human authoring and machine exchange representation. OM rows, schema snapshots, and behavior manifests are import/export targets, not a second ontology grammar.

## Machine-readable authority contract

Tests parse this contract and compare every named API with both the package's CommonJS exports and `cozo-om.d.ts`. Keep the JSON synchronized with the normative prose below.

<!-- projection-authority-contract -->
```json
{
  "authorityPackage": "/Users/kongweixian/infra-dev/ontology/depa-ontology.ts/packages/depa-ontology",
  "publicEntrypoint": "index.js#om",
  "schemaReadApis": [
    "readSchemaSnapshot",
    "getClassHierarchy",
    "getFieldDefinitions"
  ],
  "behaviorReadApis": [
    "getBehaviorCatalog",
    "exportBehaviorManifestJson"
  ],
  "importStages": [
    { "stage": "mixins", "api": "defineMixin" },
    { "stage": "mixin-fields", "api": "defineField" },
    { "stage": "types-parent-before-child", "api": "defineClass" },
    { "stage": "type-fields-parent-before-child", "api": "defineField" },
    { "stage": "relation-defs", "api": "defineRelationDef" },
    { "stage": "behaviors", "api": "importBehaviorManifestJson" }
  ],
  "behaviorKinds": [
    "constraint",
    "computed",
    "operation",
    "mutation",
    "interceptor"
  ],
  "callbackRegistrationApis": [
    "registerConstraint",
    "registerValidator",
    "registerComputed",
    "registerOperation",
    "registerMutation",
    "registerInterceptor"
  ],
  "callbackTransport": "binding-id-only",
  "importAllowsUnresolvedByDefault": true,
  "readyImportOption": "requireReady",
  "profileRequiredXmlKinds": [
    "BusinessObject",
    "Operation",
    "Mutation",
    "ComputedFunction",
    "ConstraintHandler",
    "Interceptor",
    "Rule",
    "StateMachine",
    "Association",
    "Operation",
    "Evidence",
    "DomainPolicy",
    "BusinessProcess",
    "Capability",
    "EventContract",
    "Lifecycle",
    "RuntimeBinding",
    "ImplementationMapping",
    "SchemaEvolution"
  ]
}
```

## Native OM surface

| XML | depa-ontology.ts API / relation-def |
| --- | --- |
| `Mixin@id`, `Description` | `defineMixin(name, description)` / `om_mixin` |
| `Class@id` or `BusinessObject@id`, `Description`, `parentRef`, `Mixins` | `defineClass(name, description, { parentClass, mixins })` / `om_class_def`, `om_class_mixin` |
| embedded `Field@name`, `typeRef`, `required`, `Description` | `defineField(owner, name, valueType, required, description)` / `om_field_def`, `om_field_desc` |
| `RelationDef@name`, endpoints, `directed` | `defineRelationDef(name, fromType, toType, directed, description)` / `om_rel_def`, `om_rel_desc` |
| Class-local or BusinessObject-local `ComputedProp@name` | `defineComputed(type, name, callback, description)` metadata plus a separate RuntimeBinding for callback readiness |
| BusinessObject-owned `Operation`, `Mutation`, `ComputedFunction`, `ConstraintHandler`, `Interceptor` | `importBehaviorManifestJson` entries or `defineOperation`, `defineMutation`, `defineComputed`, `defineConstraint`, `addInterceptor` after owner class and callback bindings exist |

Projection uses declaration order only after dependency sorting:

1. Define Mixins.
2. Define Mixin Fields.
3. Define Classes and BusinessObjects in parent-before-child order and pass Mixin refs in XML author order.
4. Define Class and BusinessObject Fields.
5. Define RelationDefs.
6. Import behavior metadata only after owner classes exist. Callback bindings may remain unresolved by default; use `requireReady: true` when unresolved callbacks must reject the import.

The validated XML importer owns these preconditions. The current low-level `defineField` and `defineRelationDef` functions do not themselves prove that an field owner or relation-def endpoint already exists, so their permissiveness must not be treated as a different projection order.

## Import to OM

An XML-to-OM importer must validate the FS-native tree first, then lower it to a normalized OM exchange IR:

- Class, BusinessObject, Mixin, embedded Field, and RelationDef declarations lower to the native APIs listed above. BusinessObject-to-type lowering is intentionally lossy unless the projection profile records that the runtime type came from a BusinessObject.
- Native value kinds are `String`, `Number`, `Bool`, `Json`, and `Validity`; their XML spellings are `builtin:String`, `builtin:Number`, `builtin:Bool`, `builtin:Json`, and `builtin:Validity`.
- BusinessObject-owned behavior lowers through the BusinessObject `id`: the runtime `ownerClass` and XML semantic `ownerRef` are the BusinessObject identity.
- Behavior names require an explicit projection policy. A default policy may use the final segment of the semantic id, but the chosen name must be stable, unique within `(kind, ownerClass)`, and recorded in mapping evidence when ambiguity is possible.
- RuntimeBinding supplies callback `bindingId` values. The portable manifest carries IDs and `unbound|unresolved|ready` readiness only; callback functions remain host-memory values registered through the typed `register*` APIs or supplied in `BehaviorCallbackBindingSet`. XML never embeds callbacks, module paths, scripts, SQL, CozoScript, or host execution instructions.
- A behavior manifest import uses `importBehaviorManifestJson(runtime, json, callbacks, options)`. Missing callbacks produce unresolved diagnostics and still apply by default. `options.requireReady: true` makes the same boundary reject before persistence.
- Direct `defineOperation`, `defineMutation`, `defineComputed`, `defineConstraint`, and `addInterceptor` calls accept callbacks, but persist only behavior metadata. They do not serialize function bodies or establish portable `bindingId` values.

## Export from OM

An OM-to-XML exporter may use:

- `readSchemaSnapshot(runner, version)` or equivalent schema snapshot data for classes, Mixins, Fields, and RelationDefs;
- `exportBehaviorManifestJson(runner)` for constraint, computed, operation, mutation, and interceptor metadata;
- explicit export policy files or ImplementationMapping resources to choose XML package identity, catalog placement, behavior name expansion, and DomainSemantics ownership.

Schema snapshots and behavior manifests are native fact carriers, not XML resource emitters. There is no public depa-ontology.ts XML export API. Every kind in `profileRequiredXmlKinds` above requires projection-profile evidence for its FS-native identity, catalog placement, and profile semantics. Runtime rows or snapshots alone must not create one of those XML resources.

If an OM behavior only says `{ ownerClass, kind, name }`, an exporter may retain a lower class-owned behavior exchange record or require a profile that maps `ownerClass` and the behavior key to XML resources. It must not silently fabricate `BusinessObject@id`, behavior semantic IDs, Operation dimensions, Evidence provenance, policy meaning, or lifecycle structure. A native snapshot's `perm.policies` rows are runtime access-control data, not `DomainPolicy` XML facts; `om_existential_rule_def` rows are likewise not `Rule` resources without an explicit mapping.

## Field semantics

Field is not a registry resource and has no authored global ID. The parser derives `<owner-fqn>#<localName>` only when another resource needs an unambiguous field path.

For example:

```xml
<Class id="MakerSpace.Tool" parentRef="MakerSpace.Resource">
  <Fields>
    <Field name="displayName" typeRef="builtin:String" required="true" />
  </Fields>
</Class>
```

projects to the conceptual calls:

```text
defineClass("MakerSpace.Tool", ..., { parentClass: "MakerSpace.Resource" })
defineField("MakerSpace.Tool", "displayName", "String", true, ...)
```

`MakerSpace.Tool#createdAt` may resolve even when `createdAt` is contributed by an applied Mixin. The left side names the active Class or BusinessObject view used by `getFieldDefinitions`, not a separate Field entity.

## Inheritance and Mixin precedence

Match the current `cozo-om` effective field model:

- Mixin fields have the lowest precedence.
- Far ancestors precede near ancestors.
- The current Class or BusinessObject has the highest precedence.
- A redeclaration may tighten optional to required.
- A redeclaration may not loosen required or change value kind.
- XML parsing and generation preserve authored Mixin order for stable source round-trips.
- Current `cozo-om` persists `om_class_mixin` with the key `(class_name, mixin_name)` and no ordinal. Runtime behavior must therefore not depend on source order when two applied Mixins contribute the same Field.
- Identical duplicate Mixin contributions are harmless; incompatible `typeRef` or `required` contributions are rejected as `COZO_OM_MIXIN_PROPERTY_AMBIGUOUS`.

## Native and extended value kinds

The native `cozo-om` value kinds are `String`, `Number`, `Bool`, `Json`, and `Validity`. Their XML spellings are `builtin:String`, `builtin:Number`, `builtin:Bool`, `builtin:Json`, and `builtin:Validity`.

`DateTime`, `Decimal`, `Uuid`, enums, unions, collections, and value Classes are XML extensions. A target projector must publish an explicit lowering rule, such as enum-to-String plus validation rules. Projection fails when no rule exists; it never silently stores an unsupported value kind.

## Non-native metadata

`abstract`, Class `kind`, relation-def cardinality, RelationLink fields, evidence, DomainSemantics resources, Operation dimensions, invocation presets, and lifecycle state machines are useful XML facts but are not all persisted by the core `cozo-om` schema. A projector may emit governance metadata or validators for them, but must not claim direct runtime support without a declared mapping.
