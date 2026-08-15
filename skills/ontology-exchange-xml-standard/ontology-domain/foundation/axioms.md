# Ontology-domain foundation axioms

These axioms define the latest ontology authoring model. Specifications may refine them but must not contradict them.

## O1. FS-native XML owns ontology meaning

Canonical FS-native XML resources own class, relation-def, rule, lifecycle, DomainSemantics, operation, evidence, binding, mapping, and evolution declarations. Generated Bun/.NET code, Cozo `om_*` rows, HTTP catalogs, workbench state, diagrams, Markdown catalogs, request logs, and runtime database rows are projections. For Bun OM, native runtime capability is defined by `/Users/kongweixian/infra-dev/ontology/depa-ontology.ts/packages/depa-ontology`; XML is the readable authoring and exchange representation over that surface.

## O2. Latest-only resource tree

`Ontology` is the root manifest Kind and its exact, case-sensitive entry is `Manifest.xml`. Catalog shape is selected by the referenced KindDefinition: TypeSystem declarations, DomainModel manifest declarations, and BusinessObject-owned members are manifest-shaped resources with declared entry filenames, while catalog/governance aggregate resources remain file-shaped. The latest grammar rejects `Ontology/Resources`, `Ontology/Modules`, grouped module wrappers, per-resource `href` assembly, catalog/Kind source-shape mismatches, and dual-dialect compatibility branches.

## O3. Layer dependencies point downward

The dependency layers are:

1. TypeSystem: `ScalarType`, `EnumType`, `Mixin`, `Class`, `UnionType`, `CollectionType`;
2. DomainModel: manifest `BusinessObject`, its owned Operation/Mutation/Interceptor/ComputedFunction/ConstraintHandler/Lifecycle resources, and `RelationDef`, `Rule`, `StateMachine`;
3. DomainSemantics: `Association`, `DomainPolicy`, `ConstraintHandler`, `BusinessProcess`, `Capability`, `EventContract`;
4. operation definitions: `OperationCatalog` and exact invocation presets;
5. projection and governance: `EvidenceCatalog`, `RuntimeBindingCatalog`, `ImplementationMappingCatalog`, `SchemaEvolutionModule`.

Higher layers may reference lower layers. A lower layer must not reference a DomainSemantics resource, DomainModel profile, or operation to define its own structure.

## O4. One fact has one owner

Every ontology resource root has an FS-native resource identity and an independent semantic declaration identity. Named declarations such as Class, Mixin, RelationDef, Rule, BusinessObject, DomainSemantics resource, Operation, Evidence, binding, mapping, alias, and migration use stable semantic IDs. Language members such as Field and ComputedProp are different: they are embedded in their Class/Mixin/BusinessObject/RelationDef owner and have local names, not independent global IDs or resources. Cross-resource use derives an `OwnerFqn#localName` path without creating a second owner.

## O5. Class authority is profile-neutral

The type language is profile-neutral and is not specialized for business objects. Class, Mixin, and BusinessObject manifests directly embed Field members; Class and BusinessObject own single inheritance and Mixin application. XML preserves Mixin author order, but incompatible Mixin Field collisions are invalid because current `cozo-om` storage does not persist an ordinal. Future profiles such as `PageObject` must be able to reuse the same type-language rules without causing the TypeSystem to depend on BO concepts.

## O6. Profiles add meaning by reference

BusinessObject manifests directly own their class fields and BO-local behavior membership. DomainSemantics resources may assign purpose, roles, participants, policy grouping, capability grouping, and event contracts by reference. They must not inline relation-def endpoints or cardinality, policy predicates, lifecycle state machines, or executable handler bodies.

## O7. XML is declarative

XML may contain typed predicates, declarative constraints, selectors, state transitions, effect declarations, complete request JSON presets, and non-executable explanatory text. It must not contain JavaScript, TypeScript, C#, SQL, CozoScript, callbacks, closures, arbitrary scripts, filesystem module paths supplied for execution, or host-platform invocation instructions.

## O8. Text explains; structure decides

`Description`, `Purpose`, `Statement`, and `InternalLogic` explain intent for humans. Machine behavior comes from explicit fields, typed children, references, and exact request JSON compatibility. A sentence never substitutes for a missing type reference, relation-def endpoint, predicate, transition, operation dimension, binding, or evidence reference.

## O9. Observation and interpretation are distinct

CodeKnowledge `ck_*` facts and direct source inspection describe observed repositories. Ontology resources interpret selected observations as domain meaning. Do not rename an observation into a business concept without explicit mapping and evidence. `depa_*` judgments are outside this DSL's input, reference, and output boundaries.

## O10. Evidence is first class material

Evidence records provenance and stores the revision-pinned observed material directly in the `Evidence` text node. It does not own business interpretation. Wrappers such as `Materials`, `Content`, `Findings`, `Document`, and `Code` are invalid inside `Evidence`.

## O11. Truth grades remain ordered

Use these grades in lower-case XML values:

1. `authoritative`: persisted invariant, schema constraint, or designated fact source.
2. `enforced`: backend code rejects or prevents violations.
3. `contractual`: API, DTO, schema, or protocol declaration.
4. `presentational`: frontend visibility, validation, or interoperation behavior.
5. `inferred`: naming, graph topology, heuristic, or model interpretation.

Lower-grade evidence may support discovery but cannot by itself establish a higher-grade rule.

## O12. Confidence is not authority

Confidence records certainty that evidence was interpreted correctly. Grade records authority of the source. A confidence of `1.0` on a frontend condition remains `presentational`.

## O13. Runtime projection is bidirectional with explicit authority

Project validated XML into normalized IR, target schema calls, HTTP catalogs, workbench bundles, behavior manifests, and runtime rows. Export may read OM schema snapshots and behavior manifests back into a new XML version, but only through an explicit authoring export policy with evidence. Runtime rows, request logs, and UI-edited preset copies are not canonical ontology source by themselves, and an exporter must not fabricate XML-only facts such as BusinessObject, Association, Operation, Evidence, DomainPolicy, or Lifecycle declarations when those facts are absent from the runtime source.

## O14. Open and closed world are explicit

Rules, lifecycle transitions, selection semantics, and operation effects that assume completeness, uniqueness, or absence must state that closed-world intent through typed structure. Do not infer it from one sample entity or one UI branch.

## O15. Semantic evolution is versioned

The root ontology declares a semantic schema version. A change to ontology meaning requires deliberate version treatment; backward-incompatible changes require a new semantic version and an explicit migration. Stable IDs must not silently change meaning.

## O16. Validation is layered

Validation order is secure XML/VFS parsing, FS-native manifest and catalog discovery, KindDefinition validation, declaration uniqueness, kind-aware reference closure, layer ownership constraints, TypeSystem semantics, DomainModel semantics, DomainSemantics reference semantics, operation and preset compatibility, and governance integrity. Passing grammar validation never means runtime code exists or may execute.

## O17. Request preview is the transport object

`InvocationPreset/RequestJson` contains one complete `ExecuteOperationRequest v1` with only the `apiVersion`, `context`, `operation`, `invocation`, and `execution` top-level members. The parsed preview is posted unchanged. A simplified envelope or a second implicit request model is invalid.

## O18. Definition, runtime support, and execution choice are distinct

An `Operation` owns requestable atomicity and observation capability sets. A `RuntimeBinding` owns one runtime's supported subsets. `RequestJson.execution` owns one request's atomicity choice and observation subset. No layer may replace these sets with `Operation@atomicity`, `RuntimeBinding@atomicity`, a default choice, or silent degradation; the server accepts only capabilities in the definition, binding, and server intersection.
