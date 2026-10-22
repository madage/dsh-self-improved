/**
 * 召回注入模块（M3）：在 agent/pre-step 瀑布中，把相关记忆渲染成一条 user 消息
 * 追加进 decision.messages（官方注入正路，仿 dsh-time-context 范式）。
 *
 * 规则：
 * - 仅在 step 1 注入（对话开始前，对齐腾讯 Auto-Recall）；
 * - 按当前用户消息文本做去重缓存（同一消息不重复注入）；
 * - 检索超时/失败 → 跳过注入，绝不阻塞回合；
 * - 注入消息 source: { kind: "plugin", plugin: "dsh-self-improved", form: "snapshot" }（可回放、可审计）。
 */
import type { Context } from "@deepseek-ai/cordis";
import { createUserMessage } from "@deepseek-ai/dsh-llm";
import type { RecallHit } from "./recall.js";
import { renderRecallBlock } from "./recall.js";

/**
 * 0.2.0：MessageSource 是 merge-extensible sum type——每个生产者在自己的模块里声明
 * 自己的 kind（不再有公共的 "plugin" catch-all）。本插件声明 memory-recall，
 * 语义对齐 ContextForm 'recall'（摘自其他会话日志、注入给模型的材料）。
 */
declare module "@deepseek-ai/dsh-llm" {
  interface MessageSourceMap {
    /** dsh-self-improved：回合前注入的相关记忆块 */
    "memory-recall": { kind: "memory-recall"; form: "recall" };
  }
}

/** 结构化最小依赖：只要检索能力（0.2.0 移植：实例可热重建，注入器持稳定代理） */
export interface RecallSearcher {
  search(query: string, options?: { maxResults?: number }): Promise<RecallHit[]>;
}

export interface InjectController {
  enabled(): boolean;
  maxHits: number;
  /** 注入块字符上限（防单次注入撑爆上下文） */
  maxChars?: number;
  debug?: boolean;
}

export function installRecallInjection(ctx: Context, recall: RecallSearcher, controller: InjectController): void {
  // 最近注入过的用户消息（文本 hash → 注入文本），避免同一步/重复消息反复注入
  const injectedCache = new Map<string, string>();
  const CACHE_MAX = 128;

  ctx.on(
    "agent/pre-step",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (payload: any, next: any) => {
      const decision = await next();
      if (decision.kind === "reject" || payload.signal?.aborted) return decision;
      if (!controller.enabled()) return decision;

      // 仅回合第一步注入
      if (payload.step !== 1) return decision;

      // 取本次待处理消息中的最后一条 user 消息作为检索查询
      const query = lastUserText(decision.messages);
      if (controller.debug) console.log("[dsh-self-improved] pre-step query:", JSON.stringify(query.slice(0, 80)), "step:", payload.step);
      if (!query) return decision;
      const cacheKey = hashText(query);
      if (injectedCache.has(cacheKey)) return decision;

      const hits = await recall.search(query, { maxResults: controller.maxHits });
      if (controller.debug) console.log("[dsh-self-improved] recall hits:", hits.length, hits.map((h) => h.kind).join(","));
      let block = renderRecallBlock(hits, controller.maxHits);
      if (controller.maxChars && block.length > controller.maxChars) {
        block = block.slice(0, controller.maxChars) + "\n…（已截断）";
      }
      if (!block) return decision;

      // 缓存并注入（source.kind: "memory-recall"，见文件头部的 MessageSourceMap 增强）
      if (injectedCache.size >= CACHE_MAX) injectedCache.clear();
      injectedCache.set(cacheKey, block);
      return {
        kind: "enter",
        messages: [
          ...decision.messages,
          createUserMessage({
            content: [{ type: "text", text: block }],
            source: { kind: "memory-recall", form: "recall" },
          }),
        ],
      };
    },
    { prepend: true },
  );
}

/** 从待处理消息中取最后一条"真实用户消息"的文本（用于检索；跳过插件注入/快照类 user 消息） */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lastUserText(messages: any[] | undefined): string {
  if (!Array.isArray(messages)) return "";
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (!msg || msg.role !== "user") continue;
    const src = msg.source;
    // 跳过系统/插件注入的 user 消息（运行时上下文、AGENTS.md 指令、技能目录、召回快照等）
    if (src) {
      const form = (src as { form?: unknown }).form;
      const kind = String((src as { kind?: unknown }).kind ?? "");
      if (
        // 本插件注入的记忆块（0.2.0 起自有 kind）
        kind === "memory-recall" ||
        // 其他系统/插件注入的 user 消息（未知/已知生产者一律跳过）
        kind === "plugin" ||
        kind === "agent-instructions" ||
        kind === "skill-catalog" ||
        kind === "skill-invocation" ||
        form === "snapshot"
      ) {
        continue;
      }
    }
    const content = msg.content;
    if (Array.isArray(content)) {
      const texts = content
        .filter((b: { type?: string; text?: unknown }) => b && b.type === "text" && typeof b.text === "string")
        .map((b: { text: string }) => b.text);
      if (texts.length > 0) return texts.join("\n");
    }
    if (typeof content === "string") return content;
  }
  return "";
}

function hashText(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return String(hash);
}
