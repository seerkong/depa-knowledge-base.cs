# Naming, identity, and references

## XML casing

Use PascalCase for element names and FQN segments. XML fields remain lower-case or lowerCamelCase as specified. Do not infer semantic identity from file layout.

## Resource identity and semantic identity

FS-native resource descriptors normalize to `kind`, `description`, and either `fqn` or `name`. In this ontology-domain package, the canonical resource identity is the root element's `fqn` field. The root `id` field remains a semantic declaration identity and must not be used as the FS-native identity source.

```xml
<Ontology fqn="ontology.maker-space" id="MakerSpace.Ontology" version="1.0.0">
<Class fqn="ontology.maker-space.classes.resource" id="MakerSpace.Resource">
<OperationCatalog fqn="ontology.maker-space.operations" id="MakerSpace.Operations">
```

Semantic declaration IDs remain stable domain references:

```text
MakerSpace.Reservation
MakerSpace.RelationDef.ReservesTool
MakerSpace.Rule.ToolRequiresCertification
MakerSpace.Lifecycle.Reservation
MakerSpace.Operation.ApproveReservation
MakerSpace.Binding.ApproveReservation.Bun
MakerSpace.Evolution.V2
```

Local runtime-facing names use lowerCamelCase unless a projection mapping explicitly records another target name:

```text
reservationNumber
workflowState
reservedFrom
```

Evidence IDs use stable namespaced tokens:

```text
backend:reservation-approval-policy
database:tool-schedule-constraint
decision:rename-booking-to-reservation
```

## VFS references

Catalog roots use containment-safe VFS URIs:

- `vfs://@/...` resolves relative to the ontology manifest boundary.
- `vfs://./...` may be used inside a resource for internal non-resource material when that KindDefinition allows it.

Reject absolute filesystem paths, bare relative paths, backslashes, and traversal that escapes the permitted root.

Semantic references use IDs, not file paths:

```xml
<FieldPresent fieldRef="MakerSpace.Reservation#reservationNumber" />
<Evidence ref="backend:reservation-approval-policy" />
<Operation ref="MakerSpace.Operation.ApproveReservation" />
```

## Reference kind table

| Field or element | Required target kind |
| --- | --- |
| `typeRef` on Field-like value slots | built-in or declared scalar, enum, value/object Class, union, or collection type; a Mixin is not a value kind |
| `subjectTypeRef`, relation-def endpoint refs, request subject `ref.type` | declared entity `Class` or `BusinessObject` |
| `inputTypeRef`, `outputTypeRef`, capability `Type@ref` | built-in or declared scalar, enum, Class, BusinessObject, union, or collection type; a Mixin is not a value kind |
| `eventTypeRef` | declared event payload `Class` |
| `parentRef` | declared entity `Class` or `BusinessObject` |
| `mixinRef`, `Mixin@ref` in a ref context | declared mixin |
| `fieldRef`, `otherFieldRef`, `stateFieldRef` | derived field path `<ClassOrBusinessObjectOrRelationDefFqn>#<localName>`; the local member is embedded in its owner and has no authored global ID |
| `relationDefRef`, `RelationDef@ref` in a ref context | declared manifest `RelationDef` |
| `ruleRef`, `Rule@ref` in a ref context | declared manifest `Rule` |
| `stateMachineRef`, `StateMachine@ref` in a ref context | declared manifest `StateMachine`; a BusinessObject-local `Lifecycle` resource still has its own member id and points here |
| `profileRef` | declared DomainSemantics or DomainModel profile resource |
| `DomainPolicy@ownerRef`, `ConstraintHandler@ownerRef`, `Operation@ownerRef` | declaration kind in the Semantic Owner Reference Table |
| local-name `Alias@ownerRef` | current declaration that owns the renamed local member |
| `operationRef`, `Operation@ref` in a ref context | declared `Operation` |
| `presetRef`, `InvocationPreset@ref` in a ref context | declared `InvocationPreset` |
| `bindingRef`, `RuntimeBinding@ref` in a ref context | declared `RuntimeBinding` |
| `mappingRef`, `ImplementationMapping@ref` in a ref context | declared `ImplementationMapping` |
| `evidenceRef`, `Evidence@ref` in a ref context | declared `Evidence` |
| `targetRef` in evolution operations | declaration kind named by `kind` |

Do not overload one field with both FQN and path semantics. Do not overload a root `id` as both resource identity and semantic declaration identity.

## Semantic owner reference table

The same mapping applies to `DomainPolicy@ownerKind`, `ConstraintHandler@ownerKind`, and `Operation@owner`:

| Owner kind | `ownerRef` presence | Required target kind |
| --- | --- | --- |
| `domain-context` | forbidden | containing `Ontology` context |
| `business-object` | required | `BusinessObject` |
| `association` | required | `Association` |
| `lifecycle` | required | `StateMachine` |
| `constraint` | required | `ConstraintHandler` |
| `business-process` | required | `BusinessProcess` |
| `capability` | required | `Capability` |
| `raw` | optional | `Class` only for an explicitly structured raw context |

The owner rows are identity references, not shortcuts to structural facts. Validators must reject a `business-object` ownerRef to a non-BO `Class`, an `association` ownerRef to `RelationDef`, and a `constraint` ownerRef to `Rule`. The `lifecycle` row is deliberately `StateMachine`: the state-machine declaration owns lifecycle identity, while a BusinessObject-local `Lifecycle` resource is only a membership node.

## Execute request identity mapping

`ExecuteOperationRequest v1` repeats catalog identity using these exact mappings:

| XML source | Request field |
| --- | --- |
| `Ontology@id` | `context.id` |
| `Ontology@version` | `context.version` |
| `Operation@id` | `operation.ref` |
| `Operation@owner` | `operation.ownerKind` |
| `Operation@ownerRef` | `operation.ownerRef`, including identical presence |
| `Operation@behavior` | `operation.behaviorKind` |
| `Operation@subject` | `operation.subjectKind` |
| `Operation@invocation` | `operation.invocationMode` and `invocation.mode` |
| `Operation@effect` | `operation.effect` |
| `Operation@verb` | single `invocation.verb` or every batch item `verb` |

`apiVersion` is the literal string `"1"` and is independent of `Ontology@version`. Request field names are transport contract names, not alternate semantic IDs or aliases.

## Plural containers

Plural containers contain singular members. Use:

```xml
<Evidences>
  <Evidence ref="backend:reservation-approval-policy" />
</Evidences>
```

Do not introduce `*Refs` wrapper elements in latest XML. A singular element with `ref` is a reference; a singular element with `id` is a declaration. Validators must reject an element that supplies both `id` and `ref`.

## Aliases and renames

Aliases are explicit `SchemaEvolutionModule` objects, not alternate declarations. `Alias@from` is a compatibility identity and `Alias@to` resolves to the canonical declaration of the matching kind.

- Class, mixin, relation-def, rule, lifecycle, profile, operation, binding, and mapping aliases use FQNs in both `from` and `to`.
- Field and computed-prop aliases use derived `<owner-fqn>#<localName>` paths; prefer `kind="local-name"` with `ownerRef` for ordinary field renames.
- Local-name aliases use lowerCamelCase `from` and `to` plus `ownerRef`.
- Alias chains must resolve to one canonical declaration.
- Self-aliases, cycles, conflicting sources, and kind mismatches are invalid.

Never define two semantic declarations because frontend, backend, database, or HTTP names differ. Represent target names through implementation mappings or runtime bindings.

## Versioning

`Ontology@version` is the immutable semantic schema version for one coherent ontology meaning. Existing bundles may use a documented monotonic token such as `v5`; new version lines should prefer semantic versions such as `1.2.0`.

Start a new ontology version when changing class, field, relation-def, lifecycle, rule, operation dimensions, request schema, effect, capability sets, binding contract, identity, or alias policy. Do not change semantic version merely because source revisions, file locations, evidence lines, resolver versions, generation time, output digest, seed data, or runtime rows changed.
