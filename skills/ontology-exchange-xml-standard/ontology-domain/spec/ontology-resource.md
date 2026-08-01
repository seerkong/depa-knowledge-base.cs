# Ontology manifest resource

The root entry is named exact PascalCase `Manifest.xml` and contains exactly one `Ontology` root. `Ontology` is an FS-native manifest Kind. Each direct catalog must use a source shape and exact entry filename allowed by its referenced KindDefinition.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Ontology fqn="ontology.maker-space" id="MakerSpace.Ontology" version="1.0.0">
  <Description>Maker space workshop scheduling ontology.</Description>
  <ManifestResourceCatalog id="scalar-types" kind="ScalarType" root="vfs://@/TypeSystem/ScalarTypes/" entry="ScalarType.xml" />
  <ManifestResourceCatalog id="enum-types" kind="EnumType" root="vfs://@/TypeSystem/EnumTypes/" entry="EnumType.xml" />
  <ManifestResourceCatalog id="mixins" kind="Mixin" root="vfs://@/TypeSystem/Mixins/" entry="Mixin.xml" />
  <ManifestResourceCatalog id="object-types" kind="ObjectType" root="vfs://@/TypeSystem/ObjectTypes/" entry="ObjectType.xml" />
  <ManifestResourceCatalog id="union-types" kind="UnionType" root="vfs://@/TypeSystem/TypeExpressions/UnionTypes/" entry="UnionType.xml" />
  <ManifestResourceCatalog id="collection-types" kind="CollectionType" root="vfs://@/TypeSystem/TypeExpressions/CollectionTypes/" entry="CollectionType.xml" />
  <ManifestResourceCatalog id="business-objects" kind="BusinessObject" root="vfs://@/DomainModel/BusinessObjects/" entry="BusinessObject.xml" />
  <ManifestResourceCatalog id="relations" kind="Relation" root="vfs://@/DomainModel/Relations/" entry="Relation.xml" />
  <ManifestResourceCatalog id="rules" kind="Rule" root="vfs://@/DomainModel/Rules/" entry="Rule.xml" />
  <ManifestResourceCatalog id="state-machines" kind="StateMachine" root="vfs://@/DomainModel/StateMachines/" entry="StateMachine.xml" />
  <FileResourceCatalog id="associations" kind="AssociationCatalog" root="vfs://@/DomainSemantics/Associations/" />
  <FileResourceCatalog id="operations" kind="OperationCatalog" root="vfs://@/Operations/" />
</Ontology>
```

## Grammar

- `Ontology` requires `fqn`, semantic `id`, and non-empty `version`; no other ontology-domain attributes are allowed.
- `fqn` is the FS-native resource identity. `id` is the semantic domain-context identity and maps to `ExecuteOperationRequest.context.id`.
- `version` is the semantic schema version for one coherent meaning. It is not a source revision, build number, timestamp, generation counter, or runtime schema version.
- Direct children are exactly one `Description` followed by one or more direct FS-native `FileResourceCatalog`, `DirectoryResourceCatalog`, or `ManifestResourceCatalog` elements.
- `Description` contains non-empty plain text and no attributes or child elements.
- Every catalog follows the generic FS-native catalog grammar from `system/spec/canonical-grammar.xml`.
- Catalog shape must match the KindDefinition. TypeSystem declarations, DomainModel manifest declarations, and `BusinessObject`-owned members are manifest-shaped resources. Catalog/governance aggregate resources remain file-shaped.
- `Ontology` and every TypeSystem or DomainModel manifest declaration allow the `manifest` source shape. The registry currently contains 28 ontology-domain KindDefinitions.
- Each catalog `kind` must resolve to exactly one ontology-domain KindDefinition.
- A file catalog scans direct XML files. A directory or manifest catalog scans direct child directories and loads its declared `entry`. Recursive scan, glob expansion, path-list assembly, and per-resource assembly entries are invalid.

## Allowed ontology resource Kinds

TypeSystem resources:

- `ScalarType`
- `EnumType`
- `Mixin`
- `ObjectType`
- `UnionType`
- `CollectionType`

DomainModel resources:

- `BusinessObject`
- `Relation`
- `Rule`
- `StateMachine`

DomainSemantics resources:

- `AssociationCatalog`
- `DomainPolicyCatalog`
- `ConstraintHandlerCatalog`
- `BusinessProcessCatalog`
- `CapabilityCatalog`
- `EventContractCatalog`

BusinessObject-owned file resources:

- `Action`
- `Mutation`
- `Interceptor`
- `ComputedFunction`
- `ConstraintHandler`
- `Lifecycle`

Operation resources:

- `OperationCatalog`

Projection and governance resources:

- `EvidenceCatalog`
- `RuntimeBindingCatalog`
- `ImplementationMappingCatalog`
- `SchemaEvolutionModule`

At least one `ObjectType` catalog is required for a bundle that declares DomainSemantics resources, operations, rules, lifecycles, mappings, or bindings. A bundle may have no DomainSemantics or operations, but all references must resolve in the same compiled Resource Registry.

At most one `SchemaEvolutionModule` is allowed in a bundle version. Its generation snapshots and each `Migration@toVersion` must name the same `Ontology@version`; `Migration@fromVersion` names an earlier explicit semantic version.

## Rejection rules

Validators must reject:

- `Ontology` without `Description`;
- any `Resources` element under `Ontology`;
- any `Modules` element under `Ontology`;
- legacy per-resource entries using `href`;
- a Catalog whose file/directory/manifest shape is not allowed by its referenced KindDefinition;
- nested grouping containers such as `BusinessObjects`, `EvidenceCatalogs`, or `Modules` used as root assembly syntax;
- resource references outside the allowed KindDefinition set;
- inline semantic declarations under `Ontology`;
- catalog roots that are absolute paths, bare relative paths, backslash paths, or VFS paths escaping the permitted root;
- files whose root element does not match the catalog's `kind`;
- duplicate semantic IDs across discovered resources.
