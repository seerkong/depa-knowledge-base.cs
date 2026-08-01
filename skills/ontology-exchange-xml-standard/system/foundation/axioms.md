# FS-native Resource System Axioms

## F1. The author tree is the source of truth

Self-describing files, directory entries, and manifest entries are author-maintained source. Registries, semantic projections, indexes, runtime facts, and generated artifacts are rebuildable outputs and must not become hidden inputs to validation.

## F2. Source shape is not business Kind

`file`, `directory`, and `manifest` describe how a resource is stored and composed. They are not business Kinds. File format, such as XML, YAML, JSON, or Markdown, also does not determine source shape.

## F3. Identity is declared content

A resource identity comes from `fqn` or `name`, not from path, filename, directory name, catalog `id`, or loading order. `fqn` is globally unique within the compiled resource tree. `name` is unique only inside a declared resolution scope.

## F4. Catalogs are the only tree composition boundary

Only a manifest resource may declare `ResourceCatalog` children. Catalogs scan exactly the first level of their `root`. Validators must not recursively discover resources, infer resources from filenames, or assemble domain resources through undeclared links.

## F5. KindDefinition is the registry authority

Every catalog declares one normalized `kind`. That Kind selects a registered `KindDefinition`, determines the Resource Registry partition, and defines the descriptor schema, entry contract, internal closure rules, cross-resource rules, and stable diagnostics for accepted members.

## F6. Directory closure is not resource composition

A `directory` resource may contain schemas, prompts, generated notes, fixtures, or implementation material. Those files belong to the resource's internal closure and are not child resources unless a manifest catalog explicitly admits them.

## F7. References are logical and containment-safe

`vfs://`, `resource://`, `config://`, and `secret://` are logical references. Resolution must reject host absolute paths, naked relative paths, `..` escapes, percent-decoding escapes, and symlink traversal outside the owning boundary.

## F8. Secrets are never authoring material

Secret values, bearer tokens, cookies, private keys, connection strings, and runtime session state must not enter the author tree, AI-visible semantic output, diagnostics, indexes, revision records, or generated artifacts. Only logical references may be stored.

## F9. Validation precedes projection

Shape, catalog syntax, Kind registration, descriptor schema, identity uniqueness, internal contracts, cross-resource rules, and containment must pass before building registries, semantic outputs, or runtime projections.

## F10. Diagnostics are part of the contract

Validation failures must produce stable rule codes, logical locations, non-sensitive evidence, and actionable repair hints. Diagnostics must not leak host paths, secrets, or runtime-only state.
