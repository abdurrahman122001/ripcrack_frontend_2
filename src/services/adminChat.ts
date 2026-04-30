// ===============================
// ADMIN CHAT HELPERS (Sessions + FAQ)
// ===============================
// These are the chat-related admin functions extracted from your admin logic.

type AdminChatStatus = "BOT" | "WAITING_FOR_HUMAN" | "HUMAN" | "CLOSED";
type GatewayFetch = (path: string, init?: RequestInit) => Promise<any>;

// Sessions
export async function refreshChatSessions(
  gatewayFetch: GatewayFetch,
  statusFilter?: string
) {
  const params = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : "";
  const json = await gatewayFetch(`/admin/chat/sessions${params}`, { method: "GET" });
  return json?.items || [];
}

export async function loadChatSession(gatewayFetch: GatewayFetch, sessionId: string) {
  const json = await gatewayFetch(`/admin/chat/sessions/${sessionId}`, { method: "GET" });
  return json?.item || null; // item.messages contains messages
}

export async function sendAdminMessage(
  gatewayFetch: GatewayFetch,
  sessionId: string,
  text: string
) {
  await gatewayFetch(`/admin/chat/sessions/${sessionId}/message`, {
    method: "POST",
    body: JSON.stringify({ text: text.trim() }),
  });
}

export async function updateChatStatus(
  gatewayFetch: GatewayFetch,
  sessionId: string,
  status: AdminChatStatus
) {
  await gatewayFetch(`/admin/chat/sessions/${sessionId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

// FAQs
export async function listChatFAQs(gatewayFetch: GatewayFetch) {
  const json = await gatewayFetch("/admin/chat/faqs", { method: "GET" });
  return json?.items || [];
}

export async function createChatFAQ(
  gatewayFetch: GatewayFetch,
  payload: {
    question: string;
    answer: string;
    keywords?: string[]; // already split
    sortOrder?: number;
    active?: boolean;
  }
) {
  await gatewayFetch("/admin/chat/faqs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateChatFAQ(
  gatewayFetch: GatewayFetch,
  id: number,
  payload: {
    question: string;
    answer: string;
    keywords?: string[];
    sortOrder?: number;
    active?: boolean;
  }
) {
  await gatewayFetch(`/admin/chat/faqs/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteChatFAQ(gatewayFetch: GatewayFetch, id: number) {
  await gatewayFetch(`/admin/chat/faqs/${id}`, { method: "DELETE" });
}

