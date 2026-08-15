# Implementation mapping resources

`ImplementationMappingCatalog` connects ontology meaning to observed implementation facts. It does not turn DTOs, pages, tables, framework roles, or handler keys into domain types.

```xml
<ImplementationMappingCatalog fqn="ontology.maker-space.mappings" id="MakerSpace.Mappings">
  <Description>Implementation crosswalks for maker-space semantics.</Description>
  <Mappings>
    <ImplementationMapping id="MakerSpace.Mapping.ReservationDto" targetKind="business-object" targetRef="MakerSpace.Reservation" status="accepted">
      <RepresentedBy>
        <CodeRef repository="maker-space-api" language="typescript" kind="dto" symbol="ReservationDto" />
      </RepresentedBy>
      <ImplementedBy>
        <CodeRef repository="maker-space-api" language="typescript" kind="service" symbol="ReservationService" />
      </ImplementedBy>
      <Enforces>
        <Rule ref="MakerSpace.Rule.ToolRequiresCertification" />
      </Enforces>
    </ImplementationMapping>
  </Mappings>
</ImplementationMappingCatalog>
```

## Grammar

- `ImplementationMappingCatalog` requires resource `fqn` and semantic `id`.
- Direct children are optional `Description`, then exactly one `Mappings`.
- `Mappings` contains one or more `ImplementationMapping` declarations.
- `ImplementationMapping` requires FQN `id`, `targetKind`, and `targetRef`.
- `targetKind` is `class|field|relation-def|rule|state-machine|transition|business-object|association|domain-policy|constraint-handler|business-process|capability|event-contract|operation|runtime-binding`.
- `targetRef` resolves to the declaration kind named by `targetKind`.
- Owner-level concepts use matching mapping target kinds: `business-object` -> `BusinessObject`, `association` -> `Association`, `constraint-handler` -> `ConstraintHandler`, `business-process` -> `BusinessProcess`, `capability` -> `Capability`, and `state-machine` -> lifecycle `StateMachine`.
- A mapping whose `targetKind` is `class`, `relation-def`, or `rule` describes that DomainModel declaration only. It must not be interpreted as a mapping for a `business-object`, `association`, or constraint owner that references the lower declaration.
- `ImplementationMapping` does not allow `owner`, `ownerKind`, or `ownerRef`; ownership remains on the directly referenced semantic declaration.
- Optional `status` is `accepted|hypothesis`.
- Direct children are optional `Description`, optional `RepresentedBy`, optional `ImplementedBy`, optional `PresentedBy`, optional `StoredBy`, optional `ExposedBy`, optional `Enforces`, optional `Evidences`, in that order.
- Each role collection contains one or more `CodeRef` entries.
- `Enforces` contains one or more `Rule ref="RuleFqn"` entries.
- Accepted mappings require evidence; inferred mapping evidence retains its grade and confidence.

## CodeRef

`CodeRef` requires stable `repository`, normalized `language`, bounded `kind`, and stable `symbol`. Optional fields are `path`, `resolver`, and `confidence`. A Spring-derived role remains implementation evidence; the mapping is the explicit interpretation boundary.

## Boundary rules

- A mapping may connect one target semantic declaration to many code refs.
- Multiple mappings may target one semantic declaration when each mapping has distinct implementation evidence.
- Mapping target facts remain owned by their semantic resources.
- Mapping role collections do not imply enforcement unless `Enforces` names a `Rule` and evidence supports that claim.
- Runtime handler registry keys may appear as observed symbols, but executable binding support belongs in `RuntimeBindingCatalog`.

## Rejection rules

Validators must reject mappings whose `targetRef` kind does not match `targetKind`; mappings that declare owner dimensions or use a structural target kind as a surrogate for an owner resource; unsafe `CodeRef` values; inline semantic declarations; `Enforces` refs that point to non-Rule declarations; and mappings that reference or depend on `depa_*` objects.
