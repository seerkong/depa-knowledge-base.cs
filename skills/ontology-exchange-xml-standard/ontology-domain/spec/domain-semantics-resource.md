# DomainSemantics resources

DomainSemantics resources assign business and domain meaning to declared TypeSystem and DomainModel facts by reference. BusinessObject is a DomainModel manifest that owns a domain object type and its local behavior subtree; `Association`, `DomainPolicy`, `ConstraintHandler`, `BusinessProcess`, `Capability`, and `EventContract` are DomainSemantics resources. An `ownerRef` is the only allowed peer owner resource identity edge; it does not transfer ownership of the referenced resource's facts.

## Semantic owner references

`DomainPolicy@ownerKind`, `ConstraintHandler@ownerKind`, and `Operation@owner` use one target-kind contract:

| Owner kind | `ownerRef` presence | Required target kind |
| --- | --- | --- |
| `domain-context` | forbidden | the containing `Ontology` is the implicit owner |
| `business-object` | required | `BusinessObject` |
| `association` | required | `Association` |
| `lifecycle` | required | `StateMachine` |
| `constraint` | required | `ConstraintHandler` |
| `business-process` | required | `BusinessProcess` |
| `capability` | required | `Capability` |
| `raw` | optional | `ObjectType` only when a structured raw context is declared |

`business-object`, `association`, `constraint`, `business-process`, and `capability` always resolve to matching owner resource identities; an `ObjectType`, `Relation`, or `Rule` is not a valid fallback. `lifecycle` resolves to the `StateMachine` identity. A BusinessObject-local `Lifecycle` resource is an owned membership resource, not a replacement global lifecycle owner target.

## BusinessObject

BusinessObject is a manifest resource with an owned FS-native subtree, not a grouped `BusinessObjectCatalog` file. It directly declares identity/properties/computed properties and may own Action, Mutation, Interceptor, ComputedFunction, ConstraintHandler, and Lifecycle resources. See [business-object-resource.md](business-object-resource.md) for its tree, grammar, ownership closure, and `cozo-om` behavior projection boundary.

## AssociationCatalog

```xml
<AssociationCatalog fqn="ontology.maker-space.associations" id="MakerSpace.Associations">
  <Description>Workshop associations.</Description>
  <Associations>
    <Association id="MakerSpace.Association.ToolReservation" relationRef="MakerSpace.Relation.ReservesTool">
      <Description>Reservation to reserved tool.</Description>
    </Association>
  </Associations>
</AssociationCatalog>
```

- `AssociationCatalog` requires resource `fqn` and semantic `id`; children are optional `Description`, then exactly one `Associations`.
- `Association` requires FQN `id` and `relationRef`.
- `relationRef` resolves to a declared `Relation`.
- Optional `status` is `accepted|hypothesis`.
- Direct children are optional `Description`, optional `Evidences`, in that order.
- `Association` must not contain `from`, `to`, `fromTypeRef`, `toTypeRef`, `directed`, `min`, `max`, or relation `Property` declarations.

## DomainPolicyCatalog

```xml
<DomainPolicyCatalog fqn="ontology.maker-space.policies" id="MakerSpace.Policies">
  <Description>Workshop policy groupings.</Description>
  <DomainPolicies>
    <DomainPolicy id="MakerSpace.Policy.ReservationApproval" ownerKind="business-object" ownerRef="MakerSpace.Reservation">
      <Statement>Reservation approval follows certification and schedule rules.</Statement>
      <Rules>
        <Rule ref="MakerSpace.Rule.ToolRequiresCertification" />
      </Rules>
    </DomainPolicy>
  </DomainPolicies>
</DomainPolicyCatalog>
```

- `DomainPolicyCatalog` requires resource `fqn` and semantic `id`; children are optional `Description`, then exactly one `DomainPolicies`.
- `DomainPolicy` requires FQN `id` and `ownerKind`; `ownerRef` presence follows the shared semantic owner table.
- `ownerKind` is `domain-context|business-object|association|lifecycle|constraint|business-process|capability|raw`.
- `ownerRef` must resolve exactly as specified by the shared semantic owner table; validators must not substitute the structural fact referenced by the owner resource.
- Direct children are optional `Description`, exactly one `Statement`, optional `Rules`, optional `Evidences`, in that order.
- `Rules` contains `Rule ref="RuleFqn"` references.
- `DomainPolicy` groups DomainModel rules. It must not declare `When`, `Require`, `Violation`, predicate elements, or constraint-handler routing inline.

## ConstraintHandlerCatalog

```xml
<ConstraintHandlerCatalog fqn="ontology.maker-space.constraint-handlers" id="MakerSpace.ConstraintHandlers">
  <Description>Workshop enforcement responsibilities.</Description>
  <ConstraintHandlers>
    <ConstraintHandler id="MakerSpace.ConstraintHandler.ReservationApproval" ownerKind="business-object" ownerRef="MakerSpace.Reservation" portability="extension-point">
      <Statement>The runtime enforces reservation approval rules before state transition.</Statement>
      <Rules>
        <Rule ref="MakerSpace.Rule.ToolRequiresCertification" />
      </Rules>
    </ConstraintHandler>
  </ConstraintHandlers>
</ConstraintHandlerCatalog>
```

- `ConstraintHandlerCatalog` requires resource `fqn` and semantic `id`; children are optional `Description`, then exactly one `ConstraintHandlers`.
- `ConstraintHandler` requires FQN `id`, `ownerKind`, and `portability`; `ownerRef` presence and target kind follow the shared semantic owner table.
- `ownerKind` is `domain-context|business-object|association|lifecycle|constraint|business-process|capability|raw`.
- `portability` is `portable|extension-point|target-specific`.
- Direct children are optional `Description`, exactly one `Statement`, optional `Rules`, optional `Evidences`, in that order.
- `Rules` contains one or more `Rule ref="RuleFqn"` references.
- A handler may identify enforcement responsibility but must not copy rule predicates or embed callback/source code.

## BusinessProcessCatalog

```xml
<BusinessProcessCatalog fqn="ontology.maker-space.processes" id="MakerSpace.Processes">
  <Description>Workshop business processes.</Description>
  <BusinessProcesses>
    <BusinessProcess id="MakerSpace.BusinessProcess.ReserveTool">
      <Description>Member reserves and checks out a tool.</Description>
      <Participants>
        <Type ref="MakerSpace.Reservation" role="case" />
        <StateMachine ref="MakerSpace.Lifecycle.Reservation" role="workflow" />
      </Participants>
    </BusinessProcess>
  </BusinessProcesses>
</BusinessProcessCatalog>
```

- `BusinessProcessCatalog` requires resource `fqn` and semantic `id`; children are optional `Description`, then exactly one `BusinessProcesses`.
- `BusinessProcess` requires FQN `id`; optional `status` is `accepted|hypothesis`.
- Direct children are optional `Description`, exactly one `Participants`, optional `Policies`, optional `Evidences`, in that order.
- `Participants` contains `Type ref="..."` references to ObjectType or BusinessObject declarations, plus `Relation` or `StateMachine` references; each may have optional `role`.
- `Policies` contains `Rule ref="RuleFqn"` references. A `BusinessProcess` must not reference `DomainPolicy` as an alternate source of rule truth.

## CapabilityCatalog

```xml
<CapabilityCatalog fqn="ontology.maker-space.capabilities" id="MakerSpace.Capabilities">
  <Description>Workshop capability groupings.</Description>
  <Capabilities>
    <Capability id="MakerSpace.Capability.ReservationManagement">
      <Description>Manage reservations through typed inputs and outputs.</Description>
      <Inputs>
        <Type ref="MakerSpace.Reservation" />
      </Inputs>
    </Capability>
  </Capabilities>
</CapabilityCatalog>
```

- `CapabilityCatalog` requires resource `fqn` and semantic `id`; children are optional `Description`, then exactly one `Capabilities`.
- `Capability` requires FQN `id`; optional `status` is `accepted|hypothesis`.
- Direct children are optional `Description`, optional `Inputs`, optional `Outputs`, optional `Evidences`, in that order.
- `Inputs` and `Outputs` contain `Type ref="ObjectTypeOrBusinessObjectFqn"` references.
- Capability is a DomainSemantics grouping resource. It must not own type declarations or implementation bodies.

## EventContractCatalog

```xml
<EventContractCatalog fqn="ontology.maker-space.events" id="MakerSpace.Events">
  <Description>Workshop event contracts.</Description>
  <EventContracts>
    <EventContract id="MakerSpace.Event.ReservationApproved" eventTypeRef="MakerSpace.EventType.ReservationApproved">
      <Description>Published after reservation approval.</Description>
      <Subjects>
        <Type ref="MakerSpace.Reservation" />
      </Subjects>
    </EventContract>
  </EventContracts>
</EventContractCatalog>
```

- `EventContractCatalog` requires resource `fqn` and semantic `id`; children are optional `Description`, then exactly one `EventContracts`.
- `EventContract` requires FQN `id` and `eventTypeRef`.
- `eventTypeRef` resolves to a declared event payload `ObjectType`.
- Direct children are optional `Description`, optional `Subjects`, optional `Evidences`, in that order.
- `Subjects` contains `Type ref="..."` references to ObjectType or BusinessObject declarations, or `Relation` references.

## Shared rejection rules

Validators must reject non-BO DomainSemantics declarations that include structural facts such as relation endpoints/cardinality, rule predicates, lifecycle states/transitions, or executable routing bodies; BusinessObject property entries using `Property@ref`; references whose target kind does not match the container; owner refs inconsistent with the shared semantic owner target kind; executable code in explanatory text; and a DomainSemantics resource that claims execution support without a matching `Operation` and, when executable projection is required, a matching `RuntimeBinding`.
