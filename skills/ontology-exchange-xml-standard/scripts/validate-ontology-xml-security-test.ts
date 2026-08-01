#!/usr/bin/env bun

import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const skillRoot = resolve(import.meta.dir, "..");
const canonical = join(skillRoot, "ontology-domain", "examples", "valid", "MakerSpace");
const validator = join(import.meta.dir, "validate-ontology-xml.ts");
const root = mkdtempSync(join(tmpdir(), "ontology-xml-validator-security-"));

function runValidator(manifest: string, workspaceRoot: string): { exitCode: number | null; stderr: string } {
  const result = Bun.spawnSync([
    process.execPath,
    "run",
    validator,
    manifest,
    "--workspace-root",
    workspaceRoot,
  ]);
  return {
    exitCode: result.exitCode,
    stderr: new TextDecoder().decode(result.stderr),
  };
}

function assertRejected(manifest: string, workspaceRoot: string, label: string, diagnostic: RegExp): void {
  const result = runValidator(manifest, workspaceRoot);
  if (result.exitCode === 0 || !diagnostic.test(result.stderr)) {
    throw new Error(`${label} must be rejected with ${diagnostic}; stderr: ${result.stderr}`);
  }
}

function copyCanonical(label: string): string {
  const tree = join(root, label);
  cpSync(canonical, tree, { recursive: true });
  return tree;
}

function replaceInManifest(tree: string, search: string, replacement: string): void {
  const manifest = join(tree, "Manifest.xml");
  const source = readFileSync(manifest, "utf8");
  if (!source.includes(search)) throw new Error(`Manifest did not contain expected text: ${search}`);
  writeFileSync(manifest, source.replace(search, replacement));
}

try {
  const dotDotTree = copyCanonical("dot-dot");
  replaceInManifest(dotDotTree, 'root="vfs://@/TypeSystem/ObjectTypes/"', 'root="vfs://@/../outside/types/"');
  assertRejected(join(dotDotTree, "Manifest.xml"), dotDotTree, "dot-dot catalog root", /\.\.|escapes workspace root|catalog root.*unsafe/i);

  const percentTree = copyCanonical("percent");
  replaceInManifest(percentTree, 'root="vfs://@/TypeSystem/ObjectTypes/"', 'root="vfs://@/%2e%2e/outside/types/"');
  assertRejected(join(percentTree, "Manifest.xml"), percentTree, "percent-encoded catalog root", /percent|decode|\.\.|escapes workspace root|catalog root.*unsafe/i);

  const rootLinkWorkspace = join(root, "root-link-workspace");
  const rootLinkOutside = join(root, "root-link-outside");
  mkdirSync(rootLinkWorkspace, { recursive: true });
  mkdirSync(rootLinkOutside, { recursive: true });
  writeFileSync(join(rootLinkOutside, "Manifest.xml"), readFileSync(join(canonical, "Manifest.xml"), "utf8"));
  symlinkSync(join(rootLinkOutside, "Manifest.xml"), join(rootLinkWorkspace, "Manifest.xml"));
  assertRejected(join(realpathSync(rootLinkWorkspace), "Manifest.xml"), realpathSync(rootLinkWorkspace), "root XML symlink", /symbolic link|escapes workspace root/i);

  const catalogLinkTree = copyCanonical("catalog-link");
  const outsideTypes = join(root, "outside-types");
  mkdirSync(outsideTypes, { recursive: true });
  mkdirSync(join(outsideTypes, "Resource"), { recursive: true });
  writeFileSync(join(outsideTypes, "Resource", "ObjectType.xml"), readFileSync(join(catalogLinkTree, "TypeSystem", "ObjectTypes", "Resource", "ObjectType.xml"), "utf8"));
  rmSync(join(catalogLinkTree, "TypeSystem", "ObjectTypes"), { recursive: true, force: true });
  symlinkSync(outsideTypes, join(catalogLinkTree, "TypeSystem", "ObjectTypes"));
  assertRejected(join(catalogLinkTree, "Manifest.xml"), catalogLinkTree, "catalog-directory symlink", /symbolic link|escapes workspace root|catalog root.*unsafe/i);

  const doctypeTree = copyCanonical("doctype");
  writeFileSync(
    join(doctypeTree, "Manifest.xml"),
    '<!DOCTYPE Ontology><Ontology fqn="ontology.security" id="Security.Ontology" version="1.0.0"><Description>Forbidden doctype.</Description></Ontology>',
  );
  assertRejected(join(doctypeTree, "Manifest.xml"), doctypeTree, "DOCTYPE input", /DOCTYPE\/ENTITY declarations are forbidden/i);

  const entityTree = copyCanonical("entity");
  writeFileSync(
    join(entityTree, "Manifest.xml"),
    '<!ENTITY xxe SYSTEM "file:///etc/passwd"><Ontology fqn="ontology.security" id="Security.Ontology" version="1.0.0"><Description>&xxe;</Description></Ontology>',
  );
  assertRejected(join(entityTree, "Manifest.xml"), entityTree, "ENTITY input", /DOCTYPE\/ENTITY declarations are forbidden/i);

  const encodingTree = copyCanonical("encoding");
  writeFileSync(
    join(encodingTree, "Manifest.xml"),
    '<?xml version="1.0" encoding="UTF-7"?><Ontology fqn="ontology.security" id="Security.Ontology" version="1.0.0"><Description>Unsupported encoding.</Description></Ontology>',
  );
  assertRejected(join(encodingTree, "Manifest.xml"), encodingTree, "non-UTF-8 encoding", /Unsupported XML encoding 'UTF-7'/i);

  const oversizedTree = copyCanonical("oversized");
  writeFileSync(join(oversizedTree, "Manifest.xml"), `<Ontology>${"x".repeat(1024 * 1024)}</Ontology>`);
  assertRejected(join(oversizedTree, "Manifest.xml"), oversizedTree, "oversized XML input", /exceeds parser size limit 1048576 bytes/i);

  const outsideBoundary = join(root, "outside-boundary");
  const boundaryWorkspace = join(root, "boundary-workspace");
  mkdirSync(outsideBoundary, { recursive: true });
  mkdirSync(boundaryWorkspace, { recursive: true });
  writeFileSync(join(outsideBoundary, "Manifest.xml"), readFileSync(join(canonical, "Manifest.xml"), "utf8"));
  assertRejected(join(outsideBoundary, "Manifest.xml"), boundaryWorkspace, "root outside workspace", /escapes workspace root|workspace boundary|outside/i);

  console.log("Ontology XML FS-native security RED tests passed.");
} finally {
  rmSync(root, { recursive: true, force: true });
}
