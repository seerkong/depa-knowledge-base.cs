# Evidence resources

`EvidenceCatalog` owns observation provenance and direct material. It does not decide business meaning.

```xml
<EvidenceCatalog fqn="ontology.maker-space.evidence" id="MakerSpace.Evidence">
  <Description>Evidence used by the maker-space ontology.</Description>
  <Evidences>
    <Evidence id="backend:reservation-approval-policy" source="code" repository="maker-space-api" revision="a1b2c3d" path="src/reservations/approval.ts" symbol="reservation.approve" lines="20-48" grade="enforced" resolver="treesitter" confidence="1.0"><![CDATA[
The service rejects approval when a member lacks required certification.
]]></Evidence>
  </Evidences>
</EvidenceCatalog>
```

## Catalog grammar

- `EvidenceCatalog` requires resource `fqn` and semantic `id`.
- Direct children are optional `Description`, then exactly one `Evidences`.
- `Evidences` contains one or more `Evidence` declarations.

## Evidence grammar

- `Evidence` requires unique namespaced `id`, `source`, `grade`, and `confidence`.
- `source` is `code|database-investigation|document|api-contract|ui|decision|manual|generated`.
- Optional fields are `repository`, `revision`, `artifact`, `path`, `symbol`, `lines`, `resolver`, `observedAt`, `sourceKind`, and `externalId`.
- At least one locator is required: `repository+path`, `artifact`, `externalId`, or `source="manual"` with `resolver="manual"`.
- `path` is repository-relative with forward slashes. Reject absolute paths and `..` segments.
- `lines` is either one positive integer or `start-end` where `end >= start`.
- `confidence` is a decimal in `[0,1]`.
- `grade` is `authoritative|enforced|contractual|presentational|inferred`.
- `resolver` names the producing mechanism, for example `treesitter`, `roslyn`, `spring-deriver`, `regex`, `sql-schema`, `manual`, or `llm`.
- The direct text node is the revision-pinned code excerpt, document excerpt, saved read-only investigation result, or decision material. CDATA is allowed.
- Whitespace normalization is projection-specific; validators must preserve material text for hashing and review.
- `Evidence` has no child elements.

## EvidenceRef contract

Semantic resources use plural `Evidences` containers with singular `Evidence ref="evidence-id"` references. A ref must resolve to exactly one `Evidence` in the fully assembled bundle.

Evidence-bearing semantic objects include Class, value-kind, Mixin, Field, ComputedProp, RelationDef, RelationLink Field, Rule, StateMachine, Transition, Derivation, BusinessObject, Association, DomainPolicy, ConstraintHandler, BusinessProcess, Capability, EventContract, Operation, InvocationPreset, RuntimeBinding, ImplementationMapping, Alias, and Migration.

An accepted interpreted object requires evidence appropriate to the strength of its claim. A hypothesis requires at least one direct or owner-scoped evidence item with `grade="inferred"` and remains non-enforcing by default.

## Material rules

- Evidence material is not a label. It must contain enough direct observed content or saved investigation material to let a reviewer understand what was observed.
- Do not use wrappers such as `Materials`, `Content`, `Findings`, `Document`, `Code`, `Summary`, or `Excerpt` inside `Evidence`.
- Do not put business interpretation, rule meaning, or ontology declarations in `Evidence`; put those in semantic resources and cite evidence.
- Large materials may be shortened only when the retained text is still revision-pinned and enough for review. Use `artifact` or `externalId` to locate larger immutable material.

## Rejection rules

Validators must reject evidence IDs that collide with semantic FQNs; invalid grade values; confidence outside `[0,1]`; absolute paths, traversal paths, or mutable local filesystem paths; child elements inside `Evidence`; wrapper nodes inside `Evidence`; and semantic resources that use `EvidenceRefs` instead of latest `Evidences/Evidence ref` containers.
