# FS-native System Examples

These examples are compact authoring fixtures for the generic FS-native resource system. They are not normative authority; `system/foundation`, `system/std`, and `system/spec` remain the authority.

The `ResourceLab/` tree demonstrates:

| Path | Rule shown |
| --- | --- |
| `Manifest.xml` | A manifest resource that owns direct catalogs without wrapper elements. |
| `KindDefinitions/*.yaml` | A file catalog used as a KindDefinition registry. |
| `Notes/*.xml` | A file-shaped resource admitted by `FileResourceCatalog`. |
| `Procedures/*/Procedure.xml` | A directory-shaped resource admitted by `DirectoryResourceCatalog`. |
| `Collections/*/Manifest.xml` | A manifest-shaped resource admitted by `ManifestResourceCatalog`. |
| `Collections/Alpha/Manifest.xml` | Nested composition through an explicit child manifest. |
| `Procedures/Prepare/Notes.txt` | Internal closure material that is not a child resource. |

Catalogs scan exactly one level under their `root`. Any deeper material is visible only as internal material or through a nested manifest that declares its own catalogs.
