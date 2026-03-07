/**
 * 预览 ROSBOT_FLOW_MERMAID.md 中的 Mermaid 图：导出为 SVG 并用默认程序打开。
 * 依赖：Node 18+，需可执行 npx。
 * 使用：node pyapps/d3-check/docs/preview_mermaid.mjs
 * 或：node preview_mermaid.mjs（在 docs 目录下执行）
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const docDir = typeof __dirname !== "undefined" ? __dirname : dirname(fileURLToPath(import.meta.url));
const mdPath = join(docDir, "ROSBOT_FLOW_MERMAID.md");
const outDir = join(docDir, "mermaid_preview");
const outSvg = join(outDir, "ROSBOT_FLOW.svg");

const md = readFileSync(mdPath, "utf8");
const re = /```mermaid\n([\s\S]*?)```/g;
const blocks = [];
let m;
while ((m = re.exec(md)) !== null) blocks.push(m[1]);

if (blocks.length === 0) {
  console.error("No mermaid block found in", mdPath);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
const mmdPath = join(tmpdir(), `rosbot_flow_${Date.now()}.mmd`);
writeFileSync(mmdPath, blocks[0], "utf8");

try {
  execSync(`npx -y @mermaid-js/mermaid-cli -i "${mmdPath}" -o "${outSvg}"`, {
    stdio: "inherit",
    shell: true,
  });
} catch (e) {
  console.error("mmdc failed. Install: npm i -g @mermaid-js/mermaid-cli");
  process.exit(1);
}

const open =
  process.platform === "win32"
    ? "start"
    : process.platform === "darwin"
      ? "open"
      : "xdg-open";
execSync(`${open} "${outSvg}"`, { stdio: "inherit", shell: true });
console.log("Opened:", outSvg);
