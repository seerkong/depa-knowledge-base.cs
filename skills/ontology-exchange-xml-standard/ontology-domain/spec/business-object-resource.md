# BusinessObject manifest resource

`BusinessObject` is a DomainModel FS-native manifest that directly declares one domain object type and its local semantic subtree. It reuses the same ObjectType/Mixin/Property language rules for inheritance, Mixin application, embedded properties, and computed properties, but it is not a wrapper around a shadow structural `ObjectType`.

The `TypeSystem/ObjectTypes/*/ObjectType.xml` catalog remains domain-role-neutral. Use it for reusable, non-BO, value, raw, document, view, and shared parent declarations. Use `BusinessObject.xml` when the modeled object is the domain object boundary that owns identity, properties, and BO-local actions, mutations, interceptors, computed functions, constraint handlers, and lifecycle membership.

## Resource tree

```text
DomainModel/BusinessObjects/
  reservation/
    BusinessObject.xml
    Actions/
      Approve/
        Action.xml
    Mutations/
      MarkApproved/
        Mutation.xml
    Interceptors/
    ComputedFunctions/
    ConstraintHandlers/
    Lifecycles/
```

The directory names are conventional. `BusinessObject.xml` and its `ManifestResourceCatalog` children are authoritative. Each local catalog scans only direct child directories and loads only the declared entry file. Deeper files are invisible unless a child manifest declares its own catalog.

The containing `Ontology` discovers these manifests with:

```xml
<ManifestResourceCatalog
  id="business-objects"
  kind="BusinessObject"
  root="vfs://@/DomainModel/BusinessObjects/"
  entry="BusinessObject.xml" />
```

## BusinessObject grammar

```xml
<BusinessObject
  fqn="ontology.maker-space.business-object.reservation"
  id="MakerSpace.Reservation"
  parentRef="MakerSpace.Resource">
  <Description>Reservation business-object resource.</Description>
  <Purpose>Represents a member request to reserve and use a tool.</Purpose>
  <Mixins>
    <Mixin ref="MakerSpace.Mixin.Auditable" />
  </Mixins>
  <Identity>
    <Property name="reservationNumber" typeRef="MakerSpace.Type.ReservationNumber" required="true" />
  </Identity>
  <Properties>
    <Property name="workflowState" typeRef="MakerSpace.Type.ReservationState" required="true" role="state" />
    <Property name="startTime" typeRef="builtin:DateTime" required="true" role="measurement" />
    <Property name="endTime" typeRef="builtin:DateTime" required="true" role="measurement" />
  </Properties>
  <ComputedProperties>
    <ComputedProperty name="durationMinutes" typeRef="builtin:Number">
      <Statement>Duration is the number of minutes between startTime and endTime.</Statement>
    </ComputedProperty>
  </ComputedProperties>
  <Constraints>
    <Rule ref="MakerSpace.Rule.ToolRequiresCertification" />
  </Constraints>
  <Lifecycles>
    <StateMachine ref="MakerSpace.Lifecycle.Reservation" />
  </Lifecycles>
  <ManifestResourceCatalog id="actions" kind="Action" root="vfs://@/Actions/" entry="Action.xml" />
  <ManifestResourceCatalog id="mutations" kind="Mutation" root="vfs://@/Mutations/" entry="Mutation.xml" />
</BusinessObject>
```

- `fqn`, `id`, `Description`, and `Purpose` are required.
- `BusinessObject@id` is the object type identity. It projects to the OM type name when an importer lowers this resource.
- `parentRef` is optional and resolves to an entity `ObjectType` or another `BusinessObject`.
- `Mixins/Mixin@ref` works like `ObjectType` Mixin application and preserves authored order.
- `Identity` and `Properties` contain direct `Property` declarations. `Property@ref` is invalid inside `BusinessObject`.
- A BO property declaration requires `name`, `typeRef`, and `required="true|false"`; it must not have a global `id`.
- `role` is allowed only on BusinessObject-owned properties and is a semantic/UI hint, not a separate property owner.
- `ComputedProperties` contains direct `ComputedProperty` declarations whose derived paths are `BusinessObjectFqn#localName`.
- `Constraints` and `Lifecycles` reference compatible `Rule` and `StateMachine` declarations.
- Local catalogs may target only `Action`, `Mutation`, `Interceptor`, `ComputedFunction`, `ConstraintHandler`, or `Lifecycle`.

## Owned member resources

```xml
<Mutation
  fqn="ontology.maker-space.business-object.reservation.mutation.mark-approved"
  id="MakerSpace.Reservation.Mutation.MarkApproved"
  ownerRef="MakerSpace.Reservation"
  portability="portable">
  <Description>Move the reservation state to approved.</Description>
  <InternalLogic>Set the active reservation workflow state to approved.</InternalLogic>
</Mutation>
```

```xml
<Action
  fqn="ontology.maker-space.business-object.reservation.action.approve"
  id="MakerSpace.Reservation.Action.Approve"
  ownerRef="MakerSpace.Reservation"
  portability="portable">
  <Description>Approve a requested reservation.</Description>
  <Mutations>
    <Mutation ref="MakerSpace.Reservation.Mutation.MarkApproved" />
  </Mutations>
  <InternalLogic>Evaluate approval constraints and apply the mutation.</InternalLogic>
</Action>
```

Every owned member is a manifest resource with an independent FS-native resource identity and a semantic `id`, but `ownerRef` must equal the containing BusinessObject manifest's `id`. This visible containment is the ownership fact; `ownerRef` is a semantic cross-check, not a replacement for the resource tree.

- `Action` may compose same-owner `Mutation` resources.
- `Mutation` declares a named write behavior; executable code belongs in RuntimeBinding, not XML.
- `Interceptor` targets a same-owner Action and declares `phase="before|after"` plus non-negative `seq`.
- `ComputedFunction` declares a lowerCamelCase `name` and `returnTypeRef` from the type system.
- A local `ConstraintHandler` uses `ownerKind="business-object"` and the same `ownerRef`.
- `Lifecycle` references a StateMachine whose subject type is compatible with the BusinessObject `id`.

## cozo-om projection boundary

For the depa-ontology.ts `cozo-om` runtime, the BusinessObject `id` supplies the behavior owner type. The importer lowers a BusinessObject to `defineType(id, description, { parentType, mixins })`, lowers direct `Identity` and `Properties` entries to `defineAttribute`, and lowers direct `ComputedProperties` metadata after the owner type exists.

Action, Mutation, Interceptor, ComputedFunction, and ConstraintHandler metadata can project to `defineAction`, `defineMutation`, `addInterceptor`, `defineComputed`, and `defineConstraint`, or to `importBehaviorManifestJson`, only when a RuntimeBinding supplies the required callback `bindingId` values. XML never embeds those callbacks.

Projection from BusinessObject-local resources to OM behavior names is explicit. A default projector may derive the final segment of the semantic id, such as `Approve` from `MakerSpace.Reservation.Action.Approve`, but it must keep the mapping stable and unique for the owner type. Export from OM back to BusinessObject-local XML requires an export policy that maps the runtime `ownerType` to this BusinessObject manifest; it must not fabricate a BusinessObject manifest from `{ ownerType, kind, name }` alone.

`Operation` remains a separate callable/API model. It may represent the callable surface corresponding to a BusinessObject Action or Mutation, but it does not replace those local semantic resources and the current grammar does not infer correspondence from matching names.
