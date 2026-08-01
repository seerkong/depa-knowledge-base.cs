# Ontology Domain Examples

These examples are illustrative fixtures for the ontology-domain package. They are not authority: the grammar and validation rules live in `../foundation`, `../std`, and `../spec`.

## Trees

- `valid/MakerSpace/` is a complete FS-native ontology manifest resource for a new MakerSpace domain.
- `invalid/*/` are focused negative trees. Each directory changes one concern and includes a `README.md` with the expected diagnostic intent.

The valid tree uses manifest catalogs for TypeSystem and DomainModel object resources, plus file catalogs for DomainSemantics and governance aggregates. Each BusinessObject manifest owns first-level manifest catalogs for its local Action and Mutation resource directories. There is no legacy `Resources`, `Modules`, per-resource `href`, recursive discovery, or `collection` subject.
