# Invalid: Catalog Kind/Shape Mismatch

Expected diagnostic intent: reject a `DirectoryResourceCatalog` whose `Type` KindDefinition allows only the manifest source shape. Non-file catalogs are valid under `Ontology` when the referenced KindDefinition permits that shape.
