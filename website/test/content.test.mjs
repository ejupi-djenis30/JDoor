import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [html, styles, runtime, assetGenerator, pagesWorkflow] = await Promise.all([
  readFile(new URL("../public/index.html", import.meta.url), "utf8"),
  readFile(new URL("../public/styles.css", import.meta.url), "utf8"),
  readFile(new URL("../public/main.js", import.meta.url), "utf8"),
  readFile(new URL("../scripts/generate-assets.mjs", import.meta.url), "utf8"),
  readFile(new URL("../../.github/workflows/pages.yml", import.meta.url), "utf8")
]);

test("the product narrative leads with evidence and keeps permission ahead of origin", () => {
  const interfaceIndex = html.indexOf('id="interface"');
  const storyIndex = html.indexOf('id="story"');
  const flowIndex = html.indexOf('id="flow"');
  const decisionsIndex = html.indexOf('id="decisions"');
  const trustIndex = html.indexOf('id="trust"');
  const boundaryIndex = html.indexOf('id="boundaries"');
  assert(interfaceIndex > 0);
  assert(storyIndex > 0);
  assert(decisionsIndex > 0);
  assert(interfaceIndex < flowIndex);
  assert(flowIndex < storyIndex);
  assert(storyIndex < decisionsIndex);
  assert(decisionsIndex < trustIndex);
  assert(flowIndex < boundaryIndex);
  assert.match(html, /Two student collaborators created JDoor as a school experiment/iu);
  assert.match(html, /view-only sessions by default/iu);
  assert.match(html, /host enables it for that session/iu);
  assert.match(html, /revoke/iu);
});

test("technology choices name the alternative and accepted cost", () => {
  assert.match(html, /Java 21 \+ Swing/);
  assert.match(html, /Direct trusted-LAN connection/);
  assert.match(html, /Ephemeral TLS \+ exact pin/);
  assert.match(html, /Bounded protocol, view first/);
  assert.equal((html.match(/<dt>Instead of<\/dt>/g) ?? []).length, 4);
  assert.equal((html.match(/<dt>Accepted cost<\/dt>/g) ?? []).length, 4);
  assert.match(html, /pin identifies the endpoint—not the person/iu);
  assert.match(html, /No NAT traversal/iu);
});

test("scope is explained through concrete fits and explicit alternatives", () => {
  assert.match(html, /Helping family on the same trusted home network/iu);
  assert.match(html, /classroom or lab workstation/iu);
  assert.match(html, /colleague in a small office/iu);
  assert.match(html, /Choose something else/iu);
  assert.match(html, /fleet management/iu);
});

test("real product surfaces support the consent narrative", () => {
  assert.match(html, /jdoor-launcher\.avif/);
  assert.match(html, /jdoor-launcher\.webp/);
  assert.match(html, /jdoor-local-approval\.avif/);
  assert.match(html, /jdoor-local-approval\.webp/);
  assert.match(html, /actual desktop surfaces from the 1\.0\.0 codebase/iu);
  assert.match(html, /endpoint is redacted here/iu);
  assert.doesNotMatch(html, /192\.168\.\d+\.\d+/);
});

test("the published source status is precise about distribution", () => {
  assert.match(html, /Source 1\.0\.0/);
  assert.match(html, /softwareVersion": "1\.0\.0"/);
  assert.match(html, /no signed\s+installer or tagged GitHub release/iu);
  assert.doesNotMatch(html, /pre-release/iu);
  assert.match(assetGenerator, /REMOTE ASSISTANCE \/ SOURCE 1\.0\.0/);
  assert.doesNotMatch(assetGenerator, /PRE-RELEASE/iu);
});

test("the site is documentation, not a remote-control surface", () => {
  assert.match(html, /does not start or join remote sessions/iu);
  assert.doesNotMatch(html, /<button[^>]*>\s*(?:Start|Join|Connect)/iu);
  assert.doesNotMatch(html, /jdoor:\/\/[^<\s]+/iu);
  assert.doesNotMatch(html, /pairing token:\s*[A-Za-z0-9_-]+/iu);
});

test("security and privacy claims stay within repository evidence", () => {
  for (const claim of [
    /TLS 1\.2\/1\.3/,
    /128-bit/,
    /10 minutes/,
    /single-use/,
    /5 MiB/,
    /30 days/,
    /no telemetry/i,
    /trusted local network/i
  ]) {
    assert.match(html, claim);
  }

  assert.doesNotMatch(html, /zero risk|unhackable|military-grade|internet-ready|end-to-end encrypted/iu);
  assert.doesNotMatch(html, /every viewer is verified/iu);
  assert.match(html, /software checks the endpoint.*host decides the person/isu);
});

test("GitHub Pages publishes only the reviewed static directory with least privilege", () => {
  assert.match(pagesWorkflow, /^permissions:\s*\{\}/m);
  assert.match(
    pagesWorkflow,
    /build:[\s\S]*?permissions:\s*\n\s+contents: read\s*\n\s+pages: read/
  );
  assert.match(
    pagesWorkflow,
    /deploy:[\s\S]*?permissions:\s*\n\s+pages: write\s*\n\s+id-token: write/
  );
  assert.match(pagesWorkflow, /path: website\/public/);
  assert.match(pagesWorkflow, /actions\/configure-pages@[0-9a-f]{40}/);
  assert.match(pagesWorkflow, /actions\/upload-pages-artifact@[0-9a-f]{40}/);
  assert.match(pagesWorkflow, /actions\/deploy-pages@[0-9a-f]{40}/);
  assert.doesNotMatch(pagesWorkflow, /wrangler|cloudflare/iu);
});

test("layout contracts preserve readable type and touch targets", () => {
  assert.match(styles, /min-width:\s*2\.75rem/);
  assert.match(styles, /min-height:\s*2\.75rem/);
  assert.match(styles, /text-wrap:\s*balance/);
  assert.match(styles, /overflow-wrap:\s*anywhere/);
});

test("mobile navigation locks background interaction and traps keyboard focus", () => {
  assert.match(styles, /html\[data-menu-open\]\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(runtime, /target\.inert = open/);
  assert.match(runtime, /event\.key === "Tab"/);
});

test("mutable shell assets use revisioned URLs", () => {
  assert.match(html, /href="\/JDoor\/styles\.css\?v=\d+"/);
  assert.match(html, /src="\/JDoor\/main\.js\?v=\d+"/);
  assert.match(html, /href="\/JDoor\/site\.webmanifest\?v=\d+"/);
});
