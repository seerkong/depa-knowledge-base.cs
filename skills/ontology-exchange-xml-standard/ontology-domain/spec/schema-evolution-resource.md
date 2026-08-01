# Schema evolution resources

`SchemaEvolutionModule` owns compatibility aliases, declarative semantic migrations, and reproducible generation provenance. It does not redefine current semantic objects and does not contain executable migration code.

```xml
<SchemaEvolutionModule fqn="ontology.maker-space.evolution.v2" id="MakerSpace.Evolution.V2">
  <Description>Compatibility and provenance for semantic version 2.0.0.</Description>
  <Aliases>
    <Alias id="MakerSpace.Evolution.Alias.Booking" kind="business-object" from="MakerSpace.Booking" to="MakerSpace.Reservation" sinceVersion="2.0.0" />
  </Aliases>
  <Migrations>
    <Migration id="MakerSpace.Evolution.Migration.V1ToV2" fromVersion="1.4.0" toVersion="2.0.0" compatibility="breaking">
      <Description>Rename booking semantics to reservation semantics.</Description>
      <Changes>
        <Rename kind="business-object" from="MakerSpace.Booking" to="MakerSpace.Reservation" />
        <Alter kind="operation" targetRef="MakerSpace.Operation.ApproveReservation" aspect="operation-dimensions" />
      </Changes>
    </Migration>
  </Migrations>
</SchemaEvolutionModule>
```

## Module grammar

- `SchemaEvolutionModule` requires resource `fqn` and semantic `id`.
- Direct children are optional `Description`, optional `Aliases`, optional `Migrations`, and optional `GenerationSnapshots`, in that order.
- At least one of the three containers is required.
- A bundle contains at most one `SchemaEvolutionModule`.
- The module may reference declarations and evidence from the fully resolved bundle.
- It must not duplicate current declarations from ObjectType, Relation, Rule, Lifecycle, profile, Operation, Evidence, Binding, or Mapping resources.

## Alias grammar

- `Aliases` contains one or more `Alias` declarations.
- `Alias` requires FQN `id`, `kind`, `from`, `to`, and `sinceVersion`.
- Optional attributes are `untilVersion` and `status`.
- `status` is `accepted|hypothesis`.
- `kind` is `object-type|mixin|property|relation|rule|state-machine|transition|business-object|association|domain-policy|constraint-handler|business-process|capability|event-contract|operation|runtime-binding|implementation-mapping|local-name`.
- For all FQN kinds, `from` and `to` are FQNs and `ownerRef` is forbidden.
- For `local-name`, `from` and `to` are local names and `ownerRef` is required; `ownerRef` resolves to the owning current declaration.
- Direct children are optional `Description`, then optional `Evidences`.
- `to` must resolve to a current canonical declaration of the declared kind. `from` is a compatibility identity and may be absent from the current bundle.
- Self aliases, alias cycles, duplicate `kind+ownerRef+from` sources, conflicting targets, and kind mismatches are invalid.

## Migration grammar

- `Migrations` contains one or more `Migration` declarations.
- `Migration` requires FQN `id`, `fromVersion`, `toVersion`, and `compatibility`.
- `compatibility` is `backward-compatible|breaking`.
- Optional `status` is `accepted|hypothesis`.
- Version endpoints use the same semantic-version token vocabulary as `Ontology@version`, differ from each other, and form an acyclic migration graph.
- `toVersion` equals the containing root `Ontology@version`.
- Direct children are optional `Description`, exactly one `Changes`, then optional `Evidences`.
- `Changes` contains one or more typed operations: `Add`, `Remove`, `Rename`, or `Alter`.
- `Add` and `Remove` require `kind` and `targetRef`.
- `Rename` requires `kind`, `from`, and `to`.
- `Alter` requires `kind`, `targetRef`, and `aspect`.
- `kind` uses the same vocabulary as `Alias@kind`, except `local-name` is not allowed for `Add` or `Remove`.
- For the current bundle, `Add@targetRef`, `Rename@to`, and `Alter@targetRef` resolve to current declarations of the stated kind.
- Historical `Remove@targetRef` and `Rename@from` names may be absent from the current graph but must be well-formed and consistent with aliases when an alias exists.
- `Alter@aspect` is a bounded descriptor such as `requiredness`, `cardinality`, `type-ref`, `predicate`, `state`, `transition`, `operation-dimensions`, `request-schema`, `effect`, `atomicity`, `binding-target`, or `evidence-grade`.

A Migration is a declarative semantic change plan. It must not contain scripts, callbacks, query text, host-language bodies, entity data, arbitrary transformation expressions, or request execution instructions.

## Generation snapshot grammar

- `GenerationSnapshots` contains one or more `GenerationSnapshot` declarations.
- `GenerationSnapshot` requires unique namespaced `id`, `ontologyVersion`, RFC 3339 `generatedAt`, and non-empty `generator`.
- Optional `generatorVersion` identifies the generator release.
- `ontologyVersion` must equal the containing root `Ontology@version`.
- Direct children are exactly one `SourceRevisions`, then exactly one `OutputDigest`.
- `SourceRevisions` contains one or more `SourceRevision` entries with unique stable `repository` keys and immutable non-empty `revision` values.
- `OutputDigest` requires `algorithm="sha256"` and a lowercase 64-hex `value`.
- The digest covers normalized semantic IR and excludes generation-provenance metadata itself.
- Generation snapshots do not use `Evidences`: they are provenance records, not semantic interpretations.

## Rejection rules

Validators must reject migration operations whose target kind does not match `kind`; aliases that point to missing current declarations; alias cycles, self aliases, and conflicting aliases; migrations whose `toVersion` differs from root `Ontology@version`; scripts, SQL, CozoScript, host-language code, entity data, or opaque transformation expressions inside migrations; and generation snapshots whose digest is not lowercase sha256 or whose `ontologyVersion` differs from the root.
