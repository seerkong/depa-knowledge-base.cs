# Rule resources

`Rule` is a lower mechanism manifest resource. It owns declarative predicates and violations. It does not own policy grouping, constraint handler routing, runtime callbacks, or host-language bodies.

```xml
<Rule fqn="ontology.maker-space.rules.tool-requires-certification" id="MakerSpace.Rule.ToolRequiresCertification" scopeTypeRef="MakerSpace.Reservation" kind="cross-entity">
  <Statement>An approved tool reservation must be for a certified member.</Statement>
  <When>
    <PropertyEquals propertyRef="MakerSpace.Reservation#workflowState" value="approved" />
  </When>
  <Require>
    <EveryRelated relationRef="MakerSpace.Relation.RequestedBy">
      <PropertyEquals propertyRef="MakerSpace.Member#certificationState" value="certified" />
    </EveryRelated>
  </Require>
  <Violation code="MEMBER_NOT_CERTIFIED" message="Member is not certified for the requested tool." />
</Rule>
```

## Rule grammar

- `Rule` requires resource `fqn`, semantic `id`, `scopeTypeRef`, and `kind`.
- `scopeTypeRef` resolves to a declared entity `ObjectType` or `BusinessObject`.
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

### Property predicates

```xml
<PropertyPresent propertyRef="MakerSpace.Reservation#reservationNumber" />
<PropertyEquals propertyRef="MakerSpace.Reservation#workflowState" value="approved" />
<PropertyNotEquals propertyRef="MakerSpace.Reservation#workflowState" value="cancelled" />
<PropertyIn propertyRef="MakerSpace.Tool#toolState">
  <Value value="available" />
  <Value value="maintenance" />
</PropertyIn>
<PropertyCompare propertyRef="MakerSpace.Reservation#startTime" op="lt" otherPropertyRef="MakerSpace.Reservation#endTime" />
```

- `propertyRef` resolves to a declared `Property` available in the current predicate context.
- A property is available in the current predicate context when it is declared by the context `ObjectType` or `BusinessObject`, one of its transitive parent types, or one of its transitively composed mixins. A nested relation predicate uses its target-entity context.
- `PropertyCompare` requires `propertyRef` and `op`, permits only the conditional RHS attributes `value` and `otherPropertyRef`, and has no child elements or text content.
- Exactly one of `value` and `otherPropertyRef` is required. They are mutually exclusive.
- `PropertyCompare@op` is `lt|lte|gt|gte`.
- Normalize each operand type before comparison. The orderable normalized bases are `builtin:Number`, `builtin:Decimal`, and `builtin:DateTime`.
- With `otherPropertyRef`, the referenced RHS must resolve to a `Property` available in the same current predicate context as `propertyRef`. Both normalized bases must be identical.
- With `value`, constant conversion must succeed through the normalized LHS base. `value` is literal data only; it cannot name another property, contain interpolation, or encode an expression.

### Type and relation predicates

```xml
<TypeIs typeRef="MakerSpace.Reservation" />
<RelatedExists relationRef="MakerSpace.Relation.ReservesTool">
  <TypeIs typeRef="MakerSpace.Tool" />
</RelatedExists>
<EveryRelated relationRef="MakerSpace.Relation.RequestedBy">
  <PropertyEquals propertyRef="MakerSpace.Member#certificationState" value="certified" />
</EveryRelated>
<RelatedCount relationRef="MakerSpace.Relation.ReservesTool" op="eq" value="1" />
```

- `typeRef` resolves to a declared entity `ObjectType` or `BusinessObject`.
- `relationRef` resolves to a declared `Relation` whose endpoint is compatible with the current predicate context.
- `RelatedExists` and `EveryRelated` contain exactly one predicate evaluated in target-entity context.
- `RelatedCount@op` is `eq|neq|lt|lte|gt|gte`; `value` is a non-negative integer.

### Existential predicate

```xml
<ExistsRelated relationRef="MakerSpace.Relation.ReservesTool" direction="out" targetTypeRef="MakerSpace.Tool" />
```

- `direction` is `out|in`.
- `targetTypeRef` resolves to a declared entity `ObjectType` or `BusinessObject`.
- The relation endpoint for the chosen direction must be compatible with `scopeTypeRef`.

## Rejection rules

Validators must reject predicates encoded as strings, scripts, SQL, CozoScript, JavaScript, TypeScript, or C#; rules that reference non-entity DomainSemantics resources or implementation symbols to define predicates; missing `Violation`; property or relation refs incompatible with the predicate context; invalid `PropertyCompare` operands; and `custom` rules that omit evidence or claim executable behavior without an external binding resource.
