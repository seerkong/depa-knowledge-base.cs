# Proposal: migrate knowledge-base to ontology Class/Object model

## Goal

Migrate `/Users/kongweixian/infra-dev/ontology/depa-knowledge-base.cs` to the breaking ontology-core rename completed by mission G2.

The dependent project must use the same current language:

- `Class` for object category definitions.
- `Object` for concrete persisted object data.
- `Field` for fields defined on a Class.
- `FieldValue` for persisted Object field values.
- `ComputedProp` for computed properties defined on a Class.
- `RelationDef` for allowed relation types.
- `RelationLink` for explicit persisted Object-to-Object relation links.
- `Operation` for class-exposed upper-level operations.

## Scope

- Production source in `src/`.
- Integration tests in `tests/`.
- Direct Cozo OM table and column references.
- Current Codument records in this project.
- Project skills under `skills/`, including docs, prompts, scripts, validators, tests, and examples.

## Non-goals

- Do not reintroduce compatibility aliases for old ontology APIs or tables.
- Do not rename unrelated domain concepts that are not OM vocabulary, such as code graph edges or programming-language types when they describe source code.
- Do not archive historical Codument records as part of implementation.

## Acceptance

- Knowledge-base compiles against the renamed ontology-core public API.
- Tests and direct Cozo assertions use the renamed OM table/column contract:
  `om_class_def`, `om_object`, `om_field_def`, `om_field_value`,
  `om_relation_def`, `om_relation_link`, `om_computed_prop_def`,
  `om_operation_def`, and `om_perm_operation`.
- Current skills and docs stop teaching `Type/Entity/Attribute/Property/Edge/Action` as active OM terms.
- Legacy terms remain only where they are explicitly unrelated to OM or intentionally used as historical deny-list strings.
- Verification evidence is recorded in the track reports.
