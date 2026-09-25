// Lets `node --test` run the TypeScript unit tests without a bundler or extra
// dependency: Node strips the types itself; this hook only resolves the
// "@/..." path alias and extension-less relative imports the app uses.
import { register } from "node:module";

register(new URL("./resolve-hook.mjs", import.meta.url));
