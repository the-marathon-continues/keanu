import { defineCollection, z } from "astro:content";

const paper = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string().optional(),
    order: z.number().optional(),
  }),
});

export const collections = { paper };
