import lit from "@astrojs/lit";
import { defineConfig } from "astro/config";

export default defineConfig({
  integrations: [lit()],
  site: "https://keanus.org",
  output: "static",
});
