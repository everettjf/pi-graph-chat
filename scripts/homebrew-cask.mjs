#!/usr/bin/env node
// Write the Homebrew cask for the current version into a tap checkout.
//
//   bun scripts/homebrew-cask.mjs [--tap <dir>] [--zip <file>]
//
// The version comes from package.json; the sha256 from the release zip
// (dist-app by default). With --tap the cask is written to <dir>/Casks/,
// otherwise it is printed. The tap defaults to Homebrew's checkout of
// everettjf/tap when it exists.

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);

function option(name) {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} needs a value.`);
  return value;
}

const { version } = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const zip = path.resolve(option("--zip") ?? path.join(root, "dist-app", `Pi-Graph-Chat-${version}.zip`));
if (!fs.existsSync(zip)) {
  throw new Error(`${zip} does not exist. Run \`bun run app:build\` with signing and notarization first.`);
}
const sha256 = createHash("sha256").update(fs.readFileSync(zip)).digest("hex");

const cask = `# typed: strict
# frozen_string_literal: true

cask "pi-graph-chat" do
  version "${version}"
  sha256 "${sha256}"

  url "https://github.com/everettjf/pi-graph-chat/releases/download/v#{version}/Pi-Graph-Chat-#{version}.zip"
  name "Pi Graph Chat"
  desc "Local-first learning workspace that turns AI chats into knowledge graphs"
  homepage "https://github.com/everettjf/pi-graph-chat"

  livecheck do
    url :url
    strategy :github_latest
  end

  depends_on arch: :arm64
  depends_on macos: :monterey

  app "Pi Graph Chat.app"

  uninstall quit: "com.everettjf.pi-graph-chat"

  # Pi's own sessions and credentials under ~/.pi belong to Pi and are left alone.
  zap trash: [
    "~/Library/Application Support/Pi Graph Chat",
    "~/Library/Logs/Pi Graph Chat",
  ]
end
`;

let tap = option("--tap");
if (!tap) {
  try {
    tap = execFileSync("brew", ["--repository", "everettjf/tap"], { encoding: "utf8" }).trim();
  } catch {
    tap = undefined;
  }
}

if (tap && fs.existsSync(tap)) {
  const file = path.join(tap, "Casks", "pi-graph-chat.rb");
  fs.writeFileSync(file, cask);
  console.log(`Wrote ${file} (version ${version}, sha256 ${sha256.slice(0, 12)}…).`);
  console.log(`Next: cd ${tap} && brew audit --cask pi-graph-chat && git commit -am "Update Pi Graph Chat to ${version}" && git push`);
} else {
  process.stdout.write(cask);
}
