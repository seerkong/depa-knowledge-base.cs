# Operation catalog resources

`OperationCatalog` sits above TypeSystem, DomainModel, and DomainSemantics declarations. It defines callable semantics for operations, mutations, queries, transitions, validation, computed values, composed operations, and raw operations. It does not own class structure, relation-def endpoints, rule predicates, lifecycle state machines, runtime implementation bodies, or execution state.

`InvocationPreset/RequestJson` stores one complete `ExecuteOperationRequest v1`. The parsed object is the workbench preview and is posted unchanged to the execute endpoint. There is no second implicit request model.

## Operation grammar

```xml
<OperationCatalog fqn="ontology.maker-space.operations" id="MakerSpace.Operations">
  <Description>Callable workshop operation definitions.</Description>
  <Operations>
    <Operation id="MakerSpace.Operation.ApproveReservation" verb="ApproveReservation" owner="business-object" ownerRef="MakerSpace.Reservation" behavior="transition" subject="single" invocation="single" effect="write">
      <Capabilities>
        <Atomicity value="atomic" />
        <Observation value="before" />
        <Observation value="after" />
      </Capabilities>
    </Operation>
  </Operations>
</OperationCatalog>
```

- `OperationCatalog` requires resource `fqn` and semantic `id`.
- Direct children are optional `Description`, exactly one `Operations`, optional `InvocationPresets`, in that order.
- `Operations` contains one or more `Operation` declarations.
- `Operation` requires FQN `id`, lowerCamelCase or PascalCase `verb`, `owner`, `behavior`, `subject`, `invocation`, and `effect`.
- `owner` is `domain-context|business-object|association|lifecycle|constraint|business-process|capability|raw`.
- `behavior` is `operation|mutation|query|transition|validate|computed|composed|raw`.
- `subject` is `none|single|selection`.
- `invocation` is `single|batch`.
- `effect` is `read-only|write|mixed`.
- Optional `status` is `accepted|hypothesis`.
- `Operation@atomicity` is not part of the latest grammar. Atomicity support is a set under `Capabilities`; one request chooses one value under `execution.atomicity`.
- `ownerRef` presence and target kind follow the shared semantic owner reference table in [../std/naming-and-references.md](../std/naming-and-references.md).
- Domain owner refs must resolve to their matching resource identities. `Class` is not a fallback for `business-object`, `RelationDef` is not a fallback for `association`, and `Rule` is not a fallback for `constraint`.
- `lifecycle` resolves only to `StateMachine`; a lifecycle-bearing `BusinessObject` or its subject `Class` is not the lifecycle owner identity.
- `subjectTypeRef` is forbidden when `subject="none"` and required when `subject="single"` or `subject="selection"`.
- `subjectTypeRef` resolves to an entity `Class` or `BusinessObject`; `inputTypeRef` and `outputTypeRef` resolve to built-in or declared type expressions.
- Direct children are optional `Description`, optional `Purpose`, optional `InternalLogic`, optional `Composition`, optional `Constraints`, exactly one `Capabilities`, optional `Evidences`, in that order.
- `InternalLogic` is non-empty plain text for readers and target implementers. It is not executable pseudocode, source code, query text, a handler key, or a code-generation input.
- `Composition` contains one or more `Operation ref="OperationFqn"` references.
- `Constraints` contains one or more `Rule ref="RuleFqn"` references that must be satisfied before or during execution.
- `Operation` must not contain `RuntimeBinding`, implementation symbols, source code, SQL, handler module paths, execution choices, or execution results.

## Definition capability grammar

`Operation/Capabilities` is the semantic definition's requestable capability set:

```xml
<Capabilities>
  <Atomicity value="atomic" />
  <Atomicity value="best-effort" />
  <Observation value="before" />
  <Observation value="after" />
  <Observation value="diff" />
  <Observation value="trace" />
  <Observation value="plan" />
</Capabilities>
```

- `Capabilities` contains one or more `Atomicity` children followed by zero or more `Observation` children. No other child kind is allowed on an `Operation`.
- `Atomicity@value` is `atomic|best-effort`.
- `Observation@value` is `before|after|diff|trace|plan`.
- Values have set semantics. Duplicate values are invalid; source order does not create preference.
- At least one atomicity value is required. The observation set may be empty.
- There is no default, preferred, or inferred atomicity.
- Project these sets to `OperationDefinition.capabilities.atomicity` and `OperationDefinition.capabilities.observations`.
- These sets define what callers may request. Actual support belongs to `RuntimeBinding`; the server capability gate evaluates the selected execution against the definition, selected binding, and current server capabilities.

`atomic` requests one all-or-nothing request boundary. `best-effort` permits independently reported failures and never means that an `atomic` request may be silently degraded.

## Five dimensions

- `owner` answers who owns the operation's domain meaning.
- `behavior` answers what behavior it represents: `operation|mutation|query|transition|validate|computed|composed|raw`.
- `subject` answers what one logical invocation targets: `none|single|selection`.
- `invocation` answers whether a request contains one invocation or multiple keyed invocations: `single|batch`.
- `effect` answers whether persistent facts are read only, written, or both: `read-only|write|mixed`.

`selection` is one selector-defined logical subject. `batch` is multiple independent keyed invocation items. A batch item has the subject kind declared by the operation; this does not introduce another subject dimension.

## XML-to-request mapping

The request repeats the semantic declaration so the server can detect stale or forged previews. Values must match exactly:

| XML definition | `request.operation` |
| --- | --- |
| `Operation@id` | `ref` |
| `Operation@owner` | `ownerKind` |
| `Operation@ownerRef` | `ownerRef`, with identical presence and value |
| `Operation@behavior` | `behaviorKind` |
| `Operation@subject` | `subjectKind` |
| `Operation@invocation` | `invocationMode` |
| `Operation@effect` | `effect` |

`Operation@verb` maps to `request.invocation.verb` for a single request and to every batch item's `verb`. Type refs and capability sets remain catalog facts and are validated against request subjects, payloads, and execution choices; they are not copied into `request.operation`.

## ExecuteOperationRequest v1

`RequestJson` must parse as one JSON object with exactly these five top-level members:

```text
apiVersion
context
operation
invocation
execution
```

The former simplified top-level members `operationRef`, `mode`, `verb`, `subject`, `items`, and `atomicity` are forbidden. A preview must not be normalized into another hidden request before POST.

### Envelope

- `apiVersion` is required and equals the string `"1"`.
- `context` contains exactly non-empty string `id` and `version`; both equal the assembled `Ontology@id` and `Ontology@version`.
- `operation` contains exactly `ref`, conditional `ownerRef`, `ownerKind`, `behaviorKind`, `subjectKind`, `invocationMode`, and `effect`.
- `operation.ref` equals both `InvocationPreset@operationRef` and the referenced `Operation@id`.
- Every `operation` dimension and `ownerRef` matches XML exactly.
- `invocation` is discriminated by `mode`.
- `execution` contains exactly `atomicity` and `observe`.

### Invocation

For `invocation.mode="single"`:

- `invocation` contains exactly `mode`, `subject`, `verb`, and `payload`; `items` is forbidden.
- `mode` equals `Operation@invocation` and therefore requires `Operation@invocation="single"`.
- `subject` is required and its `kind` equals `Operation@subject`.
- `verb` is a non-empty string equal to `Operation@verb`.
- `payload` is required even when the operation has no parameters. Use `{}` for a no-parameter invocation.

For `invocation.mode="batch"`:

- `invocation` contains exactly `mode` and `items`; top-level `subject`, `verb`, and `payload` inside `invocation` are forbidden.
- `mode` equals `Operation@invocation` and therefore requires `Operation@invocation="batch"`.
- `items` is a non-empty array.
- Every item contains exactly non-empty string `key`, `subject`, non-empty string `verb`, and required JSON `payload`.
- Item keys are unique within the request.
- Every item `subject.kind` equals `Operation@subject`.
- Every item `verb` equals `Operation@verb`.
- Each payload is validated independently against `inputTypeRef` when an input schema is declared.

For both modes, a present `inputTypeRef` constrains payload JSON. Payload remains present even when it is `{}`, `null`, an array, or a scalar.

### Subject

- `{ "kind": "none" }` has exactly `kind` and is valid only for `Operation@subject="none"`.
- `{ "kind": "single", "ref": { "type": "...", "id": "..." } }` requires non-empty `type` and `id`; `ref.type` equals or is assignable to `Operation@subjectTypeRef`.
- `{ "kind": "selection", "selector": ... }` is valid only for `Operation@subject="selection"`.
- Selector shape is exactly one of `{ "kind": "all" }`, `{ "kind": "ids", "ids": [...] }`, or `{ "kind": "filter", "where": { ... } }`.
- Every `ids` item is a subject ref compatible with `Operation@subjectTypeRef`.
- `filter.where` is a JSON object containing declarative request data, never executable expressions, SQL, CozoScript, callbacks, functions, or module paths.

### Execution

- `execution.atomicity` is required and is `atomic|best-effort`.
- The selected atomicity belongs to the referenced Operation's requestable atomicity set.
- `execution.observe` is a required array containing only `before|after|diff|trace|plan`.
- Observation values are unique and form a subset of the Operation's requestable observation set.
- Empty `observe` is allowed. There is no default atomicity and no implicit observation channel.
- Static preset validation checks the Operation definition. Before execution, the server also requires the selected runtime binding and current server capabilities to support the selected atomicity and every requested observation channel.
- Unsupported choices fail with a capability diagnostic. The server must not replace `atomic` with `best-effort`, remove observation channels, or mutate the posted request.

## Request examples

Selection remains `invocation.mode="single"` because it is one logical invocation:

```json
{
  "apiVersion": "1",
  "context": { "id": "MakerSpace.Ontology", "version": "1.0.0" },
  "operation": {
    "ref": "MakerSpace.Operation.ExpireReservations",
    "ownerKind": "business-object",
    "ownerRef": "MakerSpace.Reservation",
    "behaviorKind": "mutation",
    "subjectKind": "selection",
    "invocationMode": "single",
    "effect": "write"
  },
  "invocation": {
    "mode": "single",
    "subject": {
      "kind": "selection",
      "selector": { "kind": "filter", "where": { "workflowState": "approved", "endedBefore": "2026-07-31T00:00:00Z" } }
    },
    "verb": "ExpireReservations",
    "payload": { "closedBy": "scheduler" }
  },
  "execution": { "atomicity": "atomic", "observe": ["before", "after", "diff"] }
}
```

A batch definition with `subject="single"` carries one single subject per item:

```json
{
  "apiVersion": "1",
  "context": { "id": "MakerSpace.Ontology", "version": "1.0.0" },
  "operation": {
    "ref": "MakerSpace.Operation.MarkToolUnavailable",
    "ownerKind": "business-object",
    "ownerRef": "MakerSpace.Tool",
    "behaviorKind": "mutation",
    "subjectKind": "single",
    "invocationMode": "batch",
    "effect": "write"
  },
  "invocation": {
    "mode": "batch",
    "items": [
      {
        "key": "laser-cutter",
        "subject": { "kind": "single", "ref": { "type": "MakerSpace.Tool", "id": "tool:laser-cutter" } },
        "verb": "MarkToolUnavailable",
        "payload": { "reason": "maintenance" }
      }
    ]
  },
  "execution": { "atomicity": "best-effort", "observe": ["after", "diff", "trace"] }
}
```

## InvocationPreset grammar

- `InvocationPresets` contains one or more `InvocationPreset` declarations.
- `InvocationPreset` requires FQN `id` and `operationRef`.
- `operationRef` resolves to an `Operation`.
- Optional fields are `status` and `default`; `default` is `true|false` and selects a UI preset, never an atomicity or observation default.
- Direct children are optional `Title`, optional `Description`, exactly one `RequestJson`, optional `Evidences`, in that order.
- `RequestJson` contains exactly one complete `ExecuteOperationRequest v1` JSON object as text or CDATA.
- The parsed object is the preview and POST body. Validation must not synthesize omitted envelope members or translate a simplified preset into the full request.
- Presets contain request data only. They must not contain results, response traces, snapshots, runtime connection names, handler names, source code, SQL, or mutable execution state.

## Rejection rules

Validators must reject missing or unknown dimension values; a compound `kind` enum that collapses dimensions; `Operation@atomicity`; duplicate or unknown capability values; invalid owner refs; subject refs inconsistent with the owner resource or request subjects; read-only effects with lifecycle/write semantics; composition cycles; incomplete request envelopes; former simplified top-level request members; any request operation/context/invocation field that differs from XML; unsupported atomicity or observations; and executable strings or runtime state in presets.
