import { z } from "zod";
import { IdeaStatus } from "@/lib/domain/idea-state-machine";
import { ProjectProfileStatus } from "@/lib/domain/profile-state-machine";
import { TaskStatus } from "@/lib/domain/task-state-machine";
import { AwardStatus } from "@/lib/domain/award-state-machine";

export const ideasExportQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  status: z
    .string()
    .trim()
    .refine(
      (val) => !val || Object.values(IdeaStatus).includes(val as IdeaStatus),
      { message: "Trạng thái ý tưởng không hợp lệ." }
    )
    .optional(),
  sort: z.enum(["createdAt", "updatedAt", "title"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),
});

export type IdeasExportQuery = z.infer<typeof ideasExportQuerySchema>;

export const profilesExportQuerySchema = z.object({
  q: z.string().trim().max(200).optional().default(""),
  status: z
    .string()
    .trim()
    .refine(
      (val) => !val || Object.values(ProjectProfileStatus).includes(val as ProjectProfileStatus),
      { message: "Trạng thái hồ sơ đề tài không hợp lệ." }
    )
    .optional(),
});

export type ProfilesExportQuery = z.infer<typeof profilesExportQuerySchema>;

export const tasksExportQuerySchema = z.object({
  q: z.string().trim().max(200).optional().default(""),
  status: z
    .string()
    .trim()
    .refine(
      (val) => !val || Object.values(TaskStatus).includes(val as TaskStatus),
      { message: "Trạng thái nhiệm vụ không hợp lệ." }
    )
    .optional(),
});

export type TasksExportQuery = z.infer<typeof tasksExportQuerySchema>;

export const awardsExportQuerySchema = z.object({
  q: z.string().trim().max(200).optional().default(""),
  status: z
    .string()
    .trim()
    .refine(
      (val) => !val || Object.values(AwardStatus).includes(val as AwardStatus),
      { message: "Trạng thái giải thưởng không hợp lệ." }
    )
    .optional(),
  seasonId: z.string().trim().max(100).optional(),
  isDemo: z.enum(["true", "false"]).optional(),
});

export type AwardsExportQuery = z.infer<typeof awardsExportQuerySchema>;
