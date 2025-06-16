import { z } from "zod";
import { createSubjects } from "@openauthjs/openauth/subject";

export const server = {
	SERVER_URL: z.string().url().optional(),
};

export const userSchema = z.object({
	userId: z.string(),
	username: z.string(),
});

export type User = z.infer<typeof userSchema>;

export const subject = createSubjects({
	user: userSchema,
});
