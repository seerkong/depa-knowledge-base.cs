# Rule resources

`Rule` is a lower mechanism manifest resource. It owns declarative predicates and violations. It does not own policy grouping, constraint handler routing, runtime callbacks, or host-language bodies.

```xml
<Rule fqn="ontology.maker-space.rules.tool-requires-certification" id="MakerSpace.Rule.ToolRequiresCertification" scopeTypeRef="MakerSpace.Reservation" kind="cross-entity">
  <Statement>An approved tool reservation must be for a certified member.</Statement>
  <When>
    <FieldEquals fieldRef="MakerSpace.Reservation#workflowState" value="approved" />
  </When>
  <Require>
    <EveryRelated relationDefRef="MakerSpace.RelationDef.RequestedBy">
      <FieldEquals fieldRef="MakerSpace.Member#certificationState" value="certified" />
    </EveryRelated>
  </Require>
  <Violation code="MEMBER_NOT_CERTIFIED" message="Member is not certified for the requested tool." />
</Rule>
```

## Rule grammar

- `Rule` requires resource `fqn`, semantic `id`, `scopeTypeRef`, and `kind`.
- `scopeTypeRef` resolves to a declared entity `Class` or `BusinessObject`.
- `kind` is `conditional|cross-entity|computed-dependency|existential|uniqueness|cardinality|custom`.
- Optional `status` is `accepted|hypothesis`.
- Direct children are exactly one `Statement`, optional `When`, exactly one `Require`, exactly one `Violation`, optional `Evidences`, in that order.
- `Statement` is non-empty plain text. It explains but does not execute the rule.
- `When` contains exactly one predicate. Missing `When` means unconditional.
- `Require` contains exactly one predicate.
- `Violation` requires non-empty `code` and `message`, with no children.
- Accepted rules require evidence unless their source is an explicitly designated ontology policy file represented by an evidence item.
- `custom` may describe a rule that the standard predicate vocabulary cannot fully express, but the XML rule still cannot contain code. Runtime enforcement is declared by `ConstraintHandler`, `Operation`, and `RuntimeBinding` resources that reference the rule.

## Predicate vocabulary

Every predicate is a typed XML element. Do not use expression strings.

### Boolean composition

```xml
<All>predicate predicate...</All>
<Any>predicate predicate...</Any>
<Not>predicate</Not>
```

- `All` and `Any` contain at least two predicates.
- `Not` contains exactly one predicate.

### Field predicates

```xml
<FieldPresent fieldRef="MakerSpace.Reservation#reservationNumber" />
<FieldEquals fieldRef="MakerSpace.Reservation#workflowState" value="approved" />
<FieldNotEquals fieldRef="MakerSpace.Reservation#workflowState" value="cancelled" />
<FieldIn fieldRef="MakerSpace.Tool#toolState">
  <Value value="available" />
  <Value value="maintenance" />
</FieldIn>
<FieldCompare fieldRef="MakerSpace.Reservation#startTime" op="lt" otherFieldRef="MakerSpace.Reservation#endTime" />
```

- `fieldRef` resolves to a declared `Field` available in the current predicate context.
- A field is available in the current predicate context when it is declared by the context `Class` or `BusinessObject`, one of its transitive parent classes, or one of its transitively composed mixins. A nested relation-def predicate uses its target-entity context.
- `FieldCompare` requires `fieldRef` and `op`, permits only the conditional RHS fields `value` and `otherFieldRef`, and has no child elements or text content.
- Exactly one of `value` and `otherFieldRef` is required. They are mutually exclusive.
- `FieldCompare@op` is `lt|lte|gt|gte`.
- Normalize each operand type before comparison. The orderable normalized bases are `builtin:Number`, `builtin:Decimal`, and `builtin:DateTime`.
- With `otherFieldRef`, the referenced RHS must resolve to a `Field` available in the same current predicate context as `fieldRef`. Both normalized bases must be identical.
- With `value`, constant conversion must succeed through the normalized LHS base. `value` is literal data only; it cannot name another field, contain interpolation, or encode an expression.

### Type and relation-def predicates

```xml
<TypeIs typeRef="MakerSpace.Reservation" />
<RelatedExists relationDefRef="MakerSpace.RelationDef.ReservesTool">
  <TypeIs typeRef="MakerSpace.Tool" />
</RelatedExists>
<EveryRelated relationDefRef="MakerSpace.RelationDef.RequestedBy">
  <FieldEquals fieldRef="MakerSpace.Member#certificationState" value="certified" />
</EveryRelated>
<RelatedCount relationDefRef="MakerSpace.RelationDef.ReservesTool" op="eq" value="1" />
```

- `typeRef` resolves to a declared entity `Class` or `BusinessObject`.
- `relationDefRef` resolves to a declared `RelationDef` whose endpoint is compatible with the current predicate context.
- `RelatedExists` and `EveryRelated` contain exactly one predicate evaluated in target-entity context.
- `RelatedCount@op` is `eq|neq|lt|lte|gt|gte`; `value` is a non-negative integer.

### Existential predicate

```xml
<ExistsRelated relationDefRef="MakerSpace.RelationDef.ReservesTool" direction="out" targetTypeRef="MakerSpace.Tool" />
```

- `direction` is `out|in`.
- `targetTypeRef` resolves to a declared entity `Class` or `BusinessObject`.
- The relation-def endpoint for the chosen direction must be compatible with `scopeTypeRef`.

## Rejection rules

Validators must reject predicates encoded as strings, scripts, SQL, CozoScript, JavaScript, TypeScript, or C#; rules that reference non-entity DomainSemantics resources or implementation symbols to define predicates; missing `Violation`; field or relation-def refs incompatible with the predicate context; invalid `FieldCompare` operands; and `custom` rules that omit evidence or claim executable behavior without an external binding resource.
