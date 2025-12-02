import { supabase } from "./supabase";

export type AIUsefulFlag = "useful" | "not_useful";

interface BaseFeedback {
  user_id?: string | null;
  condominio_id?: string | null;
  created_at?: string;
}

export interface ChatbotFeedback extends BaseFeedback {
  context: "chatbot";
  question: string;
  answer?: string;
  source_title?: string;
  source_type?: "faq" | "document" | string;
  useful: boolean;
}

export interface FAQFeedback extends BaseFeedback {
  context: "faq";
  faq_id: number;
  question: string;
  useful: boolean;
}

export async function recordAIResponseFeedback(
  payload: ChatbotFeedback | FAQFeedback,
) {
  const row = {
    context: payload.context,
    useful: payload.useful,
    question: "question" in payload ? payload.question : undefined,
    answer: "answer" in payload ? payload.answer : undefined,
    source_title: "source_title" in payload ? payload.source_title : undefined,
    source_type: "source_type" in payload ? payload.source_type : undefined,
    faq_id: "faq_id" in payload ? payload.faq_id : undefined,
    user_id: payload.user_id || null,
    condominio_id: payload.condominio_id || null,
    created_at: payload.created_at || new Date().toISOString(),
  };

  const { error } = await supabase.from("ai_feedback").insert(row);
  if (error) throw error;
}
