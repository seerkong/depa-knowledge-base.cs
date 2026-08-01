# Specification

The specification layer contains parser-ready contracts for the FS-native resource system.

| File | Responsibility |
| --- | --- |
| [canonical-grammar.xml](./canonical-grammar.xml) | Machine-readable manifest and catalog grammar. |
| [xml-grammar.md](./xml-grammar.md) | Human-readable XML grammar and cardinality rules. |
| [kind-definitions.md](./kind-definitions.md) | KindDefinition schema responsibility and validation boundary. |
| [refs-and-containment.md](./refs-and-containment.md) | VFS, resource, config, and secret reference safety. |
| [validation-pipeline.md](./validation-pipeline.md) | Required validation sequence before registry/projection. |
| [diagnostics.md](./diagnostics.md) | Stable diagnostics emitted by authoring validators. |
