#!/usr/bin/env node
/** CLI — talks only to Interaction and Situation contracts (ADR-0017). */
import { createRuntime } from "../../runtime/index.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];
  const arg = args[1];
  const noInteractive = args.includes("--no-interactive");

  const runtime = await createRuntime();
  try {
    switch (command) {
      case "day":
        await runtime.interaction.startDay();
        console.log("Day started — cognitive loop processed.");
        break;

      case "brief": {
        // spec-0004: German briefing with triage and seen-state
        const markdown = await runtime.interaction.briefGerman();
        console.log(markdown);

        // Interactive conversation loop unless --no-interactive is set
        if (!noInteractive && process.stdin.isTTY) {
          await runtime.interaction.runConversation();
        }
        break;
      }

      case "approve":
        if (!arg) {
          console.error("usage: aios approve <recommendation-id>");
          process.exitCode = 1;
          break;
        }
        console.log(await runtime.interaction.approve(arg));
        break;

      default:
        console.error("usage: aios <day|brief [--no-interactive]|approve <id>>");
        process.exitCode = 1;
    }
  } finally {
    await runtime.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
