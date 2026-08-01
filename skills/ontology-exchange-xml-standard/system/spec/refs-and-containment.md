# References And Containment

## Logical references

| Form | Purpose | Authoring visibility |
| --- | --- | --- |
| `vfs://@/...` | File or directory inside the current resource boundary. | Visible if the target material is visible authoring material. |
| `resource://...` | Logical resource identity resolved from the Resource Registry. | Visible subject to registry and authorization rules. |
| `config://...` | Logical configuration slot resolved by an execution environment. | The reference and schema may be visible; actual values are not. |
| `secret://...` | Provider-managed sensitive value identity. | Only the reference identity may be visible; the value is never visible. |

`vfs://@/` is resolved relative to the current boundary:

- for catalog `root`, the declaring manifest directory;
- for directory/manifest entry internal material, the resource directory;
- for file-shaped resources, the containing catalog root unless the KindDefinition narrows it.

## Containment

Implementations must reject:

- host absolute paths;
- naked relative paths;
- `..` path segments before or after percent decoding;
- encoded path separators that escape the boundary;
- symlinks that resolve outside the boundary;
- VFS roots that do not end at a directory boundary;
- entry names containing path separators.

Containment is checked before reading the target. A failed containment check must stop validation before registry or projection output is produced.

## Resource identity references

`resource://` references should use `fqn` for cross-manifest references. `name` references require a declared or inherited scope; validators must not guess across unrelated catalogs.

Reference resolution failure is a validation diagnostic. It must not trigger runtime calls, environment resolution, or fallback filesystem discovery.
