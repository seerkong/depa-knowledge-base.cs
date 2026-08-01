# FS-native Resource Tree Standard

## 1. Source shapes

| Shape | Author form | Tree role | Catalog |
| --- | --- | --- | --- |
| `file` | One self-describing file | Leaf resource | `FileResourceCatalog` |
| `directory` | One directory plus a fixed entry file | Leaf resource with internal material closure | `DirectoryResourceCatalog` |
| `manifest` | One directory plus an XML manifest entry | Resource node that may compose child resources | `ManifestResourceCatalog` |

The amount of material inside a directory does not decide the shape. A resource is `manifest` only when its entry may declare resource catalogs.

## 2. Manifest composition

A manifest entry defines the manifest resource itself and may directly own any number of `FileResourceCatalog`, `DirectoryResourceCatalog`, and `ManifestResourceCatalog` children. No wrapper element is required or allowed for catalog collections.

Manifest ownership is local: a catalog root is resolved relative to the manifest boundary that declared it. Child manifests may declare their own catalogs, creating nested composition through explicit manifest-to-manifest edges.

## 3. Resource catalogs

Every catalog must declare:

| Field | Meaning |
| --- | --- |
| `id` | Local catalog declaration identity, unique inside one manifest. It is not resource identity. |
| `kind` | Normalized business Kind accepted by this catalog. |
| `root` | Containment-safe `vfs://@/...` root scanned by this catalog. |

`DirectoryResourceCatalog` and `ManifestResourceCatalog` also require `entry`.

| Catalog | Scan rule | Entry rule |
| --- | --- | --- |
| `FileResourceCatalog` | Accept direct files under `root` only. | The file itself is the descriptor. |
| `DirectoryResourceCatalog` | Accept direct child directories under `root` only. | Each child must contain `<entry>`. The entry must not declare catalogs. |
| `ManifestResourceCatalog` | Accept direct child directories under `root` only. | Each child must contain XML `<entry>`. The entry may declare catalogs. |

Catalogs scan exactly one level. Recursive discovery, glob expansion below the first level, and domain-specific href assembly are outside this system.

## 4. Kind registry

The compiled Resource Registry is partitioned by Kind:

```text
ResourceRegistry[kind] = all catalog members with catalog.kind == kind that passed KindDefinition validation
```

Different catalogs may feed the same Kind, including different source shapes, when the registered `KindDefinition` allows them. The same logical resource must not be accepted by two catalogs in one compiled tree.

## 5. Resource descriptor and identity

Every resource descriptor must normalize to:

| Field | Rule |
| --- | --- |
| `kind` | Must match the accepting catalog `kind`. If omitted by a compact syntax, the KindDefinition parser must normalize it. |
| `description` | Required, non-empty, and safe for authoring diagnostics. |
| `fqn` or `name` | At least one is required. |

`fqn` is the canonical global identity when present. `name` is a scoped alias and may be resolved only when the caller has a declared namespace or catalog scope.

## 6. KindDefinition authority

`KindDefinition` is a platform file resource that defines one resource Kind. It owns:

- allowed source shapes;
- descriptor schema;
- entry filename requirements for directory and manifest shapes;
- internal material contract;
- cross-resource and reference rules;
- stable diagnostics and suggested repair shapes.

Domain specifications may extend or specialize Kinds by publishing KindDefinitions. They must not bypass catalog discovery or use paths as identity.

## 7. Validation before projection

Implementations must validate the resource tree before producing registries, semantics, build output, or runtime projections. Validation order is standardized in [../spec/validation-pipeline.md](../spec/validation-pipeline.md).
