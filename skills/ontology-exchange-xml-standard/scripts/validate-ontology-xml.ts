#!/usr/bin/env bun

import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { XMLParser, XMLValidator } from "fast-xml-parser";

type XmlObject = Record<string, unknown>;
type Diagnostic = { file: string; message: string };
type SourceShape = "file" | "directory" | "manifest";

type DeclarationKind =
  | "ontology"
  | "scalar-type"
  | "enum-type"
  | "mixin"
  | "object-type"
  | "union-type"
  | "collection-type"
  | "property"
  | "computed-property"
  | "relation"
  | "rule"
  | "state-machine"
  | "derivation"
  | "transition"
  | "business-object"
  | "action"
  | "mutation"
  | "interceptor"
  | "computed-function"
  | "lifecycle-profile"
  | "association"
  | "domain-policy"
  | "constraint-handler"
  | "business-process"
  | "capability"
  | "event-contract"
  | "operation"
  | "invocation-preset"
  | "evidence"
  | "runtime-binding"
  | "implementation-mapping"
  | "alias"
  | "migration"
  | "generation-snapshot";

type Declaration = {
  id: string;
  kind: DeclarationKind;
  element: string;
  node: XmlObject;
  file: string;
  parent?: Declaration;
};

type LoadedDocument = {
  file: string;
  rootName: string;
  root: XmlObject;
  layer: number;
  sourceShape: SourceShape;
  ownerResourceId?: string;
};

type KindDefinition = {
  resourceKind: string;
  sourceShapes: Set<string>;
  rootElement: string;
  requiredAttributes: Set<string>;
  requiredChildren: Set<string>;
  identityFrom: string;
  identityRequired: boolean;
  identityFqnPath?: string;
  identityNamePath?: string;
  descriptionPath?: string;
  entries?: Map<SourceShape, string>;
  allowedReferenceBoundaries?: Set<string>;
};

type ElementNode = {
  element: string;
  node: XmlObject;
  file: string;
  parentElement: string | null;
  parentDeclaration?: Declaration;
};

type ValidationContext = {
  rootFile: string;
  workspaceRoot: string;
  generated: boolean;
  hypothesisOnly: boolean;
  kindDefinitions: Map<string, KindDefinition>;
  documents: Map<string, LoadedDocument>;
  diagnostics: Diagnostic[];
  elements: ElementNode[];
  declarations: Map<string, Declaration>;
  referencedTargets: Set<string>;
  resourceFqns: Map<string, string>;
  ontologyId: string;
  ontologyVersion: string;
};

type ChildRule = { min?: number; max?: number };
type ElementSpec = {
  attributes?: string[];
  requiredAttributes?: string[];
  children?: Record<string, ChildRule>;
  order?: string[];
  minElementChildren?: number;
  maxElementChildren?: number;
  atLeastOneOf?: string[];
  text?: "required" | "optional" | "forbidden";
};

type PropertyInfo = {
  id: string;
  name: string;
  owner: string;
  ownerKind: "object-type" | "business-object" | "mixin" | "relation";
  typeRef: string;
  required: boolean;
  computed: boolean;
  node: XmlObject;
  file: string;
};

type TypeModel = {
  parentByType: Map<string, string>;
  mixinsByOwner: Map<string, string[]>;
  propertiesByOwner: Map<string, PropertyInfo[]>;
  propertyById: Map<string, PropertyInfo>;
};

type OperationInfo = {
  id: string;
  node: XmlObject;
  file: string;
  atomicity: Set<string>;
  observations: Set<string>;
};

const resourceLayers = new Map<string, number>([
  ["ScalarType", 0],
  ["EnumType", 0],
  ["Mixin", 0],
  ["ObjectType", 0],
  ["UnionType", 0],
  ["CollectionType", 0],
  ["Relation", 1],
  ["Rule", 2],
  ["StateMachine", 3],
  ["BusinessObject", 4],
  ["AssociationCatalog", 4],
  ["DomainPolicyCatalog", 4],
  ["ConstraintHandlerCatalog", 4],
  ["BusinessProcessCatalog", 4],
  ["CapabilityCatalog", 4],
  ["EventContractCatalog", 4],
  ["Action", 5],
  ["Mutation", 5],
  ["Interceptor", 5],
  ["ComputedFunction", 5],
  ["ConstraintHandler", 5],
  ["Lifecycle", 5],
  ["OperationCatalog", 6],
  ["EvidenceCatalog", 7],
  ["RuntimeBindingCatalog", 8],
  ["ImplementationMappingCatalog", 9],
  ["SchemaEvolutionModule", 10],
]);

const builtins = new Set([
  "builtin:String",
  "builtin:Number",
  "builtin:Bool",
  "builtin:Json",
  "builtin:Validity",
  "builtin:DateTime",
  "builtin:Decimal",
  "builtin:Uuid",
]);
const builtinScalarKeys = new Set([
  "builtin:String",
  "builtin:Number",
  "builtin:Bool",
  "builtin:DateTime",
  "builtin:Decimal",
  "builtin:Uuid",
]);
const orderableBuiltins = new Set(["builtin:Number", "builtin:Decimal", "builtin:DateTime"]);
const grades = new Set(["authoritative", "enforced", "contractual", "presentational", "inferred"]);
const evidenceSources = new Set(["code", "database-investigation", "document", "api-contract", "ui", "decision", "manual", "generated"]);
const statusValues = new Set(["accepted", "hypothesis"]);
const typeKinds = new Set(["entity", "value", "document", "view", "raw"]);
const collectionKinds = new Set(["list", "set", "map"]);
const ruleKinds = new Set(["conditional", "cross-entity", "computed-dependency", "existential", "uniqueness", "cardinality", "custom"]);
const profilePropertyRoles = new Set(["member", "state", "display-name", "external-id", "classification", "measurement", "raw"]);
const ownerKinds = new Set(["domain-context", "business-object", "association", "lifecycle", "constraint", "business-process", "capability", "raw"]);
const behaviorKinds = new Set(["action", "mutation", "query", "transition", "validate", "computed", "composed", "raw"]);
const subjectKinds = new Set(["none", "single", "selection"]);
const invocationModes = new Set(["single", "batch"]);
const effects = new Set(["read-only", "write", "mixed"]);
const atomicityValues = new Set(["atomic", "best-effort"]);
const observationValues = new Set(["before", "after", "diff", "trace", "plan"]);
const portabilityValues = new Set(["portable", "extension-point", "target-specific"]);
const runtimeTargetKinds = new Set(["operation", "computed-property", "rule", "transition", "projection"]);
const mappingTargetKinds = new Set([
  "object-type",
  "property",
  "relation",
  "rule",
  "state-machine",
  "transition",
  "business-object",
  "action",
  "mutation",
  "interceptor",
  "computed-function",
  "lifecycle-profile",
  "association",
  "domain-policy",
  "constraint-handler",
  "business-process",
  "capability",
  "event-contract",
  "operation",
  "runtime-binding",
]);
const evolutionKinds = new Set([...mappingTargetKinds, "mixin", "computed-property", "implementation-mapping", "local-name"]);
const predicateElements = new Set([
  "All",
  "Any",
  "Not",
  "PropertyPresent",
  "PropertyEquals",
  "PropertyNotEquals",
  "PropertyIn",
  "PropertyCompare",
  "TypeIs",
  "RelatedExists",
  "EveryRelated",
  "RelatedCount",
  "ExistsRelated",
]);
const fqnPattern = /^[A-Z][A-Za-z0-9]*(?:\.[A-Z][A-Za-z0-9]*)+$/;
const propertyRefPattern = /^([A-Z][A-Za-z0-9]*(?:\.[A-Z][A-Za-z0-9]*)+)#([a-z][A-Za-z0-9]*)$/;
const ontologyIdPattern = /^[A-Z][A-Za-z0-9]*(?:\.[A-Z][A-Za-z0-9]*)*$/;
const resourceFqnPattern = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/;
const localNamePattern = /^[a-z][A-Za-z0-9]*$/;
const pascalNamePattern = /^[A-Z][A-Za-z0-9]*$/;
const verbPattern = /^(?:[a-z][A-Za-z0-9]*|[A-Z][A-Za-z0-9]*)$/;
const namespacedIdPattern = /^[a-z][a-z0-9-]*:[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const versionPattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const forbiddenTextPattern = /```|\b(?:SELECT|INSERT|UPDATE|DELETE|MERGE|CREATE\s+TABLE)\b|=>|\bfunction\s*\(|\bimport\s+|require\s*\(|\b(?:javascript|typescript|csharp|sql|cozoscript):/i;
const forbiddenPathPattern = /(?:^|[ \t])(?:\.{1,2}\/|\/[A-Za-z0-9_.-]|[A-Za-z]:\\)|\b(?:node_modules|\.dll|\.jar|\.so|\.dylib|\.ts|\.js|\.cs)\b/i;
const migrationAlterAspects = new Set([
  "requiredness",
  "cardinality",
  "type-ref",
  "predicate",
  "state",
  "transition",
  "operation-dimensions",
  "request-schema",
  "effect",
  "atomicity",
  "binding-target",
  "evidence-grade",
]);
const depaPattern = /depa_/i;
const maxXmlBytes = 1024 * 1024;
const valueTypeKinds: DeclarationKind[] = ["scalar-type", "enum-type", "object-type", "union-type", "collection-type"];
const entityTypeKinds: DeclarationKind[] = ["object-type", "business-object"];
const typeLikeReferenceKinds: DeclarationKind[] = [...valueTypeKinds, "business-object"];

const refElementKinds: Record<string, DeclarationKind[]> = {
  Evidence: ["evidence"],
  Type: typeLikeReferenceKinds,
  Mixin: ["mixin"],
  Relation: ["relation"],
  Rule: ["rule"],
  StateMachine: ["state-machine"],
  Mutation: ["mutation"],
  Operation: ["operation"],
  RuntimeBinding: ["runtime-binding"],
  ImplementationMapping: ["implementation-mapping"],
};

const targetKindMap: Record<string, DeclarationKind[]> = {
  "object-type": ["object-type"],
  "scalar-type": ["scalar-type"],
  "enum-type": ["enum-type"],
  mixin: ["mixin"],
  property: [],
  "computed-property": [],
  relation: ["relation"],
  rule: ["rule"],
  "state-machine": ["state-machine"],
  transition: ["transition"],
  "business-object": ["business-object"],
  action: ["action"],
  mutation: ["mutation"],
  interceptor: ["interceptor"],
  "computed-function": ["computed-function"],
  lifecycle: ["lifecycle-profile", "state-machine"],
  association: ["association"],
  "domain-policy": ["domain-policy"],
  "constraint-handler": ["constraint-handler"],
  "business-process": ["business-process"],
  capability: ["capability"],
  "event-contract": ["event-contract"],
  operation: ["operation"],
  "runtime-binding": ["runtime-binding"],
  "implementation-mapping": ["implementation-mapping"],
};

const ownerTargetKinds: Record<string, { required: boolean; kinds: DeclarationKind[] }> = {
  "domain-context": { required: false, kinds: ["ontology"] },
  "business-object": { required: true, kinds: ["business-object"] },
  association: { required: true, kinds: ["association"] },
  lifecycle: { required: true, kinds: ["state-machine"] },
  constraint: { required: true, kinds: ["constraint-handler"] },
  "business-process": { required: true, kinds: ["business-process"] },
  capability: { required: true, kinds: ["capability"] },
  raw: { required: false, kinds: ["object-type"] },
};

const genericContainers = {
  Evidences: { children: { Evidence: { min: 1 } }, order: ["Evidence"], minElementChildren: 1 },
  Properties: { children: { Property: { min: 1 } }, order: ["Property"], minElementChildren: 1 },
  Mixins: { children: { Mixin: { min: 1 } }, order: ["Mixin"], minElementChildren: 1 },
  Description: { text: "required" as const },
  Purpose: { text: "required" as const },
  Statement: { text: "required" as const },
  InternalLogic: { text: "required" as const },
  Title: { text: "required" as const },
  RequestJson: { text: "required" as const },
};

function loadKindDefinitions(): Map<string, KindDefinition> {
  const directory = resolve(import.meta.dir, "..", "ontology-domain", "spec", "kind-definitions");
  const definitions = new Map<string, KindDefinition>();
  const sourceShapeOwners = new Map<string, string>();
  const rootElementOwners = new Map<string, string>();
  for (const name of readdirSync(directory).filter((file) => file.endsWith(".yaml")).sort()) {
    const file = resolve(directory, name);
    const raw = Bun.YAML.parse(readFileSync(file, "utf8")) as XmlObject;
    if (raw.apiVersion !== "fs-native/v1" || raw.kind !== "KindDefinition") {
      throw new Error(`KIND_DEFINITION_INVALID ${file}: expected apiVersion=fs-native/v1 and kind=KindDefinition.`);
    }
    const spec = raw.spec;
    if (!isObject(spec)) throw new Error(`KIND_DEFINITION_INVALID ${file}: missing spec.`);
    const resourceKind = typeof spec.resourceKind === "string" ? spec.resourceKind : "";
    const sourceShapes = Array.isArray(spec.sourceShapes) ? spec.sourceShapes.filter((shape): shape is string => typeof shape === "string") : [];
    const descriptorSchema = isObject(spec.descriptorSchema) ? spec.descriptorSchema : {};
    const rootElement = typeof descriptorSchema.rootElement === "string" ? descriptorSchema.rootElement : "";
    const requiredAttributes = Array.isArray(descriptorSchema.requiredAttributes)
      ? descriptorSchema.requiredAttributes.filter((attribute): attribute is string => typeof attribute === "string")
      : [];
    const requiredChildren = Array.isArray(descriptorSchema.requiredChildren)
      ? descriptorSchema.requiredChildren.filter((child): child is string => typeof child === "string")
      : [];
    const entries = new Map<SourceShape, string>();
    const entriesSource = isObject(spec.entries) ? spec.entries : {};
    for (const shape of ["directory", "manifest"] as const) {
      if (!sourceShapes.includes(shape)) continue;
      const entrySpec = isObject(entriesSource[shape]) ? entriesSource[shape] : {};
      const entry = typeof entrySpec.entry === "string" ? entrySpec.entry : "";
      if (!plainEntryName(entry)) {
        throw new Error(`KIND_DEFINITION_INVALID ${file}: ${shape} source shape requires a plain exact entry filename.`);
      }
      entries.set(shape, entry);
    }
    const identity = isObject(spec.identity) ? spec.identity : {};
    const fqn = isObject(identity.fqn) ? identity.fqn : {};
    const identityFrom = typeof fqn.from === "string" ? fqn.from : "";
    const identityRequired = fqn.required === true;
    if (!resourceKind || sourceShapes.length !== 1 || !rootElement || identityFrom !== "@fqn" || !identityRequired) {
      throw new Error(`KIND_DEFINITION_INVALID ${file}: resourceKind/sourceShapes/rootElement/@fqn identity must be explicit.`);
    }
    if (definitions.has(resourceKind)) throw new Error(`KIND_DEFINITION_DUPLICATE resourceKind ${resourceKind}.`);
    const sourceShapeKey = `${sourceShapes[0]}:${resourceKind}`;
    if (sourceShapeOwners.has(sourceShapeKey)) throw new Error(`KIND_DEFINITION_DUPLICATE sourceShape/resourceKind ${sourceShapeKey}.`);
    if (rootElementOwners.has(rootElement)) throw new Error(`KIND_DEFINITION_DUPLICATE rootElement ${rootElement}.`);
    sourceShapeOwners.set(sourceShapeKey, resourceKind);
    rootElementOwners.set(rootElement, resourceKind);
    definitions.set(resourceKind, {
      resourceKind,
      sourceShapes: new Set(sourceShapes),
      rootElement,
      requiredAttributes: new Set(requiredAttributes),
      requiredChildren: new Set(requiredChildren),
      identityFrom,
      identityRequired,
      entries,
    });
  }
  if (definitions.size !== 28) throw new Error(`KIND_DEFINITION_REGISTRY expected 28 definitions, found ${definitions.size}.`);
  return definitions;
}

function genericKindDefinitionBuiltin(): KindDefinition {
  return {
    resourceKind: "KindDefinition",
    sourceShapes: new Set(["file"]),
    rootElement: "KindDefinition",
    requiredAttributes: new Set(),
    requiredChildren: new Set(),
    identityFrom: "",
    identityRequired: false,
    identityNamePath: "metadata.name",
    entries: new Map(),
    allowedReferenceBoundaries: new Set(),
  };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function yamlObjectAt(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, part) => {
    if (!isObject(current)) return undefined;
    return current[part];
  }, value);
}

function parseGenericKindDefinition(file: string, raw: XmlObject): KindDefinition {
  if (raw.apiVersion !== "fs-native/v1" || raw.kind !== "KindDefinition") {
    throw new Error(`RESOURCE_KIND_CONTRACT_INVALID: KindDefinition ${file} must use apiVersion=fs-native/v1 and kind=KindDefinition.`);
  }
  const metadata = isObject(raw.metadata) ? raw.metadata : {};
  const spec = isObject(raw.spec) ? raw.spec : {};
  const resourceKind = typeof spec.resourceKind === "string" ? spec.resourceKind : "";
  const sourceShapes = stringArray(spec.sourceShapes)
    .filter((shape): shape is SourceShape => shape === "file" || shape === "directory" || shape === "manifest");
  const descriptorSchema = isObject(spec.descriptorSchema) ? spec.descriptorSchema : {};
  const rootElement = typeof descriptorSchema.rootElement === "string" ? descriptorSchema.rootElement : resourceKind;
  const requiredAttributes = new Set(stringArray(descriptorSchema.requiredAttributes));
  const requiredChildren = new Set(stringArray(descriptorSchema.requiredChildren));
  const identity = isObject(spec.identity) ? spec.identity : {};
  const fqn = isObject(identity.fqn) ? identity.fqn : {};
  const name = isObject(identity.name) ? identity.name : {};
  const description = isObject(spec.description) ? spec.description : {};
  const entries = new Map<SourceShape, string>();
  const entriesSource = isObject(spec.entries) ? spec.entries : {};
  for (const shape of ["directory", "manifest"] as const) {
    const entrySpec = isObject(entriesSource[shape]) ? entriesSource[shape] : {};
    const entry = typeof entrySpec.entry === "string" ? entrySpec.entry : "";
    if (entry) entries.set(shape, entry);
  }
  const internalContract = isObject(spec.internalContract) ? spec.internalContract : {};
  const allowedReferenceBoundaries = new Set<string>();
  const allowedReferences = Array.isArray(internalContract.allowedReferences) ? internalContract.allowedReferences : [];
  for (const reference of allowedReferences) {
    if (!isObject(reference)) continue;
    if (typeof reference.boundary === "string") allowedReferenceBoundaries.add(reference.boundary);
  }
  const metadataName = typeof metadata.name === "string" ? metadata.name : "";
  if (!resourceKind || !metadataName || metadataName !== resourceKind || sourceShapes.length === 0 || !rootElement) {
    throw new Error(`RESOURCE_KIND_CONTRACT_INVALID: KindDefinition ${file} must declare metadata.name, spec.resourceKind, sourceShapes, and descriptorSchema.rootElement.`);
  }
  return {
    resourceKind,
    sourceShapes: new Set(sourceShapes),
    rootElement,
    requiredAttributes,
    requiredChildren,
    identityFrom: typeof fqn.from === "string" ? fqn.from : "",
    identityRequired: fqn.required === true,
    identityFqnPath: typeof fqn.path === "string" ? fqn.path : typeof fqn.from === "string" ? fqn.from : undefined,
    identityNamePath: typeof name.path === "string" ? name.path : undefined,
    descriptionPath: typeof description.path === "string" ? description.path : undefined,
    entries,
    allowedReferenceBoundaries,
  };
}

function loadGenericKindDefinitionFile(context: ValidationContext, definitions: Map<string, KindDefinition>, loadedFiles: Set<string>, file: string): void {
  const canonicalFile = realpathSync(file);
  if (loadedFiles.has(canonicalFile)) return;
  loadedFiles.add(canonicalFile);
  try {
    const raw = Bun.YAML.parse(readFileSync(canonicalFile, "utf8")) as XmlObject;
    const definition = parseGenericKindDefinition(canonicalFile, raw);
    const existing = definitions.get(definition.resourceKind);
    if (existing && existing.resourceKind !== "KindDefinition") {
      add(context, canonicalFile, `RESOURCE_KIND_CONTRACT_INVALID: duplicate KindDefinition for '${definition.resourceKind}'.`);
      return;
    }
    definitions.set(definition.resourceKind, definition);
  } catch (error) {
    add(context, canonicalFile, error instanceof Error ? error.message : String(error));
  }
}

function loadGenericKindDefinitionsFromDirectory(context: ValidationContext, definitions: Map<string, KindDefinition>, loadedFiles: Set<string>, directory: string): void {
  if (!existsSync(directory) || !lstatSync(directory).isDirectory()) return;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".yaml")) continue;
    loadGenericKindDefinitionFile(context, definitions, loadedFiles, resolve(directory, entry.name));
  }
}

function loadGenericKindDefinitions(context: ValidationContext, rootFile: string, root: XmlObject): Map<string, KindDefinition> {
  const definitions = new Map<string, KindDefinition>([["KindDefinition", genericKindDefinitionBuiltin()]]);
  const loadedFiles = new Set<string>();
  loadGenericKindDefinitionsFromDirectory(context, definitions, loadedFiles, resolve(context.workspaceRoot, "KindDefinitions"));

  for (const catalog of childObjects(root, "FileResourceCatalog")) {
    if (attribute(catalog, "kind") !== "KindDefinition") continue;
    const rootResolution = resolveCatalogRoot(context, dirname(rootFile), attribute(catalog, "root"));
    if (!rootResolution.directory) {
      add(context, rootFile, rootResolution.error!);
      continue;
    }
    loadGenericKindDefinitionsFromDirectory(context, definitions, loadedFiles, rootResolution.directory);
  }
  return definitions;
}

function predicateChildren(): Record<string, ChildRule> {
  return Object.fromEntries([...predicateElements].map((name) => [name, {}]));
}

const specs: Record<string, ElementSpec> = {
  Ontology: { attributes: ["fqn", "id", "version"], requiredAttributes: ["fqn", "id", "version"], children: { Description: { max: 1 }, FileResourceCatalog: {}, DirectoryResourceCatalog: {}, ManifestResourceCatalog: {} }, order: ["Description"], atLeastOneOf: ["FileResourceCatalog", "DirectoryResourceCatalog", "ManifestResourceCatalog"] },
  FileResourceCatalog: { attributes: ["id", "kind", "root"], requiredAttributes: ["id", "kind", "root"] },
  DirectoryResourceCatalog: { attributes: ["id", "kind", "root", "entry"], requiredAttributes: ["id", "kind", "root", "entry"] },
  ManifestResourceCatalog: { attributes: ["id", "kind", "root", "entry"], requiredAttributes: ["id", "kind", "root", "entry"] },
  ScalarTypes: { children: { ScalarType: { min: 1 } }, order: ["ScalarType"], minElementChildren: 1 },
  ScalarType: { attributes: ["fqn", "id", "base"], requiredAttributes: ["id", "base"], children: { Description: { max: 1 }, Evidences: { max: 1 } }, order: ["Description", "Evidences"] },
  EnumTypes: { children: { EnumType: { min: 1 } }, order: ["EnumType"], minElementChildren: 1 },
  EnumType: { attributes: ["fqn", "id", "status"], requiredAttributes: ["id"], children: { Description: { max: 1 }, Members: { min: 1, max: 1 }, Evidences: { max: 1 } }, order: ["Description", "Members", "Evidences"] },
  Members: { children: { Member: { min: 1 } }, order: ["Member"], minElementChildren: 1 },
  Member: { attributes: ["id", "value"], requiredAttributes: ["id", "value"], children: { Description: { max: 1 } }, order: ["Description"] },
  ObjectTypes: { children: { ObjectType: { min: 1 } }, order: ["ObjectType"], minElementChildren: 1 },
  ObjectType: { attributes: ["fqn", "id", "parentRef", "abstract", "kind", "status"], requiredAttributes: ["id"], children: { Description: { max: 1 }, Mixins: { max: 1 }, Properties: { max: 1 }, ComputedProperties: { max: 1 }, Evidences: { max: 1 } }, order: ["Description", "Mixins", "Properties", "ComputedProperties", "Evidences"] },
  Mixin: { attributes: ["fqn", "id", "status"], requiredAttributes: ["id"], children: { Description: { max: 1 }, Properties: { max: 1 }, Evidences: { max: 1 } }, order: ["Description", "Properties", "Evidences"] },
  Property: { attributes: ["name", "typeRef", "required", "role", "status", "defaultKind"], requiredAttributes: ["name", "typeRef", "required"], children: { Description: { max: 1 }, Evidences: { max: 1 } }, order: ["Description", "Evidences"] },
  ComputedProperties: { children: { ComputedProperty: { min: 1 } }, order: ["ComputedProperty"], minElementChildren: 1 },
  ComputedProperty: { attributes: ["name", "typeRef", "status"], requiredAttributes: ["name", "typeRef"], children: { Description: { max: 1 }, Statement: { max: 1 }, Evidences: { max: 1 } }, order: ["Description", "Statement", "Evidences"] },
  UnionTypes: { children: { UnionType: { min: 1 } }, order: ["UnionType"], minElementChildren: 1 },
  UnionType: { attributes: ["fqn", "id", "status"], requiredAttributes: ["id"], children: { Description: { max: 1 }, Options: { min: 1, max: 1 }, Evidences: { max: 1 } }, order: ["Description", "Options", "Evidences"] },
  Options: { children: { Type: { min: 2 } }, order: ["Type"], minElementChildren: 2 },
  CollectionTypes: { children: { CollectionType: { min: 1 } }, order: ["CollectionType"], minElementChildren: 1 },
  CollectionType: { attributes: ["fqn", "id", "collection", "itemTypeRef", "keyTypeRef", "status"], requiredAttributes: ["id", "collection", "itemTypeRef"], children: { Description: { max: 1 }, Evidences: { max: 1 } }, order: ["Description", "Evidences"] },
  Relations: { children: { Relation: { min: 1 } }, order: ["Relation"], minElementChildren: 1 },
  Relation: { attributes: ["fqn", "id", "name", "fromTypeRef", "toTypeRef", "directed", "min", "max", "status"], requiredAttributes: ["id", "name", "fromTypeRef", "toTypeRef", "directed"], children: { Description: { max: 1 }, Properties: { max: 1 }, Evidences: { max: 1 } }, order: ["Description", "Properties", "Evidences"] },
  Rules: { children: { Rule: { min: 1 } }, order: ["Rule"], minElementChildren: 1 },
  Rule: { attributes: ["fqn", "id", "scopeTypeRef", "kind", "status"], requiredAttributes: ["id", "scopeTypeRef", "kind"], children: { Statement: { min: 1, max: 1 }, When: { max: 1 }, Require: { min: 1, max: 1 }, Violation: { min: 1, max: 1 }, Evidences: { max: 1 } }, order: ["Statement", "When", "Require", "Violation", "Evidences"] },
  When: { children: predicateChildren(), minElementChildren: 1, maxElementChildren: 1 },
  Require: { children: predicateChildren(), minElementChildren: 1, maxElementChildren: 1 },
  Guard: { children: predicateChildren(), minElementChildren: 1, maxElementChildren: 1 },
  All: { children: predicateChildren(), minElementChildren: 2 },
  Any: { children: predicateChildren(), minElementChildren: 2 },
  Not: { children: predicateChildren(), minElementChildren: 1, maxElementChildren: 1 },
  PropertyPresent: { attributes: ["propertyRef"], requiredAttributes: ["propertyRef"] },
  PropertyEquals: { attributes: ["propertyRef", "value"], requiredAttributes: ["propertyRef", "value"] },
  PropertyNotEquals: { attributes: ["propertyRef", "value"], requiredAttributes: ["propertyRef", "value"] },
  PropertyIn: { attributes: ["propertyRef"], requiredAttributes: ["propertyRef"], children: { Value: { min: 1 } }, order: ["Value"], minElementChildren: 1 },
  Value: { attributes: ["value"], requiredAttributes: ["value"] },
  PropertyCompare: { attributes: ["propertyRef", "op", "value", "otherPropertyRef"], requiredAttributes: ["propertyRef", "op"] },
  TypeIs: { attributes: ["typeRef"], requiredAttributes: ["typeRef"] },
  RelatedExists: { attributes: ["relationRef"], requiredAttributes: ["relationRef"], children: predicateChildren(), minElementChildren: 1, maxElementChildren: 1 },
  EveryRelated: { attributes: ["relationRef"], requiredAttributes: ["relationRef"], children: predicateChildren(), minElementChildren: 1, maxElementChildren: 1 },
  RelatedCount: { attributes: ["relationRef", "op", "value"], requiredAttributes: ["relationRef", "op", "value"] },
  ExistsRelated: { attributes: ["relationRef", "direction", "targetTypeRef"], requiredAttributes: ["relationRef", "direction", "targetTypeRef"] },
  Violation: { attributes: ["code", "message"], requiredAttributes: ["code", "message"] },
  StateMachines: { children: { StateMachine: { min: 1 } }, order: ["StateMachine"], minElementChildren: 1 },
  StateMachine: { attributes: ["fqn", "id", "subjectTypeRef", "statePropertyRef", "initial", "status"], requiredAttributes: ["id", "subjectTypeRef", "statePropertyRef", "initial"], children: { Description: { max: 1 }, States: { min: 1, max: 1 }, Derivations: { max: 1 }, Transitions: { min: 1, max: 1 }, Evidences: { max: 1 } }, order: ["Description", "States", "Derivations", "Transitions", "Evidences"] },
  States: { children: { State: { min: 1 } }, order: ["State"], minElementChildren: 1 },
  State: { attributes: ["id", "terminal", "status"], requiredAttributes: ["id"], children: { Description: { max: 1 } }, order: ["Description"] },
  Derivations: { children: { Derivation: { min: 1 } }, order: ["Derivation"], minElementChildren: 1 },
  Derivation: { attributes: ["id", "status"], requiredAttributes: ["id"], children: { Description: { max: 1 }, Statement: { min: 1, max: 1 }, When: { max: 1 }, Yields: { min: 1, max: 1 }, Evidences: { max: 1 } }, order: ["Description", "Statement", "When", "Yields", "Evidences"] },
  Yields: { attributes: ["state"], requiredAttributes: ["state"] },
  Transitions: { children: { Transition: { min: 1 } }, order: ["Transition"], minElementChildren: 1 },
  Transition: { attributes: ["id", "trigger", "from", "to", "status"], requiredAttributes: ["id", "trigger", "from", "to"], children: { Description: { max: 1 }, Guard: { max: 1 }, Effects: { max: 1 }, Evidences: { max: 1 } }, order: ["Description", "Guard", "Effects", "Evidences"] },
  Effects: { children: { SetProperty: {}, ClearProperty: {}, CreateRelation: {}, RemoveRelation: {} }, minElementChildren: 1 },
  SetProperty: { attributes: ["propertyRef", "value"], requiredAttributes: ["propertyRef", "value"] },
  ClearProperty: { attributes: ["propertyRef"], requiredAttributes: ["propertyRef"] },
  CreateRelation: { attributes: ["relationRef", "targetRef"], requiredAttributes: ["relationRef", "targetRef"] },
  RemoveRelation: { attributes: ["relationRef", "targetRef"], requiredAttributes: ["relationRef", "targetRef"] },
  BusinessObject: { attributes: ["fqn", "id", "parentRef", "abstract", "status"], requiredAttributes: ["fqn", "id"], children: { Description: { min: 1, max: 1 }, Purpose: { min: 1, max: 1 }, Mixins: { max: 1 }, Identity: { max: 1 }, Properties: { max: 1 }, ComputedProperties: { max: 1 }, Constraints: { max: 1 }, Lifecycles: { max: 1 }, Evidences: { max: 1 }, ManifestResourceCatalog: {} }, order: ["Description", "Purpose", "Mixins", "Identity", "Properties", "ComputedProperties", "Constraints", "Lifecycles", "Evidences", "ManifestResourceCatalog"] },
  Identity: { children: { Property: { min: 1 } }, order: ["Property"], minElementChildren: 1 },
  Constraints: { children: { Rule: { min: 1 } }, order: ["Rule"], minElementChildren: 1 },
  Lifecycles: { children: { StateMachine: { min: 1 } }, order: ["StateMachine"], minElementChildren: 1 },
  AssociationCatalog: { attributes: ["fqn", "id"], requiredAttributes: ["fqn", "id"], children: { Description: { max: 1 }, Associations: { min: 1, max: 1 } }, order: ["Description", "Associations"] },
  Associations: { children: { Association: { min: 1 } }, order: ["Association"], minElementChildren: 1 },
  Association: { attributes: ["id", "relationRef", "status"], requiredAttributes: ["id", "relationRef"], children: { Description: { max: 1 }, Evidences: { max: 1 } }, order: ["Description", "Evidences"] },
  DomainPolicyCatalog: { attributes: ["fqn", "id"], requiredAttributes: ["fqn", "id"], children: { Description: { max: 1 }, DomainPolicies: { min: 1, max: 1 } }, order: ["Description", "DomainPolicies"] },
  DomainPolicies: { children: { DomainPolicy: { min: 1 } }, order: ["DomainPolicy"], minElementChildren: 1 },
  DomainPolicy: { attributes: ["id", "ownerKind", "ownerRef", "status"], requiredAttributes: ["id", "ownerKind"], children: { Description: { max: 1 }, Statement: { min: 1, max: 1 }, Rules: { max: 1 }, Evidences: { max: 1 } }, order: ["Description", "Statement", "Rules", "Evidences"] },
  ConstraintHandlerCatalog: { attributes: ["fqn", "id"], requiredAttributes: ["fqn", "id"], children: { Description: { max: 1 }, ConstraintHandlers: { min: 1, max: 1 } }, order: ["Description", "ConstraintHandlers"] },
  ConstraintHandlers: { children: { ConstraintHandler: { min: 1 } }, order: ["ConstraintHandler"], minElementChildren: 1 },
  ConstraintHandler: { attributes: ["fqn", "id", "ownerKind", "ownerRef", "portability", "status"], requiredAttributes: ["id", "ownerKind", "portability"], children: { Description: { max: 1 }, Statement: { min: 1, max: 1 }, Rules: { max: 1 }, Evidences: { max: 1 } }, order: ["Description", "Statement", "Rules", "Evidences"] },
  Action: { attributes: ["fqn", "id", "ownerRef", "portability", "status"], requiredAttributes: ["fqn", "id", "ownerRef", "portability"], children: { Description: { min: 1, max: 1 }, Mutations: { max: 1 }, InternalLogic: { max: 1 }, Evidences: { max: 1 } }, order: ["Description", "Mutations", "InternalLogic", "Evidences"] },
  Mutation: { attributes: ["fqn", "id", "ownerRef", "portability", "status"], requiredAttributes: ["fqn", "id", "ownerRef", "portability"], children: { Description: { min: 1, max: 1 }, InternalLogic: { max: 1 }, Evidences: { max: 1 } }, order: ["Description", "InternalLogic", "Evidences"] },
  Mutations: { children: { Mutation: { min: 1 } }, order: ["Mutation"], minElementChildren: 1 },
  Interceptor: { attributes: ["fqn", "id", "ownerRef", "actionRef", "phase", "seq", "portability", "status"], requiredAttributes: ["fqn", "id", "ownerRef", "actionRef", "phase", "seq", "portability"], children: { Description: { min: 1, max: 1 }, InternalLogic: { max: 1 }, Evidences: { max: 1 } }, order: ["Description", "InternalLogic", "Evidences"] },
  ComputedFunction: { attributes: ["fqn", "id", "ownerRef", "name", "returnTypeRef", "portability", "status"], requiredAttributes: ["fqn", "id", "ownerRef", "name", "returnTypeRef", "portability"], children: { Description: { min: 1, max: 1 }, Statement: { max: 1 }, Evidences: { max: 1 } }, order: ["Description", "Statement", "Evidences"] },
  Lifecycle: { attributes: ["fqn", "id", "ownerRef", "stateMachineRef", "status"], requiredAttributes: ["fqn", "id", "ownerRef", "stateMachineRef"], children: { Description: { min: 1, max: 1 }, Evidences: { max: 1 } }, order: ["Description", "Evidences"] },
  BusinessProcessCatalog: { attributes: ["fqn", "id"], requiredAttributes: ["fqn", "id"], children: { Description: { max: 1 }, BusinessProcesses: { min: 1, max: 1 } }, order: ["Description", "BusinessProcesses"] },
  BusinessProcesses: { children: { BusinessProcess: { min: 1 } }, order: ["BusinessProcess"], minElementChildren: 1 },
  BusinessProcess: { attributes: ["id", "status"], requiredAttributes: ["id"], children: { Description: { max: 1 }, Participants: { min: 1, max: 1 }, Policies: { max: 1 }, Evidences: { max: 1 } }, order: ["Description", "Participants", "Policies", "Evidences"] },
  Participants: { children: { Type: {}, Relation: {}, StateMachine: {} }, minElementChildren: 1 },
  Policies: { children: { Rule: { min: 1 } }, order: ["Rule"], minElementChildren: 1 },
  CapabilityCatalog: { attributes: ["fqn", "id"], requiredAttributes: ["fqn", "id"], children: { Description: { max: 1 }, Capabilities: { min: 1, max: 1 } }, order: ["Description", "Capabilities"] },
  Capabilities: { children: { Capability: {}, Atomicity: {}, Observation: {} }, minElementChildren: 1 },
  Capability: { attributes: ["id", "name", "value", "status"], requiredAttributes: [], children: { Description: { max: 1 }, Inputs: { max: 1 }, Outputs: { max: 1 }, Evidences: { max: 1 } }, order: ["Description", "Inputs", "Outputs", "Evidences"] },
  Inputs: { children: { Type: { min: 1 } }, order: ["Type"], minElementChildren: 1 },
  Outputs: { children: { Type: { min: 1 } }, order: ["Type"], minElementChildren: 1 },
  EventContractCatalog: { attributes: ["fqn", "id"], requiredAttributes: ["fqn", "id"], children: { Description: { max: 1 }, EventContracts: { min: 1, max: 1 } }, order: ["Description", "EventContracts"] },
  EventContracts: { children: { EventContract: { min: 1 } }, order: ["EventContract"], minElementChildren: 1 },
  EventContract: { attributes: ["id", "eventTypeRef", "status"], requiredAttributes: ["id", "eventTypeRef"], children: { Description: { max: 1 }, Subjects: { max: 1 }, Evidences: { max: 1 } }, order: ["Description", "Subjects", "Evidences"] },
  Subjects: { children: { Type: {}, Relation: {} }, minElementChildren: 1 },
  OperationCatalog: { attributes: ["fqn", "id"], requiredAttributes: ["fqn", "id"], children: { Description: { max: 1 }, Operations: { min: 1, max: 1 }, InvocationPresets: { max: 1 } }, order: ["Description", "Operations", "InvocationPresets"] },
  Operations: { children: { Operation: { min: 1 } }, order: ["Operation"], minElementChildren: 1 },
  Operation: { attributes: ["id", "verb", "owner", "ownerRef", "behavior", "subject", "invocation", "effect", "subjectTypeRef", "inputTypeRef", "outputTypeRef", "status"], requiredAttributes: ["id", "verb", "owner", "behavior", "subject", "invocation", "effect"], children: { Description: { max: 1 }, Purpose: { max: 1 }, InternalLogic: { max: 1 }, Composition: { max: 1 }, Constraints: { max: 1 }, Capabilities: { min: 1, max: 1 }, Evidences: { max: 1 } }, order: ["Description", "Purpose", "InternalLogic", "Composition", "Constraints", "Capabilities", "Evidences"] },
  Composition: { children: { Operation: { min: 1 } }, order: ["Operation"], minElementChildren: 1 },
  Atomicity: { attributes: ["value"], requiredAttributes: ["value"] },
  Observation: { attributes: ["value"], requiredAttributes: ["value"] },
  InvocationPresets: { children: { InvocationPreset: { min: 1 } }, order: ["InvocationPreset"], minElementChildren: 1 },
  InvocationPreset: { attributes: ["id", "operationRef", "status", "default"], requiredAttributes: ["id", "operationRef"], children: { Title: { max: 1 }, Description: { max: 1 }, RequestJson: { min: 1, max: 1 }, Evidences: { max: 1 } }, order: ["Title", "Description", "RequestJson", "Evidences"] },
  EvidenceCatalog: { attributes: ["fqn", "id"], requiredAttributes: ["fqn", "id"], children: { Description: { max: 1 }, Evidences: { min: 1, max: 1 } }, order: ["Description", "Evidences"] },
  Evidence: { attributes: ["id", "source", "repository", "revision", "artifact", "path", "symbol", "lines", "grade", "resolver", "confidence", "observedAt", "sourceKind", "externalId", "ref"], requiredAttributes: ["id", "source", "grade", "confidence"], text: "optional" },
  RuntimeBindingCatalog: { attributes: ["fqn", "id"], requiredAttributes: ["fqn", "id"], children: { Description: { max: 1 }, RuntimeBindings: { min: 1, max: 1 } }, order: ["Description", "RuntimeBindings"] },
  RuntimeBindings: { children: { RuntimeBinding: { min: 1 } }, order: ["RuntimeBinding"], minElementChildren: 1 },
  RuntimeBinding: { attributes: ["id", "targetKind", "targetRef", "runtime", "portability", "status"], requiredAttributes: ["id", "targetKind", "targetRef", "runtime", "portability"], children: { Description: { max: 1 }, HandlerRef: { min: 1, max: 1 }, Capabilities: { max: 1 }, Evidences: { max: 1 } }, order: ["Description", "HandlerRef", "Capabilities", "Evidences"] },
  HandlerRef: { attributes: ["registry", "key", "version", "contract"], requiredAttributes: ["registry", "key"] },
  ImplementationMappingCatalog: { attributes: ["fqn", "id"], requiredAttributes: ["fqn", "id"], children: { Description: { max: 1 }, Mappings: { min: 1, max: 1 } }, order: ["Description", "Mappings"] },
  Mappings: { children: { ImplementationMapping: { min: 1 } }, order: ["ImplementationMapping"], minElementChildren: 1 },
  ImplementationMapping: { attributes: ["id", "targetKind", "targetRef", "status"], requiredAttributes: ["id", "targetKind", "targetRef"], children: { Description: { max: 1 }, RepresentedBy: { max: 1 }, ImplementedBy: { max: 1 }, PresentedBy: { max: 1 }, StoredBy: { max: 1 }, ExposedBy: { max: 1 }, Enforces: { max: 1 }, Evidences: { max: 1 } }, order: ["Description", "RepresentedBy", "ImplementedBy", "PresentedBy", "StoredBy", "ExposedBy", "Enforces", "Evidences"] },
  RepresentedBy: { children: { CodeRef: { min: 1 } }, order: ["CodeRef"], minElementChildren: 1 },
  ImplementedBy: { children: { CodeRef: { min: 1 } }, order: ["CodeRef"], minElementChildren: 1 },
  PresentedBy: { children: { CodeRef: { min: 1 } }, order: ["CodeRef"], minElementChildren: 1 },
  StoredBy: { children: { CodeRef: { min: 1 } }, order: ["CodeRef"], minElementChildren: 1 },
  ExposedBy: { children: { CodeRef: { min: 1 } }, order: ["CodeRef"], minElementChildren: 1 },
  CodeRef: { attributes: ["repository", "language", "kind", "symbol", "path", "resolver", "confidence"], requiredAttributes: ["repository", "language", "kind", "symbol"] },
  Enforces: { children: { Rule: { min: 1 } }, order: ["Rule"], minElementChildren: 1 },
  SchemaEvolutionModule: { attributes: ["fqn", "id"], requiredAttributes: ["fqn", "id"], children: { Description: { max: 1 }, Aliases: { max: 1 }, Migrations: { max: 1 }, GenerationSnapshots: { max: 1 } }, order: ["Description", "Aliases", "Migrations", "GenerationSnapshots"], atLeastOneOf: ["Aliases", "Migrations", "GenerationSnapshots"] },
  Aliases: { children: { Alias: { min: 1 } }, order: ["Alias"], minElementChildren: 1 },
  Alias: { attributes: ["id", "kind", "from", "to", "ownerRef", "sinceVersion", "untilVersion", "status"], requiredAttributes: ["id", "kind", "from", "to", "sinceVersion"], children: { Description: { max: 1 }, Evidences: { max: 1 } }, order: ["Description", "Evidences"] },
  Migrations: { children: { Migration: { min: 1 } }, order: ["Migration"], minElementChildren: 1 },
  Migration: { attributes: ["id", "fromVersion", "toVersion", "compatibility", "status"], requiredAttributes: ["id", "fromVersion", "toVersion", "compatibility"], children: { Description: { max: 1 }, Changes: { min: 1, max: 1 }, Evidences: { max: 1 } }, order: ["Description", "Changes", "Evidences"] },
  Changes: { children: { Add: {}, Remove: {}, Rename: {}, Alter: {} }, minElementChildren: 1 },
  Add: { attributes: ["kind", "targetRef", "ownerRef"], requiredAttributes: ["kind", "targetRef"] },
  Remove: { attributes: ["kind", "targetRef", "ownerRef"], requiredAttributes: ["kind", "targetRef"] },
  Rename: { attributes: ["kind", "from", "to", "ownerRef"], requiredAttributes: ["kind", "from", "to"] },
  Alter: { attributes: ["kind", "targetRef", "aspect", "ownerRef"], requiredAttributes: ["kind", "targetRef", "aspect"] },
  GenerationSnapshots: { children: { GenerationSnapshot: { min: 1 } }, order: ["GenerationSnapshot"], minElementChildren: 1 },
  GenerationSnapshot: { attributes: ["id", "ontologyVersion", "generatedAt", "generator", "generatorVersion"], requiredAttributes: ["id", "ontologyVersion", "generatedAt", "generator"], children: { SourceRevisions: { min: 1, max: 1 }, OutputDigest: { min: 1, max: 1 } }, order: ["SourceRevisions", "OutputDigest"] },
  SourceRevisions: { children: { SourceRevision: { min: 1 } }, order: ["SourceRevision"], minElementChildren: 1 },
  SourceRevision: { attributes: ["repository", "revision"], requiredAttributes: ["repository", "revision"] },
  OutputDigest: { attributes: ["algorithm", "value"], requiredAttributes: ["algorithm", "value"] },
  ...genericContainers,
};

function isObject(value: unknown): value is XmlObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function childObjects(node: XmlObject, name: string): XmlObject[] {
  return asArray(node[name]).filter(isObject);
}

function firstChildValue(node: XmlObject, name: string): unknown {
  return asArray(node[name])[0];
}

function directChildEntries(node: XmlObject): Array<[string, XmlObject]> {
  const entries: Array<[string, XmlObject]> = [];
  for (const [name, value] of Object.entries(node)) {
    if (name.startsWith("@_") || name === "#text") continue;
    for (const child of asArray(value)) {
      if (isObject(child)) entries.push([name, child]);
    }
  }
  return entries;
}

function attribute(node: XmlObject, name: string): string {
  const value = node[`@_${name}`];
  return typeof value === "string" ? value : "";
}

function hasAttribute(node: XmlObject, name: string): boolean {
  return Object.hasOwn(node, `@_${name}`);
}

function nodeText(node: unknown): string {
  if (typeof node === "string") return node;
  if (!isObject(node)) return "";
  const text = node["#text"];
  return typeof text === "string" ? text : "";
}

function add(context: ValidationContext, file: string, message: string): void {
  context.diagnostics.push({ file, message });
}

function parseArgs(): { rootFile: string; workspaceRoot: string; generated: boolean; hypothesisOnly: boolean } {
  const args = process.argv.slice(2);
  let rootArgument = "";
  let workspaceArgument = "";
  let generated = false;
  let hypothesisOnly = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!;
    if (argument === "--generated") {
      generated = true;
      continue;
    }
    if (argument === "--hypothesis-only") {
      hypothesisOnly = true;
      continue;
    }
    if (argument === "--workspace-root") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        console.error("--workspace-root requires a path.");
        process.exit(2);
      }
      workspaceArgument = value;
      index += 1;
      continue;
    }
    if (argument.startsWith("--")) {
      console.error(`Unknown option '${argument}'.`);
      process.exit(2);
    }
    if (rootArgument) {
      console.error(`Unexpected positional argument '${argument}'.`);
      process.exit(2);
    }
    rootArgument = argument;
  }

  if (!rootArgument) {
    console.error("Usage: validate-ontology-xml.ts <ontology.xml> [--workspace-root <path>] [--generated] [--hypothesis-only]");
    process.exit(2);
  }

  const rootFile = resolve(rootArgument);
  const workspaceRoot = workspaceArgument ? resolve(workspaceArgument) : dirname(rootFile);
  if (!existsSync(workspaceRoot)) {
    console.error(`Workspace root does not exist: ${workspaceRoot}`);
    process.exit(2);
  }
  return { rootFile, workspaceRoot: realpathSync(workspaceRoot), generated, hypothesisOnly };
}

function pathIsWithin(root: string, target: string): boolean {
  const path = relative(root, target);
  return path === "" || (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path));
}

function resolveWorkspaceFile(workspaceRoot: string, candidate: string): { file?: string; requestedEntry?: string; actualEntry?: string; error?: string } {
  const requestedEntry = entryFileName(candidate);
  try {
    if (!existsSync(candidate)) return { error: "Referenced XML file does not exist or is not a regular file." };
    if (lstatSync(candidate).isSymbolicLink()) {
      return { error: `Referenced XML file traverses a symbolic link: ${candidate}` };
    }
    if (!lstatSync(candidate).isFile()) return { error: "Referenced XML file does not exist or is not a regular file." };
    const canonicalFile = realpathSync(candidate);
    if (!pathIsWithin(workspaceRoot, canonicalFile)) {
      return { error: "Referenced XML file escapes workspace root after realpath resolution." };
    }
    if (pathIsWithin(workspaceRoot, candidate)) {
      const pathFromRoot = relative(workspaceRoot, candidate);
      let current = workspaceRoot;
      for (const segment of pathFromRoot.split(sep).filter(Boolean)) {
        current = resolve(current, segment);
        if (lstatSync(current).isSymbolicLink()) {
          return { error: `Referenced XML file traverses a symbolic link: ${current}` };
        }
      }
    }
    const actualEntry = readdirSync(dirname(canonicalFile), { withFileTypes: true })
      .find((entry) => entry.isFile() && resolve(dirname(canonicalFile), entry.name) === canonicalFile)?.name;
    if (!actualEntry) return { error: "Referenced XML file could not be matched to its directory entry safely." };
    return { file: canonicalFile, requestedEntry, actualEntry };
  } catch {
    return { error: "Referenced XML file could not be resolved safely." };
  }
}

function parseDslResource(source: string, uri: string): XmlObject {
  if (Buffer.byteLength(source, "utf8") > maxXmlBytes) {
    throw new Error(`XML input at ${uri} exceeds parser size limit ${maxXmlBytes} bytes.`);
  }
  const normalizedSource = source.replace(/^\uFEFF/, "");
  const encodingMatch = normalizedSource.match(/<\?xml[^>]*\bencoding\s*=\s*["']([^"']+)["'][^>]*\?>/i);
  if (encodingMatch && !/^utf-?8$/i.test(encodingMatch[1]!)) {
    throw new Error(`Unsupported XML encoding '${encodingMatch[1]}' at ${uri}; only UTF-8 is accepted.`);
  }
  if (/<!DOCTYPE/i.test(normalizedSource) || /<!ENTITY/i.test(normalizedSource)) {
    throw new Error(`DOCTYPE/ENTITY declarations are forbidden at ${uri}.`);
  }
  const validation = XMLValidator.validate(normalizedSource);
  if (validation !== true) {
    const error = validation.err ?? {};
    const line = typeof error.line === "number" ? error.line : "?";
    const column = typeof error.col === "number" ? error.col : "?";
    throw new Error(`XML parse error at ${uri}:${line}:${column}: ${error.msg ?? "invalid XML"}`);
  }
  const document = new XMLParser({
    ignoreAttributes: false,
    ignoreDeclaration: true,
    attributeNamePrefix: "@_",
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: false,
  }).parse(normalizedSource) as XmlObject;
  if (Object.keys(document).length !== 1) throw new Error(`XML resource must have exactly one root element at ${uri}`);
  return document;
}

function specFor(element: string, node: XmlObject, parent: string | null): ElementSpec | undefined {
  if (element === "Type" && hasAttribute(node, "ref")) return { attributes: ["ref", "role"], requiredAttributes: ["ref"] };
  if (element === "Mixin" && hasAttribute(node, "ref")) return { attributes: ["ref"], requiredAttributes: ["ref"] };
  if (["Property", "Relation", "Rule", "StateMachine", "Operation", "Mutation", "Evidence", "RuntimeBinding", "ImplementationMapping"].includes(element) && hasAttribute(node, "ref")) {
    const attributes = element === "Property" ? ["ref", "role"] : ["ref", "role"];
    return { attributes, requiredAttributes: ["ref"] };
  }
  if (element === "Capability" && !hasAttribute(node, "id") && (parent === "Capabilities" || hasAttribute(node, "name"))) {
    return { attributes: ["name", "value"], requiredAttributes: ["name", "value"] };
  }
  return specs[element];
}

function validateDepaBoundary(context: ValidationContext, file: string, element: string, value: unknown): void {
  if (depaPattern.test(element)) add(context, file, `Element name <${element}> contains forbidden depa_* text.`);
  if (!isObject(value)) return;
  for (const [name, raw] of Object.entries(value)) {
    if (!name.startsWith("@_")) continue;
    const attr = name.slice(2);
    if (depaPattern.test(attr)) add(context, file, `<${element}> attribute name @${attr} contains forbidden depa_* text.`);
    if (typeof raw === "string" && depaPattern.test(raw)) add(context, file, `<${element}> @${attr} contains forbidden depa_* text '${raw}'.`);
  }
  if (depaPattern.test(nodeText(value))) add(context, file, `<${element}> text contains forbidden depa_* text.`);
}

function childOccurrenceCount(value: unknown): number {
  return value === undefined ? 0 : Array.isArray(value) ? value.length : 1;
}

function validateChildOrder(context: ValidationContext, file: string, element: string, childNames: string[], order?: string[]): void {
  if (!order) return;
  let lastIndex = -1;
  for (const childName of childNames) {
    const index = order.indexOf(childName);
    if (index === -1) continue;
    if (index < lastIndex) {
      add(context, file, `<${element}> child <${childName}> is out of latest grammar order.`);
    } else {
      lastIndex = index;
    }
  }
}

function validateElementGrammar(context: ValidationContext, file: string, element: string, node: unknown, parent: string | null): void {
  validateDepaBoundary(context, file, element, node);
  if (!isObject(node)) {
    const spec = specs[element];
    if (spec?.text === "required" || spec?.text === "optional") return;
    add(context, file, `<${element}> must be an element object.`);
    return;
  }

  if ((element === "Modules" || element === "Resources") && parent === "Ontology") {
    add(context, file, `ONTOLOGY_LEGACY_ASSEMBLY_REJECTED: Ontology/${element} and href assembly are retired; use direct FileResourceCatalog children.`);
  }
  const spec = specFor(element, node, parent);
  if (!spec) add(context, file, `Unknown ontology XML element <${element}>.`);

  const allowedAttributes = new Set(spec?.attributes ?? []);
  const requiredAttributes = new Set(spec?.requiredAttributes ?? []);
  for (const [name, value] of Object.entries(node)) {
    if (!name.startsWith("@_")) continue;
    const attr = name.slice(2);
    if (!allowedAttributes.has(attr)) add(context, file, `<${element}> does not allow attribute @${attr}.`);
    if (typeof value !== "string") add(context, file, `<${element}> @${attr} must be a string attribute.`);
  }
  for (const required of requiredAttributes) {
    if (!attribute(node, required).trim()) add(context, file, `<${element}> requires non-empty @${required}.`);
  }

  const text = nodeText(node);
  if (spec?.text === "required" && !text.trim()) add(context, file, `<${element}> requires non-empty plain text.`);
  if (spec?.text !== "required" && spec?.text !== "optional" && text.trim()) add(context, file, `<${element}> does not allow text content.`);

  const childEntries = directChildEntries(node);
  const childNames = childEntries.map(([name]) => name);
  const childCount = childEntries.length;
  if (spec?.minElementChildren !== undefined && childCount < spec.minElementChildren) {
    add(context, file, `<${element}> requires at least ${spec.minElementChildren} child element(s).`);
  }
  if (spec?.maxElementChildren !== undefined && childCount > spec.maxElementChildren) {
    add(context, file, `<${element}> allows at most ${spec.maxElementChildren} child element(s).`);
  }
  validateChildOrder(context, file, element, childNames, spec?.order);

  const allowedChildren = spec?.children ?? {};
  for (const [childName, childValue] of Object.entries(node)) {
    if (childName.startsWith("@_") || childName === "#text") continue;
    const count = childOccurrenceCount(childValue);
    const rule = allowedChildren[childName];
    if (!rule) add(context, file, `<${childName}> is not allowed inside <${element}>.`);
    else if (rule.max !== undefined && count > rule.max) add(context, file, `<${element}> allows at most ${rule.max} <${childName}> child element(s).`);
    for (const child of asArray(childValue)) validateElementGrammar(context, file, childName, child, element);
  }
  for (const [childName, rule] of Object.entries(allowedChildren)) {
    const count = childOccurrenceCount(node[childName]);
    if (rule.min !== undefined && count < rule.min) add(context, file, `<${element}> requires at least ${rule.min} <${childName}> child element(s).`);
  }
  if (spec?.atLeastOneOf && !spec.atLeastOneOf.some((childName) => childOccurrenceCount(node[childName]) > 0)) {
    add(context, file, `<${element}> requires at least one of ${spec.atLeastOneOf.map((name) => `<${name}>`).join(", ")}.`);
  }
}

function declarationKind(element: string, node: XmlObject, parentElement: string | null, isRoot: boolean): DeclarationKind | null {
  if (isRoot && element === "Ontology") return "ontology";
  if (hasAttribute(node, "ref")) return null;
  switch (element) {
    case "ScalarType": return "scalar-type";
    case "EnumType": return "enum-type";
    case "Mixin": return "mixin";
    case "ObjectType": return "object-type";
    case "UnionType": return "union-type";
    case "CollectionType": return "collection-type";
    case "Property": return null;
    case "ComputedProperty": return null;
    case "Relation": return "relation";
    case "Rule": return "rule";
    case "StateMachine": return "state-machine";
    case "Derivation": return "derivation";
    case "Transition": return "transition";
    case "BusinessObject": return "business-object";
    case "Action": return "action";
    case "Mutation": return "mutation";
    case "Interceptor": return "interceptor";
    case "ComputedFunction": return "computed-function";
    case "Lifecycle": return "lifecycle-profile";
    case "Association": return "association";
    case "DomainPolicy": return "domain-policy";
    case "ConstraintHandler": return "constraint-handler";
    case "BusinessProcess": return "business-process";
    case "Capability": return hasAttribute(node, "id") ? "capability" : null;
    case "EventContract": return "event-contract";
    case "Operation": return "operation";
    case "InvocationPreset": return "invocation-preset";
    case "Evidence": return "evidence";
    case "RuntimeBinding": return "runtime-binding";
    case "ImplementationMapping": return "implementation-mapping";
    case "Alias": return "alias";
    case "Migration": return "migration";
    case "GenerationSnapshot": return "generation-snapshot";
    default: return null;
  }
}

function idPatternFor(kind: DeclarationKind): { pattern: RegExp; label: string } {
  if (kind === "evidence" || kind === "generation-snapshot") {
    return { pattern: namespacedIdPattern, label: "stable namespaced ID" };
  }
  if (kind === "ontology") return { pattern: ontologyIdPattern, label: "ontology FQN root" };
  return { pattern: fqnPattern, label: "dot-separated PascalCase FQN" };
}

function registerDeclaration(context: ValidationContext, file: string, element: string, node: XmlObject, kind: DeclarationKind, parent?: Declaration): Declaration | undefined {
  const id = attribute(node, "id");
  const { pattern, label } = idPatternFor(kind);
  if (!pattern.test(id)) add(context, file, `${element} id '${id}' is not a ${label}.`);
  if (!id) return undefined;
  const existing = context.declarations.get(id);
  if (existing) {
    add(context, file, `Duplicate id '${id}' was already declared as ${existing.kind} in ${relative(process.cwd(), existing.file)}.`);
    return existing;
  }
  const declaration = { id, kind, element, node, file, parent };
  context.declarations.set(id, declaration);
  return declaration;
}

function walkAndRegister(context: ValidationContext, file: string, element: string, node: XmlObject, parentElement: string | null, parentDeclaration: Declaration | undefined, isRoot = false): void {
  const kind = declarationKind(element, node, parentElement, isRoot);
  const declaration = kind ? registerDeclaration(context, file, element, node, kind, parentDeclaration) : undefined;
  const currentDeclaration = declaration ?? parentDeclaration;
  context.elements.push({ element, node, file, parentElement, parentDeclaration });
  for (const [childName, child] of directChildEntries(node)) {
    walkAndRegister(context, file, childName, child, element, currentDeclaration, false);
  }
}

function validateRootResourceIdentity(context: ValidationContext, file: string, rootName: string, root: XmlObject): void {
  const fqn = attribute(root, "fqn");
  const id = attribute(root, "id");
  if (!fqn || !id) {
    add(context, file, `RESOURCE_IDENTITY_MISSING: <${rootName}> requires distinct @fqn and @id resource identity fields.`);
    return;
  }
  if (!resourceFqnPattern.test(fqn)) add(context, file, `RESOURCE_IDENTITY_INVALID: <${rootName}> @fqn '${fqn}' must be a lower-case dot resource fqn.`);
  const existing = context.resourceFqns.get(fqn);
  if (existing && existing !== file) {
    add(context, file, `RESOURCE_FQN_DUPLICATE: resource fqn '${fqn}' was already declared in ${relative(process.cwd(), existing)}.`);
  } else {
    context.resourceFqns.set(fqn, file);
  }
}

function resolveCatalogRoot(context: ValidationContext, boundaryDirectory: string, rootRef: string): { directory?: string; error?: string } {
  if (!rootRef.startsWith("vfs://@/")) return { error: `RESOURCE_REF_CONTAINMENT: catalog root '${rootRef}' is unsafe: VFS root must use vfs://@/.` };
  if (rootRef.includes("\\")) return { error: `RESOURCE_REF_CONTAINMENT: catalog root '${rootRef}' is unsafe: backslashes are forbidden.` };
  if (/%[0-9a-f]{2}/i.test(rootRef)) return { error: `RESOURCE_REF_CONTAINMENT: catalog root '${rootRef}' is unsafe: percent-encoded traversal is forbidden.` };
  const suffix = rootRef.slice("vfs://@/".length);
  if (!suffix || suffix.startsWith("/") || suffix.split("/").some((segment) => segment === "..")) {
    return { error: `RESOURCE_REF_CONTAINMENT: catalog root '${rootRef}' is unsafe: absolute paths and '..' traversal are forbidden.` };
  }
  const candidate = resolve(boundaryDirectory, suffix);
  try {
    if (!existsSync(candidate) || !lstatSync(candidate).isDirectory()) return { error: `RESOURCE_REF_CONTAINMENT: catalog root '${rootRef}' is unsafe: directory does not exist.` };
    if (lstatSync(candidate).isSymbolicLink()) return { error: `RESOURCE_REF_CONTAINMENT: catalog root '${rootRef}' is unsafe: catalog directory is a symbolic link.` };
    const canonicalDirectory = realpathSync(candidate);
    if (!pathIsWithin(context.workspaceRoot, canonicalDirectory)) return { error: `RESOURCE_REF_CONTAINMENT: catalog root '${rootRef}' escapes workspace root after realpath resolution.` };
    const pathFromRoot = relative(context.workspaceRoot, candidate);
    let current = context.workspaceRoot;
    for (const segment of pathFromRoot.split(sep).filter(Boolean)) {
      current = resolve(current, segment);
      if (lstatSync(current).isSymbolicLink()) return { error: `RESOURCE_REF_CONTAINMENT: catalog root '${rootRef}' is unsafe: path traverses symbolic link ${current}.` };
    }
    return { directory: canonicalDirectory };
  } catch {
    return { error: `RESOURCE_REF_CONTAINMENT: catalog root '${rootRef}' could not be resolved safely.` };
  }
}

function loadDocument(
  context: ValidationContext,
  file: string,
  expectedRoot: string | null,
  layer = -1,
  sourceShape: "file" | "directory" | "manifest" = expectedRoot === "Ontology" ? "manifest" : "file",
  ownerResourceId?: string,
): void {
  const resolution = resolveWorkspaceFile(context.workspaceRoot, file);
  if (!resolution.file) {
    add(context, file, resolution.error!);
    return;
  }
  file = resolution.file;
  if (context.documents.has(file)) {
    const loaded = context.documents.get(file)!;
    if (expectedRoot && loaded.rootName !== expectedRoot) add(context, file, `Reference expects ${expectedRoot}, found ${loaded.rootName}.`);
    return;
  }
  let document: XmlObject;
  try {
    document = parseDslResource(readFileSync(file, "utf8"), `vfs://validation/${relative(context.workspaceRoot, file)}`);
  } catch (error) {
    add(context, file, error instanceof Error ? error.message : String(error));
    return;
  }
  const roots = Object.keys(document);
  if (roots.length !== 1 || !context.kindDefinitions.has(roots[0]!)) {
    add(context, file, `Expected exactly one latest ontology Kind root; found ${roots.join(", ") || "none"}.`);
    return;
  }
  const rootName = roots[0]!;
  const root = document[rootName];
  if (!isObject(root)) {
    add(context, file, `<${rootName}> root must be an element object.`);
    return;
  }
  if (expectedRoot && rootName !== expectedRoot) {
    add(context, file, `RESOURCE_CATALOG_MEMBER_KIND_MISMATCH: catalog expects ${expectedRoot}, found ${rootName}.`);
  }
  const kindDefinition = context.kindDefinitions.get(rootName);
  if (!kindDefinition) return;
  if (kindDefinition.rootElement !== rootName) add(context, file, `KIND_DEFINITION_ROOT_MISMATCH: KindDefinition for ${rootName} declares root ${kindDefinition.rootElement}.`);
  if (!kindDefinition.sourceShapes.has(sourceShape)) add(context, file, `RESOURCE_SHAPE_MISMATCH: ${rootName} does not allow source shape '${sourceShape}'.`);
  const expectedEntry = kindDefinition.entries?.get(sourceShape);
  if (expectedEntry && (resolution.requestedEntry !== expectedEntry || resolution.actualEntry !== expectedEntry)) {
    add(context, file, `ONTOLOGY_MANIFEST_ENTRY_MISSING: ${rootName} ${sourceShape} resource requires exact KindDefinition entry '${expectedEntry}', requested '${resolution.requestedEntry}', actual '${resolution.actualEntry}'.`);
  }
  for (const requiredAttribute of kindDefinition.requiredAttributes) {
    if (!hasAttribute(root, requiredAttribute)) add(context, file, `KIND_DEFINITION_REQUIRED_ATTRIBUTE_MISSING: <${rootName}> requires @${requiredAttribute}.`);
  }
  for (const requiredChild of kindDefinition.requiredChildren) {
    if (asArray(root[requiredChild]).length === 0) add(context, file, `KIND_DEFINITION_REQUIRED_CHILD_MISSING: <${rootName}> requires <${requiredChild}>.`);
  }
  context.documents.set(file, { file, rootName, root, layer, sourceShape, ownerResourceId });
  validateElementGrammar(context, file, rootName, root, null);
  validateRootResourceIdentity(context, file, rootName, root);
  walkAndRegister(context, file, rootName, root, null, undefined, true);

  if (rootName === "Ontology") {
    context.ontologyId = attribute(root, "id");
    context.ontologyVersion = attribute(root, "version");
    if (!versionPattern.test(context.ontologyVersion)) add(context, file, `Ontology version '${context.ontologyVersion}' is not a valid version token.`);
    if (childObjects(root, "Resources").length > 0 || childObjects(root, "Modules").length > 0) return;
  }
  if (sourceShape !== "manifest") return;
  let schemaEvolutionCount = 0;
  let typeCount = 0;
  const discovered: Array<{ file: string; kind: string; layer: number; sourceShape: "file" | "directory" | "manifest" }> = [];
  const catalogIds = new Set<string>();
  for (const [element, catalog] of directChildEntries(root)) {
    if (element === "Description") continue;
    if (!["FileResourceCatalog", "DirectoryResourceCatalog", "ManifestResourceCatalog"].includes(element)) continue;
    const catalogId = attribute(catalog, "id");
    const catalogKind = attribute(catalog, "kind");
    const catalogRoot = attribute(catalog, "root");
    if (catalogIds.has(catalogId)) add(context, file, `RESOURCE_CATALOG_ID_DUPLICATE: duplicate ResourceCatalog id '${catalogId}'.`);
    catalogIds.add(catalogId);
    const kind = context.kindDefinitions.get(catalogKind);
    if (!kind) {
      add(context, file, `RESOURCE_KIND_DEFINITION_NOT_FOUND: catalog '${catalogId}' references unknown kind '${catalogKind}'.`);
      continue;
    }
    const catalogShape = element === "FileResourceCatalog" ? "file" : element === "DirectoryResourceCatalog" ? "directory" : "manifest";
    if (!kind.sourceShapes.has(catalogShape)) {
      add(context, file, `RESOURCE_SHAPE_MISMATCH: catalog '${catalogId}' kind '${catalogKind}' does not allow '${catalogShape}' resources.`);
      continue;
    }
    const currentLayer = resourceLayers.get(catalogKind);
    if (currentLayer === undefined) {
      add(context, file, `RESOURCE_KIND_DEFINITION_NOT_FOUND: catalog '${catalogId}' kind '${catalogKind}' is not in the ontology resource layer table.`);
      continue;
    }
    if (catalogKind === "SchemaEvolutionModule") schemaEvolutionCount += 1;
    if (catalogKind === "ObjectType") typeCount += 1;
    const rootResolution = resolveCatalogRoot(context, dirname(file), catalogRoot);
    if (!rootResolution.directory) {
      add(context, file, rootResolution.error!);
      continue;
    }
    const entryName = attribute(catalog, "entry");
    if (catalogShape !== "file" && (!entryName || entryName.includes("/") || entryName.includes("\\") || entryName === "." || entryName === "..")) {
      add(context, file, `${element} '${catalogId}' requires a plain containment-safe @entry filename.`);
      continue;
    }
    const expectedEntry = kind.entries?.get(catalogShape);
    if (catalogShape !== "file" && entryName !== expectedEntry) {
      add(context, file, `RESOURCE_CATALOG_ENTRY_MISSING: ${element} '${catalogId}' requires exact KindDefinition entry '${expectedEntry ?? "<missing>"}', found '${entryName}'.`);
      continue;
    }
    for (const entry of readdirSync(rootResolution.directory, { withFileTypes: true })) {
      let memberFile = "";
      if (catalogShape === "file") {
        if (!entry.isFile() || !entry.name.endsWith(".xml")) continue;
        memberFile = resolve(rootResolution.directory, entry.name);
      } else {
        if (!entry.isDirectory()) continue;
        memberFile = resolve(rootResolution.directory, entry.name, entryName);
        if (!existsSync(memberFile) || !lstatSync(memberFile).isFile()) {
          add(context, memberFile, `${element} '${catalogId}' member '${entry.name}' is missing entry '${entryName}'.`);
          continue;
        }
      }
      const memberResolution = resolveWorkspaceFile(context.workspaceRoot, memberFile);
      if (!memberResolution.file) {
        add(context, memberFile, memberResolution.error!);
        continue;
      }
      if (context.referencedTargets.has(memberResolution.file)) {
        add(context, memberResolution.file, `RESOURCE_CATALOG_MEMBER_DUPLICATE: resource file is discovered by more than one ResourceCatalog.`);
        continue;
      }
      context.referencedTargets.add(memberResolution.file);
      discovered.push({ file: memberResolution.file, kind: catalogKind, layer: currentLayer, sourceShape: catalogShape });
    }
  }
  for (const member of discovered.sort((left, right) => left.layer - right.layer || left.kind.localeCompare(right.kind) || left.file.localeCompare(right.file))) {
    loadDocument(context, member.file, member.kind, member.layer, member.sourceShape, attribute(root, "id"));
  }
  if (rootName === "Ontology" && typeCount === 0) add(context, file, "Ontology ResourceCatalogs require at least one ObjectType catalog.");
  if (rootName === "Ontology" && schemaEvolutionCount > 1) add(context, file, "Ontology may reference at most one SchemaEvolutionModule.");
}

function readXmlDocument(context: ValidationContext, file: string): { file: string; rootName: string; root: XmlObject } | null {
  const resolution = resolveWorkspaceFile(context.workspaceRoot, file);
  if (!resolution.file) {
    add(context, file, resolution.error!);
    return null;
  }
  try {
    const document = parseDslResource(readFileSync(resolution.file, "utf8"), `vfs://validation/${relative(context.workspaceRoot, resolution.file)}`);
    const roots = Object.keys(document);
    const rootName = roots[0]!;
    const root = document[rootName];
    if (!isObject(root)) {
      add(context, resolution.file, `<${rootName}> root must be an element object.`);
      return null;
    }
    return { file: resolution.file, rootName, root };
  } catch (error) {
    add(context, resolution.file, error instanceof Error ? error.message : String(error));
    return null;
  }
}

function entryFileName(file: string): string {
  return file.split(sep).pop() ?? file;
}

function inferGenericSourceShape(file: string, definition: KindDefinition): SourceShape {
  const filename = entryFileName(file);
  if (definition.sourceShapes.has("manifest") && definition.entries?.get("manifest") === filename) return "manifest";
  if (definition.sourceShapes.has("directory") && definition.entries?.get("directory") === filename) return "directory";
  if (definition.sourceShapes.has("file")) return "file";
  return [...definition.sourceShapes][0] as SourceShape;
}

function plainEntryName(entry: string): boolean {
  return Boolean(entry) && !entry.includes("/") && !entry.includes("\\") && entry !== "." && entry !== "..";
}

function validateGenericIdentity(context: ValidationContext, file: string, rootName: string, root: XmlObject, sourceShape: SourceShape): void {
  const fqn = attribute(root, "fqn");
  const name = attribute(root, "name");
  if (!fqn && !name) {
    add(context, file, `${sourceShape === "manifest" ? "RESOURCE_MANIFEST_IDENTITY_MISSING" : "RESOURCE_IDENTITY_MISSING"}: <${rootName}> requires @fqn or @name.`);
    return;
  }
  if (!fqn) return;
  const existing = context.resourceFqns.get(fqn);
  if (existing && existing !== file) {
    add(context, file, `RESOURCE_FQN_DUPLICATE: resource fqn '${fqn}' was already declared in ${relative(process.cwd(), existing)}.`);
  } else {
    context.resourceFqns.set(fqn, file);
  }
}

function validateGenericDescription(context: ValidationContext, file: string, rootName: string, root: XmlObject, sourceShape: SourceShape, definition: KindDefinition): void {
  if (rootName === "KindDefinition") return;
  if (definition.descriptionPath && definition.descriptionPath !== "Description") {
    add(context, file, `RESOURCE_KIND_CONTRACT_INVALID: <${rootName}> uses unsupported description path '${definition.descriptionPath}'.`);
    return;
  }
  if (!nodeText(firstChildValue(root, "Description")).trim()) {
    add(context, file, `${sourceShape === "manifest" ? "RESOURCE_MANIFEST_DESCRIPTION_MISSING" : "RESOURCE_KIND_SCHEMA_INVALID"}: <${rootName}> requires non-empty <Description>.`);
  }
}

function resolveGenericVfsReference(context: ValidationContext, boundaryDirectory: string, ref: string): string | null {
  if (!ref.startsWith("vfs://@/")) return null;
  if (ref.includes("\\") || /%[0-9a-f]{2}/i.test(ref)) return null;
  const suffix = ref.slice("vfs://@/".length);
  if (!suffix || suffix.startsWith("/") || suffix.split("/").some((segment) => segment === "..")) return null;
  try {
    const candidate = resolve(boundaryDirectory, suffix);
    if (!existsSync(candidate)) return null;
    const canonical = realpathSync(candidate);
    return pathIsWithin(boundaryDirectory, canonical) ? canonical : null;
  } catch {
    return null;
  }
}

function validateGenericInternalReferences(context: ValidationContext, file: string, value: unknown, boundaryDirectory: string): void {
  if (!isObject(value)) return;
  for (const [key, raw] of Object.entries(value)) {
    if (key.startsWith("@_") && typeof raw === "string" && raw.startsWith("vfs://")) {
      if (!resolveGenericVfsReference(context, boundaryDirectory, raw)) {
        add(context, file, `RESOURCE_REF_CONTAINMENT: logical reference '${raw}' escapes or cannot be resolved inside the resource boundary.`);
      }
    } else if (!key.startsWith("@_") && key !== "#text") {
      for (const child of asArray(raw)) validateGenericInternalReferences(context, file, child, boundaryDirectory);
    }
  }
}

function validateGenericKindDefinitionMember(context: ValidationContext, file: string, expectedKind: string, sourceShape: SourceShape): void {
  let raw: XmlObject;
  try {
    raw = Bun.YAML.parse(readFileSync(file, "utf8")) as XmlObject;
  } catch (error) {
    add(context, file, error instanceof Error ? error.message : String(error));
    return;
  }
  if (raw.kind !== expectedKind) {
    add(context, file, `RESOURCE_CATALOG_MEMBER_KIND_MISMATCH: catalog expects ${expectedKind}, found ${String(raw.kind || "none")}.`);
  }
  if (sourceShape !== "file") add(context, file, `RESOURCE_SHAPE_MISMATCH: KindDefinition does not allow source shape '${sourceShape}'.`);
  if (typeof yamlObjectAt(raw, "metadata.name") !== "string") {
    add(context, file, "RESOURCE_IDENTITY_MISSING: KindDefinition requires metadata.name.");
  }
  try {
    parseGenericKindDefinition(file, raw);
  } catch (error) {
    add(context, file, error instanceof Error ? error.message : String(error));
  }
}

function validateGenericXmlResource(
  context: ValidationContext,
  file: string,
  expectedKind: string | null,
  sourceShape: SourceShape,
): void {
  const loaded = readXmlDocument(context, file);
  if (!loaded) return;
  file = loaded.file;
  if (context.documents.has(file)) {
    const existing = context.documents.get(file)!;
    if (expectedKind && existing.rootName !== expectedKind) add(context, file, `RESOURCE_CATALOG_MEMBER_KIND_MISMATCH: catalog expects ${expectedKind}, found ${existing.rootName}.`);
    return;
  }
  const { rootName, root } = loaded;
  if (expectedKind && rootName !== expectedKind) {
    add(context, file, `RESOURCE_CATALOG_MEMBER_KIND_MISMATCH: catalog expects ${expectedKind}, found ${rootName}.`);
  }
  const definition = context.kindDefinitions.get(rootName) ?? (expectedKind ? context.kindDefinitions.get(expectedKind) : undefined);
  if (!definition) {
    add(context, file, `RESOURCE_KIND_DEFINITION_NOT_FOUND: no KindDefinition exists for '${expectedKind ?? rootName}'.`);
    return;
  }
  if (definition.rootElement !== rootName) {
    add(context, file, `RESOURCE_CATALOG_MEMBER_KIND_MISMATCH: catalog expects ${definition.rootElement}, found ${rootName}.`);
  }
  if (!definition.sourceShapes.has(sourceShape)) add(context, file, `RESOURCE_SHAPE_MISMATCH: ${rootName} does not allow source shape '${sourceShape}'.`);
  for (const requiredAttribute of definition.requiredAttributes) {
    if (!hasAttribute(root, requiredAttribute)) add(context, file, `RESOURCE_KIND_SCHEMA_INVALID: <${rootName}> requires @${requiredAttribute}.`);
  }
  for (const requiredChild of definition.requiredChildren) {
    if (asArray(root[requiredChild]).length === 0) add(context, file, `RESOURCE_KIND_SCHEMA_INVALID: <${rootName}> requires <${requiredChild}>.`);
  }
  validateGenericIdentity(context, file, rootName, root, sourceShape);
  validateGenericDescription(context, file, rootName, root, sourceShape, definition);
  validateGenericInternalReferences(context, file, root, dirname(file));
  context.documents.set(file, { file, rootName, root, layer: -1, sourceShape });
  if (sourceShape === "manifest") validateGenericManifestCatalogs(context, file, root);
}

function validateGenericCatalogEntryRules(
  context: ValidationContext,
  file: string,
  element: string,
  catalogId: string,
  catalog: XmlObject,
  catalogShape: SourceShape,
  definition: KindDefinition,
): boolean {
  const entry = attribute(catalog, "entry");
  if (element === "FileResourceCatalog") {
    if (entry) add(context, file, `RESOURCE_CATALOG_ENTRY_FORBIDDEN: FileResourceCatalog '${catalogId}' must not declare @entry.`);
    return !entry;
  }
  if (!plainEntryName(entry)) {
    add(context, file, `RESOURCE_CATALOG_ENTRY_MISSING: ${element} '${catalogId}' requires a plain containment-safe @entry filename.`);
    return false;
  }
  const expectedEntry = definition.entries?.get(catalogShape);
  if (!expectedEntry) {
    add(context, file, `RESOURCE_KIND_CONTRACT_INVALID: KindDefinition '${definition.resourceKind}' must declare an entry filename for '${catalogShape}' resources.`);
    return false;
  }
  if (entry !== expectedEntry) {
    add(context, file, `RESOURCE_CATALOG_ENTRY_MISSING: ${element} '${catalogId}' requires KindDefinition entry '${expectedEntry}', found '${entry}'.`);
    return false;
  }
  return true;
}

function validateGenericManifestCatalogs(context: ValidationContext, file: string, root: XmlObject): void {
  const catalogIds = new Set<string>();
  const discovered: Array<{ file: string; kind: string; sourceShape: SourceShape }> = [];
  for (const [element, catalog] of directChildEntries(root)) {
    if (element === "Description") continue;
    if (!["FileResourceCatalog", "DirectoryResourceCatalog", "ManifestResourceCatalog"].includes(element)) {
      add(context, file, `RESOURCE_KIND_CONTRACT_INVALID: <${element}> is not a generic ResourceCatalog child.`);
      continue;
    }
    const catalogId = attribute(catalog, "id");
    const catalogKind = attribute(catalog, "kind");
    const catalogRoot = attribute(catalog, "root");
    if (catalogIds.has(catalogId)) add(context, file, `RESOURCE_CATALOG_ID_DUPLICATE: duplicate ResourceCatalog id '${catalogId}'.`);
    catalogIds.add(catalogId);
    if (!catalogKind) {
      add(context, file, `RESOURCE_CATALOG_KIND_MISSING: ResourceCatalog '${catalogId}' requires @kind.`);
      continue;
    }
    const definition = context.kindDefinitions.get(catalogKind);
    if (!definition) {
      add(context, file, `RESOURCE_KIND_DEFINITION_NOT_FOUND: catalog '${catalogId}' references unknown kind '${catalogKind}'.`);
      continue;
    }
    const catalogShape: SourceShape = element === "FileResourceCatalog" ? "file" : element === "DirectoryResourceCatalog" ? "directory" : "manifest";
    if (!definition.sourceShapes.has(catalogShape)) {
      add(context, file, `RESOURCE_SHAPE_MISMATCH: catalog '${catalogId}' kind '${catalogKind}' does not allow '${catalogShape}' resources.`);
      continue;
    }
    if (!validateGenericCatalogEntryRules(context, file, element, catalogId, catalog, catalogShape, definition)) continue;
    const rootResolution = resolveCatalogRoot(context, dirname(file), catalogRoot);
    if (!rootResolution.directory) {
      add(context, file, rootResolution.error!);
      continue;
    }
    const entryName = attribute(catalog, "entry");
    for (const entry of readdirSync(rootResolution.directory, { withFileTypes: true })) {
      let memberFile = "";
      if (catalogShape === "file") {
        if (!entry.isFile()) continue;
        const extension = catalogKind === "KindDefinition" ? ".yaml" : ".xml";
        if (!entry.name.endsWith(extension)) continue;
        memberFile = resolve(rootResolution.directory, entry.name);
      } else {
        if (!entry.isDirectory()) continue;
        memberFile = resolve(rootResolution.directory, entry.name, entryName);
        if (!existsSync(memberFile) || !lstatSync(memberFile).isFile()) {
          add(context, memberFile, `RESOURCE_CATALOG_ENTRY_MISSING: ${element} '${catalogId}' member '${entry.name}' is missing entry '${entryName}'.`);
          continue;
        }
      }
      const memberResolution = resolveWorkspaceFile(context.workspaceRoot, memberFile);
      if (!memberResolution.file) {
        add(context, memberFile, memberResolution.error!);
        continue;
      }
      if (context.referencedTargets.has(memberResolution.file)) {
        add(context, memberResolution.file, "RESOURCE_CATALOG_MEMBER_DUPLICATE: resource file is discovered by more than one ResourceCatalog.");
        continue;
      }
      context.referencedTargets.add(memberResolution.file);
      discovered.push({ file: memberResolution.file, kind: catalogKind, sourceShape: catalogShape });
    }
  }
  for (const member of discovered.sort((left, right) => left.kind.localeCompare(right.kind) || left.file.localeCompare(right.file))) {
    if (member.kind === "KindDefinition") {
      validateGenericKindDefinitionMember(context, member.file, member.kind, member.sourceShape);
    } else {
      validateGenericXmlResource(context, member.file, member.kind, member.sourceShape);
    }
  }
}

function validateGenericResourceTree(context: ValidationContext, rootDocument: { file: string; rootName: string; root: XmlObject }): void {
  context.kindDefinitions = loadGenericKindDefinitions(context, rootDocument.file, rootDocument.root);
  const definition = context.kindDefinitions.get(rootDocument.rootName);
  if (!definition) {
    add(context, rootDocument.file, `RESOURCE_KIND_DEFINITION_NOT_FOUND: no KindDefinition exists for root kind '${rootDocument.rootName}'.`);
    return;
  }
  validateGenericXmlResource(context, rootDocument.file, null, inferGenericSourceShape(rootDocument.file, definition));
}

function expectReference(context: ValidationContext, file: string, owner: string, value: string, expectedKinds: DeclarationKind[]): Declaration | null {
  if (!value) {
    add(context, file, `RESOURCE_KIND_CONTRACT_INVALID: ${owner} requires a semantic reference.`);
    return null;
  }
  if (builtins.has(value)) {
    if (expectedKinds.some((kind) => valueTypeKinds.includes(kind))) {
      return { id: value, kind: "scalar-type", element: "builtin", node: {}, file };
    }
    add(context, file, `RESOURCE_KIND_CONTRACT_INVALID: ${owner} references builtin type '${value}' where ${expectedKinds.join("|")} is required.`);
    return null;
  }
  const declaration = context.declarations.get(value);
  if (!declaration) {
    add(context, file, `RESOURCE_KIND_CONTRACT_INVALID: ${owner} references undeclared id '${value}'.`);
    return null;
  }
  if (!expectedKinds.includes(declaration.kind)) {
    add(context, file, `RESOURCE_KIND_CONTRACT_INVALID: ${owner} references '${value}' as ${expectedKinds.join("|")}, but it is declared as ${declaration.kind}.`);
    return null;
  }
  return declaration;
}

function validateBoolean(context: ValidationContext, file: string, owner: string, value: string): void {
  if (value !== "true" && value !== "false") add(context, file, `${owner} must be 'true' or 'false', found '${value}'.`);
}

function validateLocalName(context: ValidationContext, file: string, owner: string, name: string): void {
  if (!localNamePattern.test(name)) add(context, file, `${owner} '${name}' must be lowerCamelCase.`);
}

function validateExecutableText(context: ValidationContext, file: string, owner: string, text: string, allowPathLike = false): void {
  if (!text.trim()) return;
  if (forbiddenTextPattern.test(text)) add(context, file, `${owner} contains executable or expression-like text forbidden by the declarative XML grammar.`);
  if (!allowPathLike && forbiddenPathPattern.test(text)) add(context, file, `${owner} contains a path or module reference that could be interpreted as executable host instructions.`);
}

function validateGenericElementSemantics(context: ValidationContext): void {
  for (const entry of context.elements) {
    const { element, node, file } = entry;
    if (hasAttribute(node, "status") && !statusValues.has(attribute(node, "status"))) {
      add(context, file, `<${element}> has invalid status '${attribute(node, "status")}'.`);
    }
    if (["Description", "Purpose", "Statement", "InternalLogic", "Title"].includes(element)) {
      validateExecutableText(context, file, `<${element}>`, nodeText(node));
    }
    if (element === "Property") {
      const owner = entry.parentDeclaration?.id ?? "profile";
      const ownerKind = entry.parentDeclaration?.kind;
      if (ownerKind === "business-object" && hasAttribute(node, "ref")) {
        add(context, file, `BUSINESS_OBJECT_PROPERTY_REF_REJECTED: BusinessObject '${owner}' must declare Property facts directly; Property@ref is not allowed.`);
      }
      if (hasAttribute(node, "role")) {
        if (ownerKind !== "business-object") add(context, file, `Property '${owner}#${attribute(node, "name")}' role is only allowed on BusinessObject-owned properties.`);
        else if (!profilePropertyRoles.has(attribute(node, "role"))) add(context, file, `BusinessObject '${owner}' Property role '${attribute(node, "role")}' is invalid.`);
      }
    }
    if (element === "Evidence" && hasAttribute(node, "ref")) {
      expectReference(context, file, "<Evidence> @ref", attribute(node, "ref"), ["evidence"]);
    }
    if (hasAttribute(node, "ref") && refElementKinds[element] && element !== "Evidence" && element !== "Property") {
      expectReference(context, file, `<${element}> @ref`, attribute(node, "ref"), refElementKinds[element]!);
    }
  }
}

function validateEvidence(context: ValidationContext): void {
  for (const declaration of context.declarations.values()) {
    if (declaration.kind !== "evidence") continue;
    const node = declaration.node;
    const id = declaration.id;
    if (context.declarations.has(id) && fqnPattern.test(id)) add(context, declaration.file, `Evidence '${id}' collides with semantic FQN identity.`);
    const source = attribute(node, "source");
    if (!evidenceSources.has(source)) add(context, declaration.file, `Evidence '${id}' has invalid source '${source}'.`);
    const grade = attribute(node, "grade");
    if (!grades.has(grade)) add(context, declaration.file, `Evidence '${id}' has invalid grade '${grade}'.`);
    const confidenceText = attribute(node, "confidence");
    const confidence = Number(confidenceText);
    if (!confidenceText || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
      add(context, declaration.file, `Evidence '${id}' confidence must be in [0,1].`);
    }
    const hasRepoPath = attribute(node, "repository") && attribute(node, "path");
    const hasLocator = hasRepoPath || attribute(node, "artifact") || attribute(node, "externalId") || (source === "manual" && attribute(node, "resolver") === "manual");
    if (!hasLocator) add(context, declaration.file, `Evidence '${id}' requires repository+path, artifact, externalId, or manual resolver locator.`);
    const path = attribute(node, "path");
    if (path && (isAbsolute(path) || path.includes("\\") || path.split("/").includes(".."))) {
      add(context, declaration.file, `Evidence '${id}' path must be a forward-slash repository-relative path.`);
    }
    const lines = attribute(node, "lines");
    if (lines && !/^([1-9]\d*|[1-9]\d*-[1-9]\d*)$/.test(lines)) {
      add(context, declaration.file, `Evidence '${id}' lines must be a positive line or start-end range.`);
    } else if (lines.includes("-")) {
      const [start, end] = lines.split("-").map(Number);
      if (end < start) add(context, declaration.file, `Evidence '${id}' lines end must be greater than or equal to start.`);
    }
    if (directChildEntries(node).length > 0) add(context, declaration.file, `Evidence '${id}' has child elements; direct material must be text only.`);
    if (!nodeText(node).trim()) add(context, declaration.file, `Evidence '${id}' requires direct material text.`);
  }
}

function validateTypeRef(context: ValidationContext, file: string, owner: string, value: string, allowBuiltin = true): Declaration | null {
  if (allowBuiltin && builtins.has(value)) return { id: value, kind: "scalar-type", element: "builtin", node: {}, file };
  return expectReference(context, file, owner, value, valueTypeKinds);
}

function validateTypeLikeRef(context: ValidationContext, file: string, owner: string, value: string, allowBuiltin = true): Declaration | null {
  if (allowBuiltin && builtins.has(value)) return { id: value, kind: "scalar-type", element: "builtin", node: {}, file };
  return expectReference(context, file, owner, value, typeLikeReferenceKinds);
}

function detectCycles(context: ValidationContext, graph: Map<string, string[]>, label: string, ownerFiles: Map<string, string>): void {
  const state = new Map<string, "visiting" | "done">();
  const stack: string[] = [];
  const reported = new Set<string>();
  const visit = (node: string): void => {
    if (state.get(node) === "done") return;
    if (state.get(node) === "visiting") {
      const start = stack.indexOf(node);
      const cycle = [...stack.slice(start), node];
      const key = [...new Set(cycle)].sort().join("|");
      if (!reported.has(key)) {
        reported.add(key);
        add(context, ownerFiles.get(node) ?? context.rootFile, `${label} cycle detected: ${cycle.join(" -> ")}.`);
      }
      return;
    }
    state.set(node, "visiting");
    stack.push(node);
    for (const target of graph.get(node) ?? []) {
      if (graph.has(target)) visit(target);
    }
    stack.pop();
    state.set(node, "done");
  };
  for (const node of [...graph.keys()].sort()) visit(node);
}

function buildTypeModel(context: ValidationContext): TypeModel {
  const model: TypeModel = {
    parentByType: new Map(),
    mixinsByOwner: new Map(),
    propertiesByOwner: new Map(),
    propertyById: new Map(),
  };
  const ownerFiles = new Map<string, string>();

  for (const declaration of context.declarations.values()) {
    if (!["object-type", "business-object", "mixin", "relation"].includes(declaration.kind)) continue;
    const id = declaration.id;
    ownerFiles.set(id, declaration.file);
    const mixinRefs = declaration.kind === "object-type" || declaration.kind === "business-object"
      ? childObjects(declaration.node, "Mixins")
        .flatMap((container) => childObjects(container, "Mixin"))
        .map((node) => attribute(node, "ref"))
      : [];
    const seenMixins = new Set<string>();
    for (const ref of mixinRefs) {
      if (seenMixins.has(ref)) add(context, declaration.file, `${declaration.element} '${id}' has duplicate Mixin ref '${ref}'.`);
      seenMixins.add(ref);
      if (ref === id) add(context, declaration.file, `${declaration.element} '${id}' cannot compose itself.`);
      expectReference(context, declaration.file, `${declaration.element} '${id}' Mixin`, ref, ["mixin"]);
    }
    model.mixinsByOwner.set(id, mixinRefs);
    const properties: PropertyInfo[] = [];
    const declaredProperties = [
      ...childObjects(declaration.node, "Identity").flatMap((container) => childObjects(container, "Property")),
      ...childObjects(declaration.node, "Properties").flatMap((container) => childObjects(container, "Property")),
    ];
    for (const property of declaredProperties) {
      const name = attribute(property, "name");
      const info = {
        id: `${id}#${name}`,
        name,
        owner: id,
        ownerKind: declaration.kind as "object-type" | "business-object" | "mixin" | "relation",
        typeRef: attribute(property, "typeRef"),
        required: attribute(property, "required") === "true",
        computed: false,
        node: property,
        file: declaration.file,
      };
      properties.push(info);
      if (model.propertyById.has(info.id)) add(context, declaration.file, `${declaration.element} '${id}' declares duplicate Property '${name}'.`);
      model.propertyById.set(info.id, info);
    }
    for (const property of childObjects(declaration.node, "ComputedProperties").flatMap((container) => childObjects(container, "ComputedProperty"))) {
      const name = attribute(property, "name");
      const info = {
        id: `${id}#${name}`,
        name,
        owner: id,
        ownerKind: declaration.kind as "object-type" | "business-object" | "mixin" | "relation",
        typeRef: attribute(property, "typeRef"),
        required: false,
        computed: true,
        node: property,
        file: declaration.file,
      };
      properties.push(info);
      if (model.propertyById.has(info.id)) add(context, declaration.file, `${declaration.element} '${id}' declares duplicate property '${name}'.`);
      model.propertyById.set(info.id, info);
    }
    model.propertiesByOwner.set(id, properties);
  }

  for (const declaration of context.declarations.values()) {
    const { kind, node, file, id } = declaration;
    if (kind === "scalar-type") {
      if (!builtins.has(attribute(node, "base"))) add(context, file, `ScalarType '${id}' base '${attribute(node, "base")}' must be a built-in scalar.`);
    }
    if (kind === "enum-type") {
      const seen = new Set<string>();
      for (const member of childObjects(node, "Members").flatMap((container) => childObjects(container, "Member"))) {
        const memberId = attribute(member, "id");
        if (!pascalNamePattern.test(memberId)) add(context, file, `EnumType '${id}' Member '${memberId}' must be PascalCase.`);
        if (seen.has(memberId)) add(context, file, `EnumType '${id}' declares duplicate Member '${memberId}'.`);
        seen.add(memberId);
        if (!attribute(member, "value").trim()) add(context, file, `EnumType '${id}' Member '${memberId}' requires non-empty @value.`);
      }
    }
    if (kind === "object-type" || kind === "business-object") {
      const parentRef = attribute(node, "parentRef");
      if (parentRef) {
        expectReference(context, file, `${declaration.element} '${id}' @parentRef`, parentRef, entityTypeKinds);
        if (parentRef === id) add(context, file, `${declaration.element} '${id}' cannot inherit from itself.`);
        model.parentByType.set(id, parentRef);
      }
      if (hasAttribute(node, "abstract")) validateBoolean(context, file, `${declaration.element} '${id}' @abstract`, attribute(node, "abstract"));
      if (kind === "object-type" && attribute(node, "kind") && !typeKinds.has(attribute(node, "kind"))) add(context, file, `ObjectType '${id}' has invalid kind '${attribute(node, "kind")}'.`);
    }
    if (kind === "union-type") {
      const refs = childObjects(node, "Options").flatMap((container) => childObjects(container, "Type")).map((type) => attribute(type, "ref"));
      const seen = new Set<string>();
      for (const ref of refs) {
        if (seen.has(ref)) add(context, file, `UnionType '${id}' has duplicate option '${ref}'.`);
        seen.add(ref);
        expectReference(context, file, `UnionType '${id}' option`, ref, valueTypeKinds);
      }
    }
    if (kind === "collection-type") {
      const collection = attribute(node, "collection");
      if (!collectionKinds.has(collection)) add(context, file, `CollectionType '${id}' has invalid collection '${collection}'.`);
      validateTypeRef(context, file, `CollectionType '${id}' @itemTypeRef`, attribute(node, "itemTypeRef"));
      if (collection === "map" && !attribute(node, "keyTypeRef")) add(context, file, `CollectionType '${id}' collection="map" requires @keyTypeRef.`);
      if (attribute(node, "keyTypeRef")) {
        const keyTypeRef = attribute(node, "keyTypeRef");
        validateTypeRef(context, file, `CollectionType '${id}' @keyTypeRef`, keyTypeRef);
        if (!isScalarMapKeyType(context, keyTypeRef)) add(context, file, `CollectionType '${id}' map keyTypeRef "${keyTypeRef}" must resolve to a built-in scalar or ScalarType alias.`);
      }
    }
  }

  for (const [owner, properties] of model.propertiesByOwner) {
    for (const property of properties) {
      const ownerLabel = `${property.computed ? "ComputedProperty" : "Property"} '${property.id}'`;
      validateLocalName(context, property.file, ownerLabel, property.name);
      validateTypeRef(context, property.file, `${ownerLabel} @typeRef`, property.typeRef);
      if (!property.computed) validateBoolean(context, property.file, `${ownerLabel} @required`, attribute(property.node, "required"));
    }
  }

  const parentGraph = new Map<string, string[]>();
  for (const declaration of context.declarations.values()) {
    if (declaration.kind === "object-type" || declaration.kind === "business-object") parentGraph.set(declaration.id, model.parentByType.has(declaration.id) ? [model.parentByType.get(declaration.id)!] : []);
  }
  detectCycles(context, parentGraph, "ObjectType inheritance", ownerFiles);
  validateMixinPropertyCompatibility(context, model, ownerFiles);
  validateComposedPropertyNames(context, model, ownerFiles);

  for (const [owner, properties] of model.propertiesByOwner) {
    const seen = new Map<string, string>();
    for (const property of properties) {
      const existing = seen.get(property.name);
      if (existing) add(context, ownerFiles.get(owner) ?? context.rootFile, `${owner} declares duplicate property name '${property.name}'.`);
      seen.set(property.name, property.id);
    }
  }
  return model;
}

function validateMixinPropertyCompatibility(context: ValidationContext, model: TypeModel, ownerFiles: Map<string, string>): void {
  for (const declaration of context.declarations.values()) {
    if (declaration.kind !== "object-type" && declaration.kind !== "business-object") continue;
    const applicableMixins: string[] = [];
    const visitedTypes = new Set<string>();
    let currentType: string | undefined = declaration.id;
    while (currentType && !visitedTypes.has(currentType)) {
      visitedTypes.add(currentType);
      for (const mixin of model.mixinsByOwner.get(currentType) ?? []) {
        if (!applicableMixins.includes(mixin)) applicableMixins.push(mixin);
      }
      currentType = model.parentByType.get(currentType);
    }

    const contributions = new Map<string, PropertyInfo>();
    for (const mixin of applicableMixins) {
      for (const property of model.propertiesByOwner.get(mixin) ?? []) {
        const existing = contributions.get(property.name);
        if (existing && (existing.typeRef !== property.typeRef || existing.required !== property.required)) {
          add(
            context,
            ownerFiles.get(declaration.id) ?? declaration.file,
            `COZO_OM_MIXIN_PROPERTY_AMBIGUOUS: ${declaration.element} '${declaration.id}' receives incompatible Mixin Property '${property.name}' from '${existing.owner}' and '${property.owner}'. Current cozo-om storage does not persist mixin application order.`,
          );
        }
        contributions.set(property.name, property);
      }
    }
  }
}

function isScalarMapKeyType(context: ValidationContext, typeRef: string): boolean {
  if (builtinScalarKeys.has(typeRef)) return true;
  const declaration = context.declarations.get(typeRef);
  return Boolean(declaration?.kind === "scalar-type" && builtinScalarKeys.has(attribute(declaration.node, "base")));
}

function validateComposedPropertyNames(context: ValidationContext, model: TypeModel, ownerFiles: Map<string, string>): void {
  const memo = new Map<string, PropertyInfo[]>();
  const collect = (ownerId: string, visiting: Set<string>): PropertyInfo[] => {
    if (memo.has(ownerId)) return memo.get(ownerId)!;
    if (visiting.has(ownerId)) return [];
    visiting.add(ownerId);
    const properties: PropertyInfo[] = [];
    for (const mixin of model.mixinsByOwner.get(ownerId) ?? []) properties.push(...collect(mixin, visiting));
    const parent = model.parentByType.get(ownerId);
    if (parent) properties.push(...collect(parent, visiting));
    properties.push(...(model.propertiesByOwner.get(ownerId) ?? []));
    visiting.delete(ownerId);
    memo.set(ownerId, properties);
    return properties;
  };

  for (const declaration of context.declarations.values()) {
    if (declaration.kind !== "object-type" && declaration.kind !== "business-object" && declaration.kind !== "mixin") continue;
    const seen = new Map<string, PropertyInfo>();
    for (const property of collect(declaration.id, new Set())) {
      const existing = seen.get(property.name);
      if (existing) {
        if (existing.typeRef !== property.typeRef) {
          add(context, ownerFiles.get(declaration.id) ?? declaration.file, `${declaration.element} '${declaration.id}' cannot change inherited or mixed-in Property '${property.name}' from '${existing.typeRef}' to '${property.typeRef}'.`);
        }
        if (existing.required && !property.required && property.owner === declaration.id) {
          add(context, ownerFiles.get(declaration.id) ?? declaration.file, `${declaration.element} '${declaration.id}' cannot loosen inherited required Property '${property.name}'.`);
        }
      }
      seen.set(property.name, property);
    }
  }
}

function isTypeAssignable(context: ValidationContext, model: TypeModel, actual: string, expected: string): boolean {
  if (actual === expected) return true;
  let current = actual;
  const seen = new Set<string>();
  while (model.parentByType.has(current) && !seen.has(current)) {
    seen.add(current);
    current = model.parentByType.get(current)!;
    if (current === expected) return true;
  }
  return Boolean(entityTypeKinds.includes(context.declarations.get(actual)?.kind as DeclarationKind) && entityTypeKinds.includes(context.declarations.get(expected)?.kind as DeclarationKind) && actual === expected);
}

function effectiveProperties(model: TypeModel, ownerId: string): Map<string, PropertyInfo> {
  const memo = new Map<string, Map<string, PropertyInfo>>();
  const resolveOwner = (id: string, visiting: Set<string>): Map<string, PropertyInfo> => {
    if (memo.has(id)) return memo.get(id)!;
    if (visiting.has(id)) return new Map();
    visiting.add(id);
    const properties = new Map<string, PropertyInfo>();
    for (const mixin of model.mixinsByOwner.get(id) ?? []) {
      for (const [name, prop] of resolveOwner(mixin, visiting)) properties.set(name, prop);
    }
    const parent = model.parentByType.get(id);
    if (parent) for (const [name, prop] of resolveOwner(parent, visiting)) properties.set(name, prop);
    for (const property of model.propertiesByOwner.get(id) ?? []) properties.set(property.name, property);
    visiting.delete(id);
    memo.set(id, properties);
    return properties;
  };
  return resolveOwner(ownerId, new Set());
}

function propertyAvailable(model: TypeModel, propertyRef: string, contextType: string): boolean {
  const parsed = propertyRefPattern.exec(propertyRef);
  if (!parsed) return false;
  const [, owner, name] = parsed;
  if (owner !== contextType) return false;
  return effectiveProperties(model, contextType).has(name!);
}

function resolvePropertyReference(context: ValidationContext, model: TypeModel, file: string, owner: string, propertyRef: string, contextType?: string): PropertyInfo | null {
  const parsed = propertyRefPattern.exec(propertyRef);
  if (!parsed) {
    add(context, file, `${owner} property reference '${propertyRef}' must use <TypeOrRelationFqn>#<localName>.`);
    return null;
  }
  const [, propertyOwner, propertyName] = parsed;
  const declaration = context.declarations.get(propertyOwner!);
  if (!declaration || !["object-type", "business-object", "mixin", "relation"].includes(declaration.kind)) {
    add(context, file, `${owner} property reference '${propertyRef}' has undeclared ObjectType, BusinessObject, Mixin, or Relation owner '${propertyOwner}'.`);
    return null;
  }
  if (contextType && propertyOwner !== contextType) {
    add(context, file, `${owner} property reference '${propertyRef}' must use its active context type '${contextType}'.`);
    return null;
  }
  const property = effectiveProperties(model, propertyOwner!).get(propertyName!);
  if (!property) {
    add(context, file, `${owner} property '${propertyName}' is not available on '${propertyOwner}' through local, inherited, or mixed-in declarations.`);
    return null;
  }
  return property;
}

function expectTargetReference(context: ValidationContext, model: TypeModel, file: string, owner: string, targetKind: string, targetRef: string, fallbackKinds: DeclarationKind[]): Declaration | PropertyInfo | null {
  if (targetKind === "property" || targetKind === "computed-property") {
    const property = resolvePropertyReference(context, model, file, owner, targetRef);
    if (property && (targetKind === "computed-property") !== property.computed) {
      add(context, file, `${owner} references '${targetRef}' as ${targetKind}, but it is ${property.computed ? "computed-property" : "property"}.`);
      return null;
    }
    return property;
  }
  return expectReference(context, file, owner, targetRef, fallbackKinds);
}

function normalizedTypeBase(context: ValidationContext, typeRef: string): string | null {
  if (builtins.has(typeRef)) return typeRef;
  const declaration = context.declarations.get(typeRef);
  if (!declaration) return null;
  if (declaration.kind === "scalar-type") return attribute(declaration.node, "base");
  if (declaration.kind === "enum-type") return "enum";
  return null;
}

function isRelationEdgePropertyType(context: ValidationContext, typeRef: string): boolean {
  if (builtins.has(typeRef)) return true;
  const declaration = context.declarations.get(typeRef);
  if (!declaration) return false;
  if (declaration.kind === "scalar-type" || declaration.kind === "enum-type") return true;
  return declaration.kind === "object-type" && attribute(declaration.node, "kind") === "value";
}

function normalizedPropertyBase(context: ValidationContext, model: TypeModel, propertyRef: string): string | null {
  const parsed = propertyRefPattern.exec(propertyRef);
  const property = parsed ? effectiveProperties(model, parsed[1]!).get(parsed[2]!) : undefined;
  if (!property) return null;
  return normalizedTypeBase(context, property.typeRef);
}

function relationEndpointContext(context: ValidationContext, model: TypeModel, relationRef: string, currentType: string, direction?: string): string | null {
  const relation = context.declarations.get(relationRef);
  if (!relation || relation.kind !== "relation") return null;
  const from = attribute(relation.node, "fromTypeRef");
  const to = attribute(relation.node, "toTypeRef");
  if (direction === "out") return isTypeAssignable(context, model, currentType, from) ? to : null;
  if (direction === "in") return isTypeAssignable(context, model, currentType, to) ? from : null;
  if (isTypeAssignable(context, model, currentType, from)) return to;
  if (isTypeAssignable(context, model, currentType, to)) return from;
  return null;
}

function isJsonNumberLexical(value: string): boolean {
  return /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(value) && Number.isFinite(Number(value));
}

function isDecimalLexical(value: string): boolean {
  return /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value);
}

function isRfc3339(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
}

function validatePredicate(context: ValidationContext, model: TypeModel, file: string, element: string, node: XmlObject, currentType: string): void {
  const exactlyOnePredicate = () => directChildEntries(node).filter(([name]) => predicateElements.has(name));
  if (element === "All" || element === "Any") {
    const predicates = exactlyOnePredicate();
    if (predicates.length < 2) add(context, file, `<${element}> must contain at least two predicates.`);
    for (const [childName, child] of predicates) validatePredicate(context, model, file, childName, child, currentType);
    return;
  }
  if (element === "Not" || element === "When" || element === "Require" || element === "Guard") {
    const predicates = exactlyOnePredicate();
    if (predicates.length !== 1) add(context, file, `<${element}> must contain exactly one predicate.`);
    for (const [childName, child] of predicates) validatePredicate(context, model, file, childName, child, currentType);
    return;
  }
  if (["PropertyPresent", "PropertyEquals", "PropertyNotEquals", "PropertyIn"].includes(element)) {
    const propertyRef = attribute(node, "propertyRef");
    resolvePropertyReference(context, model, file, `<${element}> @propertyRef`, propertyRef, currentType);
    if (["PropertyEquals", "PropertyNotEquals"].includes(element)) validateExecutableText(context, file, `<${element}> @value`, attribute(node, "value"), true);
    return;
  }
  if (element === "PropertyCompare") {
    const propertyRef = attribute(node, "propertyRef");
    const otherPropertyRef = attribute(node, "otherPropertyRef");
    const value = attribute(node, "value");
    const id = propertyRef || "<missing>";
    resolvePropertyReference(context, model, file, "PropertyCompare @propertyRef", propertyRef, currentType);
    if (!["lt", "lte", "gt", "gte"].includes(attribute(node, "op"))) add(context, file, `PropertyCompare '${id}' has invalid op '${attribute(node, "op")}'.`);
    if ((value ? 1 : 0) + (otherPropertyRef ? 1 : 0) !== 1) add(context, file, `PropertyCompare '${id}' requires exactly one of @value or @otherPropertyRef.`);
    const lhsBase = normalizedPropertyBase(context, model, propertyRef);
    if (!lhsBase || !orderableBuiltins.has(lhsBase)) {
      add(context, file, `PropertyCompare '${id}' left operand must have an orderable normalized base.`);
    }
    if (otherPropertyRef) {
      resolvePropertyReference(context, model, file, "PropertyCompare @otherPropertyRef", otherPropertyRef, currentType);
      const rhsBase = normalizedPropertyBase(context, model, otherPropertyRef);
      if (!lhsBase || !rhsBase || lhsBase !== rhsBase || !orderableBuiltins.has(lhsBase)) {
        add(context, file, `PropertyCompare '${id}' operands must have the same orderable normalized base.`);
      }
    }
    if (value) {
      validateExecutableText(context, file, `PropertyCompare '${id}' @value`, value, true);
      if (lhsBase === "builtin:Number" && !isJsonNumberLexical(value)) add(context, file, `PropertyCompare '${id}' value '${value}' is not a finite JSON number.`);
      if (lhsBase === "builtin:Decimal" && !isDecimalLexical(value)) add(context, file, `PropertyCompare '${id}' value '${value}' is not an exact base-10 decimal.`);
      if (lhsBase === "builtin:DateTime" && !isRfc3339(value)) add(context, file, `PropertyCompare '${id}' value '${value}' is not an RFC 3339 timestamp with offset.`);
    }
    return;
  }
  if (element === "TypeIs") {
    expectReference(context, file, "<TypeIs> @typeRef", attribute(node, "typeRef"), entityTypeKinds);
    return;
  }
  if (element === "RelatedExists" || element === "EveryRelated") {
    const relationRef = attribute(node, "relationRef");
    expectReference(context, file, `<${element}> @relationRef`, relationRef, ["relation"]);
    const nextType = relationEndpointContext(context, model, relationRef, currentType);
    if (!nextType) add(context, file, `<${element}> relationRef '${relationRef}' is not compatible with predicate context object type '${currentType}'.`);
    for (const [childName, child] of exactlyOnePredicate()) validatePredicate(context, model, file, childName, child, nextType ?? currentType);
    return;
  }
  if (element === "RelatedCount") {
    const relationRef = attribute(node, "relationRef");
    expectReference(context, file, "<RelatedCount> @relationRef", relationRef, ["relation"]);
    if (!relationEndpointContext(context, model, relationRef, currentType)) add(context, file, `<RelatedCount> relationRef '${relationRef}' is not compatible with predicate context object type '${currentType}'.`);
    if (!["eq", "neq", "lt", "lte", "gt", "gte"].includes(attribute(node, "op"))) add(context, file, `<RelatedCount> has invalid op '${attribute(node, "op")}'.`);
    if (!/^\d+$/.test(attribute(node, "value"))) add(context, file, "<RelatedCount> value must be a non-negative integer.");
    return;
  }
  if (element === "ExistsRelated") {
    const relationRef = attribute(node, "relationRef");
    expectReference(context, file, "<ExistsRelated> @relationRef", relationRef, ["relation"]);
    expectReference(context, file, "<ExistsRelated> @targetTypeRef", attribute(node, "targetTypeRef"), entityTypeKinds);
    if (!["out", "in"].includes(attribute(node, "direction"))) add(context, file, `<ExistsRelated> has invalid direction '${attribute(node, "direction")}'.`);
    const nextType = relationEndpointContext(context, model, relationRef, currentType, attribute(node, "direction"));
    if (!nextType) add(context, file, `<ExistsRelated> relationRef '${relationRef}' direction '${attribute(node, "direction")}' is not compatible with predicate context object type '${currentType}'.`);
    else if (!isTypeAssignable(context, model, nextType, attribute(node, "targetTypeRef"))) {
      add(context, file, `<ExistsRelated> targetTypeRef '${attribute(node, "targetTypeRef")}' is not compatible with relation endpoint '${nextType}'.`);
    }
  }
}

function validateRelations(context: ValidationContext, model: TypeModel): void {
  for (const declaration of context.declarations.values()) {
    if (declaration.kind !== "relation") continue;
    const node = declaration.node;
    const id = declaration.id;
    validateLocalName(context, declaration.file, `Relation '${id}' @name`, attribute(node, "name"));
    for (const endpoint of ["fromTypeRef", "toTypeRef"]) {
      const ref = attribute(node, endpoint);
      const target = expectReference(context, declaration.file, `Relation '${id}' @${endpoint}`, ref, entityTypeKinds);
      if (!target && context.declarations.has(ref)) {
        add(context, declaration.file, `RELATION_ENDPOINT_KIND_MISMATCH: Relation '${id}' endpoint @${endpoint} must resolve to an entity ObjectType or BusinessObject declaration, not '${context.declarations.get(ref)!.kind}'.`);
      }
    }
    validateBoolean(context, declaration.file, `Relation '${id}' @directed`, attribute(node, "directed"));
    const min = attribute(node, "min");
    const max = attribute(node, "max");
    if (min && !/^\d+$/.test(min)) add(context, declaration.file, `Relation '${id}' @min must be a non-negative integer.`);
    if (max && max !== "*" && !/^\d+$/.test(max)) add(context, declaration.file, `Relation '${id}' @max must be a non-negative integer or '*'.`);
    if (min && max && /^\d+$/.test(min) && /^\d+$/.test(max) && Number(max) < Number(min)) add(context, declaration.file, `Relation '${id}' cardinality requires max >= min.`);
    for (const property of model.propertiesByOwner.get(id) ?? []) {
      if (!isRelationEdgePropertyType(context, property.typeRef)) add(context, declaration.file, `Relation '${id}' edge Property '${property.id}' must resolve to a scalar, enum, value, or JSON-compatible type.`);
    }
  }
}

function validateRules(context: ValidationContext, model: TypeModel): void {
  for (const declaration of context.declarations.values()) {
    if (declaration.kind !== "rule") continue;
    const id = declaration.id;
    const scopeTypeRef = attribute(declaration.node, "scopeTypeRef");
    expectReference(context, declaration.file, `Rule '${id}' @scopeTypeRef`, scopeTypeRef, entityTypeKinds);
    if (!ruleKinds.has(attribute(declaration.node, "kind"))) add(context, declaration.file, `Rule '${id}' has invalid kind '${attribute(declaration.node, "kind")}'.`);
    for (const containerName of ["When", "Require"]) {
      for (const container of childObjects(declaration.node, containerName)) {
        validatePredicate(context, model, declaration.file, containerName, container, scopeTypeRef);
      }
    }
  }
}

function validateLifecycles(context: ValidationContext, model: TypeModel): void {
  for (const declaration of context.declarations.values()) {
    if (declaration.kind !== "state-machine") continue;
    const id = declaration.id;
    const node = declaration.node;
    const subjectTypeRef = attribute(node, "subjectTypeRef");
    expectReference(context, declaration.file, `StateMachine '${id}' @subjectTypeRef`, subjectTypeRef, entityTypeKinds);
    const statePropertyRef = attribute(node, "statePropertyRef");
    resolvePropertyReference(context, model, declaration.file, `StateMachine '${id}' @statePropertyRef`, statePropertyRef, subjectTypeRef);
    const states = childObjects(node, "States").flatMap((container) => childObjects(container, "State"));
    const stateIds = new Set<string>();
    const terminalStates = new Set<string>();
    for (const state of states) {
      const stateId = attribute(state, "id");
      validateLocalName(context, declaration.file, `StateMachine '${id}' State`, stateId);
      if (stateIds.has(stateId)) add(context, declaration.file, `StateMachine '${id}' declares duplicate State '${stateId}'.`);
      stateIds.add(stateId);
      if (hasAttribute(state, "terminal")) validateBoolean(context, declaration.file, `StateMachine '${id}' State '${stateId}' @terminal`, attribute(state, "terminal"));
      if (attribute(state, "terminal") === "true") terminalStates.add(stateId);
    }
    if (!stateIds.has(attribute(node, "initial"))) add(context, declaration.file, `StateMachine '${id}' initial state '${attribute(node, "initial")}' is not declared.`);
    const graph = new Map<string, Set<string>>();
    for (const stateId of stateIds) graph.set(stateId, new Set());
    const transitionKeys = new Set<string>();
    for (const transition of childObjects(node, "Transitions").flatMap((container) => childObjects(container, "Transition"))) {
      const transitionId = attribute(transition, "id");
      validateLocalName(context, declaration.file, `Transition '${transitionId}' @trigger`, attribute(transition, "trigger"));
      const from = attribute(transition, "from");
      const to = attribute(transition, "to");
      if (!stateIds.has(from)) add(context, declaration.file, `Transition '${transitionId}' from state '${from}' is not declared by '${id}'.`);
      if (!stateIds.has(to)) add(context, declaration.file, `Transition '${transitionId}' to state '${to}' is not declared by '${id}'.`);
      if (terminalStates.has(from)) add(context, declaration.file, `StateMachine '${id}' terminal State '${from}' must not have outgoing Transition '${transitionId}'.`);
      if (stateIds.has(from) && stateIds.has(to)) graph.get(from)!.add(to);
      const key = `${attribute(transition, "trigger")}|${from}|${to}`;
      if (transitionKeys.has(key)) add(context, declaration.file, `StateMachine '${id}' has duplicate transition trigger/from/to '${key}'.`);
      transitionKeys.add(key);
      for (const guard of childObjects(transition, "Guard")) validatePredicate(context, model, declaration.file, "Guard", guard, subjectTypeRef);
      for (const effect of childObjects(transition, "Effects").flatMap((container) => directChildEntries(container))) {
        const [effectName, effectNode] = effect;
        if (effectName === "SetProperty" || effectName === "ClearProperty") {
          const propertyRef = attribute(effectNode, "propertyRef");
          resolvePropertyReference(context, model, declaration.file, `<${effectName}> @propertyRef`, propertyRef, subjectTypeRef);
        } else if (effectName === "CreateRelation" || effectName === "RemoveRelation") {
          const relationRef = attribute(effectNode, "relationRef");
          expectReference(context, declaration.file, `<${effectName}> @relationRef`, relationRef, ["relation"]);
          if (!relationEndpointContext(context, model, relationRef, subjectTypeRef)) add(context, declaration.file, `<${effectName}> relationRef '${relationRef}' is not compatible with StateMachine '${id}' subjectTypeRef.`);
        }
      }
    }
    if (stateIds.has(attribute(node, "initial"))) {
      const reachable = new Set<string>();
      const stack = [attribute(node, "initial")];
      while (stack.length > 0) {
        const current = stack.pop()!;
        if (reachable.has(current)) continue;
        reachable.add(current);
        for (const next of graph.get(current) ?? []) stack.push(next);
      }
      for (const stateId of [...stateIds].sort()) {
        if (!reachable.has(stateId)) add(context, declaration.file, `StateMachine '${id}' State '${stateId}' is unreachable from initial '${attribute(node, "initial")}'.`);
      }
    }
    for (const derivation of childObjects(node, "Derivations").flatMap((container) => childObjects(container, "Derivation"))) {
      const derivationId = attribute(derivation, "id");
      const yields = childObjects(derivation, "Yields")[0];
      if (yields && !stateIds.has(attribute(yields, "state"))) add(context, declaration.file, `Derivation '${derivationId}' yields undeclared state '${attribute(yields, "state")}'.`);
      for (const when of childObjects(derivation, "When")) validatePredicate(context, model, declaration.file, "When", when, subjectTypeRef);
    }
  }
}

function validateOwnerRef(context: ValidationContext, file: string, label: string, ownerKind: string, ownerRef: string): Declaration | null {
  if (!ownerKinds.has(ownerKind)) {
    add(context, file, `${label} has invalid owner kind '${ownerKind}'.`);
    return null;
  }
  const rule = ownerTargetKinds[ownerKind]!;
  if (rule.required && !ownerRef) {
    add(context, file, `${label} ownerRef is required for owner kind '${ownerKind}'.`);
    return null;
  }
  if (!rule.required && ownerRef === "") return ownerKind === "domain-context" ? context.declarations.get(context.ontologyId) ?? null : null;
  if (ownerKind === "domain-context" && ownerRef) {
    add(context, file, `${label} ownerRef is forbidden for owner kind 'domain-context'.`);
    return null;
  }
  if (ownerKind === "raw" && !ownerRef) return null;
  const declaration = context.declarations.get(ownerRef);
  if (!declaration) {
    add(context, file, `${label} ownerRef references undeclared owner resource identity '${ownerRef}'.`);
    return null;
  }
  if (!rule.kinds.includes(declaration.kind)) {
    add(context, file, `${label} ownerRef must resolve to owner resource identity for owner kind '${ownerKind}', expected ${rule.kinds.join("|")} but found ${declaration.kind}.`);
    return null;
  }
  return declaration;
}

function validateProfiles(context: ValidationContext, model: TypeModel): void {
  for (const declaration of context.declarations.values()) {
    const { kind, node, file, id } = declaration;
    if (kind === "business-object") {
      for (const rule of childObjects(node, "Constraints").flatMap((container) => childObjects(container, "Rule"))) {
        const ref = attribute(rule, "ref");
        const ruleDecl = expectReference(context, file, `BusinessObject '${id}' Rule`, ref, ["rule"]);
        if (ruleDecl && !isTypeAssignable(context, model, id, attribute(ruleDecl.node, "scopeTypeRef"))) add(context, file, `BusinessObject '${id}' Rule '${ref}' scopeTypeRef is not compatible with '${id}'.`);
      }
      for (const sm of childObjects(node, "Lifecycles").flatMap((container) => childObjects(container, "StateMachine"))) {
        const ref = attribute(sm, "ref");
        const smDecl = expectReference(context, file, `BusinessObject '${id}' StateMachine`, ref, ["state-machine"]);
        if (smDecl && !isTypeAssignable(context, model, id, attribute(smDecl.node, "subjectTypeRef"))) add(context, file, `BusinessObject '${id}' StateMachine '${ref}' subjectTypeRef is not compatible with '${id}'.`);
      }
    }
    if (kind === "association") {
      for (const forbidden of ["from", "to", "fromTypeRef", "toTypeRef", "directed", "min", "max"]) {
        if (hasAttribute(node, forbidden)) add(context, file, `ASSOCIATION_INLINE_RELATION_FACT: Association '${id}' must not redeclare DomainModel relation endpoints or cardinality.`);
      }
      expectReference(context, file, `Association '${id}' @relationRef`, attribute(node, "relationRef"), ["relation"]);
      if (childObjects(node, "Properties").length > 0) add(context, file, `ASSOCIATION_INLINE_RELATION_FACT: Association '${id}' must not redeclare DomainModel relation endpoints or edge properties.`);
    }
    if (kind === "domain-policy") {
      validateOwnerRef(context, file, `DomainPolicy '${id}'`, attribute(node, "ownerKind"), attribute(node, "ownerRef"));
      for (const child of directChildEntries(node)) {
        if (predicateElements.has(child[0]) || ["When", "Require", "Violation"].includes(child[0])) add(context, file, `DomainPolicy '${id}' must not declare predicates inline.`);
      }
      for (const rule of childObjects(node, "Rules").flatMap((container) => childObjects(container, "Rule"))) {
        expectReference(context, file, `DomainPolicy '${id}' Rule`, attribute(rule, "ref"), ["rule"]);
      }
    }
    if (kind === "constraint-handler") {
      validateOwnerRef(context, file, `ConstraintHandler '${id}'`, attribute(node, "ownerKind"), attribute(node, "ownerRef"));
      if (!portabilityValues.has(attribute(node, "portability"))) add(context, file, `ConstraintHandler '${id}' has invalid portability '${attribute(node, "portability")}'.`);
      for (const rule of childObjects(node, "Rules").flatMap((container) => childObjects(container, "Rule"))) {
        expectReference(context, file, `ConstraintHandler '${id}' Rule`, attribute(rule, "ref"), ["rule"]);
      }
    }
    if (kind === "business-process") {
      for (const [element, ref] of childObjects(node, "Participants").flatMap((container) => directChildEntries(container))) {
        expectReference(context, file, `BusinessProcess '${id}' ${element}`, attribute(ref, "ref"), refElementKinds[element] ?? []);
      }
      for (const rule of childObjects(node, "Policies").flatMap((container) => childObjects(container, "Rule"))) {
        expectReference(context, file, `BusinessProcess '${id}' Rule`, attribute(rule, "ref"), ["rule"]);
      }
    }
    if (kind === "capability") {
      for (const type of childObjects(node, "Inputs").flatMap((container) => childObjects(container, "Type")).concat(childObjects(node, "Outputs").flatMap((container) => childObjects(container, "Type")))) {
        validateTypeLikeRef(context, file, `Capability '${id}' Type`, attribute(type, "ref"));
      }
    }
    if (kind === "event-contract") {
      expectReference(context, file, `EventContract '${id}' @eventTypeRef`, attribute(node, "eventTypeRef"), ["object-type"]);
      for (const [element, ref] of childObjects(node, "Subjects").flatMap((container) => directChildEntries(container))) {
        expectReference(context, file, `EventContract '${id}' ${element}`, attribute(ref, "ref"), refElementKinds[element] ?? []);
      }
    }
  }
}

function validateBusinessObjectMembers(context: ValidationContext, model: TypeModel): void {
  const allowedMemberKinds = new Set(["Action", "Mutation", "Interceptor", "ComputedFunction", "ConstraintHandler", "Lifecycle"]);
  for (const document of context.documents.values()) {
    if (document.rootName === "BusinessObject") {
      const catalogIds = new Set<string>();
      for (const catalog of childObjects(document.root, "ManifestResourceCatalog")) {
        const id = attribute(catalog, "id");
        const kind = attribute(catalog, "kind");
        if (catalogIds.has(id)) add(context, document.file, `BusinessObject '${attribute(document.root, "id")}' has duplicate local catalog '${id}'.`);
        catalogIds.add(id);
        if (!allowedMemberKinds.has(kind)) add(context, document.file, `BusinessObject '${attribute(document.root, "id")}' local catalog kind '${kind}' is not an owned member kind.`);
      }
      continue;
    }
    if (!allowedMemberKinds.has(document.rootName)) continue;
    const declaration = context.declarations.get(attribute(document.root, "id"));
    if (!declaration) continue;
    const expectedOwner = document.ownerResourceId ?? "";
    const ownerRef = attribute(document.root, "ownerRef");
    const owner = expectReference(context, document.file, `${document.rootName} '${declaration.id}' @ownerRef`, ownerRef, ["business-object"]);
    if (!expectedOwner || ownerRef !== expectedOwner) {
      add(context, document.file, `${document.rootName.toUpperCase()}_OWNER_MISMATCH: '${declaration.id}' ownerRef '${ownerRef}' must match containing BusinessObject '${expectedOwner || "<missing>"}'.`);
    }
    if (hasAttribute(document.root, "portability") && !portabilityValues.has(attribute(document.root, "portability"))) {
      add(context, document.file, `${document.rootName} '${declaration.id}' has invalid portability '${attribute(document.root, "portability")}'.`);
    }
    if (document.rootName === "Action") {
      for (const mutationRef of childObjects(document.root, "Mutations").flatMap((container) => childObjects(container, "Mutation"))) {
        const mutation = expectReference(context, document.file, `Action '${declaration.id}' Mutation`, attribute(mutationRef, "ref"), ["mutation"]);
        if (mutation && attribute(mutation.node, "ownerRef") !== ownerRef) add(context, document.file, `Action '${declaration.id}' composes Mutation '${mutation.id}' owned by a different BusinessObject.`);
      }
    }
    if (document.rootName === "Interceptor") {
      const action = expectReference(context, document.file, `Interceptor '${declaration.id}' @actionRef`, attribute(document.root, "actionRef"), ["action"]);
      if (action && attribute(action.node, "ownerRef") !== ownerRef) add(context, document.file, `Interceptor '${declaration.id}' targets Action '${action.id}' owned by a different BusinessObject.`);
      if (!["before", "after"].includes(attribute(document.root, "phase"))) add(context, document.file, `Interceptor '${declaration.id}' phase must be 'before' or 'after'.`);
      if (!/^\d+$/.test(attribute(document.root, "seq"))) add(context, document.file, `Interceptor '${declaration.id}' seq must be a non-negative integer.`);
    }
    if (document.rootName === "ComputedFunction") {
      validateLocalName(context, document.file, `ComputedFunction '${declaration.id}' @name`, attribute(document.root, "name"));
      validateTypeRef(context, document.file, `ComputedFunction '${declaration.id}' @returnTypeRef`, attribute(document.root, "returnTypeRef"));
    }
    if (document.rootName === "ConstraintHandler" && attribute(document.root, "ownerKind") !== "business-object") {
      add(context, document.file, `ConstraintHandler '${declaration.id}' in a BusinessObject member catalog requires ownerKind='business-object'.`);
    }
    if (document.rootName === "Lifecycle") {
      const stateMachine = expectReference(context, document.file, `Lifecycle '${declaration.id}' @stateMachineRef`, attribute(document.root, "stateMachineRef"), ["state-machine"]);
      const businessObject = owner?.kind === "business-object" ? owner : null;
      if (stateMachine && businessObject) {
        const businessObjectType = businessObject.id;
        if (!isTypeAssignable(context, model, businessObjectType, attribute(stateMachine.node, "subjectTypeRef"))) {
          add(context, document.file, `Lifecycle '${declaration.id}' stateMachineRef is not compatible with BusinessObject '${businessObjectType}'.`);
        }
      }
    }
  }
}

function readCapabilitySet(context: ValidationContext, file: string, owner: string, node: XmlObject, mode: "definition" | "binding-operation" | "binding-generic"): { atomicity: Set<string>; observations: Set<string>; generic: Set<string> } {
  const atomicity = new Set<string>();
  const observations = new Set<string>();
  const generic = new Set<string>();
  const children = directChildEntries(node);
  let phase = 0;
  for (const [element, child] of children) {
    if (element === "Atomicity") {
      if (mode === "binding-generic") add(context, file, `${owner} Atomicity is forbidden for non-operation RuntimeBinding.`);
      if (phase > 0) add(context, file, `${owner} Atomicity must appear before Observation and generic Capability.`);
      const value = attribute(child, "value");
      if (!atomicityValues.has(value)) add(context, file, `${owner} Atomicity '${value}' is invalid.`);
      if (atomicity.has(value)) add(context, file, `OPERATION_CAPABILITY_ROLE_MISMATCH: ${owner} declares duplicate Atomicity '${value}'.`);
      atomicity.add(value);
    } else if (element === "Observation") {
      if (mode === "binding-generic") add(context, file, `${owner} Observation '${attribute(child, "value")}' is forbidden for non-operation RuntimeBinding.`);
      phase = Math.max(phase, 1);
      const value = attribute(child, "value");
      if (!observationValues.has(value)) add(context, file, `${owner} Observation '${value}' is invalid.`);
      if (observations.has(value)) add(context, file, `RUNTIME_BINDING_CAPABILITY_ROLE_MISMATCH: ${owner} declares duplicate Observation '${value}'.`);
      observations.add(value);
    } else if (element === "Capability") {
      if (mode === "definition") add(context, file, `${owner} Operation definition Capabilities cannot contain generic Capability.`);
      phase = 2;
      const name = attribute(child, "name");
      const value = attribute(child, "value");
      if (["atomicity", "observation", "observations", "observe", "before", "after", "diff", "trace", "plan"].includes(name)) add(context, file, `${owner} generic Capability '${name}' impersonates structured atomicity/observation.`);
      const key = `${name}=${value}`;
      if (generic.has(key)) add(context, file, `${owner} declares duplicate generic Capability '${key}'.`);
      generic.add(key);
    }
  }
  if (mode !== "binding-generic" && atomicity.size === 0) add(context, file, `${owner} requires a non-empty structured Atomicity set.`);
  return { atomicity, observations, generic };
}

function buildOperations(context: ValidationContext, model: TypeModel): Map<string, OperationInfo> {
  const operations = new Map<string, OperationInfo>();
  for (const declaration of context.declarations.values()) {
    if (declaration.kind !== "operation") continue;
    const id = declaration.id;
    const node = declaration.node;
    const owner = attribute(node, "owner");
    const behavior = attribute(node, "behavior");
    const effect = attribute(node, "effect");
    const subjectTypeRef = attribute(node, "subjectTypeRef");
    const ownerRef = attribute(node, "ownerRef");
    if (!verbPattern.test(attribute(node, "verb"))) add(context, declaration.file, `Operation '${id}' verb "${attribute(node, "verb")}" must be lowerCamelCase or PascalCase.`);
    if (!ownerKinds.has(attribute(node, "owner"))) add(context, declaration.file, `Operation '${id}' has invalid owner '${attribute(node, "owner")}'.`);
    if (!behaviorKinds.has(attribute(node, "behavior"))) add(context, declaration.file, `Operation '${id}' has invalid behavior '${attribute(node, "behavior")}'.`);
    if (!subjectKinds.has(attribute(node, "subject"))) add(context, declaration.file, `Operation '${id}' has invalid subject '${attribute(node, "subject")}'.`);
    if (!invocationModes.has(attribute(node, "invocation"))) add(context, declaration.file, `Operation '${id}' has invalid invocation '${attribute(node, "invocation")}'.`);
    if (!effects.has(attribute(node, "effect"))) add(context, declaration.file, `Operation '${id}' has invalid effect '${attribute(node, "effect")}'.`);
    if ((behavior === "mutation" || behavior === "transition") && effect === "read-only") add(context, declaration.file, `Operation '${id}' behavior "${behavior}" cannot use effect "read-only".`);
    const ownerDecl = validateOwnerRef(context, declaration.file, `Operation '${id}'`, owner, ownerRef);
    if (attribute(node, "subject") === "none" && attribute(node, "subjectTypeRef")) add(context, declaration.file, `Operation '${id}' forbids subjectTypeRef when subject="none".`);
    if (attribute(node, "subject") !== "none" && !attribute(node, "subjectTypeRef")) add(context, declaration.file, `Operation '${id}' requires subjectTypeRef when subject is '${attribute(node, "subject")}'.`);
    if (attribute(node, "subjectTypeRef")) expectReference(context, declaration.file, `Operation '${id}' @subjectTypeRef`, attribute(node, "subjectTypeRef"), entityTypeKinds);
    if (ownerDecl && subjectTypeRef && owner === "business-object") {
      if (!isTypeAssignable(context, model, subjectTypeRef, ownerDecl.id)) add(context, declaration.file, `Operation '${id}' subjectTypeRef "${subjectTypeRef}" must be compatible with BusinessObject owner "${ownerDecl.id}".`);
    }
    if (ownerDecl && subjectTypeRef && owner === "lifecycle") {
      const ownerSubjectTypeRef = attribute(ownerDecl.node, "subjectTypeRef");
      if (ownerSubjectTypeRef && !isTypeAssignable(context, model, subjectTypeRef, ownerSubjectTypeRef)) add(context, declaration.file, `Operation '${id}' subjectTypeRef "${subjectTypeRef}" must be compatible with StateMachine owner subjectTypeRef "${ownerSubjectTypeRef}".`);
    }
    if (attribute(node, "inputTypeRef")) validateTypeLikeRef(context, declaration.file, `Operation '${id}' @inputTypeRef`, attribute(node, "inputTypeRef"));
    if (attribute(node, "outputTypeRef")) validateTypeLikeRef(context, declaration.file, `Operation '${id}' @outputTypeRef`, attribute(node, "outputTypeRef"));
    for (const opRef of childObjects(node, "Composition").flatMap((container) => childObjects(container, "Operation"))) {
      expectReference(context, declaration.file, `Operation '${id}' Composition`, attribute(opRef, "ref"), ["operation"]);
    }
    for (const rule of childObjects(node, "Constraints").flatMap((container) => childObjects(container, "Rule"))) {
      expectReference(context, declaration.file, `Operation '${id}' Constraint`, attribute(rule, "ref"), ["rule"]);
    }
    const capabilities = childObjects(node, "Capabilities")[0] ?? {};
    const sets = readCapabilitySet(context, declaration.file, `Operation '${id}'`, capabilities, "definition");
    operations.set(id, { id, node, file: declaration.file, atomicity: sets.atomicity, observations: sets.observations });
  }
  const graph = new Map<string, string[]>();
  const ownerFiles = new Map<string, string>();
  for (const operation of operations.values()) {
    graph.set(operation.id, childObjects(operation.node, "Composition").flatMap((container) => childObjects(container, "Operation")).map((ref) => attribute(ref, "ref")));
    ownerFiles.set(operation.id, operation.file);
  }
  detectCycles(context, graph, "Operation composition", ownerFiles);
  return operations;
}

function exactKeys(value: unknown, keys: string[]): boolean {
  return isObject(value) && Object.keys(value).sort().join("|") === [...keys].sort().join("|");
}

function describeValue(value: unknown): string {
  return typeof value === "string" ? `"${value}"` : JSON.stringify(value);
}

function jsonContainsExecutableText(value: unknown): boolean {
  if (typeof value === "string") return forbiddenTextPattern.test(value) || forbiddenPathPattern.test(value);
  if (Array.isArray(value)) return value.some(jsonContainsExecutableText);
  if (isObject(value)) return Object.values(value).some(jsonContainsExecutableText);
  return false;
}

function enumValues(context: ValidationContext, enumRef: string): Set<string> {
  const declaration = context.declarations.get(enumRef);
  if (!declaration || declaration.kind !== "enum-type") return new Set();
  return new Set(childObjects(declaration.node, "Members").flatMap((container) => childObjects(container, "Member")).map((member) => attribute(member, "value")));
}

function validateJsonValueForType(context: ValidationContext, file: string, owner: string, value: unknown, typeRef: string, model: TypeModel): void {
  const base = normalizedTypeBase(context, typeRef);
  if (base === "builtin:String" || base === "builtin:DateTime" || base === "builtin:Uuid") {
    if (typeof value !== "string") add(context, file, `${owner} must be string for type "${base}".`);
    else if (base === "builtin:DateTime" && !isRfc3339(value)) add(context, file, `${owner} must be an RFC 3339 string for type "${base}".`);
    return;
  }
  if (base === "builtin:Number" || base === "builtin:Decimal") {
    if (typeof value !== "number" || !Number.isFinite(value)) add(context, file, `${owner} must be number for type "${base}".`);
    return;
  }
  if (base === "builtin:Bool") {
    if (typeof value !== "boolean") add(context, file, `${owner} must be boolean for type "${base}".`);
    return;
  }
  if (base === "builtin:Json") return;
  if (base === "builtin:Validity") {
    if (typeof value !== "string" || !["valid", "invalid", "unknown"].includes(value)) add(context, file, `${owner} must be valid, invalid, or unknown for type "${base}".`);
    return;
  }
  if (base === "enum") {
    if (typeof value !== "string" || !enumValues(context, typeRef).has(value)) add(context, file, `${owner} must be one declared enum value for type "${typeRef}".`);
    return;
  }

  const declaration = context.declarations.get(typeRef);
  if (declaration?.kind === "collection-type") {
    const collection = attribute(declaration.node, "collection");
    if (collection === "list" || collection === "set") {
      if (!Array.isArray(value)) add(context, file, `${owner} must be array for type "${typeRef}".`);
      else value.forEach((item, index) => validateJsonValueForType(context, file, `${owner}[${index}]`, item, attribute(declaration.node, "itemTypeRef"), model));
      return;
    }
    if (collection === "map") {
      if (!isObject(value)) add(context, file, `${owner} must be object for type "${typeRef}".`);
      else for (const [key, item] of Object.entries(value)) {
        if (!key) add(context, file, `${owner} map keys must be non-empty strings.`);
        validateJsonValueForType(context, file, `${owner}.${key}`, item, attribute(declaration.node, "itemTypeRef"), model);
      }
      return;
    }
  }
  if (declaration?.kind === "union-type") return;
  if (declaration?.kind === "object-type" || declaration?.kind === "business-object" || declaration?.kind === "mixin") {
    validateObjectPayloadJson(context, file, owner, value, typeRef, model);
  }
}

function validateObjectPayloadJson(context: ValidationContext, file: string, owner: string, payload: unknown, inputTypeRef: string, model: TypeModel): void {
  if (!isObject(payload)) {
    add(context, file, `${owner} must be object for inputTypeRef "${inputTypeRef}".`);
    return;
  }
  const properties = [...effectiveProperties(model, inputTypeRef).values()];
  const byName = new Map(properties.map((property) => [property.name, property]));
  for (const property of properties) {
    if (property.required && !Object.hasOwn(payload, property.name)) add(context, file, `${owner} missing required field "${property.name}" for inputTypeRef "${inputTypeRef}".`);
  }
  for (const [key, value] of Object.entries(payload)) {
    const property = byName.get(key);
    if (!property) {
      add(context, file, `${owner} contains unknown field "${key}" for inputTypeRef "${inputTypeRef}".`);
      continue;
    }
    validateJsonValueForType(context, file, `${owner} field "${key}"`, value, property.typeRef, model);
  }
}

function validatePayloadJson(context: ValidationContext, file: string, owner: string, payload: unknown, operation: XmlObject, model: TypeModel): void {
  const inputTypeRef = attribute(operation, "inputTypeRef");
  if (!inputTypeRef) return;
  const declaration = context.declarations.get(inputTypeRef);
  if (declaration?.kind === "object-type" || declaration?.kind === "business-object" || declaration?.kind === "mixin") validateObjectPayloadJson(context, file, owner, payload, inputTypeRef, model);
  else validateJsonValueForType(context, file, owner, payload, inputTypeRef, model);
}

function validateSubjectJson(context: ValidationContext, file: string, owner: string, subject: unknown, operation: XmlObject, model: TypeModel): void {
  if (!isObject(subject)) {
    add(context, file, `${owner} subject must be an object.`);
    return;
  }
  const kind = subject.kind;
  if (kind !== attribute(operation, "subject")) add(context, file, `${owner} subject.kind ${describeValue(kind)} must equal Operation@subject "${attribute(operation, "subject")}".`);
  if (kind === "none") {
    if (!exactKeys(subject, ["kind"])) add(context, file, `${owner} none subject must contain exactly kind.`);
    return;
  }
  if (kind === "single") {
    if (!exactKeys(subject, ["kind", "ref"])) add(context, file, `${owner} single subject must contain exactly kind and ref.`);
    const ref = subject.ref;
    if (!isObject(ref) || !exactKeys(ref, ["type", "id"]) || typeof ref.type !== "string" || typeof ref.id !== "string" || !ref.id) {
      add(context, file, `${owner} single subject ref requires non-empty type and id.`);
    } else if (!isTypeAssignable(context, model, ref.type, attribute(operation, "subjectTypeRef"))) {
      add(context, file, `${owner} subject ref.type "${ref.type}" must be assignable to Operation@subjectTypeRef "${attribute(operation, "subjectTypeRef")}".`);
    }
    return;
  }
  if (kind === "selection") {
    if (!exactKeys(subject, ["kind", "selector"])) add(context, file, `${owner} selection subject must contain exactly kind and selector.`);
    const selector = subject.selector;
    if (!isObject(selector) || typeof selector.kind !== "string") {
      add(context, file, `${owner} selector must be an object with kind.`);
      return;
    }
    if (selector.kind === "all") {
      if (!exactKeys(selector, ["kind"])) add(context, file, `${owner} all selector must contain exactly kind.`);
    } else if (selector.kind === "ids") {
      if (!exactKeys(selector, ["kind", "ids"]) || !Array.isArray(selector.ids) || selector.ids.length === 0) add(context, file, `${owner} ids selector requires a non-empty ids array.`);
      if (Array.isArray(selector.ids)) {
        selector.ids.forEach((item, index) => {
          if (!isObject(item) || !exactKeys(item, ["type", "id"]) || typeof item.type !== "string" || typeof item.id !== "string" || !item.type || !item.id) {
            add(context, file, `${owner} ids selector item ${index} requires exactly non-empty string type and id.`);
            return;
          }
          const subjectTypeRef = attribute(operation, "subjectTypeRef");
          if (!isTypeAssignable(context, model, item.type, subjectTypeRef)) add(context, file, `${owner} ids selector item ${index} type "${item.type}" must be assignable to Operation@subjectTypeRef "${subjectTypeRef}".`);
        });
      }
    } else if (selector.kind === "filter") {
      if (!exactKeys(selector, ["kind", "where"]) || !isObject(selector.where)) add(context, file, `${owner} filter selector requires where object.`);
      else {
        for (const [key, value] of Object.entries(selector.where)) {
          if (jsonContainsExecutableText(value)) add(context, file, `${owner} filter selector field "${key}" contains executable or path-like text.`);
        }
      }
    } else {
      add(context, file, `${owner} selector kind "${selector.kind}" is invalid.`);
    }
    return;
  }
  add(context, file, `${owner} subject.kind ${describeValue(kind)} is invalid.`);
}

function validateRequestJson(context: ValidationContext, file: string, presetId: string, preset: XmlObject, operation: OperationInfo, model: TypeModel): void {
  let request: unknown;
  try {
    request = JSON.parse(nodeText(firstChildValue(preset, "RequestJson")));
  } catch (error) {
    add(context, file, `RequestJson '${presetId}' must parse as JSON: ${error instanceof Error ? error.message : String(error)}.`);
    return;
  }
  if (!isObject(request)) {
    add(context, file, `RequestJson '${presetId}' must be a JSON object.`);
    return;
  }
  const topKeys = new Set(Object.keys(request));
  for (const key of ["apiVersion", "context", "operation", "invocation", "execution"]) {
    if (!topKeys.has(key)) add(context, file, `RequestJson '${presetId}' missing required top-level field "${key}".`);
  }
  for (const key of topKeys) {
    if (!["apiVersion", "context", "operation", "invocation", "execution"].includes(key)) add(context, file, `RequestJson '${presetId}' unexpected top-level field "${key}".`);
  }
  if (request.apiVersion !== "1") add(context, file, `RequestJson '${presetId}' apiVersion ${describeValue(request.apiVersion)} must equal "1".`);
  if (!isObject(request.context) || !exactKeys(request.context, ["id", "version"])) add(context, file, `RequestJson '${presetId}' context must contain exactly id and version.`);
  else {
    if (request.context.id !== context.ontologyId) add(context, file, `RequestJson '${presetId}' context.id ${describeValue(request.context.id)} must equal Ontology@id "${context.ontologyId}".`);
    if (request.context.version !== context.ontologyVersion) add(context, file, `RequestJson '${presetId}' context.version ${describeValue(request.context.version)} must equal Ontology@version "${context.ontologyVersion}".`);
  }
  if (!isObject(request.operation)) add(context, file, `RequestJson '${presetId}' operation must be an object.`);
  else {
    const expectedOperationKeys = attribute(operation.node, "ownerRef")
      ? ["ref", "ownerKind", "ownerRef", "behaviorKind", "subjectKind", "invocationMode", "effect"]
      : ["ref", "ownerKind", "behaviorKind", "subjectKind", "invocationMode", "effect"];
    if (!exactKeys(request.operation, expectedOperationKeys)) add(context, file, `RequestJson '${presetId}' operation has invalid keys.`);
    const pairs: Array<[string, string, string]> = [
      ["ref", "id", operation.id],
      ["ownerKind", "owner", attribute(operation.node, "owner")],
      ["behaviorKind", "behavior", attribute(operation.node, "behavior")],
      ["subjectKind", "subject", attribute(operation.node, "subject")],
      ["invocationMode", "invocation", attribute(operation.node, "invocation")],
      ["effect", "effect", attribute(operation.node, "effect")],
    ];
    for (const [field, xmlName, expected] of pairs) {
      if (request.operation[field] !== expected) add(context, file, `RequestJson '${presetId}' operation.${field} ${describeValue(request.operation[field])} must equal Operation@${xmlName} "${expected}".`);
    }
    if (attribute(operation.node, "ownerRef")) {
      if (!Object.hasOwn(request.operation, "ownerRef")) add(context, file, `RequestJson '${presetId}' operation.ownerRef is required for Operation@owner "${attribute(operation.node, "owner")}".`);
      else if (request.operation.ownerRef !== attribute(operation.node, "ownerRef")) add(context, file, `RequestJson '${presetId}' operation.ownerRef ${describeValue(request.operation.ownerRef)} must equal Operation@ownerRef "${attribute(operation.node, "ownerRef")}".`);
    } else if (Object.hasOwn(request.operation, "ownerRef")) {
      add(context, file, `RequestJson '${presetId}' operation.ownerRef is forbidden for Operation@owner "${attribute(operation.node, "owner")}".`);
    }
  }
  if (!isObject(request.invocation)) {
    add(context, file, `RequestJson '${presetId}' invocation must be an object.`);
  } else if (request.invocation.mode !== attribute(operation.node, "invocation")) {
    add(context, file, `RequestJson '${presetId}' invocation.mode ${describeValue(request.invocation.mode)} must equal Operation@invocation "${attribute(operation.node, "invocation")}".`);
  } else if (request.invocation.mode === "single") {
    if (!exactKeys(request.invocation, ["mode", "subject", "verb", "payload"])) add(context, file, `RequestJson '${presetId}' single invocation must contain exactly mode, subject, verb, and payload.`);
    if (request.invocation.verb !== attribute(operation.node, "verb")) add(context, file, `RequestJson '${presetId}' invocation.verb ${describeValue(request.invocation.verb)} must equal Operation@verb "${attribute(operation.node, "verb")}".`);
    if (!Object.hasOwn(request.invocation, "payload")) add(context, file, `RequestJson '${presetId}' single invocation requires payload.`);
    validateSubjectJson(context, file, `RequestJson '${presetId}'`, request.invocation.subject, operation.node, model);
    validatePayloadJson(context, file, `RequestJson '${presetId}' payload`, request.invocation.payload, operation.node, model);
  } else if (request.invocation.mode === "batch") {
    if (!exactKeys(request.invocation, ["mode", "items"])) add(context, file, `RequestJson '${presetId}' batch invocation must contain exactly mode and items.`);
    if (!Array.isArray(request.invocation.items) || request.invocation.items.length === 0) {
      add(context, file, `RequestJson '${presetId}' batch invocation requires non-empty items.`);
    } else {
      const keys = new Set<string>();
      for (const item of request.invocation.items) {
        if (!isObject(item)) {
          add(context, file, `RequestJson '${presetId}' batch item must be an object.`);
          continue;
        }
        const key = typeof item.key === "string" ? item.key : "";
        if (!exactKeys(item, ["key", "subject", "verb", "payload"])) add(context, file, `RequestJson '${presetId}' batch item "${key || "<missing>"}" must contain exactly key, subject, verb, and payload.`);
        if (!key) add(context, file, `RequestJson '${presetId}' batch item requires non-empty key.`);
        if (keys.has(key)) add(context, file, `RequestJson '${presetId}' batch item key "${key}" is duplicated.`);
        keys.add(key);
        if (item.verb !== attribute(operation.node, "verb")) add(context, file, `RequestJson '${presetId}' batch item "${key}" verb ${describeValue(item.verb)} must equal Operation@verb "${attribute(operation.node, "verb")}".`);
        if (!Object.hasOwn(item, "payload")) add(context, file, `RequestJson '${presetId}' batch item "${key}" requires payload.`);
        validateSubjectJson(context, file, `RequestJson '${presetId}' batch item "${key}"`, item.subject, operation.node, model);
        validatePayloadJson(context, file, `RequestJson '${presetId}' batch item "${key}" payload`, item.payload, operation.node, model);
      }
    }
  }
  if (!isObject(request.execution) || !exactKeys(request.execution, ["atomicity", "observe"])) {
    add(context, file, `RequestJson '${presetId}' execution must contain exactly atomicity and observe.`);
    return;
  }
  if (typeof request.execution.atomicity !== "string" || !atomicityValues.has(request.execution.atomicity)) add(context, file, `OPERATION_CAPABILITY_ROLE_MISMATCH: RequestJson '${presetId}' execution.atomicity ${describeValue(request.execution.atomicity)} must be atomic|best-effort.`);
  else if (!operation.atomicity.has(request.execution.atomicity)) add(context, file, `RequestJson '${presetId}' execution.atomicity "${request.execution.atomicity}" is not declared by Operation "${operation.id}".`);
  if (!Array.isArray(request.execution.observe)) {
    add(context, file, `RequestJson '${presetId}' execution.observe must be an array.`);
  } else {
    const seen = new Set<string>();
    for (const observation of request.execution.observe) {
      if (typeof observation !== "string" || !observationValues.has(observation)) add(context, file, `RequestJson '${presetId}' execution.observe contains invalid observation ${describeValue(observation)}.`);
      else if (seen.has(observation)) add(context, file, `RequestJson '${presetId}' execution.observe contains duplicate observation "${observation}".`);
      else if (!operation.observations.has(observation)) add(context, file, `RequestJson '${presetId}' execution.observe contains undeclared observation "${observation}" for Operation "${operation.id}".`);
      seen.add(String(observation));
    }
  }
}

function validateOperationsAndBindings(context: ValidationContext, model: TypeModel): void {
  const operations = buildOperations(context, model);
  for (const declaration of context.declarations.values()) {
    if (declaration.kind === "invocation-preset") {
      const opRef = attribute(declaration.node, "operationRef");
      const operationDecl = expectReference(context, declaration.file, `InvocationPreset '${declaration.id}' @operationRef`, opRef, ["operation"]);
      const operation = operationDecl ? operations.get(operationDecl.id) : undefined;
      if (operation) validateRequestJson(context, declaration.file, declaration.id, declaration.node, operation, model);
      if (hasAttribute(declaration.node, "default")) validateBoolean(context, declaration.file, `InvocationPreset '${declaration.id}' @default`, attribute(declaration.node, "default"));
    }
    if (declaration.kind === "runtime-binding") {
      const targetKind = attribute(declaration.node, "targetKind");
      const targetRef = attribute(declaration.node, "targetRef");
      if (!runtimeTargetKinds.has(targetKind)) add(context, declaration.file, `RuntimeBinding '${declaration.id}' has invalid targetKind '${targetKind}'.`);
      const expected = targetKind === "projection"
        ? ["object-type", "relation", "rule", "state-machine", "operation", "business-object", "association", "domain-policy", "constraint-handler", "business-process", "capability", "event-contract"] as DeclarationKind[]
        : targetKindMap[targetKind] ?? [];
      const target = expectTargetReference(context, model, declaration.file, `RuntimeBinding '${declaration.id}' @targetRef`, targetKind, targetRef, expected);
      if (!portabilityValues.has(attribute(declaration.node, "portability"))) add(context, declaration.file, `RuntimeBinding '${declaration.id}' has invalid portability '${attribute(declaration.node, "portability")}'.`);
      for (const forbidden of ["owner", "ownerKind", "ownerRef", "atomicity"]) {
        if (hasAttribute(declaration.node, forbidden)) add(context, declaration.file, `RuntimeBinding '${declaration.id}' must not declare @${forbidden}.`);
      }
      const caps = childObjects(declaration.node, "Capabilities")[0];
      if (targetKind === "operation") {
        if (!caps) add(context, declaration.file, `RuntimeBinding '${declaration.id}' targetKind="operation" requires Capabilities.`);
        const sets = readCapabilitySet(context, declaration.file, `RuntimeBinding '${declaration.id}'`, caps ?? {}, "binding-operation");
        const operation = target ? operations.get(target.id) : undefined;
        if (operation) {
          for (const atomicity of sets.atomicity) {
            if (!operation.atomicity.has(atomicity)) add(context, declaration.file, `RuntimeBinding "${declaration.id}" Atomicity "${atomicity}" is not declared by Operation "${operation.id}".`);
          }
          for (const observation of sets.observations) {
            if (!operation.observations.has(observation)) add(context, declaration.file, `RuntimeBinding "${declaration.id}" Observation "${observation}" is not declared by Operation "${operation.id}".`);
          }
          if (attribute(operation.node, "invocation") === "batch" && !sets.generic.has("batch=keyed-items")) add(context, declaration.file, `RuntimeBinding '${declaration.id}' must declare generic batch=keyed-items for batch Operation "${operation.id}".`);
          if (attribute(operation.node, "subject") === "selection" && ![...sets.generic].some((value) => value.startsWith("selection="))) add(context, declaration.file, `RuntimeBinding '${declaration.id}' must declare generic selection support for selection Operation "${operation.id}".`);
        }
      } else if (caps) {
        readCapabilitySet(context, declaration.file, `RuntimeBinding '${declaration.id}'`, caps, "binding-generic");
      }
      const handler = childObjects(declaration.node, "HandlerRef")[0];
      if (handler) {
        for (const attr of ["registry", "key", "contract"]) {
          const value = attribute(handler, attr);
          if (value && (/^(?:https?:|file:)/i.test(value) || /[\\/]/.test(value) || /[;&|`$<>]/.test(value) || forbiddenTextPattern.test(value))) {
            add(context, declaration.file, `RuntimeBinding '${declaration.id}' HandlerRef @${attr} must be a stable registry key, not executable code or a path.`);
          }
        }
      }
    }
  }
}

function validateMappings(context: ValidationContext, model: TypeModel): void {
  for (const declaration of context.declarations.values()) {
    if (declaration.kind !== "implementation-mapping") continue;
    const targetKind = attribute(declaration.node, "targetKind");
    if (!mappingTargetKinds.has(targetKind)) add(context, declaration.file, `ImplementationMapping '${declaration.id}' has invalid targetKind '${targetKind}'.`);
    expectTargetReference(context, model, declaration.file, `ImplementationMapping '${declaration.id}' @targetRef`, targetKind, attribute(declaration.node, "targetRef"), targetKindMap[targetKind] ?? []);
    for (const forbidden of ["owner", "ownerKind", "ownerRef"]) {
      if (hasAttribute(declaration.node, forbidden)) add(context, declaration.file, `ImplementationMapping '${declaration.id}' must not declare @${forbidden}.`);
    }
    for (const codeRef of ["RepresentedBy", "ImplementedBy", "PresentedBy", "StoredBy", "ExposedBy"].flatMap((container) => childObjects(declaration.node, container).flatMap((node) => childObjects(node, "CodeRef")))) {
      const path = attribute(codeRef, "path");
      if (path && (isAbsolute(path) || path.includes("\\") || path.split("/").includes(".."))) add(context, declaration.file, `ImplementationMapping '${declaration.id}' CodeRef path must be repository-relative.`);
      for (const attr of ["repository", "language", "kind", "symbol"]) {
        if (/[;&|`$<>]/.test(attribute(codeRef, attr))) add(context, declaration.file, `ImplementationMapping '${declaration.id}' CodeRef @${attr} contains executable shell-like text.`);
      }
    }
    for (const rule of childObjects(declaration.node, "Enforces").flatMap((container) => childObjects(container, "Rule"))) {
      expectReference(context, declaration.file, `ImplementationMapping '${declaration.id}' Enforces Rule`, attribute(rule, "ref"), ["rule"]);
    }
  }
}

function validateEvolution(context: ValidationContext, model: TypeModel): void {
  const aliasSources = new Map<string, Declaration>();
  const aliasGraph = new Map<string, string[]>();
  const aliasFiles = new Map<string, string>();
  const migrationGraph = new Map<string, string[]>();
  const migrationFiles = new Map<string, string>();
  for (const declaration of context.declarations.values()) {
    if (declaration.kind === "alias") {
      const kind = attribute(declaration.node, "kind");
      const from = attribute(declaration.node, "from");
      const to = attribute(declaration.node, "to");
      const ownerRef = attribute(declaration.node, "ownerRef");
      if (!evolutionKinds.has(kind)) add(context, declaration.file, `Alias '${declaration.id}' has invalid kind '${kind}'.`);
      if (kind === "local-name") {
        const owner = expectReference(context, declaration.file, `Alias '${declaration.id}' @ownerRef`, ownerRef, ["object-type", "mixin", "relation"]);
        if (!localNamePattern.test(from) || !localNamePattern.test(to)) add(context, declaration.file, `Alias '${declaration.id}' local-name @from and @to must be lowerCamelCase.`);
        if (owner && ![...effectiveProperties(model, owner.id).values()].some((property) => property.name === to)) add(context, declaration.file, `Alias '${declaration.id}' @to local-name '${to}' is not declared by owner '${owner.id}'.`);
      } else {
        if (hasAttribute(declaration.node, "ownerRef")) add(context, declaration.file, `Alias '${declaration.id}' forbids @ownerRef for kind '${kind}'.`);
        const identityPattern = kind === "property" || kind === "computed-property" ? propertyRefPattern : fqnPattern;
        if (!identityPattern.test(from) || !identityPattern.test(to)) add(context, declaration.file, `Alias '${declaration.id}' @from and @to must use the canonical identity syntax for kind '${kind}'.`);
        expectTargetReference(context, model, declaration.file, `Alias '${declaration.id}' @to`, kind, to, targetKindMap[kind] ?? []);
      }
      if (from === to) add(context, declaration.file, `Alias '${declaration.id}' cannot alias '${from}' to itself.`);
      const sourceKey = `${kind}|${ownerRef}|${from}`;
      if (aliasSources.has(sourceKey)) add(context, declaration.file, `Alias '${declaration.id}' duplicates alias source '${from}'.`);
      aliasSources.set(sourceKey, declaration);
      aliasGraph.set(sourceKey, [`${kind}|${ownerRef}|${to}`]);
      aliasFiles.set(sourceKey, declaration.file);
      if (attribute(declaration.node, "sinceVersion") && !versionPattern.test(attribute(declaration.node, "sinceVersion"))) add(context, declaration.file, `Alias '${declaration.id}' sinceVersion is not a valid version token.`);
      if (attribute(declaration.node, "untilVersion") && !versionPattern.test(attribute(declaration.node, "untilVersion"))) add(context, declaration.file, `Alias '${declaration.id}' untilVersion is not a valid version token.`);
    }
    if (declaration.kind === "migration") {
      const fromVersion = attribute(declaration.node, "fromVersion");
      const toVersion = attribute(declaration.node, "toVersion");
      if (!versionPattern.test(fromVersion)) add(context, declaration.file, `Migration '${declaration.id}' fromVersion is not a valid version token.`);
      if (!versionPattern.test(toVersion)) add(context, declaration.file, `Migration '${declaration.id}' toVersion is not a valid version token.`);
      if (fromVersion === toVersion) add(context, declaration.file, `Migration '${declaration.id}' fromVersion and toVersion must differ.`);
      if (toVersion !== context.ontologyVersion) add(context, declaration.file, `Migration '${declaration.id}' toVersion '${toVersion}' must equal Ontology version '${context.ontologyVersion}'.`);
      if (!["backward-compatible", "breaking"].includes(attribute(declaration.node, "compatibility"))) add(context, declaration.file, `Migration '${declaration.id}' has invalid compatibility '${attribute(declaration.node, "compatibility")}'.`);
      if (migrationGraph.has(fromVersion)) add(context, declaration.file, `Migration '${declaration.id}' duplicates migration fromVersion '${fromVersion}'.`);
      migrationGraph.set(fromVersion, [...(migrationGraph.get(fromVersion) ?? []), toVersion]);
      migrationFiles.set(fromVersion, declaration.file);
      for (const [operation, node] of childObjects(declaration.node, "Changes").flatMap((container) => directChildEntries(container))) {
        const kind = attribute(node, "kind");
        if (!["Add", "Remove", "Rename", "Alter"].includes(operation)) add(context, declaration.file, `Migration '${declaration.id}' has invalid change operation <${operation}>.`);
        if (!evolutionKinds.has(kind) || kind === "local-name") add(context, declaration.file, `Migration '${declaration.id}' <${operation}> has invalid kind '${kind}'.`);
        const currentTarget = operation === "Rename" ? attribute(node, "to") : attribute(node, "targetRef");
        const identityPattern = kind === "property" || kind === "computed-property" ? propertyRefPattern : fqnPattern;
        if (operation === "Rename" && !identityPattern.test(attribute(node, "from"))) add(context, declaration.file, `Migration '${declaration.id}' <Rename> @from must use the canonical identity syntax for kind '${kind}'.`);
        if (operation !== "Remove" && currentTarget) expectTargetReference(context, model, declaration.file, `Migration '${declaration.id}' <${operation}> target`, kind, currentTarget, targetKindMap[kind] ?? []);
        if (operation === "Remove" && currentTarget && !identityPattern.test(currentTarget)) add(context, declaration.file, `Migration '${declaration.id}' <Remove> targetRef must use the canonical identity syntax for kind '${kind}'.`);
        if (operation === "Alter" && !migrationAlterAspects.has(attribute(node, "aspect"))) add(context, declaration.file, `Migration '${declaration.id}' <Alter> aspect '${attribute(node, "aspect")}' is not in the bounded schema-evolution aspect set.`);
      }
    }
    if (declaration.kind === "generation-snapshot") {
      if (attribute(declaration.node, "ontologyVersion") !== context.ontologyVersion) add(context, declaration.file, `GenerationSnapshot '${declaration.id}' ontologyVersion '${attribute(declaration.node, "ontologyVersion")}' must equal Ontology version '${context.ontologyVersion}'.`);
      if (!isRfc3339(attribute(declaration.node, "generatedAt"))) add(context, declaration.file, `GenerationSnapshot '${declaration.id}' generatedAt must be an RFC 3339 timestamp.`);
      const digest = childObjects(declaration.node, "OutputDigest")[0];
      if (digest) {
        if (attribute(digest, "algorithm") !== "sha256") add(context, declaration.file, `GenerationSnapshot '${declaration.id}' OutputDigest algorithm must be 'sha256'.`);
        if (!/^[a-f0-9]{64}$/.test(attribute(digest, "value"))) add(context, declaration.file, `GenerationSnapshot '${declaration.id}' OutputDigest value must be 64 lowercase hex characters.`);
      }
      const repositories = new Set<string>();
      for (const revision of childObjects(declaration.node, "SourceRevisions").flatMap((container) => childObjects(container, "SourceRevision"))) {
        const repository = attribute(revision, "repository");
        const value = attribute(revision, "revision");
        if (!repository.trim()) add(context, declaration.file, `GenerationSnapshot '${declaration.id}' SourceRevision repository must be non-empty.`);
        if (!value.trim()) add(context, declaration.file, `GenerationSnapshot '${declaration.id}' SourceRevision revision must be non-empty.`);
        if (repositories.has(repository)) add(context, declaration.file, `GenerationSnapshot '${declaration.id}' has duplicate SourceRevision repository "${repository}".`);
        repositories.add(repository);
      }
    }
  }
  detectCycles(context, aliasGraph, "Alias", aliasFiles);
  detectCycles(context, migrationGraph, "Migration version graph", migrationFiles);
}

function validateGeneratedAndHypothesisModes(context: ValidationContext): void {
  if (context.generated && context.hypothesisOnly) return;
  const evidenceBearing = new Set<DeclarationKind>([
    "object-type", "mixin", "relation", "rule", "state-machine", "derivation", "transition",
    "business-object", "association", "domain-policy", "constraint-handler", "business-process", "capability", "event-contract",
    "operation", "invocation-preset", "runtime-binding", "implementation-mapping", "alias", "migration",
  ]);
  for (const declaration of context.declarations.values()) {
    if (!evidenceBearing.has(declaration.kind)) continue;
    const evidenceRefs = childObjects(declaration.node, "Evidences").flatMap((container) => childObjects(container, "Evidence"));
    if (context.generated && evidenceRefs.length === 0) add(context, declaration.file, `${declaration.element} '${declaration.id}' requires direct Evidences in --generated mode.`);
    if (context.hypothesisOnly && attribute(declaration.node, "status") !== "hypothesis") add(context, declaration.file, `${declaration.element} '${declaration.id}' must use status='hypothesis' in --hypothesis-only mode.`);
    if (attribute(declaration.node, "status") === "hypothesis") {
      const hasInferred = evidenceRefs.some((ref) => {
        const evidence = context.declarations.get(attribute(ref, "ref"));
        return evidence?.kind === "evidence" && attribute(evidence.node, "grade") === "inferred";
      });
      if (!hasInferred) add(context, declaration.file, `${declaration.element} '${declaration.id}' status='hypothesis' requires at least one inferred Evidence.`);
    }
  }
}

function validateBundleSemantics(context: ValidationContext): void {
  validateGenericElementSemantics(context);
  validateEvidence(context);
  const typeModel = buildTypeModel(context);
  validateRelations(context, typeModel);
  validateRules(context, typeModel);
  validateLifecycles(context, typeModel);
  validateProfiles(context, typeModel);
  validateBusinessObjectMembers(context, typeModel);
  validateOperationsAndBindings(context, typeModel);
  validateMappings(context, typeModel);
  validateEvolution(context, typeModel);
  validateGeneratedAndHypothesisModes(context);
}

const { rootFile, workspaceRoot, generated, hypothesisOnly } = parseArgs();
const context: ValidationContext = {
  rootFile,
  workspaceRoot,
  generated,
  hypothesisOnly,
  kindDefinitions: new Map(),
  documents: new Map(),
  diagnostics: [],
  elements: [],
  declarations: new Map(),
  referencedTargets: new Set(),
  resourceFqns: new Map(),
  ontologyId: "",
  ontologyVersion: "",
};

const rootDocument = readXmlDocument(context, rootFile);
if (rootDocument?.rootName === "Ontology") {
  try {
    context.kindDefinitions = loadKindDefinitions();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  }
  loadDocument(context, rootFile, "Ontology");
  if (context.documents.size > 0) validateBundleSemantics(context);
} else if (rootDocument) {
  validateGenericResourceTree(context, rootDocument);
}

context.diagnostics.sort((left, right) => {
  const fileOrder = left.file.localeCompare(right.file);
  return fileOrder !== 0 ? fileOrder : left.message.localeCompare(right.message);
});

if (context.diagnostics.length > 0) {
  for (const diagnostic of context.diagnostics) console.error(`${relative(process.cwd(), diagnostic.file)}: ${diagnostic.message}`);
  process.exit(1);
}

const mode = generated ? " (generated strict mode)" : hypothesisOnly ? " (hypothesis-only mode)" : "";
console.log(`Ontology XML bundle is structurally and mechanically valid${mode}: ${relative(process.cwd(), rootFile)}`);
