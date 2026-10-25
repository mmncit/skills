#!/usr/bin/env node
// Structural checks for this repository. Zero dependencies, run with `node scripts/check-skills.mjs`.
//
// Catches the three kinds of drift that have actually happened here: frontmatter the
// skills CLI silently skips at publish time, a new skill missing from the front door's
// routing table, and a skill with no outbound links that leaves a reader with nowhere
// to go.

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FRONT_DOOR = "functional-architecture";
// Skills that sit outside the functional-architecture family and are deliberately
// absent from its routing table. Each still has to be reachable from somewhere.
const OUTSIDE_FAMILY = new Set(["react-state"]);

const problems = [];
const fail = (file, msg) => problems.push(`${file}: ${msg}`);

const skills = readdirSync(root, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith(".") && d.name !== "temp" && d.name !== "scripts")
  .map((d) => d.name)
  .filter((name) => existsSync(join(root, name, "SKILL.md")))
  .sort();

if (skills.length === 0) fail("repo", "no skills found");

const bodies = new Map();

for (const name of skills) {
  const dir = join(root, name);
  const skillPath = join(name, "SKILL.md");
  const text = readFileSync(join(root, skillPath), "utf8");
  bodies.set(name, text);

  // Frontmatter. The contract is exactly two keys, with description as a double-quoted
  // scalar. An unquoted ": " inside a description makes the skills CLI skip the whole
  // skill at publish time without failing, so this is checked strictly rather than leniently.
  const fm = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!fm) {
    fail(skillPath, "missing or malformed YAML frontmatter");
  } else {
    const lines = fm[1].split("\n");
    const nameLine = lines.find((l) => l.startsWith("name:"));
    const descStart = lines.findIndex((l) => l.startsWith("description:"));

    if (!nameLine) fail(skillPath, "frontmatter has no 'name'");
    else if (nameLine.slice(5).trim() !== name)
      fail(skillPath, `frontmatter name '${nameLine.slice(5).trim()}' does not match folder '${name}'`);

    if (descStart === -1) {
      fail(skillPath, "frontmatter has no 'description'");
    } else {
      const literal = lines.slice(descStart).join("\n").slice("description:".length).trim();
      if (!literal.startsWith('"')) {
        fail(skillPath, "description must be double-quoted; an unquoted ': ' silently skips the skill at publish time");
      } else {
        try {
          JSON.parse(literal);
        } catch {
          fail(skillPath, "description is not a well-formed quoted scalar (check for an unescaped \")");
        }
      }
    }

    const keys = lines.filter((l) => /^[a-zA-Z_-]+:/.test(l)).map((l) => l.split(":")[0]);
    const extra = keys.filter((k) => k !== "name" && k !== "description");
    if (extra.length) fail(skillPath, `frontmatter has unsupported keys: ${extra.join(", ")}`);
  }

  if (!/^## When NOT to use it$/m.test(text))
    fail(skillPath, "no 'When NOT to use it' section; a skill that only argues for itself gets misapplied");

  if (!existsSync(join(dir, "README.md"))) fail(name, "no README.md");

  // Reference files pointed at from anywhere in the skill must exist, and files sitting
  // in references/ must be pointed at by something.
  const refDir = join(dir, "references");
  const declared = new Set();
  const allText = [text, ...(existsSync(join(dir, "README.md")) ? [readFileSync(join(dir, "README.md"), "utf8")] : [])].join("\n");
  for (const m of allText.matchAll(/(?:([a-z0-9-]+)\/)?references\/([a-z0-9-]+\.md)/g)) {
    const owner = m[1] && m[1] !== "references" ? m[1] : name;
    if (owner === name) declared.add(m[2]);
    if (!existsSync(join(root, owner, "references", m[2])))
      fail(name, `points at ${owner}/references/${m[2]}, which does not exist`);
  }
  if (existsSync(refDir) && statSync(refDir).isDirectory()) {
    for (const f of readdirSync(refDir)) {
      if (f.endsWith(".md") && !declared.has(f)) fail(name, `references/${f} exists but nothing points at it`);
    }
  }
}

// Cross-links. A skill named in backticks or in a relative link has to be a real skill,
// and every skill needs at least one way out of it.
for (const name of skills) {
  const dir = join(root, name);
  const files = [join(dir, "SKILL.md")];
  if (existsSync(join(dir, "README.md"))) files.push(join(dir, "README.md"));

  let outbound = new Set();
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/`([a-z][a-z0-9-]+)`/g)) {
      if (skills.includes(m[1]) && m[1] !== name) outbound.add(m[1]);
    }
    for (const m of text.matchAll(/\]\(\.\.\/([a-z0-9-]+)\/\)/g)) {
      if (!skills.includes(m[1])) fail(file.replace(root + "/", ""), `links to ../${m[1]}/, which is not a skill`);
      else if (m[1] !== name) outbound.add(m[1]);
    }
  }
  if (outbound.size === 0) fail(name, "has no outbound links to any sibling; a reader landing here has nowhere to go");
}

// The front door has to route to every skill in the family.
const frontDoor = bodies.get(FRONT_DOOR);
if (!frontDoor) {
  fail("repo", `front door '${FRONT_DOOR}' not found`);
} else {
  for (const name of skills) {
    if (name === FRONT_DOOR || OUTSIDE_FAMILY.has(name)) continue;
    if (!frontDoor.includes(`\`${name}\``) && !frontDoor.includes(`../${name}/`))
      fail(`${FRONT_DOOR}/SKILL.md`, `routing table does not mention '${name}'`);
  }
}

// The root README has to list every skill, so nothing is invisible from the repo front page.
const rootReadmePath = join(root, "README.md");
if (!existsSync(rootReadmePath)) {
  fail("repo", "no root README.md");
} else {
  const rootReadme = readFileSync(rootReadmePath, "utf8");
  for (const name of skills) {
    if (!rootReadme.includes(`(${name}/)`)) fail("README.md", `catalogue does not link to '${name}'`);
  }
}

if (problems.length) {
  console.error(`\n${problems.length} problem${problems.length === 1 ? "" : "s"}:\n`);
  for (const p of problems) console.error(`  ${p}`);
  console.error("");
  process.exit(1);
}

console.log(`ok  ${skills.length} skills: ${skills.join(", ")}`);
