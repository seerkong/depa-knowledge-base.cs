import { afterEach, describe, expect, test } from "bun:test";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { createRequire } from "node:module";
import { XMLParser } from "fast-xml-parser";

const skillRoot = resolve(import.meta.dir, "..");
const repoRoot = resolve(skillRoot, "..", "..");
const validator = join(skillRoot, "scripts", "validate-ontology-xml.ts");
const systemRoot = join(skillRoot, "system");
const systemExampleTree = join(systemRoot, "examples", "ResourceLab");
const kindDefinitionDir = join(skillRoot, "ontology-domain", "spec", "kind-definitions");
const validTree = join(skillRoot, "ontology-domain", "examples", "valid", "MakerSpace");
const validManifest = join(validTree, "Manifest.xml");
const invalidRoot = join(skillRoot, "ontology-domain", "examples", "invalid");
const runtimeAuthorityRoot = "/Users/kongweixian/infra-dev/ontology/depa-ontology.ts/packages/depa-ontology";
const requireFromTest = createRequire(import.meta.url);
const tempRoots: string[] = [];

type XmlNode = Record<string, unknown>;
type JsonObject = Record<string, unknown>;
type ValidatorResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
};
type CatalogEntry = {
  id: string;
  kind: string;
  rootRef: string;
  rootDir: string;
  shape: "file" | "directory" | "manifest";
  entryName?: string;
  files: string[];
};
type ProjectionAuthorityContract = {
  authorityPackage: string;
  publicEntrypoint: string;
  schemaReadApis: string[];
  behaviorReadApis: string[];
  importStages: Array<{ stage: string; api: string }>;
  behaviorKinds: string[];
  callbackRegistrationApis: string[];
  callbackTransport: string;
  importAllowsUnresolvedByDefault: boolean;
  readyImportOption: string;
  profileRequiredXmlKinds: string[];
};

const expectedKinds = [
  "Ontology",
  "ScalarType",
  "EnumType",
  "Mixin",
  "ObjectType",
  "UnionType",
  "CollectionType",
  "Relation",
  "Rule",
  "StateMachine",
  "BusinessObject",
  "AssociationCatalog",
  "DomainPolicyCatalog",
  "ConstraintHandlerCatalog",
  "BusinessProcessCatalog",
  "CapabilityCatalog",
  "EventContractCatalog",
  "OperationCatalog",
  "EvidenceCatalog",
  "RuntimeBindingCatalog",
  "ImplementationMappingCatalog",
  "SchemaEvolutionModule",
  "Action",
  "Mutation",
  "Interceptor",
  "ComputedFunction",
  "ConstraintHandler",
  "Lifecycle",
];
const expectedManifestKinds = [
  "Ontology",
  "ScalarType",
  "EnumType",
  "Mixin",
  "ObjectType",
  "UnionType",
  "CollectionType",
  "Relation",
  "Rule",
  "StateMachine",
  "BusinessObject",
  "Action",
  "Mutation",
  "Interceptor",
  "ComputedFunction",
  "ConstraintHandler",
  "Lifecycle",
];
const expectedFileKinds = expectedKinds.filter((kind) => !expectedManifestKinds.includes(kind));
const expectedDiscoveredKinds = [
  "ScalarType",
  "EnumType",
  "Mixin",
  "ObjectType",
  "UnionType",
  "CollectionType",
  "Relation",
  "Rule",
  "StateMachine",
  "BusinessObject",
  "AssociationCatalog",
  "DomainPolicyCatalog",
  "ConstraintHandlerCatalog",
  "BusinessProcessCatalog",
  "CapabilityCatalog",
  "EventContractCatalog",
  "OperationCatalog",
  "EvidenceCatalog",
  "RuntimeBindingCatalog",
  "ImplementationMappingCatalog",
  "SchemaEvolutionModule",
  "Action",
  "Mutation",
];

const parser = new XMLParser({
  ignoreAttributes: false,
  ignoreDeclaration: true,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: false,
});

afterEach(() => {
  while (tempRoots.length > 0) {
    rmSync(tempRoots.pop()!, { recursive: true, force: true });
  }
});

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function parseXmlFile(file: string): { rootName: string; root: XmlNode } {
  const document = parser.parse(readFileSync(file, "utf8")) as XmlNode;
  const rootNames = Object.keys(document);
  expect(rootNames).toHaveLength(1);
  return { rootName: rootNames[0]!, root: document[rootNames[0]!] as XmlNode };
}

function filesUnder(root: string): string[] {
  const files: string[] = [];
  const visit = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(path);
      } else if (entry.isFile()) {
        files.push(path);
      }
    }
  };
  visit(root);
  return files.sort();
}

function textOf(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const text = (value as XmlNode)["#text"];
    return typeof text === "string" ? text : "";
  }
  return "";
}

function expectPlainDescription(node: XmlNode): void {
  expect(textOf(node.Description).trim()).not.toBe("");
}

function expectResourceNarrative(rootName: string, node: XmlNode): void {
  if (rootName === "Rule") {
    expect(textOf(node.Statement).trim()).not.toBe("");
  } else {
    expectPlainDescription(node);
  }
}

function runValidator(rootFile: string, workspaceRoot = dirname(rootFile), extraArgs: string[] = []): ValidatorResult {
  const result = Bun.spawnSync([
    process.execPath,
    "run",
    validator,
    rootFile,
    "--workspace-root",
    workspaceRoot,
    ...extraArgs,
  ], {
    cwd: repoRoot,
  });
  return {
    exitCode: result.exitCode,
    stdout: new TextDecoder().decode(result.stdout),
    stderr: new TextDecoder().decode(result.stderr),
  };
}

function expectAccepted(result: ValidatorResult): void {
  expect(result.exitCode, `stdout:\n${result.stdout}\n\nstderr:\n${result.stderr}`).toBe(0);
}

function expectRejected(result: ValidatorResult, diagnostic: RegExp): void {
  const combined = `${result.stdout}\n${result.stderr}`;
  expect(result.exitCode, `stdout:\n${result.stdout}\n\nstderr:\n${result.stderr}`).not.toBe(0);
  expect(combined, `stdout:\n${result.stdout}\n\nstderr:\n${result.stderr}`).toMatch(diagnostic);
}

function parseKindDefinition(file: string): JsonObject {
  return Bun.YAML.parse(readFileSync(file, "utf8")) as JsonObject;
}

function attrByName(node: XmlNode, name: string): XmlNode {
  const attr = asArray(node.Attribute as XmlNode | XmlNode[] | undefined)
    .find((candidate) => candidate["@_name"] === name);
  expect(attr, `Expected attribute ${name}`).toBeDefined();
  return attr!;
}

function ontologyManifest(tree = validTree): XmlNode {
  return parseXmlFile(join(tree, "Manifest.xml")).root;
}

function catalogNodes(manifest: XmlNode): Array<{ shape: "file" | "directory" | "manifest"; node: XmlNode }> {
  return [
    ...asArray(manifest.FileResourceCatalog as XmlNode | XmlNode[] | undefined).map((node) => ({ shape: "file" as const, node })),
    ...asArray(manifest.DirectoryResourceCatalog as XmlNode | XmlNode[] | undefined).map((node) => ({ shape: "directory" as const, node })),
    ...asArray(manifest.ManifestResourceCatalog as XmlNode | XmlNode[] | undefined).map((node) => ({ shape: "manifest" as const, node })),
  ];
}

function resolveCatalogRoot(tree: string, rootRef: string): string {
  expect(rootRef).toMatch(/^vfs:\/\/@\/.+\/$/);
  const rootDir = resolve(tree, rootRef.slice("vfs://@/".length));
  const rel = relative(tree, rootDir);
  expect(rel === "" || (!rel.startsWith("..") && !isAbsolute(rel))).toBe(true);
  return rootDir;
}

function discoverCatalogs(tree = validTree, manifestFile = join(tree, "Manifest.xml")): CatalogEntry[] {
  const manifest = parseXmlFile(manifestFile).root;
  const boundary = dirname(manifestFile);
  const catalogs: CatalogEntry[] = [];
  for (const { shape, node: catalog } of catalogNodes(manifest)) {
    const id = catalog["@_id"] as string;
    const kind = catalog["@_kind"] as string;
    const rootRef = catalog["@_root"] as string;
    const rootDir = resolveCatalogRoot(boundary, rootRef);
    const entryName = catalog["@_entry"] as string | undefined;
    const files = readdirSync(rootDir, { withFileTypes: true })
      .flatMap((entry) => {
        if (shape === "file") return entry.isFile() && entry.name.endsWith(".xml") ? [join(rootDir, entry.name)] : [];
        return entry.isDirectory() && entryName ? [join(rootDir, entry.name, entryName)] : [];
      })
      .sort();
    catalogs.push({ id, kind, rootRef, rootDir, shape, entryName, files });
    if (shape === "manifest") {
      for (const childManifest of files) catalogs.push(...discoverCatalogs(tree, childManifest));
    }
  }
  return catalogs;
}

function discoverSystemCatalogs(manifestFile = join(systemExampleTree, "Manifest.xml")): CatalogEntry[] {
  const manifest = parseXmlFile(manifestFile).root;
  const boundary = dirname(manifestFile);
  const catalogs: CatalogEntry[] = [];
  for (const { shape, node: catalog } of catalogNodes(manifest)) {
    const id = catalog["@_id"] as string;
    const kind = catalog["@_kind"] as string;
    const rootRef = catalog["@_root"] as string;
    const rootDir = resolveCatalogRoot(boundary, rootRef);
    const entryName = catalog["@_entry"] as string | undefined;
    const files = readdirSync(rootDir, { withFileTypes: true })
      .flatMap((entry) => {
        if (shape === "file") return entry.isFile() ? [join(rootDir, entry.name)] : [];
        return entry.isDirectory() && entryName ? [join(rootDir, entry.name, entryName)] : [];
      })
      .sort();
    catalogs.push({ id, kind, rootRef, rootDir, shape, files });
    if (shape === "manifest") {
      for (const childManifest of files) catalogs.push(...discoverSystemCatalogs(childManifest));
    }
  }
  return catalogs;
}

function resourceFiles(tree = validTree): string[] {
  return discoverCatalogs(tree).flatMap((catalog) => catalog.files);
}

function docsByRootKind(tree = validTree): Map<string, XmlNode[]> {
  const docs = new Map<string, XmlNode[]>();
  for (const file of resourceFiles(tree)) {
    const { rootName, root } = parseXmlFile(file);
    const list = docs.get(rootName) ?? [];
    list.push(root);
    docs.set(rootName, list);
  }
  return docs;
}

function firstResource(kind: string, tree = validTree): XmlNode {
  const doc = docsByRootKind(tree).get(kind)?.[0];
  expect(doc, `Expected resource kind ${kind}`).toBeDefined();
  return doc!;
}

function operationCatalog(): { operations: Map<string, XmlNode>; presets: XmlNode[] } {
  const catalog = firstResource("OperationCatalog");
  const operations = new Map<string, XmlNode>();
  for (const operation of asArray((catalog.Operations as XmlNode).Operation as XmlNode | XmlNode[] | undefined)) {
    operations.set(operation["@_id"] as string, operation);
  }
  return {
    operations,
    presets: asArray((catalog.InvocationPresets as XmlNode).InvocationPreset as XmlNode | XmlNode[] | undefined),
  };
}

function runtimeBindings(): XmlNode[] {
  const catalog = firstResource("RuntimeBindingCatalog");
  return asArray((catalog.RuntimeBindings as XmlNode).RuntimeBinding as XmlNode | XmlNode[] | undefined);
}

function capabilitySet(container: XmlNode | undefined): { atomicity: Set<string>; observations: Set<string> } {
  const atomicity = new Set<string>();
  const observations = new Set<string>();
  if (!container) return { atomicity, observations };
  for (const item of asArray(container.Atomicity as XmlNode | XmlNode[] | undefined)) {
    atomicity.add(item["@_value"] as string);
  }
  for (const item of asArray(container.Observation as XmlNode | XmlNode[] | undefined)) {
    observations.add(item["@_value"] as string);
  }
  return { atomicity, observations };
}

function requestForPreset(preset: XmlNode): JsonObject {
  return JSON.parse(textOf(preset.RequestJson)) as JsonObject;
}

function expectExactKeys(value: unknown, keys: string[]): void {
  expect(Object.keys(value as JsonObject).sort()).toEqual([...keys].sort());
}

function parseProjectionAuthorityContract(markdown: string): ProjectionAuthorityContract {
  const marker = "<!-- projection-authority-contract -->";
  const markerIndex = markdown.indexOf(marker);
  expect(markerIndex).toBeGreaterThanOrEqual(0);
  const fenced = markdown.slice(markerIndex + marker.length).match(/^\s*```json\s*\n([\s\S]*?)\n```/);
  expect(fenced, "Expected JSON authority contract after marker").not.toBeNull();
  return JSON.parse(fenced![1]!) as ProjectionAuthorityContract;
}

function declaredCallableExports(declaration: string): string[] {
  return [...declaration.matchAll(/^export (?:function|class) ([A-Za-z][A-Za-z0-9_]*)/gm)]
    .map((match) => match[1]!)
    .filter((name, index, all) => all.indexOf(name) === index)
    .sort();
}

function behaviorManifest(ownerType: string, name: string, bindingId: string): string {
  return JSON.stringify({
    version: 1,
    behaviors: [{
      kind: "action",
      ownerType,
      name,
      constraintType: null,
      message: null,
      description: "Portable action metadata.",
      interceptorPhase: null,
      interceptorSeq: null,
      callbacks: [{ slot: "handler", bindingId, readiness: "unresolved" }],
    }],
  });
}

function makeTempTree(label: string): string {
  const root = mkdtempSync(join(tmpdir(), `ontology-fs-native-${label}-`));
  tempRoots.push(root);
  const tree = join(root, "MakerSpace");
  cpSync(validTree, tree, { recursive: true });
  return tree;
}

function makeSystemTempTree(label: string): string {
  const root = mkdtempSync(join(tmpdir(), `ontology-fs-native-system-${label}-`));
  tempRoots.push(root);
  const tree = join(root, "ResourceLab");
  cpSync(systemExampleTree, tree, { recursive: true });
  return tree;
}

function replaceInTree(tree: string, relativePath: string, search: string, replacement: string): void {
  const file = join(tree, relativePath);
  const source = readFileSync(file, "utf8");
  expect(source).toContain(search);
  writeFileSync(file, source.replace(search, replacement));
}

function replaceInSystemTree(tree: string, relativePath: string, search: string, replacement: string): void {
  const file = join(tree, relativePath);
  const source = readFileSync(file, "utf8");
  expect(source).toContain(search);
  writeFileSync(file, source.replace(search, replacement));
}

function mutatePresetRequest(tree: string, presetId: string, mutate: (request: JsonObject) => void): void {
  const file = join(tree, "Operations", "Workbench.xml");
  const source = readFileSync(file, "utf8");
  const presetStart = source.indexOf(`<InvocationPreset id="${presetId}"`);
  expect(presetStart, `Preset ${presetId} must exist`).toBeGreaterThanOrEqual(0);
  const startTag = "<RequestJson><![CDATA[";
  const endTag = "]]></RequestJson>";
  const jsonStartTag = source.indexOf(startTag, presetStart);
  expect(jsonStartTag, `Preset ${presetId} must contain RequestJson CDATA`).toBeGreaterThanOrEqual(0);
  const jsonStart = jsonStartTag + startTag.length;
  const jsonEnd = source.indexOf(endTag, jsonStart);
  expect(jsonEnd, `Preset ${presetId} RequestJson CDATA must close`).toBeGreaterThan(jsonStart);
  const request = JSON.parse(source.slice(jsonStart, jsonEnd)) as JsonObject;
  mutate(request);
  writeFileSync(file, `${source.slice(0, jsonStart)}\n${JSON.stringify(request, null, 2)}\n${source.slice(jsonEnd)}`);
}

describe("Generic FS-native system specification and examples", () => {
  test("pins the four-layer system docs and parser-ready catalog grammar", () => {
    expect(readdirSync(systemRoot).sort()).toEqual(expect.arrayContaining([
      "examples",
      "foundation",
      "spec",
      "std",
    ]));

    for (const file of [
      join(systemRoot, "foundation", "axioms.md"),
      join(systemRoot, "std", "resource-tree.md"),
      join(systemRoot, "spec", "canonical-grammar.xml"),
      join(systemRoot, "spec", "kind-definitions.md"),
      join(systemRoot, "spec", "validation-pipeline.md"),
      join(systemRoot, "spec", "refs-and-containment.md"),
      join(systemRoot, "spec", "diagnostics.md"),
      join(systemRoot, "examples", "README.md"),
    ]) {
      expect(readFileSync(file, "utf8").trim(), file).not.toBe("");
    }

    const { rootName, root } = parseXmlFile(join(systemRoot, "spec", "canonical-grammar.xml"));
    expect(rootName).toBe("FsNativeResourceSystemGrammar");
    const manifestRoot = root.ManifestRoot as XmlNode;
    const catalogs = asArray(manifestRoot.Catalog as XmlNode | XmlNode[] | undefined);
    const byName = new Map(catalogs.map((catalog) => [catalog["@_name"] as string, catalog]));
    expect([...byName.keys()].sort()).toEqual([
      "DirectoryResourceCatalog",
      "FileResourceCatalog",
      "ManifestResourceCatalog",
    ]);

    expect(attrByName(byName.get("FileResourceCatalog")!, "entry")["@_forbidden"]).toBe("true");
    expect(attrByName(byName.get("DirectoryResourceCatalog")!, "entry")["@_required"]).toBe("true");
    expect(attrByName(byName.get("ManifestResourceCatalog")!, "entry")["@_required"]).toBe("true");
    for (const catalog of catalogs) {
      expect(attrByName(catalog, "id")["@_uniqueAmong"]).toBe("manifest-catalogs");
      expect(attrByName(catalog, "kind")["@_type"]).toBe("normalized-kind");
      expect(attrByName(catalog, "root")["@_type"]).toBe("vfs-root-ref");
    }

    const ruleCodes = asArray((root.Rules as XmlNode).Rule as XmlNode | XmlNode[] | undefined)
      .map((rule) => rule["@_code"]);
    expect(ruleCodes).toEqual(expect.arrayContaining([
      "RESOURCE_CATALOG_KIND_MISSING",
      "RESOURCE_CATALOG_MEMBER_KIND_MISMATCH",
      "RESOURCE_CATALOG_MEMBER_DUPLICATE",
      "RESOURCE_IDENTITY_MISSING",
      "RESOURCE_FQN_DUPLICATE",
      "RESOURCE_KIND_DEFINITION_NOT_FOUND",
      "RESOURCE_REF_CONTAINMENT",
    ]));
  });

  test("uses a neutral ResourceLab example that minimally covers all source shapes", () => {
    const forbiddenFixtureTerms = /\b(Ontology|BusinessObject|ObjectType|ScalarType|EnumType|Relation|StateMachine|Operation|Evidence|RuntimeBinding|ImplementationMapping|SchemaEvolution|DomainPolicy|Association|MakerSpace|IT[- ]?Asset|Asset)\b/;
    for (const file of filesUnder(join(systemRoot, "examples"))) {
      const relativeFile = relative(systemRoot, file);
      expect(relativeFile).not.toContain("assets/examples");
      expect(readFileSync(file, "utf8"), relativeFile).not.toMatch(forbiddenFixtureTerms);
    }

    const { rootName, root } = parseXmlFile(join(systemExampleTree, "Manifest.xml"));
    expect(rootName).toBe("CollectionManifest");
    expect(root["@_fqn"]).toBe("system.example.resource_lab");
    const rootCatalogs = catalogNodes(root);
    expect(rootCatalogs.map((catalog) => catalog.shape).sort()).toEqual([
      "directory",
      "file",
      "file",
      "manifest",
    ]);
    expect(rootCatalogs.map((catalog) => catalog.node["@_kind"]).sort()).toEqual([
      "CollectionManifest",
      "KindDefinition",
      "Note",
      "Procedure",
    ]);

    for (const manifestFile of [
      join(systemExampleTree, "Manifest.xml"),
      join(systemExampleTree, "Collections", "Alpha", "Manifest.xml"),
    ]) {
      const manifestCatalogs = catalogNodes(parseXmlFile(manifestFile).root);
      const ids = manifestCatalogs.map((catalog) => catalog.node["@_id"] as string);
      expect(new Set(ids).size, manifestFile).toBe(ids.length);
      for (const { shape, node } of manifestCatalogs) {
        expect(node["@_kind"], manifestFile).toBeString();
        expect(node["@_root"], manifestFile).toMatch(/^vfs:\/\/@\/.+\/$/);
        if (shape === "file") {
          expect(node).not.toHaveProperty("@_entry");
        } else {
          expect(node["@_entry"], manifestFile).toBeString();
        }
      }
    }

    const catalogs = discoverSystemCatalogs();
    expect(catalogs.map((catalog) => catalog.shape).sort()).toEqual([
      "directory",
      "directory",
      "file",
      "file",
      "file",
      "manifest",
    ]);
    expect(catalogs.map((catalog) => catalog.kind).sort()).toEqual([
      "CollectionManifest",
      "KindDefinition",
      "Note",
      "Note",
      "Procedure",
      "Procedure",
    ]);
    const discovered = catalogs.flatMap((catalog) => catalog.files.map((file) => relative(systemExampleTree, file)));
    expect(discovered).toEqual(expect.arrayContaining([
      "KindDefinitions/CollectionManifest.yaml",
      "KindDefinitions/Note.yaml",
      "KindDefinitions/Procedure.yaml",
      "Notes/RootNote.xml",
      "Procedures/Prepare/Procedure.xml",
      "Collections/Alpha/Manifest.xml",
      "Collections/Alpha/Notes/AlphaNote.xml",
      "Collections/Alpha/Procedures/Review/Procedure.xml",
    ]));
    expect(discovered).not.toEqual(expect.arrayContaining([
      "Procedures/Prepare/Notes.txt",
      "Collections/Alpha/Procedures/Review/Notes.txt",
    ]));

    const definitionFiles = filesUnder(join(systemExampleTree, "KindDefinitions"));
    expect(definitionFiles).toHaveLength(3);
    const definitions = new Map<string, JsonObject>(
      definitionFiles.map((file) => {
        const definition = parseKindDefinition(file);
        expect(definition.apiVersion, file).toBe("fs-native/v1");
        expect(definition.kind, file).toBe("KindDefinition");
        const spec = definition.spec as JsonObject;
        const resourceKind = spec.resourceKind as string;
        expect((definition.metadata as JsonObject).name, file).toBe(resourceKind);
        expect((spec.descriptorSchema as JsonObject).rootElement, file).toBe(resourceKind);
        expect(((spec.identity as JsonObject).fqn as JsonObject).path, file).toBe("@fqn");
        expect(((spec.identity as JsonObject).name as JsonObject).path, file).toBe("@name");
        expect((spec.description as JsonObject).path, file).toBe("Description");
        expect((spec.description as JsonObject).minLength, file).toBe(1);
        const diagnostics = spec.diagnostics as JsonObject[];
        expect(diagnostics.length, file).toBeGreaterThan(0);
        for (const diagnostic of diagnostics) {
          expect(diagnostic.code, file).toMatch(/^[A-Z][A-Z0-9_]+$/);
          expect(diagnostic.mapsTo, file).toMatch(/^RESOURCE_[A-Z0-9_]+$/);
        }
        return [resourceKind, spec];
      }),
    );
    expect(definitions.get("Note")!.sourceShapes).toEqual(["file"]);
    expect(definitions.get("Procedure")!.sourceShapes).toEqual(["directory"]);
    expect(definitions.get("CollectionManifest")!.sourceShapes).toEqual(["manifest"]);

    for (const catalog of catalogs) {
      if (catalog.kind === "KindDefinition") continue;
      const definition = definitions.get(catalog.kind);
      expect(definition, catalog.kind).toBeDefined();
      expect(definition!.sourceShapes as string[], catalog.kind).toContain(catalog.shape);
      const expectedRoot = (definition!.descriptorSchema as JsonObject).rootElement;
      for (const file of catalog.files) {
        const { rootName: memberKind, root: member } = parseXmlFile(file);
        expect(memberKind, file).toBe(catalog.kind);
        expect(memberKind, file).toBe(expectedRoot);
        const identity = member["@_fqn"] ?? member["@_name"];
        expect(typeof identity === "string" && identity.trim().length > 0, file).toBe(true);
        expectPlainDescription(member);

        const internalMaterial = member.InternalMaterial as XmlNode | undefined;
        if (internalMaterial) {
          const ref = internalMaterial["@_ref"] as string;
          expect(ref, file).toMatch(/^vfs:\/\/@\/.+$/);
          const boundary = realpathSync(dirname(file));
          const target = realpathSync(resolve(boundary, ref.slice("vfs://@/".length)));
          const rel = relative(boundary, target);
          expect(rel === "" || (!rel.startsWith("..") && !isAbsolute(rel)), file).toBe(true);
        }
      }
    }
  });

  test("keeps ontology-domain fields out of generic system grammar", () => {
    const forbiddenTerms = /\b(BusinessObject|ObjectType|ScalarType|EnumType|StateMachine|OperationCatalog|Operation|EvidenceCatalog|Evidence|RuntimeBinding|ImplementationMapping|SchemaEvolution|DomainPolicy|AssociationCatalog|Association|MakerSpace|depa-ontology|Cozo|IT[- ]?Asset|Asset)\b/;
    for (const file of filesUnder(systemRoot)) {
      const relativeFile = relative(systemRoot, file);
      expect(readFileSync(file, "utf8"), relativeFile).not.toMatch(forbiddenTerms);
    }

    const grammar = readFileSync(join(systemRoot, "spec", "canonical-grammar.xml"), "utf8");
    for (const field of [
      "ownerRef",
      "typeRef",
      "propertyRef",
      "operationRef",
      "behavior",
      "subject",
      "invocation",
      "effect",
      "href",
    ]) {
      expect(grammar).not.toContain(field);
    }
  });

  test("validates ResourceLab file, directory, and manifest shapes through the generic pipeline", () => {
    expectAccepted(runValidator(join(systemExampleTree, "Notes", "RootNote.xml"), systemExampleTree));
    expectAccepted(runValidator(join(systemExampleTree, "Procedures", "Prepare", "Procedure.xml"), systemExampleTree));
    expectAccepted(runValidator(join(systemExampleTree, "Manifest.xml"), systemExampleTree));
  });

  test("rejects generic ResourceLab shape and catalog mutants with stable RESOURCE diagnostics", () => {
    const fileMismatch = makeSystemTempTree("file-kind-mismatch");
    replaceInSystemTree(
      fileMismatch,
      "Notes/RootNote.xml",
      "<Note fqn=\"system.example.note.root\">",
      "<Procedure fqn=\"system.example.note.root\">",
    );
    replaceInSystemTree(
      fileMismatch,
      "Notes/RootNote.xml",
      "</Note>",
      "</Procedure>",
    );
    expectRejected(
      runValidator(join(fileMismatch, "Manifest.xml"), fileMismatch),
      /RESOURCE_CATALOG_MEMBER_KIND_MISMATCH/i,
    );

    const missingDirectoryEntry = makeSystemTempTree("missing-directory-entry");
    rmSync(join(missingDirectoryEntry, "Procedures", "Prepare", "Procedure.xml"));
    expectRejected(
      runValidator(join(missingDirectoryEntry, "Manifest.xml"), missingDirectoryEntry),
      /RESOURCE_CATALOG_ENTRY_MISSING/i,
    );

    const wrongDirectoryEntry = makeSystemTempTree("wrong-directory-entry");
    cpSync(
      join(wrongDirectoryEntry, "Procedures", "Prepare", "Procedure.xml"),
      join(wrongDirectoryEntry, "Procedures", "Prepare", "Alternate.xml"),
    );
    replaceInSystemTree(
      wrongDirectoryEntry,
      "Manifest.xml",
      'entry="Procedure.xml"',
      'entry="Alternate.xml"',
    );
    expectRejected(
      runValidator(join(wrongDirectoryEntry, "Manifest.xml"), wrongDirectoryEntry),
      /RESOURCE_CATALOG_ENTRY_MISSING/i,
    );

    const manifestMismatch = makeSystemTempTree("manifest-kind-mismatch");
    replaceInSystemTree(
      manifestMismatch,
      "Collections/Alpha/Manifest.xml",
      "<CollectionManifest fqn=\"system.example.collection.alpha\" version=\"1.0.0\">",
      "<Note fqn=\"system.example.collection.alpha\" version=\"1.0.0\">",
    );
    replaceInSystemTree(
      manifestMismatch,
      "Collections/Alpha/Manifest.xml",
      "</CollectionManifest>",
      "</Note>",
    );
    expectRejected(
      runValidator(join(manifestMismatch, "Manifest.xml"), manifestMismatch),
      /RESOURCE_CATALOG_MEMBER_KIND_MISMATCH/i,
    );

    const shapeMismatch = makeSystemTempTree("shape-mismatch");
    replaceInSystemTree(
      shapeMismatch,
      "Manifest.xml",
      '<DirectoryResourceCatalog id="root-procedures" kind="Procedure" root="vfs://@/Procedures/" entry="Procedure.xml"/>',
      '<FileResourceCatalog id="root-procedures" kind="Procedure" root="vfs://@/Procedures/"/>',
    );
    expectRejected(
      runValidator(join(shapeMismatch, "Manifest.xml"), shapeMismatch),
      /RESOURCE_SHAPE_MISMATCH/i,
    );
  });

  test("keeps generic discovery first-level and rejects duplicate or escaping resources", () => {
    const nestedInvisible = makeSystemTempTree("nested-invisible");
    mkdirSync(join(nestedInvisible, "Notes", "nested"));
    writeFileSync(
      join(nestedInvisible, "Notes", "nested", "ShadowNote.xml"),
      '<Note fqn="system.example.note.root"><Description>Invalid if recursively discovered.</Description></Note>',
    );
    expectAccepted(runValidator(join(nestedInvisible, "Manifest.xml"), nestedInvisible));

    const duplicateMember = makeSystemTempTree("duplicate-member");
    replaceInSystemTree(
      duplicateMember,
      "Manifest.xml",
      '<FileResourceCatalog id="root-notes" kind="Note" root="vfs://@/Notes/"/>',
      '<FileResourceCatalog id="root-notes" kind="Note" root="vfs://@/Notes/"/>\n  <FileResourceCatalog id="root-notes-copy" kind="Note" root="vfs://@/Notes/"/>',
    );
    expectRejected(
      runValidator(join(duplicateMember, "Manifest.xml"), duplicateMember),
      /RESOURCE_CATALOG_MEMBER_DUPLICATE/i,
    );

    const duplicateFqn = makeSystemTempTree("duplicate-fqn");
    writeFileSync(
      join(duplicateFqn, "Notes", "CopyNote.xml"),
      '<Note fqn="system.example.note.root"><Description>Duplicate root note identity.</Description></Note>',
    );
    expectRejected(
      runValidator(join(duplicateFqn, "Manifest.xml"), duplicateFqn),
      /RESOURCE_FQN_DUPLICATE/i,
    );

    const unsafeRoot = makeSystemTempTree("unsafe-root");
    replaceInSystemTree(
      unsafeRoot,
      "Manifest.xml",
      'root="vfs://@/Notes/"',
      'root="vfs://@/../outside/Notes/"',
    );
    expectRejected(
      runValidator(join(unsafeRoot, "Manifest.xml"), unsafeRoot),
      /RESOURCE_REF_CONTAINMENT/i,
    );

    const unsafeInternalRef = makeSystemTempTree("unsafe-internal-ref");
    replaceInSystemTree(
      unsafeInternalRef,
      "Procedures/Prepare/Procedure.xml",
      'ref="vfs://@/Notes.txt"',
      'ref="vfs://@/../secret.txt"',
    );
    expectRejected(
      runValidator(join(unsafeInternalRef, "Manifest.xml"), unsafeInternalRef),
      /RESOURCE_REF_CONTAINMENT/i,
    );
  });
});

describe("FS-native ontology KindDefinition registry", () => {
  test("parses exactly 28 ontology-domain KindDefinitions with manifest/file shapes and fqn identity", () => {
    const files = readdirSync(kindDefinitionDir)
      .filter((name) => name.endsWith(".yaml"))
      .sort();
    expect(files).toHaveLength(28);

    const byKind = new Map<string, JsonObject>();
    for (const file of files) {
      const definition = parseKindDefinition(join(kindDefinitionDir, file));
      expect(definition.apiVersion).toBe("fs-native/v1");
      expect(definition.kind).toBe("KindDefinition");
      const spec = definition.spec as JsonObject;
      const resourceKind = spec.resourceKind as string;
      expect(byKind.has(resourceKind), `Duplicate resourceKind ${resourceKind}`).toBe(false);
      byKind.set(resourceKind, definition);
      expect(((spec.identity as JsonObject).fqn as JsonObject).from).toBe("@fqn");
      expect(((spec.identity as JsonObject).fqn as JsonObject).required).toBe(true);
    }

    expect([...byKind.keys()].sort()).toEqual([...expectedKinds].sort());
    expect(((byKind.get("Ontology")!.spec as JsonObject).sourceShapes as string[])).toEqual(["manifest"]);
    expect((((byKind.get("Ontology")!.spec as JsonObject).descriptorSchema as JsonObject).allowedCatalogs as string[])).toEqual(["FileResourceCatalog", "DirectoryResourceCatalog", "ManifestResourceCatalog"]);
    for (const kind of expectedManifestKinds) {
      const spec = byKind.get(kind)!.spec as JsonObject;
      expect(spec.sourceShapes as string[], kind).toEqual(["manifest"]);
      expect((spec.descriptorSchema as JsonObject).rootElement).toBe(kind);
      expect((((spec.entries as JsonObject).manifest as JsonObject).entry), kind)
        .toBe(kind === "Ontology" ? "Manifest.xml" : `${kind}.xml`);
    }

    for (const kind of expectedFileKinds) {
      expect(((byKind.get(kind)!.spec as JsonObject).sourceShapes as string[]), kind).toEqual(["file"]);
      expect(((byKind.get(kind)!.spec as JsonObject).descriptorSchema as JsonObject).rootElement).toBe(kind);
    }
  });
});

describe("FS-native MakerSpace resource discovery", () => {
  test("discovers first-level file and manifest members and normalizes kind, fqn, id, and Description", () => {
    const { rootName, root } = parseXmlFile(validManifest);
    expect(rootName).toBe("Ontology");
    expect(root["@_fqn"]).toBe("ontology.maker-space");
    expect(root["@_id"]).toBe("MakerSpace.Ontology");
    expect(root["@_version"]).toBe("1.0.0");
    expectPlainDescription(root);
    expect(root).not.toHaveProperty("Resources");
    expect(root).not.toHaveProperty("Modules");
    expect(root).not.toHaveProperty("DirectoryResourceCatalog");
    expect(root).toHaveProperty("ManifestResourceCatalog");

    const catalogs = discoverCatalogs();
    expect(catalogs).toHaveLength(23);
    expect(catalogs.map((catalog) => catalog.kind).sort()).toEqual([...expectedDiscoveredKinds].sort());

    const resourceFqns = new Set<string>();
    const resourceIds = new Set<string>();
    for (const catalog of catalogs) {
      const definition = parseKindDefinition(join(kindDefinitionDir, `${catalog.kind}.yaml`));
      const spec = definition.spec as JsonObject;
      expect(spec.sourceShapes, catalog.kind).toEqual([catalog.shape]);
      if (catalog.shape === "file") {
        expect(catalog.entryName, catalog.kind).toBeUndefined();
      } else {
        expect(catalog.entryName, catalog.kind)
          .toBe((((spec.entries as JsonObject)[catalog.shape] as JsonObject).entry));
      }
      const realRoot = realpathSync(catalog.rootDir);
      const rel = relative(realpathSync(validTree), realRoot);
      expect(rel === "" || (!rel.startsWith("..") && !isAbsolute(rel)), catalog.rootRef).toBe(true);
      for (const file of catalog.files) {
        const { rootName: memberKind, root: member } = parseXmlFile(file);
        expect(memberKind, file).toBe(catalog.kind);
        expect(typeof member["@_fqn"]).toBe("string");
        expect(typeof member["@_id"]).toBe("string");
        expectResourceNarrative(memberKind, member);
        expect(resourceFqns.has(member["@_fqn"] as string), `duplicate fqn ${member["@_fqn"]}`).toBe(false);
        resourceFqns.add(member["@_fqn"] as string);
        expect(resourceIds.has(member["@_id"] as string), `duplicate id ${member["@_id"]}`).toBe(false);
        resourceIds.add(member["@_id"] as string);
      }
    }

    expect(resourceFqns.size).toBe(34);
    expect(resourceIds.size).toBe(34);
  });

  test("treats nested files below catalog roots as invisible to first-level discovery", () => {
    const tree = makeTempTree("nested-invisible");
    mkdirSync(join(tree, "TypeSystem", "ObjectTypes", "Resource", "nested"));
    writeFileSync(
      join(tree, "TypeSystem", "ObjectTypes", "Resource", "nested", "ObjectType.xml"),
      '<ObjectType fqn="ontology.maker-space.object-types.shadow" id="MakerSpace.Shadow" kind="entity"><Description>Invisible nested object type.</Description></ObjectType>',
    );

    const discovered = resourceFiles(tree);
    expect(discovered).toHaveLength(34);
    expect(discovered.some((file) => file.includes("nested/ObjectType.xml"))).toBe(false);
  });

  test("discovers BusinessObject-owned members only from their declared first-level catalogs", () => {
    const tree = makeTempTree("business-object-member-discovery");
    mkdirSync(join(tree, "DomainModel", "BusinessObjects", "Reservation", "Actions", "Approve", "nested"));
    writeFileSync(
      join(tree, "DomainModel", "BusinessObjects", "Reservation", "Actions", "Approve", "nested", "Action.xml"),
      '<Action fqn="ontology.maker-space.shadow-action" id="MakerSpace.Reservation.Action.Shadow" ownerRef="MakerSpace.Reservation" portability="portable"><Description>Invisible nested action.</Description></Action>',
    );

    const docs = docsByRootKind(tree);
    expect(docs.get("BusinessObject")).toHaveLength(3);
    expect(docs.get("Action")).toHaveLength(1);
    expect(docs.get("Mutation")).toHaveLength(1);
    expect((docs.get("Action") ?? []).some((action) => action["@_id"] === "MakerSpace.Reservation.Action.Shadow")).toBe(false);
  });
});

describe("Ontology XML latest validator integration RED targets", () => {
  test("accepts the canonical FS-native MakerSpace manifest", () => {
    expectAccepted(runValidator(validManifest, validTree));
  });

  test("rejects lowercase caller aliases for a physical PascalCase ontology entry", () => {
    const entries = readdirSync(validTree);
    const relativeManifest = relative(repoRoot, validManifest);
    const relativeTree = relative(repoRoot, validTree);
    const lowercaseManifest = join(validTree, "manifest.xml");
    const lowercaseRelativeManifest = relative(repoRoot, lowercaseManifest);

    expect(entries).toContain("Manifest.xml");
    expect(entries).not.toContain("manifest.xml");
    expectAccepted(runValidator(relativeManifest, relativeTree));
    expectAccepted(runValidator(validManifest, validTree));
    expectRejected(
      runValidator(lowercaseRelativeManifest, relativeTree),
      /ONTOLOGY_MANIFEST_ENTRY_MISSING.*Manifest\.xml.*manifest\.xml/i,
    );
    expectRejected(
      runValidator(lowercaseManifest, validTree),
      /ONTOLOGY_MANIFEST_ENTRY_MISSING.*Manifest\.xml.*manifest\.xml/i,
    );
  });

  test("requires exact PascalCase ontology root and exact KindDefinition member entries", () => {
    const lowercaseRoot = makeTempTree("lowercase-root-entry");
    renameSync(join(lowercaseRoot, "Manifest.xml"), join(lowercaseRoot, ".manifest-case-tmp.xml"));
    renameSync(join(lowercaseRoot, ".manifest-case-tmp.xml"), join(lowercaseRoot, "manifest.xml"));
    expectRejected(
      runValidator(join(lowercaseRoot, "manifest.xml"), lowercaseRoot),
      /ONTOLOGY_MANIFEST_ENTRY_MISSING.*Manifest\.xml.*manifest\.xml/i,
    );

    const alternateMemberEntry = makeTempTree("alternate-member-entry");
    writeFileSync(
      join(alternateMemberEntry, "TypeSystem", "Mixins", "Auditable", "Alternate.xml"),
      readFileSync(join(alternateMemberEntry, "TypeSystem", "Mixins", "Auditable", "Mixin.xml"), "utf8"),
    );
    replaceInTree(
      alternateMemberEntry,
      "Manifest.xml",
      'kind="Mixin" root="vfs://@/TypeSystem/Mixins/" entry="Mixin.xml"',
      'kind="Mixin" root="vfs://@/TypeSystem/Mixins/" entry="Alternate.xml"',
    );
    expectRejected(
      runValidator(join(alternateMemberEntry, "Manifest.xml"), alternateMemberEntry),
      /RESOURCE_CATALOG_ENTRY_MISSING.*Mixin\.xml.*Alternate\.xml/i,
    );
  });

  test("rejects the retired grouped BusinessObjectCatalog kind", () => {
    const tree = makeTempTree("retired-business-object-catalog");
    replaceInTree(
      tree,
      "Manifest.xml",
      'kind="BusinessObject" root="vfs://@/DomainModel/BusinessObjects/" entry="BusinessObject.xml"',
      'kind="BusinessObjectCatalog" root="vfs://@/DomainModel/BusinessObjects/" entry="BusinessObject.xml"',
    );
    expectRejected(
      runValidator(join(tree, "Manifest.xml"), tree),
      /ONTOLOGY_CATALOG_KIND_UNKNOWN|unknown kind 'BusinessObjectCatalog'/i,
    );
  });

  test.each([
    ["AssociationInlineEndpoint", /ASSOCIATION_INLINE_RELATION_FACT|Association.*DomainModel relation endpoints|Association.*relation endpoint/i],
    ["BoPropertyRef", /BUSINESS_OBJECT_PROPERTY_REF_REJECTED|Property.*does not allow attribute @ref|BusinessObject.*Property@ref/i],
    ["CatalogKindMismatch", /RESOURCE_CATALOG_MEMBER_KIND_MISMATCH/i],
    ["DomainPolicyInlinePredicate", /DOMAIN_POLICY.*INLINE|DomainPolicy.*inline.*predicate|predicate.*inline/i],
    ["LegacyModules", /ONTOLOGY_LEGACY_ASSEMBLY_REJECTED|Modules.*retired|Modules.*rejected/i],
    ["LegacyResources", /ONTOLOGY_LEGACY_ASSEMBLY_REJECTED|Resources.*retired|Resources.*rejected/i],
    ["MissingResourceIdentity", /RESOURCE_IDENTITY_MISSING|fqn.*required|identity.*fqn/i],
    ["NonFileOntologyChildCatalog", /RESOURCE_SHAPE_MISMATCH|catalog .*ObjectType.*does not allow.*directory|DirectoryResourceCatalog.*rejected|non-file.*catalog/i],
    ["RequestDimensionVerbMismatch", /OPERATION_REQUEST_ENVELOPE_MISMATCH|behaviorKind.*must equal|verb.*must equal/i],
  ])("rejects invalid fixture %s with a stable latest diagnostic", (fixture, diagnostic) => {
    const tree = join(invalidRoot, fixture);
    expectRejected(runValidator(join(tree, "Manifest.xml"), tree), diagnostic as RegExp);
  });

  test("emits system-stable discovery and KindDefinition diagnostics", () => {
    const memberMismatch = join(invalidRoot, "CatalogKindMismatch");
    expectRejected(
      runValidator(join(memberMismatch, "Manifest.xml"), memberMismatch),
      /RESOURCE_CATALOG_MEMBER_KIND_MISMATCH/i,
    );

    const unknownKind = makeTempTree("unknown-catalog-kind");
    replaceInTree(
      unknownKind,
      "Manifest.xml",
      'kind="ObjectType" root="vfs://@/TypeSystem/ObjectTypes/" entry="ObjectType.xml"',
      'kind="MissingKind" root="vfs://@/TypeSystem/ObjectTypes/" entry="ObjectType.xml"',
    );
    expectRejected(
      runValidator(join(unknownKind, "Manifest.xml"), unknownKind),
      /RESOURCE_KIND_DEFINITION_NOT_FOUND/i,
    );

    const duplicateMember = makeTempTree("duplicate-catalog-member");
    replaceInTree(
      duplicateMember,
      "Manifest.xml",
      '<ManifestResourceCatalog id="relations" kind="Relation" root="vfs://@/DomainModel/Relations/" entry="Relation.xml" />',
      '<ManifestResourceCatalog id="relations" kind="Relation" root="vfs://@/DomainModel/Relations/" entry="Relation.xml" />\n  <ManifestResourceCatalog id="relations-copy" kind="Relation" root="vfs://@/DomainModel/Relations/" entry="Relation.xml" />',
    );
    expectRejected(
      runValidator(join(duplicateMember, "Manifest.xml"), duplicateMember),
      /RESOURCE_CATALOG_MEMBER_DUPLICATE/i,
    );

    const duplicateFqn = makeTempTree("duplicate-fqn");
    replaceInTree(
      duplicateFqn,
      "TypeSystem/ObjectTypes/Resource/ObjectType.xml",
      'fqn="ontology.maker-space.object-types.resource"',
      'fqn="ontology.maker-space.business-object.reservation"',
    );
    expectRejected(
      runValidator(join(duplicateFqn, "Manifest.xml"), duplicateFqn),
      /RESOURCE_FQN_DUPLICATE/i,
    );

    const unsafeRoot = makeTempTree("stable-containment");
    replaceInTree(
      unsafeRoot,
      "Manifest.xml",
      'root="vfs://@/TypeSystem/ObjectTypes/"',
      'root="vfs://@/../outside/types/"',
    );
    expectRejected(
      runValidator(join(unsafeRoot, "Manifest.xml"), unsafeRoot),
      /RESOURCE_REF_CONTAINMENT/i,
    );
  });

  test.each([
    [
      "legacy Resources assembly",
      '<ManifestResourceCatalog id="object-types" kind="ObjectType" root="vfs://@/TypeSystem/ObjectTypes/" entry="ObjectType.xml" />',
      '<Resources><Type href="vfs://@/TypeSystem/ObjectTypes/Resource/ObjectType.xml" /></Resources>',
      /Resources.*retired|Resources.*rejected|ONTOLOGY_LEGACY_ASSEMBLY_REJECTED/i,
    ],
    [
      "legacy Modules assembly",
      '<ManifestResourceCatalog id="object-types" kind="ObjectType" root="vfs://@/TypeSystem/ObjectTypes/" entry="ObjectType.xml" />',
      '<Modules><Module kind="ObjectType" href="TypeSystem/ObjectTypes/Resource/ObjectType.xml" /></Modules>',
      /Modules.*retired|Modules.*rejected|ONTOLOGY_LEGACY_ASSEMBLY_REJECTED/i,
    ],
    [
      "DirectoryResourceCatalog with a manifest-only ObjectType kind",
      '<ManifestResourceCatalog id="object-types" kind="ObjectType" root="vfs://@/TypeSystem/ObjectTypes/" entry="ObjectType.xml" />',
      '<DirectoryResourceCatalog id="object-types" kind="ObjectType" root="vfs://@/TypeSystem/ObjectTypes/" entry="ObjectType.xml" />',
      /CATALOG_KIND_SHAPE_MISMATCH|ObjectType.*does not allow.*directory/i,
    ],
    [
      "FileResourceCatalog with a manifest-only ObjectType kind",
      '<ManifestResourceCatalog id="object-types" kind="ObjectType" root="vfs://@/TypeSystem/ObjectTypes/" entry="ObjectType.xml" />',
      '<FileResourceCatalog id="object-types" kind="ObjectType" root="vfs://@/TypeSystem/ObjectTypes/" />',
      /CATALOG_KIND_SHAPE_MISMATCH|ObjectType.*does not allow.*file/i,
    ],
  ])("rejects %s", (_label, search, replacement, diagnostic) => {
    const tree = makeTempTree("legacy-rejection");
    replaceInTree(tree, "Manifest.xml", search as string, replacement as string);
    expectRejected(runValidator(join(tree, "Manifest.xml"), tree), diagnostic as RegExp);
  });

  test.each([
    [
      "Resources",
      '<Resources><Type href="vfs://@/TypeSystem/ObjectTypes/Resource/ObjectType.xml" /></Resources>',
    ],
    [
      "Modules",
      '<Modules><Module kind="ObjectType" href="TypeSystem/ObjectTypes/Resource/ObjectType.xml" /></Modules>',
    ],
  ])("deterministically rejects legacy %s assembly without following href", (element, replacement) => {
    const tree = makeTempTree(`legacy-${String(element).toLowerCase()}-deterministic`);
    replaceInTree(
      tree,
      "Manifest.xml",
      '<ManifestResourceCatalog id="object-types" kind="ObjectType" root="vfs://@/TypeSystem/ObjectTypes/" entry="ObjectType.xml" />',
      replacement as string,
    );
    writeFileSync(
      join(tree, "TypeSystem", "ObjectTypes", "Resource", "ObjectType.xml"),
      '<!DOCTYPE ObjectType><ObjectType fqn="ontology.invalid" id="Invalid.Target"><Description>Must remain unread.</Description></ObjectType>',
    );

    const first = runValidator(join(tree, "Manifest.xml"), tree);
    const second = runValidator(join(tree, "Manifest.xml"), tree);
    expectRejected(first, new RegExp(`ONTOLOGY_LEGACY_ASSEMBLY_REJECTED: Ontology/${element} and href assembly are retired`, "i"));
    expect(second).toEqual(first);
    expect(`${first.stdout}\n${first.stderr}`).not.toMatch(/ObjectType\.xml|DOCTYPE\/ENTITY declarations are forbidden/i);
  });
});

describe("MakerSpace layered ontology semantics", () => {
  test("keeps TypeSystem, DomainModel, and DomainSemantics responsibilities separate", () => {
    const docs = docsByRootKind();
    const types = docs.get("ObjectType") ?? [];
    const businessObjects = docs.get("BusinessObject") ?? [];
    const relations = docs.get("Relation") ?? [];
    const rules = docs.get("Rule") ?? [];
    const lifecycles = docs.get("StateMachine") ?? [];
    expect(types.map((type) => type["@_id"])).toEqual(expect.arrayContaining([
      "MakerSpace.Resource",
      "MakerSpace.ReservationWindow",
      "MakerSpace.Raw.AdminCommand",
      "MakerSpace.EventType.ReservationApproved",
    ]));
    expect(types.map((type) => type["@_id"])).not.toEqual(expect.arrayContaining([
      "MakerSpace.Reservation",
      "MakerSpace.Member",
      "MakerSpace.Tool",
    ]));
    expect(businessObjects.map((businessObject) => businessObject["@_id"])).toEqual(expect.arrayContaining([
      "MakerSpace.Reservation",
      "MakerSpace.Member",
      "MakerSpace.Tool",
    ]));
    for (const type of types) expect(type).not.toHaveProperty("BusinessObjects");
    for (const relation of relations) expect(relation).not.toHaveProperty("Associations");
    for (const rule of rules) expect(rule).not.toHaveProperty("DomainPolicies");
    for (const lifecycle of lifecycles) expect(lifecycle).not.toHaveProperty("BusinessObjects");

    const reservationRule = rules
      .find((rule) => rule["@_id"] === "MakerSpace.Rule.ReservationWindowOrdered")!;
    const compare = (reservationRule.Require as XmlNode).PropertyCompare as XmlNode;
    expect(compare["@_propertyRef"]).toBe("MakerSpace.Reservation#startTime");
    expect(compare["@_otherPropertyRef"]).toBe("MakerSpace.Reservation#endTime");
    expect(compare).not.toHaveProperty("@_value");

    const lifecycle = lifecycles[0]!;
    expect(lifecycle["@_subjectTypeRef"]).toBe("MakerSpace.Reservation");
    expect(lifecycle["@_statePropertyRef"]).toBe("MakerSpace.Reservation#workflowState");
  });

  test("models cozo-om types as language declarations with embedded local properties", () => {
    const docs = docsByRootKind();
    const mixin = (docs.get("Mixin") ?? [])
      .find((candidate) => candidate["@_id"] === "MakerSpace.Mixin.Auditable")!;
    const types = docs.get("ObjectType") ?? [];
    const businessObjects = docs.get("BusinessObject") ?? [];
    const resource = types.find((candidate) => candidate["@_id"] === "MakerSpace.Resource")!;
    const member = businessObjects.find((candidate) => candidate["@_id"] === "MakerSpace.Member")!;

    expect(member["@_parentRef"]).toBe("MakerSpace.Resource");
    expect(asArray((resource.Mixins as XmlNode).Mixin as XmlNode | XmlNode[])[0]?.["@_ref"]).toBe("MakerSpace.Mixin.Auditable");
    for (const property of [
      ...asArray((mixin.Properties as XmlNode).Property as XmlNode | XmlNode[]),
      ...types.flatMap((type) => asArray(((type.Properties as XmlNode | undefined)?.Property) as XmlNode | XmlNode[] | undefined)),
    ]) {
      expect(property).toHaveProperty("@_name");
      expect(property).toHaveProperty("@_typeRef");
      expect(property).not.toHaveProperty("@_id");
      expect(property).not.toHaveProperty("@_ref");
    }
    for (const property of businessObjects.flatMap((businessObject) => [
      ...asArray(((businessObject.Identity as XmlNode | undefined)?.Property) as XmlNode | XmlNode[] | undefined),
      ...asArray(((businessObject.Properties as XmlNode | undefined)?.Property) as XmlNode | XmlNode[] | undefined),
    ])) {
      expect(property).toHaveProperty("@_name");
      expect(property).toHaveProperty("@_typeRef");
      expect(property).not.toHaveProperty("@_id");
      expect(property).not.toHaveProperty("@_ref");
    }
  });

  test("DomainSemantics resources reference structural facts and owner refs use owner resource identities", () => {
    const businessObjects = docsByRootKind().get("BusinessObject") ?? [];
    const associations = asArray((firstResource("AssociationCatalog").Associations as XmlNode).Association as XmlNode | XmlNode[]);
    const policies = asArray((firstResource("DomainPolicyCatalog").DomainPolicies as XmlNode).DomainPolicy as XmlNode | XmlNode[]);
    const handlers = asArray((firstResource("ConstraintHandlerCatalog").ConstraintHandlers as XmlNode).ConstraintHandler as XmlNode | XmlNode[]);

    for (const businessObject of businessObjects) {
      expect(businessObject).not.toHaveProperty("@_typeRef");
      expect(businessObject["@_id"]).toMatch(/^MakerSpace\./);
      for (const property of asArray(((businessObject.Properties as XmlNode | undefined)?.Property) as XmlNode | XmlNode[] | undefined)) {
        expect(property).toHaveProperty("@_name");
        expect(property).toHaveProperty("@_typeRef");
        expect(property).not.toHaveProperty("@_id");
        expect(property).not.toHaveProperty("@_ref");
      }
    }
    for (const association of associations) {
      expect(association).toHaveProperty("@_relationRef");
      expect(association).not.toHaveProperty("@_fromTypeRef");
      expect(association).not.toHaveProperty("@_toTypeRef");
      expect(association).not.toHaveProperty("@_min");
      expect(association).not.toHaveProperty("@_max");
    }
    expect(policies.find((policy) => policy["@_id"] === "MakerSpace.Policy.ReservationApproval")?.["@_ownerRef"]).toBe("MakerSpace.Reservation");
    expect(policies.find((policy) => policy["@_id"] === "MakerSpace.Policy.ReservedToolVisibility")?.["@_ownerRef"]).toBe("MakerSpace.Association.ReservedTool");
    expect(handlers[0]?.["@_ownerRef"]).toBe("MakerSpace.Reservation");
  });

  test("BusinessObject manifests directly declare object type members and own behavior resources", () => {
    const docs = docsByRootKind();
    const reservation = (docs.get("BusinessObject") ?? [])
      .find((businessObject) => businessObject["@_id"] === "MakerSpace.Reservation")!;
    const action = (docs.get("Action") ?? [])[0]!;
    const mutation = (docs.get("Mutation") ?? [])[0]!;

    expect(reservation).not.toHaveProperty("@_typeRef");
    expect(reservation["@_parentRef"]).toBe("MakerSpace.Resource");
    expect(asArray((reservation.Identity as XmlNode).Property as XmlNode | XmlNode[])[0]?.["@_name"]).toBe("reservationNumber");
    expect(reservation).toHaveProperty("ManifestResourceCatalog");
    expect(action["@_ownerRef"]).toBe(reservation["@_id"]);
    expect(mutation["@_ownerRef"]).toBe(reservation["@_id"]);
    expect(asArray((action.Mutations as XmlNode).Mutation as XmlNode | XmlNode[])[0]?.["@_ref"]).toBe(mutation["@_id"]);
    expect(reservation).not.toHaveProperty("Types");
  });

  test("rejects a BusinessObject member owned by a different manifest", () => {
    const tree = makeTempTree("business-object-owner-mismatch");
    replaceInTree(
      tree,
      "DomainModel/BusinessObjects/Reservation/Mutations/MarkApproved/Mutation.xml",
      'ownerRef="MakerSpace.Reservation"',
      'ownerRef="MakerSpace.Tool"',
    );
    expectRejected(
      runValidator(join(tree, "Manifest.xml"), tree),
      /MUTATION_OWNER_MISMATCH|must match containing BusinessObject/i,
    );
  });

  test("enforces BusinessObject manifest children published by its KindDefinition", () => {
    const tree = makeTempTree("business-object-kind-contract");
    replaceInTree(
      tree,
      "DomainModel/BusinessObjects/Tool/BusinessObject.xml",
      "  <Purpose>Represents a reservable physical workshop tool.</Purpose>\n",
      "",
    );
    expectRejected(
      runValidator(join(tree, "Manifest.xml"), tree),
      /KIND_DEFINITION_REQUIRED_CHILD_MISSING.*BusinessObject.*Purpose|BusinessObject.*requires <Purpose>/i,
    );
  });
});

describe("Operation model and ExecuteOperationRequest contract", () => {
  test("covers operation owner, behavior, subject, invocation, and effect dimensions without a compound kind", () => {
    const { operations } = operationCatalog();
    expect(operations.size).toBe(8);
    expect(new Set([...operations.values()].map((operation) => operation["@_owner"]))).toEqual(new Set([
      "domain-context",
      "business-object",
      "association",
      "lifecycle",
      "constraint",
      "business-process",
      "capability",
      "raw",
    ]));
    expect(new Set([...operations.values()].map((operation) => operation["@_behavior"]))).toEqual(new Set([
      "action",
      "mutation",
      "query",
      "transition",
      "validate",
      "composed",
      "computed",
      "raw",
    ]));
    expect(new Set([...operations.values()].map((operation) => operation["@_subject"]))).toEqual(new Set(["none", "single", "selection"]));
    expect(new Set([...operations.values()].map((operation) => operation["@_invocation"]))).toEqual(new Set(["single", "batch"]));
    expect(new Set([...operations.values()].map((operation) => operation["@_effect"]))).toEqual(new Set(["mixed", "write", "read-only"]));

    const selection = operations.get("MakerSpace.Operation.ExpireReservations")!;
    const batch = operations.get("MakerSpace.Operation.ValidateReservationCertification")!;
    expect(selection["@_subject"]).toBe("selection");
    expect(selection["@_invocation"]).toBe("single");
    expect(batch["@_subject"]).toBe("single");
    expect(batch["@_invocation"]).toBe("batch");
  });

  test("pins exact preview JSON as the complete POST body", () => {
    const ontology = ontologyManifest();
    const { operations, presets } = operationCatalog();
    expect(presets).toHaveLength(4);

    for (const preset of presets) {
      const request = requestForPreset(preset);
      const operation = operations.get(preset["@_operationRef"] as string)!;
      expectExactKeys(request, ["apiVersion", "context", "operation", "invocation", "execution"]);
      expect(request).not.toHaveProperty("operationRef");
      expect(request).not.toHaveProperty("mode");
      expect(request).not.toHaveProperty("verb");
      expect(request).not.toHaveProperty("subject");
      expect(request).not.toHaveProperty("items");
      expect(request).not.toHaveProperty("atomicity");
      expect(request.apiVersion).toBe("1");
      expect(request.context).toEqual({
        id: ontology["@_id"],
        version: ontology["@_version"],
      });

      const requestOperation = request.operation as JsonObject;
      expect(requestOperation.ref).toBe(operation["@_id"]);
      expect(requestOperation.ownerKind).toBe(operation["@_owner"]);
      expect(requestOperation.behaviorKind).toBe(operation["@_behavior"]);
      expect(requestOperation.subjectKind).toBe(operation["@_subject"]);
      expect(requestOperation.invocationMode).toBe(operation["@_invocation"]);
      expect(requestOperation.effect).toBe(operation["@_effect"]);
      if (operation["@_ownerRef"]) {
        expect(requestOperation.ownerRef).toBe(operation["@_ownerRef"]);
      } else {
        expect(requestOperation).not.toHaveProperty("ownerRef");
      }

      const invocation = request.invocation as JsonObject;
      expect(invocation.mode).toBe(operation["@_invocation"]);
      if (invocation.mode === "single") {
        expectExactKeys(invocation, ["mode", "subject", "verb", "payload"]);
        expect(invocation.verb).toBe(operation["@_verb"]);
        expect((invocation.subject as JsonObject).kind).toBe(operation["@_subject"]);
      } else {
        expectExactKeys(invocation, ["mode", "items"]);
        const items = invocation.items as JsonObject[];
        expect(items.length).toBeGreaterThan(0);
        expect(new Set(items.map((item) => item.key)).size).toBe(items.length);
        for (const item of items) {
          expectExactKeys(item, ["key", "subject", "verb", "payload"]);
          expect(item.verb).toBe(operation["@_verb"]);
          expect((item.subject as JsonObject).kind).toBe(operation["@_subject"]);
        }
      }
    }

    const byId = new Map(presets.map((preset) => [preset["@_id"], requestForPreset(preset)]));
    const selection = byId.get("MakerSpace.Preset.ExpireApprovedReservations")!;
    expect(((selection.invocation as JsonObject).subject as JsonObject)).toEqual({
      kind: "selection",
      selector: {
        kind: "filter",
        where: { workflowState: "approved", endedBefore: "2026-08-03T00:00:00Z" },
      },
    });
    const batch = byId.get("MakerSpace.Preset.ValidateCertificationBatch")!;
    expect((batch.invocation as JsonObject).items).toHaveLength(2);
  });

  test("keeps definition capability, runtime binding support, and request execution choice distinct", () => {
    const { operations, presets } = operationCatalog();
    const bindingsByOperation = new Map<string, XmlNode[]>();

    for (const operation of operations.values()) {
      expect(operation).not.toHaveProperty("@_atomicity");
      const capabilities = capabilitySet(operation.Capabilities as XmlNode);
      expect(capabilities.atomicity.size).toBeGreaterThan(0);
    }

    for (const binding of runtimeBindings()) {
      expect(binding).not.toHaveProperty("@_atomicity");
      expect(binding).not.toHaveProperty("@_owner");
      expect(binding).not.toHaveProperty("@_ownerKind");
      expect(binding).not.toHaveProperty("@_ownerRef");
      const bindingCapabilities = capabilitySet(binding.Capabilities as XmlNode | undefined);
      if (binding["@_targetKind"] !== "operation") {
        expect(bindingCapabilities.atomicity.size).toBe(0);
        expect(bindingCapabilities.observations.size).toBe(0);
        continue;
      }

      const operation = operations.get(binding["@_targetRef"] as string)!;
      const definitionCapabilities = capabilitySet(operation.Capabilities as XmlNode);
      for (const atomicity of bindingCapabilities.atomicity) expect(definitionCapabilities.atomicity.has(atomicity)).toBe(true);
      for (const observation of bindingCapabilities.observations) expect(definitionCapabilities.observations.has(observation)).toBe(true);
      const list = bindingsByOperation.get(binding["@_targetRef"] as string) ?? [];
      list.push(binding);
      bindingsByOperation.set(binding["@_targetRef"] as string, list);
    }

    for (const preset of presets) {
      const operation = operations.get(preset["@_operationRef"] as string)!;
      const request = requestForPreset(preset);
      const execution = request.execution as JsonObject;
      const definitionCapabilities = capabilitySet(operation.Capabilities as XmlNode);
      expect(definitionCapabilities.atomicity.has(execution.atomicity as string)).toBe(true);
      for (const observation of execution.observe as string[]) {
        expect(definitionCapabilities.observations.has(observation)).toBe(true);
      }
      const compatibleBinding = (bindingsByOperation.get(operation["@_id"] as string) ?? []).some((binding) => {
        const bindingCapabilities = capabilitySet(binding.Capabilities as XmlNode);
        return bindingCapabilities.atomicity.has(execution.atomicity as string)
          && (execution.observe as string[]).every((observation) => bindingCapabilities.observations.has(observation));
      });
      expect(compatibleBinding, `No runtime binding supports preset ${preset["@_id"]}`).toBe(true);
    }
  });
});

describe("Semantic and request mutation RED targets", () => {
  test.each([
    [
      "PropertyCompare mixed RHS",
      "DomainModel/Rules/ReservationWindowOrdered/Rule.xml",
      'otherPropertyRef="MakerSpace.Reservation#endTime" />',
      'otherPropertyRef="MakerSpace.Reservation#endTime" value="2026-08-03T00:00:00Z" />',
      /PropertyCompare.*exactly one of @value or @otherPropertyRef/i,
    ],
    [
      "Property declaration is promoted back to a global entity",
      "DomainModel/BusinessObjects/Reservation/BusinessObject.xml",
      '<Property name="reservationNumber" typeRef="MakerSpace.Type.ReservationNumber" required="true" />',
      '<Property id="MakerSpace.Property.Reservation.ReservationNumber" name="reservationNumber" typeRef="MakerSpace.Type.ReservationNumber" required="true" />',
      /Property.*does not allow attribute @id/i,
    ],
    [
      "Child loosens inherited required property",
      "DomainModel/BusinessObjects/Reservation/BusinessObject.xml",
      '<Property name="reservationNumber" typeRef="MakerSpace.Type.ReservationNumber" required="true" />',
      '<Property name="createdAt" typeRef="builtin:DateTime" required="false" />\n        <Property name="reservationNumber" typeRef="MakerSpace.Type.ReservationNumber" required="true" />',
      /cannot loosen inherited required Property 'createdAt'/i,
    ],
    [
      "Property uses a Mixin as its value type",
      "DomainModel/BusinessObjects/Member/BusinessObject.xml",
      'typeRef="MakerSpace.Type.MemberNumber"',
      'typeRef="MakerSpace.Mixin.Auditable"',
      /Property.*references.*as scalar-type\|enum-type\|object-type\|union-type\|collection-type.*declared as mixin/i,
    ],
    [
      "Mixin application uses a builtin value type",
      "TypeSystem/ObjectTypes/Resource/ObjectType.xml",
      '<Mixin ref="MakerSpace.Mixin.Auditable" />',
      '<Mixin ref="builtin:String" />',
      /Mixin.*references builtin type.*where mixin is required/i,
    ],
    [
      "Relation endpoint uses non-entity DomainSemantics resource",
      "DomainModel/Relations/ReservesTool/Relation.xml",
      'toTypeRef="MakerSpace.Tool"',
      'toTypeRef="MakerSpace.Association.ReservedTool"',
      /Relation.*endpoint.*entity ObjectType or BusinessObject|RELATION_ENDPOINT_KIND_MISMATCH/i,
    ],
    [
      "DomainPolicy ownerRef falls back to structural ObjectType",
      "DomainSemantics/Policies/Core.xml",
      'ownerRef="MakerSpace.Reservation"',
      'ownerRef="MakerSpace.Resource"',
      /ownerRef.*owner resource|DOMAIN_POLICY_OWNER_KIND_MISMATCH|business-object.*BusinessObject/i,
    ],
    [
      "Operation ownerRef falls back to structural ObjectType",
      "Operations/Workbench.xml",
      'ownerRef="MakerSpace.Reservation" behavior="mutation"',
      'ownerRef="MakerSpace.Resource" behavior="mutation"',
      /ownerRef.*owner resource|business-object.*BusinessObject|Operation.*ownerRef/i,
    ],
    [
      "Operation duplicate atomicity",
      "Operations/Workbench.xml",
      '<Atomicity value="atomic" />\n        <Atomicity value="best-effort" />',
      '<Atomicity value="atomic" />\n        <Atomicity value="atomic" />\n        <Atomicity value="best-effort" />',
      /duplicate Atomicity|OPERATION_CAPABILITY_ROLE_MISMATCH/i,
    ],
    [
      "RuntimeBinding capability outside definition",
      "Bindings/Runtime.xml",
      '<Observation value="after" />\n        <Observation value="diff" />',
      '<Observation value="after" />\n        <Observation value="diff" />\n        <Observation value="trace" />',
      /RuntimeBinding.*Observation.*not declared|RUNTIME_BINDING_CAPABILITY_ROLE_MISMATCH/i,
    ],
  ])("rejects canonical semantic mutant: %s", (_label, relativePath, search, replacement, diagnostic) => {
    const tree = makeTempTree("semantic-mutant");
    replaceInTree(tree, relativePath as string, search as string, replacement as string);
    expectRejected(runValidator(join(tree, "Manifest.xml"), tree), diagnostic as RegExp);
  });

  test("rejects Mixin property conflicts whose result would depend on non-persisted application order", () => {
    const tree = makeTempTree("mixin-order-ambiguity");
    mkdirSync(join(tree, "TypeSystem", "Mixins", "optionally-auditable"));
    writeFileSync(
      join(tree, "TypeSystem", "Mixins", "optionally-auditable", "Mixin.xml"),
      `<?xml version="1.0" encoding="UTF-8"?>
<Mixin fqn="ontology.maker-space.mixins.optionally-auditable" id="MakerSpace.Mixin.OptionallyAuditable">
  <Description>Conflicts with the required audit property.</Description>
  <Properties>
    <Property name="createdAt" typeRef="builtin:DateTime" required="false" />
  </Properties>
</Mixin>`,
    );
    replaceInTree(
      tree,
      "TypeSystem/ObjectTypes/Resource/ObjectType.xml",
      '<Mixin ref="MakerSpace.Mixin.Auditable" />',
      '<Mixin ref="MakerSpace.Mixin.Auditable" />\n        <Mixin ref="MakerSpace.Mixin.OptionallyAuditable" />',
    );
    expectRejected(
      runValidator(join(tree, "Manifest.xml"), tree),
      /COZO_OM_MIXIN_PROPERTY_AMBIGUOUS|does not persist mixin application order/i,
    );
  });

  test.each([
    [
      "missing execution",
      "MakerSpace.Preset.OpenShopDay",
      (request: JsonObject) => {
        delete request.execution;
      },
      /RequestJson.*missing required top-level field "execution"|OPERATION_REQUEST_ENVELOPE_MISMATCH/i,
    ],
    [
      "simplified envelope",
      "MakerSpace.Preset.OpenShopDay",
      (request: JsonObject) => {
        for (const key of Object.keys(request)) delete request[key];
        request.operationRef = "MakerSpace.Operation.OpenShopDay";
        request.mode = "single";
        request.verb = "OpenShopDay";
        request.atomicity = "atomic";
      },
      /unexpected top-level field "operationRef"|simplified.*request|OPERATION_REQUEST_ENVELOPE_MISMATCH/i,
    ],
    [
      "context id mismatch",
      "MakerSpace.Preset.OpenShopDay",
      (request: JsonObject) => {
        (request.context as JsonObject).id = "Wrong.Ontology";
      },
      /context\.id.*must equal Ontology@id|OPERATION_REQUEST_ENVELOPE_MISMATCH/i,
    ],
    [
      "operation dimension mismatch",
      "MakerSpace.Preset.ExpireApprovedReservations",
      (request: JsonObject) => {
        (request.operation as JsonObject).behaviorKind = "query";
      },
      /behaviorKind.*must equal Operation@behavior|OPERATION_REQUEST_ENVELOPE_MISMATCH/i,
    ],
    [
      "single verb mismatch",
      "MakerSpace.Preset.ApproveReservation",
      (request: JsonObject) => {
        (request.invocation as JsonObject).verb = "ApproveBooking";
      },
      /invocation\.verb.*must equal Operation@verb|OPERATION_REQUEST_ENVELOPE_MISMATCH/i,
    ],
    [
      "batch item verb mismatch",
      "MakerSpace.Preset.ValidateCertificationBatch",
      (request: JsonObject) => {
        const items = (request.invocation as JsonObject).items as JsonObject[];
        items[0]!.verb = "WrongVerb";
      },
      /batch item.*verb.*must equal Operation@verb|OPERATION_REQUEST_ENVELOPE_MISMATCH/i,
    ],
    [
      "unsupported execution atomicity",
      "MakerSpace.Preset.OpenShopDay",
      (request: JsonObject) => {
        (request.execution as JsonObject).atomicity = "eventual";
      },
      /execution\.atomicity.*atomic\|best-effort|OPERATION_CAPABILITY_ROLE_MISMATCH/i,
    ],
    [
      "filter selector executable text",
      "MakerSpace.Preset.ExpireApprovedReservations",
      (request: JsonObject) => {
        (((request.invocation as JsonObject).subject as JsonObject).selector as JsonObject).where = {
          workflowState: "approved",
          endedBefore: "SELECT * FROM reservations",
        };
      },
      /filter selector.*executable|SQL|OPERATION_REQUEST_ENVELOPE_MISMATCH/i,
    ],
  ])("rejects RequestJson mutant: %s", (_label, presetId, mutate, diagnostic) => {
    const tree = makeTempTree("request-mutant");
    mutatePresetRequest(tree, presetId as string, mutate as (request: JsonObject) => void);
    expectRejected(runValidator(join(tree, "Manifest.xml"), tree), diagnostic as RegExp);
  });
});

describe("depa-ontology.ts source authority and projection contract", () => {
  const projectionFile = join(skillRoot, "ontology-domain", "spec", "cozo-om-projection.md");

  test("matches the public CommonJS surface, declarations, and documented projection APIs", () => {
    const projection = readFileSync(projectionFile, "utf8");
    const contract = parseProjectionAuthorityContract(projection);
    const declaration = readFileSync(join(runtimeAuthorityRoot, "cozo-om.d.ts"), "utf8");
    const publicIndex = requireFromTest(join(runtimeAuthorityRoot, "index.js")) as { om: Record<string, unknown> };
    const publicOm = requireFromTest(join(runtimeAuthorityRoot, "cozo-om.js")) as Record<string, unknown>;

    expect(contract.authorityPackage).toBe(runtimeAuthorityRoot);
    expect(realpathSync(contract.authorityPackage)).toBe(realpathSync(runtimeAuthorityRoot));
    expect(contract.publicEntrypoint).toBe("index.js#om");
    expect(publicIndex.om).toBe(publicOm);

    const runtimeExports = Object.keys(publicOm).sort();
    expect(runtimeExports).toEqual(declaredCallableExports(declaration));

    const documentedApis = [
      ...contract.schemaReadApis,
      ...contract.behaviorReadApis,
      ...contract.importStages.map((stage) => stage.api),
      ...contract.callbackRegistrationApis,
    ];
    for (const api of new Set(documentedApis)) {
      expect(typeof publicOm[api], `${api} must be a public runtime export`).toBe("function");
      expect(runtimeExports, `${api} must be declared in cozo-om.d.ts`).toContain(api);
    }

    const authorityDocs = [
      readFileSync(join(skillRoot, "SKILL.md"), "utf8"),
      readFileSync(join(skillRoot, "ontology-domain", "README.md"), "utf8"),
      readFileSync(join(skillRoot, "ontology-domain", "foundation", "axioms.md"), "utf8"),
      projection,
    ].join("\n");
    const absolutePackageAuthorities = authorityDocs.match(
      /\/Users\/kongweixian\/infra-dev\/[^\s`]+\/packages\/depa-ontology/g,
    ) ?? [];
    expect(new Set(absolutePackageAuthorities)).toEqual(new Set([runtimeAuthorityRoot]));
  });

  test("pins dependency order and the callback boundary with live public APIs", async () => {
    const contract = parseProjectionAuthorityContract(readFileSync(projectionFile, "utf8"));
    const { CozoDb, om } = requireFromTest(join(runtimeAuthorityRoot, "index.js")) as {
      CozoDb: new (engine: string, path: string, options: JsonObject) => { close(): void };
      om: Record<string, (...args: any[]) => any>;
    };

    expect(contract.importStages).toEqual([
      { stage: "mixins", api: "defineMixin" },
      { stage: "mixin-properties", api: "defineAttribute" },
      { stage: "types-parent-before-child", api: "defineType" },
      { stage: "type-properties-parent-before-child", api: "defineAttribute" },
      { stage: "relations", api: "defineRelation" },
      { stage: "behaviors", api: "importBehaviorManifestJson" },
    ]);
    expect(contract.callbackTransport).toBe("binding-id-only");
    expect(contract.importAllowsUnresolvedByDefault).toBe(true);
    expect(contract.readyImportOption).toBe("requireReady");

    const db = new CozoDb("mem", "", {});
    const runtime = om.createOmRuntime(db);
    try {
      await om.initSchema(runtime);
      await expect(om.defineType(runtime, "Child", "Child.", { parentType: "Parent" }))
        .rejects.toThrow(/Parent type 'Parent' does not exist/);
      await expect(om.defineType(runtime, "Owner", "Owner.", { mixins: ["Auditable"] }))
        .rejects.toThrow(/Mixin 'Auditable' does not exist/);

      await om.defineMixin(runtime, "Auditable", "Audit fields.");
      await om.defineAttribute(runtime, "Auditable", "createdAt", "String", true, "Created timestamp.");
      await om.defineType(runtime, "Parent", "Parent.");
      await om.defineType(runtime, "Owner", "Owner.", { parentType: "Parent", mixins: ["Auditable"] });
      await om.defineAttribute(runtime, "Owner", "displayName", "String", true, "Display name.");
      await om.defineRelation(runtime, "owns", "Owner", "Parent", true, "Ownership.");

      const missingOwner = await om.importBehaviorManifestJson(
        runtime,
        behaviorManifest("MissingOwner", "run", "host:missing"),
      );
      expect(missingOwner.applied).toBe(false);
      expect(missingOwner.diagnostics.map((item: JsonObject) => item.code)).toContain("OMI1101");

      const unresolved = await om.importBehaviorManifestJson(
        runtime,
        behaviorManifest("Owner", "run", "host:run"),
      );
      expect(unresolved.applied).toBe(true);
      expect(unresolved.unresolved).toHaveLength(1);
      expect(unresolved.unresolved[0].bindingId).toBe("host:run");

      const readyRequired = await om.importBehaviorManifestJson(
        runtime,
        behaviorManifest("Owner", "mustBeReady", "host:ready"),
        undefined,
        { requireReady: true },
      );
      expect(readyRequired.applied).toBe(false);
      expect(readyRequired.unresolved).toHaveLength(1);

      const ready = await om.importBehaviorManifestJson(
        runtime,
        behaviorManifest("Owner", "ready", "host:ready"),
        { actions: [{ bindingId: "host:ready", callback: () => [] }] },
        { requireReady: true },
      );
      expect(ready.applied).toBe(true);
      expect(ready.unresolved).toEqual([]);
    } finally {
      db.close();
      await om.clearRegistry(runtime);
    }
  });

  test("proves runtime snapshots and behavior rows cannot alone emit profile-only XML facts", async () => {
    const projection = readFileSync(projectionFile, "utf8");
    const contract = parseProjectionAuthorityContract(projection);
    const { CozoDb, om } = requireFromTest(join(runtimeAuthorityRoot, "index.js")) as {
      CozoDb: new (engine: string, path: string, options: JsonObject) => { close(): void };
      om: Record<string, (...args: any[]) => any>;
    };

    expect(contract.profileRequiredXmlKinds).toEqual([
      "BusinessObject",
      "Action",
      "Mutation",
      "ComputedFunction",
      "ConstraintHandler",
      "Interceptor",
      "Rule",
      "StateMachine",
      "Association",
      "Operation",
      "Evidence",
      "DomainPolicy",
      "BusinessProcess",
      "Capability",
      "EventContract",
      "Lifecycle",
      "RuntimeBinding",
      "ImplementationMapping",
      "SchemaEvolution",
    ]);
    expect(Object.keys(om).filter((name) => /xml/i.test(name))).toEqual([]);

    const db = new CozoDb("mem", "", {});
    const runtime = om.createOmRuntime(db);
    try {
      await om.initSchema(runtime);
      await om.defineType(runtime, "RuntimeOwner", "Native runtime owner.");
      await om.defineAction(runtime, "RuntimeOwner", "run", () => [], "Native action.");

      const behaviorJson = JSON.parse(
        new TextDecoder().decode(await om.exportBehaviorManifestJson(runtime)),
      ) as JsonObject;
      expectExactKeys(behaviorJson, ["version", "behaviors"]);
      const behavior = (behaviorJson.behaviors as JsonObject[])[0]!;
      expectExactKeys(behavior, [
        "kind",
        "ownerType",
        "name",
        "constraintType",
        "message",
        "description",
        "interceptorPhase",
        "interceptorSeq",
        "callbacks",
      ]);
      expect(behavior.kind).toBe("action");
      expect(behavior.ownerType).toBe("RuntimeOwner");
      expectExactKeys((behavior.callbacks as JsonObject[])[0], ["slot", "bindingId", "readiness"]);

      const snapshot = await om.writeSchemaSnapshot(runtime, 1);
      expect(snapshot.schema.om_type).toContainEqual(["RuntimeOwner", "Native runtime owner.", null]);
      expect(snapshot.behavior.om_action_def).toContainEqual(["RuntimeOwner", "run", "Native action."]);
      expect(snapshot).not.toHaveProperty("resourceKind");
      expect(snapshot).not.toHaveProperty("fqn");
      expect(projection).toMatch(/`perm\.policies` rows are runtime access-control data, not `DomainPolicy` XML facts/);
    } finally {
      db.close();
      await om.clearRegistry(runtime);
    }
  });
});

describe("Validator security and CLI RED targets", () => {
  test.each([
    [
      "absolute catalog root",
      'root="vfs://@/TypeSystem/ObjectTypes/"',
      `root="${resolve(tmpdir(), "outside-types")}"`,
      /absolute path|catalog root.*unsafe|VFS/i,
    ],
    [
      "dot-dot catalog root",
      'root="vfs://@/TypeSystem/ObjectTypes/"',
      'root="vfs://@/../outside/types/"',
      /\.\.|escapes workspace root|catalog root.*unsafe/i,
    ],
    [
      "percent encoded traversal",
      'root="vfs://@/TypeSystem/ObjectTypes/"',
      'root="vfs://@/%2e%2e/outside/types/"',
      /percent|decode|\.\.|escapes workspace root|catalog root.*unsafe/i,
    ],
  ])("rejects unsafe VFS root: %s", (_label, search, replacement, diagnostic) => {
    const tree = makeTempTree("vfs-unsafe");
    replaceInTree(tree, "Manifest.xml", search as string, replacement as string);
    expectRejected(runValidator(join(tree, "Manifest.xml"), tree), diagnostic as RegExp);
  });

  test("rejects a root manifest symbolic link", () => {
    const root = mkdtempSync(join(tmpdir(), "ontology-root-symlink-"));
    tempRoots.push(root);
    const workspace = join(root, "workspace");
    const outside = join(root, "outside");
    mkdirSync(workspace, { recursive: true });
    mkdirSync(outside, { recursive: true });
    writeFileSync(join(outside, "Manifest.xml"), readFileSync(validManifest, "utf8"));
    symlinkSync(join(outside, "Manifest.xml"), join(workspace, "Manifest-link.xml"));
    expectRejected(runValidator(join(realpathSync(workspace), "Manifest-link.xml"), realpathSync(workspace)), /symbolic link|escapes workspace root/i);
  });

  test("rejects a catalog root symbolic link", () => {
    const tree = makeTempTree("catalog-symlink");
    const outside = join(dirname(tree), "outside-types");
    mkdirSync(outside, { recursive: true });
    mkdirSync(join(outside, "Resource"), { recursive: true });
    writeFileSync(join(outside, "Resource", "ObjectType.xml"), readFileSync(join(tree, "TypeSystem", "ObjectTypes", "Resource", "ObjectType.xml"), "utf8"));
    rmSync(join(tree, "TypeSystem", "ObjectTypes"), { recursive: true, force: true });
    symlinkSync(outside, join(tree, "TypeSystem", "ObjectTypes"));
    expectRejected(runValidator(join(tree, "Manifest.xml"), tree), /symbolic link|escapes workspace root|catalog root.*unsafe/i);
  });

  test.each([
    [
      "DOCTYPE",
      '<!DOCTYPE Ontology><Ontology fqn="ontology.security" id="Security.Ontology" version="1.0.0"><Description>Forbidden doctype.</Description></Ontology>',
    ],
    [
      "ENTITY",
      '<!ENTITY xxe SYSTEM "file:///etc/passwd"><Ontology fqn="ontology.security" id="Security.Ontology" version="1.0.0"><Description>&xxe;</Description></Ontology>',
    ],
  ])("rejects %s declarations before discovery", (label, source) => {
    const tree = makeTempTree(`forbidden-${String(label).toLowerCase()}`);
    writeFileSync(
      join(tree, "Manifest.xml"),
      source as string,
    );
    expectRejected(runValidator(join(tree, "Manifest.xml"), tree), /DOCTYPE\/ENTITY declarations are forbidden/i);
  });

  test("rejects non-UTF-8 XML encoding", () => {
    const tree = makeTempTree("encoding-limit");
    writeFileSync(
      join(tree, "Manifest.xml"),
      '<?xml version="1.0" encoding="UTF-7"?><Ontology fqn="ontology.security" id="Security.Ontology" version="1.0.0"><Description>+ADw-script+AD4-</Description><ManifestResourceCatalog id="object-types" kind="ObjectType" root="vfs://@/TypeSystem/ObjectTypes/" entry="ObjectType.xml" /></Ontology>',
    );
    expectRejected(runValidator(join(tree, "Manifest.xml"), tree), /Unsupported XML encoding 'UTF-7'/i);
  });

  test("rejects XML input over the parser byte limit", () => {
    const tree = makeTempTree("size-limit");
    writeFileSync(join(tree, "Manifest.xml"), `<Ontology>${"x".repeat(1024 * 1024)}</Ontology>`);
    expectRejected(runValidator(join(tree, "Manifest.xml"), tree), /exceeds parser size limit 1048576 bytes/i);
  });

  test("rejects a root manifest outside the declared workspace boundary", () => {
    const root = mkdtempSync(join(tmpdir(), "ontology-boundary-"));
    tempRoots.push(root);
    const workspace = join(root, "workspace");
    const outside = join(root, "outside");
    mkdirSync(workspace, { recursive: true });
    mkdirSync(outside, { recursive: true });
    writeFileSync(join(outside, "Manifest.xml"), readFileSync(validManifest, "utf8"));
    expectRejected(runValidator(join(outside, "Manifest.xml"), workspace), /escapes workspace root|workspace boundary|outside/i);
  });

  test("supports generated and hypothesis-only modes on the canonical manifest", () => {
    expectAccepted(runValidator(validManifest, validTree, ["--generated", "--hypothesis-only"]));
  });

  test("keeps direct CLI option validation", () => {
    const result = Bun.spawnSync([process.execPath, "run", validator, validManifest, "--workspace-root", validTree, "--unknown"], {
      cwd: repoRoot,
    });
    expect(result.exitCode).toBe(2);
    expect(new TextDecoder().decode(result.stderr)).toMatch(/Unknown option/);
  });
});
