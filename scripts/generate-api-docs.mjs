import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

async function main() {
  const root = process.cwd();
  const contractsPath = path.join(root, "docs", "contracts.json");
  const outputPath = path.join(root, "docs", "api-reference.md");

  const contractsRaw = await readFile(contractsPath, "utf8");
  const contracts = JSON.parse(contractsRaw);

  const lines = [];
  lines.push("# Founder GPS API Reference");
  lines.push("");
  lines.push(`Generated from docs/contracts.json (version ${contracts.version}).`);
  lines.push("");
  lines.push("## Error Model");
  lines.push("");
  lines.push("All services use a shared envelope:");
  lines.push("");
  lines.push("```json");
  lines.push('{ "error": { "code": "VALIDATION_ERROR", "message": "Human readable message", "details": {} } }');
  lines.push("```");
  lines.push("");

  for (const service of contracts.services) {
    lines.push(`## ${service.name}`);
    lines.push("");
    lines.push(`Base path: ${service.basePath}`);
    lines.push("");

    for (const endpoint of service.endpoints) {
      lines.push(`### ${endpoint.method} ${endpoint.path}`);
      lines.push("");
      lines.push(`- Summary: ${endpoint.summary}`);
      lines.push(`- Request contract: ${endpoint.requestContract}`);
      lines.push(`- Success contract: ${endpoint.successContract}`);
      lines.push(
        `- Error codes: ${endpoint.errorCodes.length > 0 ? endpoint.errorCodes.join(", ") : "None"}`
      );
      lines.push("");
    }
  }

  await writeFile(outputPath, `${lines.join("\n")}\n`, "utf8");
  console.log(`Generated ${path.relative(root, outputPath)}`);
}

main().catch((error) => {
  console.error("Failed to generate API docs", error);
  process.exitCode = 1;
});
