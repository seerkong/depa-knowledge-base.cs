# KindDefinition

`KindDefinition` is the registry authority for one resource Kind. It is itself a file-shaped platform resource and is loaded before application/domain resources are validated.

## Minimum contract

Each KindDefinition must declare:

| Field | Meaning |
| --- | --- |
| `apiVersion` | Definition schema version. |
| `kind` | Must be `KindDefinition`. |
| `metadata.name` | Stable definition resource name. |
| `spec.resourceKind` | Normalized business Kind governed by this definition. |
| `spec.sourceShapes` | Allowed source shapes: `file`, `directory`, `manifest`. |
| `spec.descriptorSchema` | Schema for normalized resource descriptor fields. |
| `spec.identity` | How `name` and `fqn` are read and scoped. |
| `spec.description` | Required description contract. |
| `spec.entries` | Entry filename rules for `directory` and `manifest` shapes. |
| `spec.internalContract` | Rules for files inside a directory or manifest resource closure. |
| `spec.crossResourceRules` | Rules that need the Resource Registry or other resources. |
| `spec.diagnostics` | Stable diagnostic codes and evidence fields emitted by the validator. |

## Responsibility boundary

KindDefinition owns authoring validation for a Kind. It must not contain runtime environment values, secret values, provider bindings, host paths, or generated registry output.

A validator must use KindDefinition to answer these questions:

- Is this source shape allowed for the catalog Kind?
- Does the entry exist and have the expected filename constraints?
- Can the descriptor normalize to the catalog Kind?
- Does the descriptor have valid identity and Description?
- Are internal references containment-safe?
- Are cross-resource references resolvable by `fqn` or scoped `name`?
- Which stable diagnostic code and suggested repair should be emitted?

Upper domain specs may provide richer grammar, but the parser-ready KindDefinition remains the machine authority used by the system validation pipeline.
