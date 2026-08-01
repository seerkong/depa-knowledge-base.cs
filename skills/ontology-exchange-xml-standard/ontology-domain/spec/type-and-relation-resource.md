# Type and relation resources

The TypeSystem and DomainModel mechanisms are made of FS-native manifest resources: `ScalarType`, `EnumType`, `Mixin`, `ObjectType`, `UnionType`, `CollectionType`, `BusinessObject`, `Relation`, `Rule`, and `StateMachine`. These resources are the XML language authority for depa-ontology.ts `cozo-om` type and relation structure. They must remain independent of PageObject, Operation, and other upper semantic models.

Properties are not split into standalone resources. `Property` and `ComputedProperty` remain embedded language members inside `Mixin`, `ObjectType`, `BusinessObject`, or relation edge `Properties`.

## ObjectType resource

```xml
<ObjectType fqn="ontology.maker-space.object-types.tool" id="MakerSpace.Tool" parentRef="MakerSpace.Resource" kind="entity">
  <Description>A reservable workshop tool.</Description>
  <Mixins>
    <Mixin ref="MakerSpace.Mixin.Auditable" />
  </Mixins>
  <Properties>
    <Property name="toolCode" typeRef="MakerSpace.Type.ToolCode" required="true" />
    <Property name="displayName" typeRef="builtin:String" required="true" />
  </Properties>
</ObjectType>
```

This is a language-shaped model:

- `ObjectType` and `Mixin` are named declarations with their own FS-native manifest boundary.
- `Property` and `ComputedProperty` are local members embedded directly inside their owner.
- A property declaration never has `id` or `ref`.
- An ObjectType applies a Mixin by reference because Mixin application is a type-language edge, like inheritance.
- A BusinessObject may reuse the same local member grammar directly. Do not create a shadow `ObjectType` only to hold a BO's properties. XML-to-OM import may lower the BusinessObject to `defineType`, but OM rows cannot identify it as a BusinessObject again without projection-profile evidence.
- `ObjectType` is the XML DSL resource kind. It projects to the current `cozo-om.defineType` API.

### ObjectType grammar

- `ObjectType` requires resource `fqn`, semantic `id`, and non-empty `Description`.
- Optional attributes are `parentRef`, `abstract`, `kind`, and `status`.
- `parentRef` resolves to one other entity `ObjectType` or `BusinessObject` and projects to `defineType(..., { parentType })`.
- `Mixins/Mixin@ref` preserves author order and projects to `defineType(..., { mixins })`. Define each Mixin and its Properties before defining types that apply it. Current `cozo-om` storage does not persist that ordinal, so applied Mixins must not contribute incompatible definitions for the same Property.
- `abstract` is an authoring/projection constraint; the current `cozo-om` storage schema has no native abstract flag.
- `kind` is `entity|value|document|view|raw`; it is structural metadata, not a BusinessObject kind.
- Direct children are optional `Description`, `Mixins`, `Properties`, `ComputedProperties`, and `Evidences`, in that order.
- Validation rejects missing parents/Mixins, inheritance cycles, invalid inherited property overrides, and Mixin Property conflicts whose effective result would depend on a non-persisted application order.

## Mixin resource

```xml
<Mixin fqn="ontology.maker-space.mixins.auditable" id="MakerSpace.Mixin.Auditable">
  <Description>Reusable audit fields.</Description>
  <Properties>
    <Property name="createdAt" typeRef="builtin:DateTime" required="true" />
    <Property name="updatedAt" typeRef="builtin:DateTime" required="false" />
  </Properties>
</Mixin>
```

- `Mixin` requires resource `fqn`, semantic `id`, and non-empty `Description`.
- Direct children are optional `Description`, optional `Properties`, and optional `Evidences`, in that order.
- A Mixin owns embedded Property declarations exactly like a language trait owns fields.
- A Mixin does not compose another Mixin and does not own computed behavior. This matches the current `cozo-om` model, where object types select Mixins through `om_type_mixin` and computed definitions are type-owned behavior.

## Property grammar

- `Property` declarations appear only inside `ObjectType`, `BusinessObject`, `Mixin`, or relation edge `Properties`.
- `Property` requires lowerCamelCase `name`, `typeRef`, and `required="true|false"`.
- It does not allow `id` or `ref`; its identity is local to the owning language declaration.
- A cross-resource property path is written as `<owner-fqn>#<localName>`, for example `MakerSpace.Tool#displayName`.
- For an ObjectType or BusinessObject path, the local name may resolve from the owner itself, its parent chain, or an applied Mixin. The left side remains the active owner context, not the declaration that originally contributed the field.
- A child ObjectType or BusinessObject may redeclare an inherited Property with the same `typeRef` and may tighten `required="false"` to `required="true"`.
- A child ObjectType or BusinessObject must not change an inherited property's type or loosen required to optional. These are the same restrictions enforced by `cozo-om.defineAttribute`.
- Optional attributes are `status` and `defaultKind`.
- Direct children are optional `Description` and `Evidences`, in that order.

## ComputedProperty grammar

- `ComputedProperty` is an ObjectType-local or BusinessObject-local member with `name` and `typeRef`; it has no global `id`.
- Its cross-resource path is also `<owner-fqn>#<localName>`.
- Direct children are optional `Description`, optional `Statement`, and optional `Evidences`.
- Runtime support is declared by `RuntimeBinding targetKind="computed-property"` using the derived property path.

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
- A declared ObjectType/Mixin/type-alias ID is unique across the ontology.
- Mixin is an applicable trait declaration, not a Property value type. Use it only through `Mixins/Mixin@ref`.
- Union options and collection items may reference built-in or declared value types, but never a Mixin.
- These forms are not all native `cozo-om` value types, so a projector must either lower them through an explicit mapping or reject the projection. The validator must never silently pretend that a non-native type is directly supported by `cozo-om`.

## Relation resource

```xml
<Relation fqn="ontology.maker-space.relations.reserves-tool" id="MakerSpace.Relation.ReservesTool" name="reservesTool" fromTypeRef="MakerSpace.Reservation" toTypeRef="MakerSpace.Tool" directed="true" min="1" max="1">
  <Description>Reservation to reserved tool.</Description>
  <Properties>
    <Property name="assignedAt" typeRef="builtin:DateTime" required="true" />
  </Properties>
</Relation>
```

- `Relation` requires resource `fqn`, semantic `id`, lowerCamelCase `name`, `fromTypeRef`, `toTypeRef`, and `directed="true|false"`.
- Endpoints resolve to entity `ObjectType` or `BusinessObject` declarations and project to `defineRelation` after the target object types exist. This is an importer invariant: the low-level runtime API currently accepts unresolved endpoint names and therefore is not sufficient validation by itself.
- Optional `min`/`max` cardinality and edge Properties are XML semantic extensions; current `cozo-om.defineRelation` does not persist them and projection must declare how they are enforced.
- Edge Property declarations use the same embedded local grammar and are referenced as `<relation-fqn>#<localName>`.
- Association is a DomainSemantics resource over `relationRef`; it does not repeat endpoints, cardinality, or edge properties.

## Shared evidence grammar

`Evidences` contains `Evidence ref="..."` references. Evidence belongs to the Type, Mixin, Relation, or local member it explains; it does not turn local members into independent resources.
