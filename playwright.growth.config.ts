import base from "./playwright.config";
import { readFileSync } from "node:fs";
import path from "node:path";
if (!process.env.GROWTH_QA_FOLDER)
  throw Error("GROWTH_QA_FOLDER required; never run this against production");
export default {
  ...base,
  use: {
    ...base.use,
    extraHTTPHeaders: {
      "X-Pappy-QA": readFileSync(
        path.join(process.env.GROWTH_QA_FOLDER, "access-token"),
        "utf8",
      ).trim(),
    },
  },
  projects: base.projects,
};
