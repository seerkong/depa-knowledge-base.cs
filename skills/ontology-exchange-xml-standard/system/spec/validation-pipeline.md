# Validation Pipeline

Validators must run in this order:

1. Parse candidate XML/YAML/JSON safely. Reject DOCTYPE, entity expansion, hostile encodings, and oversized inputs according to host limits.
2. Validate the root manifest descriptor: Kind, identity, Description, and direct catalog grammar.
3. Resolve catalog roots as containment-safe `vfs://@/...` references.
4. Discover catalog members with first-level scanning only.
5. Load the `KindDefinition` for each catalog Kind.
6. Validate source shape, entry existence, and entry filename rules.
7. Normalize each member descriptor to Kind, identity, Description, and domain descriptor fields.
8. Validate descriptor schema through the selected KindDefinition.
9. Validate internal material contracts and VFS references inside each resource closure.
10. Build the Resource Registry by Kind.
11. Validate identity uniqueness and resource reference resolution.
12. Run KindDefinition cross-resource rules.
13. Emit immutable registry/semantic/projection inputs only if all previous steps pass.

Diagnostics from earlier stages must not be hidden by later stages. When a required authority is missing, such as a KindDefinition, validators should stop the affected branch and report the stable missing-authority diagnostic.
