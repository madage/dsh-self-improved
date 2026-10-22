/**
 * L0 捕获模块（M1/M2）：把会话事件流归一化为提取管线输入切片（JSONL），
 * 在 session/flush 持久化屏障内落盘并标记提取队列水位。
 *
 * 设计对齐：docs/design/dsh-memory-plugin-design.md §4.3
 */
import type { Context } from "@deepseek-ai/cordis";
import { SessionLogOffset } from "@deepseek-ai/dsh-session";
import type { MemoryStore, ConversationSliceRecord } from "./storage.js";

export interface CaptureController {
  /** 当前是否启用（总开关 && capture 模块开关） */
  enabled(): boolean;
}

/**
 * 安装捕获监听器。
 * @param onCaptured 落盘并标记队列后调用；若返回 Promise 且被 await，会阻塞 flush（headless 收尾用）
 */
export function installCapture(
  ctx: Context,
  store: MemoryStore,
  controller: CaptureController,
  onCaptured?: () => void | Promise<unknown>,
): void {
  // 每会话已写到的最大 seq（进程内游标；权威防重由 DSH 事件 seq 保证）
  const lastWritten = new Map<string, number>();

  ctx.on("session/flush", async (session) => {
    if (!controller.enabled()) return;
    const floor = lastWritten.get(session.id) ?? 0;
    const records: ConversationSliceRecord[] = [];
    // 0.2.0：Session 不再暴露 events 字段，改用 snapshotEvents(fromSeq)（半开区间，fromSeq 含）。
    // 权威防重仍由 seq 水位保证：floor 之后（含）才是本轮新事件。
    for (const event of session.snapshotEvents(SessionLogOffset(floor === 0 ? 0 : floor + 1))) {
      const slice = toSlice(session.id, event);
      if (slice) records.push(slice);
    }
    if (records.length > 0) {
      store.appendConversationSlice(session.id, records);
      const maxSeq = records[records.length - 1].seq;
      store.markPending(session.id, maxSeq);
      lastWritten.set(session.id, maxSeq);
    }
    if (onCaptured) {
      const result = onCaptured();
      if (result instanceof Promise) await result;
    }
  });
}

/** 把会话事件转成切片记录；非文本事件（如 turn/start、tool/call）返回 null */
function toSlice(sessionId: string, event: SessionEventLike): ConversationSliceRecord | null {
  const ts = typeof event.time === "number" ? event.time : Date.now();
  const data = event.data as Record<string, unknown> | undefined;
  switch (event.type) {
    case "user/message": {
      const text = textOfContent(data?.content);
      return text ? { type: "user", seq: event.seq, ts, text, sessionId } : null;
    }
    case "assistant/message": {
      const message = (data?.message ?? data) as Record<string, unknown> | undefined;
      const text = textOfContent(message?.content);
      return text ? { type: "assistant", seq: event.seq, ts, text, sessionId } : null;
    }
    case "tool/result": {
      const message = data?.message as Record<string, unknown> | undefined;
      const text = textOfContent(message?.content);
      if (!text) return null;
      return { type: "tool", seq: event.seq, ts, text, sessionId };
    }
    default:
      return null;
  }
}

/** 从 LLM 消息 content 块数组（或字符串）中提取纯文本 */
function textOfContent(content: unknown): string {
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const block of content) {
      if (block && typeof block === "object" && typeof (block as { text?: unknown }).text === "string") {
        parts.push((block as { text: string }).text);
      }
    }
    return parts.join("\n").trim();
  }
  if (typeof content === "string") return content.trim();
  return "";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SessionEventLike = { type: string; seq: number; time?: number; data?: any };
