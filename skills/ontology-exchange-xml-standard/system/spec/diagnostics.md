# Diagnostics

Diagnostics are stable authoring contracts. They are intended for local AI agents, CLI validators, and IDEs.

Each diagnostic must include:

| Field | Rule |
| --- | --- |
| `code` | Stable uppercase code. |
| `severity` | `error`, `warning`, or `info`. |
| `path` | Logical VFS path, manifest/catalog id, or resource identity. No host absolute paths. |
| `rule` | Stable rule identifier. |
| `message` | Human-readable summary. |
| `evidence` | Non-sensitive evidence sufficient for repair. |
| `suggestedFix` | Optional concrete repair hint. |

## Required system codes

| Code | Meaning |
| --- | --- |
| `RESOURCE_PARSE_UNSAFE_XML` | XML input uses a forbidden construct such as DOCTYPE or entity expansion. |
| `RESOURCE_MANIFEST_IDENTITY_MISSING` | Manifest root lacks both `name` and `fqn`. |
| `RESOURCE_MANIFEST_DESCRIPTION_MISSING` | Manifest root lacks non-empty `Description`. |
| `RESOURCE_CATALOG_KIND_MISSING` | Catalog lacks `kind`. |
| `RESOURCE_CATALOG_ID_DUPLICATE` | Two catalogs in one manifest share `id`. |
| `RESOURCE_CATALOG_ENTRY_MISSING` | Directory or manifest catalog member lacks the required entry. |
| `RESOURCE_CATALOG_ENTRY_FORBIDDEN` | File catalog declares `entry`. |
| `RESOURCE_CATALOG_SCAN_DEPTH_INVALID` | Discovery attempted beyond the first level. |
| `RESOURCE_CATALOG_MEMBER_KIND_MISMATCH` | Member normalized Kind does not match catalog Kind. |
| `RESOURCE_CATALOG_MEMBER_DUPLICATE` | One logical resource is accepted by more than one catalog. |
| `RESOURCE_SHAPE_MISMATCH` | Source shape does not satisfy the selected KindDefinition or entry role. |
| `RESOURCE_IDENTITY_MISSING` | Member descriptor lacks both `name` and `fqn`. |
| `RESOURCE_FQN_DUPLICATE` | More than one resource declares the same `fqn`. |
| `RESOURCE_NAME_AMBIGUOUS` | A scoped `name` reference resolves to multiple resources. |
| `RESOURCE_KIND_DEFINITION_NOT_FOUND` | No KindDefinition exists for a catalog Kind. |
| `RESOURCE_KIND_SCHEMA_INVALID` | Descriptor failed the selected KindDefinition schema. |
| `RESOURCE_KIND_CONTRACT_INVALID` | Internal or cross-resource contract failed. |
| `RESOURCE_REF_CONTAINMENT` | A logical reference escapes its allowed boundary. |
| `RESOURCE_SECRET_EXPOSED` | Secret or token-like value appears in authoring material or visible output. |

Diagnostics must not include secret values, resolved provider values, cookies, tokens, private keys, or host filesystem paths.
