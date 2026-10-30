import { z } from "zod";

const id = z.string().min(1);

export const generatedMysterySchema = z.object({
  story: z.string().min(100).max(5000),
  suspects: z
    .array(
      z.object({
        name: z.string().min(2).max(80),
        bio: z.string().min(20).max(1000),
        isCulprit: z.boolean()
      })
    )
    .min(3)
    .max(6),
  clues: z
    .array(z.object({ text: z.string().min(15).max(500) }))
    .min(4)
    .max(10),
  hints: z
    .array(z.object({ text: z.string().min(10).max(300) }))
    .min(2)
    .max(5),
  solution: z.object({
    culpritIndex: z.number().int().nonnegative(),
    explanation: z.string().min(30).max(2000),
    logicChain: z.array(z.string().min(10).max(500)).min(2).max(6)
  })
});

export const createCaseSchema = z.object({
  premise: z.string().trim().min(10).max(300),
  difficulty: z.enum(["easy", "medium", "hard"])
});

export const caseIdSchema = id;
export const suspectIdSchema = z.object({ suspectId: id });
export const accusationSchema = z.object({
  suspectId: id,
  reasoning: z.string().trim().max(1000).optional().default("")
});
