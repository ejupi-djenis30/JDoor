# Release procedure

JDoor Assist publishes a release only from the exact current `main` commit. The release workflow
builds each operating-system package on its native GitHub runner. It does not treat a local build
or a pull-request artifact as a release.

## Before creating a tag

1. Update the Maven project version and add one dated changelog section for the same stable
   semantic version.
2. Keep the `[Unreleased]` comparison link and version link aligned with the candidate tag.
3. Merge the change and wait for every required check on `main`.
4. Run the **Release** workflow manually from `main` with the expected `vX.Y.Z` tag. This is a
   non-publishing rehearsal: it validates metadata, builds all three native packages, checks the
   exact asset inventory, and retains a release-candidate artifact.
5. Inspect the rehearsal before deciding whether to publish. A green run proves that the pinned
   source can be packaged; it is not permission to bypass a failed or pending check.

## Tag and publication boundary

The publication trigger must be an annotated SSH-signed `vX.Y.Z` tag. Create it only after the
rehearsal succeeds and only when remote `main` still points to the rehearsed commit.

The workflow rejects a tag unless all of these statements are true:

- the tag is stable SemVer and matches `pom.xml` plus the changelog;
- the tag object points directly to a commit;
- Git verifies its SSH signature against `.github/release-signers.allowed`;
- GitHub reports the tag-object signature as verified and valid;
- the tagged commit is the exact current `main` commit.

The `production-release` environment is the final approval boundary. Version tags are immutable:
never move or recreate one. If a release candidate is wrong, fix the source and use a new version.

## Published evidence

The candidate contains exactly three native packages, three matching SHA-256 files, and one
CycloneDX SBOM. The workflow verifies every checksum before publication and attaches GitHub build
provenance to tag-triggered artifacts.

Platform packages are currently unsigned. Users may see an unverified-publisher warning even when
the checksum and GitHub provenance are valid. Do not describe these packages as code-signed or
notarized until platform signing is implemented and independently tested.

After publication, verify the release page, asset count, checksums, SBOM format, provenance, tag
signature, and latest-release status. Record the workflow URL and tag-object SHA in the release
notes or maintenance log.
