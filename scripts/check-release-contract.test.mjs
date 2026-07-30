import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  projectVersion,
  validateReleaseMetadata,
} from "./check-release-contract.mjs";

const VALID_POM = `
<project>
  <artifactId>jdoor-assist</artifactId>
  <version>1.0.0</version>
</project>`;
const VALID_CHANGELOG = `
## [1.0.0] - 2026-07-26

[Unreleased]: https://github.com/ejupi-djenis30/JDoor/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/ejupi-djenis30/JDoor/releases/tag/v1.0.0
`;

function workflowJob(source, name) {
  const lines = source.split("\n");
  const start = lines.findIndex((line) => line === `  ${name}:`);
  if (start === -1) throw new Error(`Workflow job ${name} is missing.`);
  const next = lines.findIndex(
    (line, index) => index > start && /^  [a-z0-9-]+:$/u.test(line),
  );
  return lines.slice(start, next === -1 ? undefined : next).join("\n");
}

test("extracts the project version and accepts one exact release contract", () => {
  assert.equal(projectVersion(VALID_POM), "1.0.0");
  assert.deepEqual(
    validateReleaseMetadata({
      expectedTag: "v1.0.0",
      pom: VALID_POM,
      changelog: VALID_CHANGELOG,
    }),
    { tag: "v1.0.0", version: "1.0.0" },
  );
});

for (const tag of ["1.0.0", "v1.0", "v01.0.0", "v1.0.0-rc.1", "v1.0.0/extra"]) {
  test(`rejects non-stable release tag ${tag}`, () => {
    assert.throws(
      () =>
        validateReleaseMetadata({
          expectedTag: tag,
          pom: VALID_POM,
          changelog: VALID_CHANGELOG,
        }),
      /stable SemVer/u,
    );
  });
}

test("rejects a tag that differs from the Maven project", () => {
  assert.throws(
    () =>
      validateReleaseMetadata({
        expectedTag: "v1.0.1",
        pom: VALID_POM,
        changelog: VALID_CHANGELOG,
      }),
    /does not match pom\.xml/u,
  );
});

test("rejects missing, duplicate, or stale changelog evidence", () => {
  const inputs = [
    VALID_CHANGELOG.replace("## [1.0.0] - 2026-07-26", ""),
    `${VALID_CHANGELOG}\n## [1.0.0] - 2026-07-27\n`,
    VALID_CHANGELOG.replace("compare/v1.0.0...HEAD", "compare/v0.9.0...HEAD"),
  ];

  for (const changelog of inputs) {
    assert.throws(
      () =>
        validateReleaseMetadata({
          expectedTag: "v1.0.0",
          pom: VALID_POM,
          changelog,
        }),
      /CHANGELOG\.md/u,
    );
  }
});

test("the workflow keeps rehearsal read-only and makes publication conditional", async () => {
  const [workflow, signers, releaseGuide] = await Promise.all([
    readFile(new URL("../.github/workflows/release.yml", import.meta.url), "utf8"),
    readFile(new URL("../.github/release-signers.allowed", import.meta.url), "utf8"),
    readFile(new URL("../docs/RELEASES.md", import.meta.url), "utf8"),
  ]);
  const assembleJob = workflowJob(workflow, "assemble");
  const publishJob = workflowJob(workflow, "publish");

  assert.match(workflow, /workflow_dispatch:/u);
  assert.match(workflow, /fetch-depth:\s*0/u);
  assert.match(workflow, /git verify-tag/u);
  assert.match(workflow, /\.verification\.verified/u);
  assert.match(workflow, /\.object\.type/u);
  assert.match(workflow, /git merge-base --is-ancestor/u);
  assert.match(assembleJob, /name:\s*Assemble verified release candidate/u);
  assert.match(workflow, /jdoor-assist-windows-x64\.zip\.sha256/u);
  assert.match(
    workflow,
    /\[IO\.File\]::WriteAllText\([\s\S]*jdoor-assist-windows-x64\.zip`n[\s\S]*\[Text\.Encoding\]::ASCII/u,
  );
  const windowsArchiveStep = workflow.match(
    /- name: Archive Windows app image([\s\S]*?)(?=\n      - name:)/u,
  )?.[1] ?? "";
  assert.doesNotMatch(windowsArchiveStep, /Set-Content|Out-File/u);
  assert.match(
    publishJob,
    /^    if: github\.event_name == 'push' && github\.ref_type == 'tag'$/mu,
  );
  assert.match(publishJob, /^    environment: production-release$/mu);
  assert.match(
    publishJob,
    /release-candidate-\$\{\{ needs\.preflight\.outputs\.expected-tag \}\}/u,
  );
  assert.match(
    publishJob,
    /gh release create "\$\{GITHUB_REF_NAME\}"/u,
  );
  assert.match(
    signers,
    /^69587167\+ejupi-djenis30@users\.noreply\.github\.com namespaces="git" ssh-ed25519 /u,
  );
  assert.doesNotMatch(signers, /Djenis Ejupi/u);
  assert.match(releaseGuide, /non-publishing rehearsal/u);
  assert.match(releaseGuide, /exact current `main` commit/u);
  assert.match(releaseGuide, /currently unsigned/u);
  assert.doesNotMatch(releaseGuide, /Djenis Ejupi/u);
});
