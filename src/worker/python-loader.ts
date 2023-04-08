export const worker = new Worker(new URL(`./python.ts`, import.meta.url), {
    type: "module",
});