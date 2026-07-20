#!/usr/bin/env node
/** CLI — talks only to Interaction (input/render); reads come via Situation internally. */
import { createRuntime } from "../../runtime/index.js";

async function main(): Promise<void> {
  const [command, arg] = process.argv.slice(2);
  const runtime = await createRuntime();
  try {
    switch (command) {
      case "day":
        await runtime.interaction.startDay();
        console.log("Day started — cognitive loop processed.");
        break;
      case "brief":
        console.log(await runtime.interaction.brief());
        break;
      case "approve":
        if (!arg) {
          console.error("usage: aios approve <recommendation-id>");
          process.exitCode = 1;
          break;
        }
        console.log(await runtime.interaction.approve(arg));
        break;
      default:
        console.error("usage: aios <day|brief|approve <id>>");
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
