# Runtime binding resources

`RuntimeBindingCatalog` declares externally owned runtime support for operations, computed fields, custom rules, transitions, and projection targets. It does not contain implementation bodies or executable code.

```xml
<RuntimeBindingCatalog fqn="ontology.maker-space.bindings" id="MakerSpace.Bindings">
  <Description>Runtime support declarations for maker-space operations.</Description>
  <RuntimeBindings>
    <RuntimeBinding id="MakerSpace.Binding.ApproveReservation.Bun" targetKind="operation" targetRef="MakerSpace.Operation.ApproveReservation" runtime="bun" portability="extension-point">
      <HandlerRef registry="maker-space-workbench" key="reservation.approve" />
      <Capabilities>
        <Atomicity value="atomic" />
        <Atomicity value="best-effort" />
        <Observation value="before" />
        <Observation value="after" />
        <Observation value="diff" />
        <Capability name="transoperation" value="single-datasource" />
        <Capability name="selection" value="filter" />
        <Capability name="batch" value="keyed-items" />
      </Capabilities>
    </RuntimeBinding>
  </RuntimeBindings>
</RuntimeBindingCatalog>
```

## Grammar

- `RuntimeBindingCatalog` requires resource `fqn` and semantic `id`.
- Direct children are optional `Description`, then exactly one `RuntimeBindings`.
- `RuntimeBindings` contains one or more `RuntimeBinding` declarations.
- `RuntimeBinding` requires FQN `id`, `targetKind`, `targetRef`, `runtime`, and `portability`.
- `RuntimeBinding@atomicity` is not part of the latest grammar.
- `targetKind` is `operation|computed-prop|rule|transition|projection`.
- `targetRef` resolves according to `targetKind`: `operation` -> `Operation`; `computed-prop` -> `ComputedProp`; `rule` -> `Rule`; `transition` -> `Transition`; `projection` -> `Class`, `BusinessObject`, `RelationDef`, `Rule`, `StateMachine`, `Operation`, or a DomainSemantics profile resource.
- `runtime` is a stable runtime key such as `bun`, `dotnet`, `sqlite-workbench`, `http`, or `cozo-om`.
- `portability` is `portable|extension-point|target-specific`.
- Optional `status` is `accepted|hypothesis`.
- Direct children are optional `Description`, exactly one `HandlerRef`, conditional `Capabilities`, optional `Evidences`, in that order.
- `Capabilities` is required when `targetKind="operation"` and optional for every other target kind.

## HandlerRef

- `HandlerRef` requires non-empty `registry` and `key`.
- `registry` is a stable server-side registry name.
- `key` is a stable handler key pre-registered by runtime composition.
- Optional fields are `version` and `contract`.
- `HandlerRef` must not be a filesystem path, package import path, URL to executable code, inline function, shell command, SQL string, or arbitrary callback name accepted from a request.

## Runtime capability grammar

For `targetKind="operation"`, `Capabilities` contains one or more `Atomicity`, zero or more `Observation`, and zero or more generic `Capability` children in that order.

- `Atomicity@value` is `atomic|best-effort`.
- `Observation@value` is `before|after|diff|trace|plan`.
- Atomicity and observation values have set semantics. Duplicates are invalid and source order does not define preference.
- The atomicity set is non-empty. The observation set may be empty.
- Generic `Capability` requires non-empty `name` and `value`.
- Generic entries describe runtime-specific support such as `transoperation`, `selection`, `batch`, `projection`, or `target`.
- Generic `Capability@name` must not be `atomicity|observation|observations|observe|before|after|diff|trace|plan`; standard atomicity and observation support must use the structured children.

For a non-operation binding, `Capabilities` is optional. When present, it contains one or more generic `Capability` children only. `Atomicity` and `Observation` are forbidden, and no `not-applicable` placeholder is required or allowed.

## Definition, binding, and request compatibility

The three capability roles are distinct:

- `Operation/Capabilities` is the semantic definition's requestable capability set.
- `RuntimeBinding/Capabilities` is one runtime binding's runtime-supported capability set.
- `RequestJson.execution` is one execution choice: one atomicity value and a set of observation channels.

For an operation binding, its runtime-supported atomicity set is a non-empty subset of the referenced Operation's requestable atomicity set; its runtime-supported observation set is a subset of the referenced Operation's requestable observation set; it must support `Operation@invocation`; and it must support `Operation@subject` when the subject is `selection`. It does not declare owner dimensions.

At execution time, effective capability is the intersection of the Operation requestable set, the selected binding runtime-supported set, and current server capability projection. Unsupported requests fail with a capability diagnostic. A runtime must not silently degrade atomicity, remove observation channels, or mutate the request.

## Rejection rules

Validators must reject bindings whose `targetRef` kind does not match `targetKind`; `RuntimeBinding@atomicity`; operation bindings without structured atomicity; non-operation bindings containing `Atomicity` or `Observation`; duplicate or unknown structured values; operation binding values outside referenced Operation capabilities; generic capabilities that impersonate structured atomicity or observation; owner dimensions inside bindings; unsafe handler refs; request presets that name a binding directly; and bindings that duplicate semantic declarations as alternate truth.
