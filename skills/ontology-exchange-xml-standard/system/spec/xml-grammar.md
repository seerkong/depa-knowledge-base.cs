# XML Grammar

## Manifest root

A manifest root is an XML descriptor for a registered Kind whose `KindDefinition` allows the `manifest` source shape. It must normalize to:

- one Kind;
- `name` or `fqn`;
- optional `version`;
- exactly one non-empty `Description`;
- zero or more direct `ResourceCatalog` children.

Catalog elements are direct children of the manifest root. Do not wrap them in generic containers such as `Resources`, `Catalogs`, `Modules`, or `Tree`.

## Catalog grammar

```xml
<FileResourceCatalog id="..." kind="..." root="vfs://@/.../"/>
<DirectoryResourceCatalog id="..." kind="..." root="vfs://@/.../" entry="Definition.xml"/>
<ManifestResourceCatalog id="..." kind="..." root="vfs://@/.../" entry="Manifest.xml"/>
```

Rules:

- `id` is required and unique inside the manifest.
- `kind` is required and normalized before lookup.
- `root` is required and must be a containment-safe VFS root reference.
- `FileResourceCatalog` must not declare `entry`.
- `DirectoryResourceCatalog.entry` is a plain entry filename, not a path.
- `ManifestResourceCatalog.entry` is an XML entry filename, usually `Manifest.xml`, and must be explicit.

## First-level discovery

For a catalog root `vfs://@/x/`:

- `FileResourceCatalog` reads only files directly under `x/`.
- `DirectoryResourceCatalog` reads only `x/<child>/<entry>` for direct child directories.
- `ManifestResourceCatalog` reads only `x/<child>/<entry>` for direct child directories.

No catalog recursively walks descendants. Nested composition must be represented by a discovered manifest that declares its own catalogs.

## Shape constraints

A `directory` resource entry must not own `ResourceCatalog` children. If an entry needs to compose child resources, its KindDefinition must allow the `manifest` shape and the parent must discover it through `ManifestResourceCatalog`.

A member descriptor root must normalize to the same Kind as the accepting catalog. Mismatch is a resource error, not an opportunity to infer another catalog.
