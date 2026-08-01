# Lifecycle resources

`StateMachine` is a DomainModel mechanism manifest resource. It owns state-machine meaning independently from BusinessObject local lifecycle membership, controller methods, UI pages, event handlers, and operation handlers.

```xml
<StateMachine fqn="ontology.maker-space.lifecycles.reservation" id="MakerSpace.Lifecycle.Reservation" subjectTypeRef="MakerSpace.Reservation" statePropertyRef="MakerSpace.Reservation#workflowState" initial="draft">
  <Description>Core reservation lifecycle.</Description>
  <States>
    <State id="draft" />
    <State id="approved" />
    <State id="checkedOut" />
    <State id="closed" terminal="true" />
  </States>
  <Transitions>
    <Transition id="MakerSpace.Transition.ApproveReservation" trigger="approveReservation" from="draft" to="approved">
      <Guard>
        <PropertyEquals propertyRef="MakerSpace.Reservation#workflowState" value="draft" />
      </Guard>
      <Effects>
        <SetProperty propertyRef="MakerSpace.Reservation#workflowState" value="approved" />
      </Effects>
    </Transition>
  </Transitions>
</StateMachine>
```

## Grammar

- `StateMachine` requires resource `fqn`, semantic `id`, `subjectTypeRef`, `statePropertyRef`, and local `initial` state ID.
- `subjectTypeRef` resolves to a declared entity `ObjectType` or `BusinessObject`.
- `statePropertyRef` resolves to a declared `Property` on the subject type, BusinessObject, inherited parent, or composed mixins.
- Optional `status` is `accepted|hypothesis`.
- Direct children are optional `Description`, exactly one `States`, optional `Derivations`, exactly one `Transitions`, optional `Evidences`, in that order.
- `initial` must name a declared state.
- Accepted and hypothesis state machines require evidence coverage.

## State grammar

- `State` requires unique local `id`.
- Optional `terminal` is `true|false`.
- Optional `status` is `accepted|hypothesis`.
- Direct children are optional `Description`.
- State IDs are local to one `StateMachine`; transition and derivation refs use the local ID inside that machine.

## Derivation grammar

- `Derivations` contains one or more `Derivation` declarations.
- `Derivation` requires FQN `id`.
- Optional `status` is `accepted|hypothesis`.
- Direct children are optional `Description`, exactly one `Statement`, optional `When`, exactly one `Yields`, optional `Evidences`, in that order.
- `When` contains exactly one predicate from the rule predicate vocabulary. Missing `When` means unconditional derivation.
- `Yields@state` names a declared local state.
- `Derivation` is declarative. It must not contain source code, query text, callback bodies, or target-platform execution instructions.

## Transition grammar

- `Transition` requires FQN `id`, lowerCamelCase `trigger`, and declared local `from` and `to` state IDs.
- Optional `status` is `accepted|hypothesis`.
- Direct children are optional `Description`, optional `Guard`, optional `Effects`, optional `Evidences`, in that order.
- `Guard` contains exactly one predicate from the rule predicate vocabulary.
- `Effects` contains one or more declarative effects.
- Accepted transitions require evidence. Hypothesis transitions are not projected as executable actions by default.
- A transition does not own an `Operation`; an `Operation` with `owner="lifecycle"` and `behavior="transition"` may reference this transition.

## Effect vocabulary

```xml
<SetProperty propertyRef="MakerSpace.Reservation#workflowState" value="approved" />
<ClearProperty propertyRef="MakerSpace.Reservation#holdReason" />
<CreateRelation relationRef="MakerSpace.Relation.ReservesTool" targetRef="subject.requestedTool" />
<RemoveRelation relationRef="MakerSpace.Relation.ReservesTool" targetRef="transition.previousTool" />
```

- `SetProperty` and `ClearProperty` require `propertyRef` compatible with `subjectTypeRef`.
- `CreateRelation` and `RemoveRelation` require `relationRef`; the relation endpoint must be compatible with the state machine subject.
- `targetRef` is a declarative projection reference whose supported vocabulary must be defined by the consuming compiler. It is not an executable expression.
- Event publication is modeled by a DomainSemantics `EventContract` resource and/or an `Operation` that references this state machine or transition. `StateMachine` must not reference `EventContract` directly.

Semantic validation checks duplicate transitions, missing states, unreachable states from `initial`, terminal states with outgoing transitions, impossible guards, and effects inconsistent with the destination state.

## Rejection rules

Validators must reject lifecycle declarations nested under `BusinessObject` when they attempt to define a state machine inline instead of referencing a `StateMachine` resource; `statePropertyRef` that does not resolve to a declared property on the subject type; transition `trigger` values used as executable handler names without an `Operation` and `RuntimeBinding`; and effects that contain scripts, SQL, arbitrary expression strings, or runtime data mutations not represented by the typed effect vocabulary.
