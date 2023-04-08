export const worker = new Worker(new URL(`./cpp.ts`, import.meta.url), {
    type: "module",
});