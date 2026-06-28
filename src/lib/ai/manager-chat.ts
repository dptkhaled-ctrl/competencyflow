import { callOpenAI } from "@/lib/ai/client";
import type { ManagerIntelligenceContext } from "@/lib/ai/manager-context";
import { buildManagerUserPrompt, MANAGER_SYSTEM_PROMPT } from "@/lib/ai/prompts";

export interface ManagerChatAction {
  type: "assign_lesson" | "create_lesson" | "assign_domain";
  lessonId?: string;
  userIds?: string[];
  materialId?: string;
  topic?: string;
  assignToUserIds?: string[];
  domainId?: string;
}

export interface ManagerChatResult {
  answer: string;
  actions: ManagerChatAction[];
}

function parseManagerJson(content: string): ManagerChatResult {
  const jsonMatch = content.trim().match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("AI did not return valid JSON");

  const parsed = JSON.parse(jsonMatch[0]) as {
    answer?: string;
    actions?: ManagerChatAction[];
  };

  const actions = (parsed.actions ?? []).filter((a) => {
    if (a.type === "assign_lesson") {
      return Boolean(a.lessonId && a.userIds?.length);
    }
    if (a.type === "create_lesson") {
      return Boolean(a.materialId && a.topic?.trim());
    }
    if (a.type === "assign_domain") {
      return Boolean(a.domainId && a.userIds?.length);
    }
    return false;
  });

  return {
    answer: parsed.answer?.trim() || "I couldn't process that request. Please try again.",
    actions,
  };
}

export async function generateManagerChatResponse(
  context: ManagerIntelligenceContext,
  message: string
): Promise<ManagerChatResult> {
  const content = await callOpenAI({
    system: MANAGER_SYSTEM_PROMPT,
    user: buildManagerUserPrompt(context, message),
    jsonMode: true,
    temperature: 0.25,
    maxTokens: 2200,
  });

  return parseManagerJson(content);
}