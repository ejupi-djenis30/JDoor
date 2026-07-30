import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SEMVER_TAG = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;

function escapeRegularExpression(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

export function projectVersion(pom) {
  const match = pom.match(
    /<artifactId>\s*jdoor-assist\s*<\/artifactId>\s*<version>\s*([^<\s]+)\s*<\/version>/u,
  );

  if (!match) throw new Error("pom.xml must contain one JDoor Assist project version.");
  return match[1];
}

export function validateReleaseMetadata({ expectedTag, pom, changelog }) {
  if (!SEMVER_TAG.test(expectedTag)) {
    throw new Error(`Release tag must be stable SemVer in vX.Y.Z form: ${expectedTag}`);
  }

  const expectedVersion = expectedTag.slice(1);
  const actualVersion = projectVersion(pom);
  if (actualVersion !== expectedVersion) {
    throw new Error(
      `Release tag ${expectedTag} does not match pom.xml version ${actualVersion}.`,
    );
  }

  const escapedVersion = escapeRegularExpression(expectedVersion);
  const releaseHeadings =
    changelog.match(
      new RegExp(`^## \\[${escapedVersion}\\] - \\d{4}-\\d{2}-\\d{2}$`, "gmu"),
    ) ?? [];
  if (releaseHeadings.length !== 1) {
    throw new Error(
      `CHANGELOG.md must contain exactly one dated ${expectedVersion} release heading.`,
    );
  }

  const expectedUnreleased =
    `[Unreleased]: https://github.com/ejupi-djenis30/JDoor/compare/${expectedTag}...HEAD`;
  const expectedRelease =
    `[${expectedVersion}]: https://github.com/ejupi-djenis30/JDoor/releases/tag/${expectedTag}`;
  if (!changelog.includes(expectedUnreleased) || !changelog.includes(expectedRelease)) {
    throw new Error("CHANGELOG.md comparison and release links do not match the candidate tag.");
  }

  return Object.freeze({ tag: expectedTag, version: expectedVersion });
}

function expectedTagFromArguments(arguments_) {
  if (
    arguments_.length !== 2 ||
    arguments_[0] !== "--expected-tag" ||
    typeof arguments_[1] !== "string"
  ) {
    throw new Error("Usage: node scripts/check-release-contract.mjs --expected-tag vX.Y.Z");
  }
  return arguments_[1];
}

async function main() {
  const expectedTag = expectedTagFromArguments(process.argv.slice(2));
  const [pom, changelog] = await Promise.all([
    readFile(new URL("../pom.xml", import.meta.url), "utf8"),
    readFile(new URL("../CHANGELOG.md", import.meta.url), "utf8"),
  ]);
  const result = validateReleaseMetadata({ expectedTag, pom, changelog });
  process.stdout.write(`RELEASE_TAG=${result.tag} RELEASE_VERSION=${result.version}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await main();
}
