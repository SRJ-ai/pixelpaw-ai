/**
 * Write docs/latest.json — the file every installed copy polls to find out
 * whether it is out of date.
 *
 * Generated rather than hand-edited, for two reasons. The signature is a long
 * base64 blob that nobody can eyeball, and a manifest whose version or URL
 * drifts from the artifact it describes fails in the worst possible way: it
 * tells people an update exists and then hands them something that will not
 * verify. Reading both out of the build directory keeps them in step.
 *
 *   node scripts/manifest.mjs
 *
 * Run after `npm run tauri build` with signing enabled — without
 * TAURI_SIGNING_PRIVATE_KEY set there is no .sig file and this exits loudly
 * rather than publishing a manifest that cannot work.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const { version } = pkg;

const bundle = join(root, "src-tauri", "target", "release", "bundle", "nsis");
const asset = `PixelPaw AI_${version}_x64-setup.exe`;
const sigPath = join(bundle, `${asset}.sig`);

let signature;
try {
  signature = readFileSync(sigPath, "utf8").trim();
} catch {
  console.error(
    `No signature at:\n  ${sigPath}\n\n` +
      "The build ran without a signing key, so nothing can be published: an\n" +
      "unsigned artifact is rejected by every installed copy. Rebuild with\n" +
      "TAURI_SIGNING_PRIVATE_KEY set (see README, Releasing)."
  );
  process.exit(1);
}

// The release asset is uploaded under a dot-separated name: GitHub encodes
// spaces in download URLs, and an encoded space in an updater URL is a support
// ticket waiting to happen.
const uploadName = `PixelPaw.AI_${version}_x64-setup.exe`;
const url = `https://github.com/SRJ-ai/pixelpaw-ai/releases/download/v${version}/${uploadName}`;

// Notes come from the changelog's top section, so the text people see in the
// app is the same text as the release — one source, no paraphrase drift.
const changelog = readFileSync(join(root, "CHANGELOG.md"), "utf8");
const section = changelog.split(/^## /m).find((s) => s.startsWith(version));
const notes = section
  ? section
      .split("\n")
      .slice(1)
      .join("\n")
      .replace(/^###.*$/gm, "")
      .replace(/\*\*/g, "")
      .trim()
      .slice(0, 900)
  : `PixelPaw AI ${version}`;

const manifest = {
  version,
  notes,
  pub_date: new Date().toISOString(),
  platforms: {
    "windows-x86_64": { signature, url },
  },
};

const out = join(root, "docs", "latest.json");
writeFileSync(out, JSON.stringify(manifest, null, 2) + "\n");
console.log(`latest.json -> ${version}\n  ${url}\n  signature ${signature.length} chars`);
