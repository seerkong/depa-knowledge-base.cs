# Spec

This layer contains ontology-domain resource grammars and the machine-readable KindDefinition registry.

## Resource specs

- [ontology-resource.md](ontology-resource.md)
- [type-and-relation-resource.md](type-and-relation-resource.md)
- [cozo-om-projection.md](cozo-om-projection.md)
- [business-object-resource.md](business-object-resource.md)
- [rule-resource.md](rule-resource.md)
- [lifecycle-resource.md](lifecycle-resource.md)
- [domain-semantics-resource.md](domain-semantics-resource.md)
- [operation-catalog-resource.md](operation-catalog-resource.md)
- [evidence-resource.md](evidence-resource.md)
- [runtime-binding-resource.md](runtime-binding-resource.md)
- [implementation-mapping-resource.md](implementation-mapping-resource.md)
- [schema-evolution-resource.md](schema-evolution-resource.md)
- [csharp-om-projection.md](csharp-om-projection.md)

## Machine registry

`kind-definitions/*.yaml` publishes exactly one `KindDefinition` for each ontology resource Kind. The validator loads these YAML files with `Bun.YAML.parse` before reading ontology resource trees.
