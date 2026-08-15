# Class, value-kind, and relation-def resources

The TypeSystem and DomainModel mechanisms are made of FS-native manifest resources: `ScalarType`, `EnumType`, `Mixin`, `Class`, `UnionType`, `CollectionType`, `BusinessObject`, `RelationDef`, `Rule`, and `StateMachine`. These resources are the XML language authority for depa-ontology.ts `cozo-om` type and relation-def structure. They must remain independent of PageObject, Operation, and other upper semantic models.

Fields are not split into standalone resources. `Field` and `ComputedProp` remain embedded language members inside `Mixin`, `Class`, `BusinessObject`, or RelationLink `Fields`.

## Class resource

```xml
<Class fqn="ontology.maker-space.classes.tool" id="MakerSpace.Tool" parentRef="MakerSpace.Resource" kind="entity">
  <Description>A reservable workshop tool.</Description>
  <Mixins>
    <Mixin ref="MakerSpace.Mixin.Auditable" />
  </Mixins>
  <Fields>
    <Field name="toolCode" typeRef="MakerSpace.Type.ToolCode" required="true" />
    <Field name="displayName" typeRef="builtin:String" required="true" />
  </Fields>
</Class>
```

This is a language-shaped model:

- `Class` and `Mixin` are named declarations with their own FS-native manifest boundary.
- `Field` and `ComputedProp` are local members embedded directly inside their owner.
- A field declaration never has `id` or `ref`.
- An Class applies a Mixin by reference because Mixin application is a type-language edge, like inheritance.
- A BusinessObject may reuse the same local member grammar directly. Do not create a shadow `Class` only to hold a BO's fields. XML-to-OM import may lower the BusinessObject to `defineClass`, but OM rows cannot identify it as a BusinessObject again without projection-profile evidence.
- `Class` is the XML DSL resource kind. It projects to the current `cozo-om.defineClass` API.

### Class grammar

- `Class` requires resource `fqn`, semantic `id`, and non-empty `Description`.
- Optional fields are `parentRef`, `abstract`, `kind`, and `status`.
- `parentRef` resolves to one other entity `Class` or `BusinessObject` and projects to `defineClass(..., { parentClass })`.
- `Mixins/Mixin@ref` preserves author order and projects to `defineClass(..., { mixins })`. Define each Mixin and its Fields before defining types that apply it. Current `cozo-om` storage does not persist that ordinal, so applied Mixins must not contribute incompatible definitions for the same Field.
- `abstract` is an authoring/projection constraint; the current `cozo-om` storage schema has no native abstract flag.
- `kind` is `entity|value|document|view|raw`; it is structural metadata, not a BusinessObject kind.
- Direct children are optional `Description`, `Mixins`, `Fields`, `ComputedProps`, and `Evidences`, in that order.
- Validation rejects missing parents/Mixins, inheritance cycles, invalid inherited field overrides, and Mixin Field conflicts whose effective result would depend on a non-persisted application order.

## Mixin resource

```xml
<Mixin fqn="ontology.maker-space.mixins.auditable" id="MakerSpace.Mixin.Auditable">
  <Description>Reusable audit fields.</Description>
  <Fields>
    <Field name="createdAt" typeRef="builtin:DateTime" required="true" />
    <Field name="updatedAt" typeRef="builtin:DateTime" required="false" />
  </Fields>
</Mixin>
```

- `Mixin` requires resource `fqn`, semantic `id`, and non-empty `Description`.
- Direct children are optional `Description`, optional `Fields`, and optional `Evidences`, in that order.
- A Mixin owns embedded Field declarations exactly like a language trait owns fields.
- A Mixin does not compose another Mixin and does not own computed behavior. This matches the current `cozo-om` model, where classes select Mixins through `om_class_mixin` and computed definitions are class-owned behavior.

## Field grammar

- `Field` declarations appear only inside `Class`, `BusinessObject`, `Mixin`, or RelationLink `Fields`.
- `Field` requires lowerCamelCase `name`, `typeRef`, and `required="true|false"`.
- It does not allow `id` or `ref`; its identity is local to the owning language declaration.
- A cross-resource field path is written as `<owner-fqn>#<localName>`, for example `MakerSpace.Tool#displayName`.
- For an Class or BusinessObject path, the local name may resolve from the owner itself, its parent chain, or an applied Mixin. The left side remains the active owner context, not the declaration that originally contributed the field.
- A child Class or BusinessObject may redeclare an inherited Field with the same `typeRef` and may tighten `required="false"` to `required="true"`.
- A child Class or BusinessObject must not change an inherited field's type or loosen required to optional. These are the same restrictions enforced by `cozo-om.defineField`.
- Optional fields are `status` and `defaultKind`.
- Direct children are optional `Description` and `Evidences`, in that order.

## ComputedProp grammar

- `ComputedProp` is an Class-local or BusinessObject-local member with `name` and `typeRef`; it has no global `id`.
- Its cross-resource path is also `<owner-fqn>#<localName>`.
- Direct children are optional `Description`, optional `Statement`, and optional `Evidences`.
- Runtime support is declared by `RuntimeBinding targetKind="computed-prop"` using the derived field path.

## Scalar, enum, union, and collection resources

```xml
<ScalarType fqn="ontology.maker-space.scalar-types.tool-code" id="MakerSpace.Type.ToolCode" base="builtin:String">
  <Description>Stable tool code.</Description>
</ScalarType>

<EnumType fqn="ontology.maker-space.enum-types.tool-state" id="MakerSpace.Type.ToolState">
  <Description>Operational state of a workshop tool.</Description>
  <Members>
    <Member id="Available" value="available" />
    <Member id="InUse" value="inUse" />
  </Members>
</EnumType>
```

- `ScalarType`, `EnumType`, `UnionType`, and `CollectionType` are TypeSystem manifest resources.
- Built-in type refs are `builtin:String`, `builtin:Number`, `builtin:Bool`, `builtin:Json`, `builtin:Validity`, `builtin:DateTime`, `builtin:Decimal`, and `builtin:Uuid`.
- `String`, `Number`, `Bool`, `Json`, and `Validity` project directly to the native `cozo-om` `ALLOWED_VALUE_TYPES`. Other built-ins and declared types require an explicit target projection policy; see [cozo-om-projection.md](cozo-om-projection.md).
- A declared Class/Mixin/type-alias ID is unique across the ontology.
- Mixin is an applicable trait declaration, not a Field value kind. Use it only through `Mixins/Mixin@ref`.
- Union options and collection items may reference built-in or declared value kinds, but never a Mixin.
- These forms are not all native `cozo-om` value kinds, so a projector must either lower them through an explicit mapping or reject the projection. The validator must never silently pretend that a non-native type is directly supported by `cozo-om`.

## RelationDef resource

```xml
<RelationDef fqn="ontology.maker-space.relation-defs.reserves-tool" id="MakerSpace.RelationDef.ReservesTool" name="reservesTool" fromClassRef="MakerSpace.Reservation" toClassRef="MakerSpace.Tool" directed="true" min="1" max="1">
  <Description>Reservation to reserved tool.</Description>
  <Fields>
    <Field name="assignedAt" typeRef="builtin:DateTime" required="true" />
  </Fields>
</RelationDef>
```

- `RelationDef` requires resource `fqn`, semantic `id`, lowerCamelCase `name`, `fromClassRef`, `toClassRef`, and `directed="true|false"`.
- Endpoints resolve to entity `Class` or `BusinessObject` declarations and project to `defineRelationDef` after the target classes exist. This is an importer invariant: the low-level runtime API currently accepts unresolved endpoint names and therefore is not sufficient validation by itself.
- Optional `min`/`max` cardinality and edge Fields are XML semantic extensions; current `cozo-om.defineRelationDef` does not persist them and projection must declare how they are enforced.
- RelationLink Field declarations use the same embedded local grammar and are referenced as `<relation-def fqn>#<localName>`.
- Association is a DomainSemantics resource over `relationDefRef`; it does not repeat endpoints, cardinality, or edge fields.

## Shared evidence grammar

`Evidences` contains `Evidence ref="..."` references. Evidence belongs to the Class, value-kind, Mixin, RelationDef, or local member it explains; it does not turn local members into independent resources.
