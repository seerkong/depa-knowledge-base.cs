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
    "getTypeHierarchy",
    "getAttributeDefinitions"
  ],
  "behaviorReadApis": [
    "getBehaviorCatalog",
    "exportBehaviorManifestJson"
  ],
  "importStages": [
    { "stage": "mixins", "api": "defineMixin" },
    { "stage": "mixin-properties", "api": "defineAttribute" },
    { "stage": "types-parent-before-child", "api": "defineType" },
    { "stage": "type-properties-parent-before-child", "api": "defineAttribute" },
    { "stage": "relations", "api": "defineRelation" },
    { "stage": "behaviors", "api": "importBehaviorManifestJson" }
  ],
  "behaviorKinds": [
    "constraint",
    "computed",
    "action",
    "mutation",
    "interceptor"
  ],
  "callbackRegistrationApis": [
    "registerConstraint",
    "registerValidator",
    "registerComputed",
    "registerAction",
    "registerMutation",
    "registerInterceptor"
  ],
  "callbackTransport": "binding-id-only",
  "importAllowsUnresolvedByDefault": true,
  "readyImportOption": "requireReady",
  "profileRequiredXmlKinds": [
    "BusinessObject",
    "Action",
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

| XML | depa-ontology.ts API / relation |
| --- | --- |
| `Mixin@id`, `Description` | `defineMixin(name, description)` / `om_mixin` |
| `ObjectType@id` or `BusinessObject@id`, `Description`, `parentRef`, `Mixins` | `defineType(name, description, { parentType, mixins })` / `om_type`, `om_type_mixin` |
| embedded `Property@name`, `typeRef`, `required`, `Description` | `defineAttribute(owner, name, valueType, required, description)` / `om_attr_def`, `om_attr_desc` |
| `Relation@name`, endpoints, `directed` | `defineRelation(name, fromType, toType, directed, description)` / `om_rel_def`, `om_rel_desc` |
| ObjectType-local or BusinessObject-local `ComputedProperty@name` | `defineComputed(type, name, callback, description)` metadata plus a separate RuntimeBinding for callback readiness |
| BusinessObject-owned `Action`, `Mutation`, `ComputedFunction`, `ConstraintHandler`, `Interceptor` | `importBehaviorManifestJson` entries or `defineAction`, `defineMutation`, `defineComputed`, `defineConstraint`, `addInterceptor` after owner type and callback bindings exist |

Projection uses declaration order only after dependency sorting:

1. Define Mixins.
2. Define Mixin Properties.
3. Define ObjectTypes and BusinessObjects in parent-before-child order and pass Mixin refs in XML author order.
4. Define ObjectType and BusinessObject Properties.
5. Define Relations.
6. Import behavior metadata only after owner types exist. Callback bindings may remain unresolved by default; use `requireReady: true` when unresolved callbacks must reject the import.

The validated XML importer owns these preconditions. The current low-level `defineAttribute` and `defineRelation` functions do not themselves prove that an attribute owner or relation endpoint already exists, so their permissiveness must not be treated as a different projection order.

## Import to OM

An XML-to-OM importer must validate the FS-native tree first, then lower it to a normalized OM exchange IR:

- ObjectType, BusinessObject, Mixin, embedded Property, and Relation declarations lower to the native APIs listed above. BusinessObject-to-type lowering is intentionally lossy unless the projection profile records that the runtime type came from a BusinessObject.
- Native value types are `String`, `Number`, `Bool`, `Json`, and `Validity`; their XML spellings are `builtin:String`, `builtin:Number`, `builtin:Bool`, `builtin:Json`, and `builtin:Validity`.
- BusinessObject-owned behavior lowers through the BusinessObject `id`: the runtime `ownerType` and XML semantic `ownerRef` are the BusinessObject identity.
- Behavior names require an explicit projection policy. A default policy may use the final segment of the semantic id, but the chosen name must be stable, unique within `(kind, ownerType)`, and recorded in mapping evidence when ambiguity is possible.
- RuntimeBinding supplies callback `bindingId` values. The portable manifest carries IDs and `unbound|unresolved|ready` readiness only; callback functions remain host-memory values registered through the typed `register*` APIs or supplied in `BehaviorCallbackBindingSet`. XML never embeds callbacks, module paths, scripts, SQL, CozoScript, or host execution instructions.
- A behavior manifest import uses `importBehaviorManifestJson(runtime, json, callbacks, options)`. Missing callbacks produce unresolved diagnostics and still apply by default. `options.requireReady: true` makes the same boundary reject before persistence.
- Direct `defineAction`, `defineMutation`, `defineComputed`, `defineConstraint`, and `addInterceptor` calls accept callbacks, but persist only behavior metadata. They do not serialize function bodies or establish portable `bindingId` values.

## Export from OM

An OM-to-XML exporter may use:

- `readSchemaSnapshot(runner, version)` or equivalent schema snapshot data for object types, Mixins, Properties, and Relations;
- `exportBehaviorManifestJson(runner)` for constraint, computed, action, mutation, and interceptor metadata;
- explicit export policy files or ImplementationMapping resources to choose XML package identity, catalog placement, behavior name expansion, and DomainSemantics ownership.

Schema snapshots and behavior manifests are native fact carriers, not XML resource emitters. There is no public depa-ontology.ts XML export API. Every kind in `profileRequiredXmlKinds` above requires projection-profile evidence for its FS-native identity, catalog placement, and profile semantics. Runtime rows or snapshots alone must not create one of those XML resources.

If an OM behavior only says `{ ownerType, kind, name }`, an exporter may retain a lower type-owned behavior exchange record or require a profile that maps `ownerType` and the behavior key to XML resources. It must not silently fabricate `BusinessObject@id`, behavior semantic IDs, Operation dimensions, Evidence provenance, policy meaning, or lifecycle structure. A native snapshot's `perm.policies` rows are runtime access-control data, not `DomainPolicy` XML facts; `om_existential_rule_def` rows are likewise not `Rule` resources without an explicit mapping.

## Property semantics

Property is not a registry resource and has no authored global ID. The parser derives `<owner-fqn>#<localName>` only when another resource needs an unambiguous property path.

For example:

```xml
<ObjectType id="MakerSpace.Tool" parentRef="MakerSpace.Resource">
  <Properties>
    <Property name="displayName" typeRef="builtin:String" required="true" />
  </Properties>
</ObjectType>
```

projects to the conceptual calls:

```text
defineType("MakerSpace.Tool", ..., { parentType: "MakerSpace.Resource" })
defineAttribute("MakerSpace.Tool", "displayName", "String", true, ...)
```

`MakerSpace.Tool#createdAt` may resolve even when `createdAt` is contributed by an applied Mixin. The left side names the active ObjectType or BusinessObject view used by `getAttributeDefinitions`, not a separate Property entity.

## Inheritance and Mixin precedence

Match the current `cozo-om` effective attribute model:

- Mixin properties have the lowest precedence.
- Far ancestors precede near ancestors.
- The current ObjectType or BusinessObject has the highest precedence.
- A redeclaration may tighten optional to required.
- A redeclaration may not loosen required or change value type.
- XML parsing and generation preserve authored Mixin order for stable source round-trips.
- Current `cozo-om` persists `om_type_mixin` with the key `(type_name, mixin_name)` and no ordinal. Runtime behavior must therefore not depend on source order when two applied Mixins contribute the same Property.
- Identical duplicate Mixin contributions are harmless; incompatible `typeRef` or `required` contributions are rejected as `COZO_OM_MIXIN_PROPERTY_AMBIGUOUS`.

## Native and extended value types

The native `cozo-om` value types are `String`, `Number`, `Bool`, `Json`, and `Validity`. Their XML spellings are `builtin:String`, `builtin:Number`, `builtin:Bool`, `builtin:Json`, and `builtin:Validity`.

`DateTime`, `Decimal`, `Uuid`, enums, unions, collections, and value ObjectTypes are XML extensions. A target projector must publish an explicit lowering rule, such as enum-to-String plus validation rules. Projection fails when no rule exists; it never silently stores an unsupported value type.

## Non-native metadata

`abstract`, ObjectType `kind`, relation cardinality, relation edge properties, evidence, DomainSemantics resources, Operation dimensions, invocation presets, and lifecycle state machines are useful XML facts but are not all persisted by the core `cozo-om` schema. A projector may emit governance metadata or validators for them, but must not claim direct runtime support without a declared mapping.
