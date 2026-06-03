import { z } from "zod";

const uuidOptional = z.string().uuid().optional().nullable();

export const multiAgentCreateFieldsSchema = z.object({
  multi_agent_enabled: z.boolean().optional(),
  multi_agent_assignment_mode: z
    .enum(["same_agent", "org_default_team", "smart_assignment", "manual"])
    .optional(),
  primary_presenter_agent_id: uuidOptional,
  qualification_agent_id: uuidOptional,
  objection_agent_id: uuidOptional,
  booking_agent_id: uuidOptional,
  crm_summary_agent_id: uuidOptional,
  handoff_agent_id: uuidOptional,
  follow_up_agent_id: uuidOptional,
});

export type MultiAgentCreateFields = z.infer<typeof multiAgentCreateFieldsSchema>;
