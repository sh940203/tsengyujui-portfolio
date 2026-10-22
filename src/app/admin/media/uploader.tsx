"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AdminMediaKind } from "@/components/admin/media-meta";
import { IconAlert, IconCheck, IconUpload, IconX } from "@/components/admin/ui/icons";
import { Spinner } from "@/components/admin/ui/primitives";
import { cn } from "@/components/admin/ui/styles";
import { finalizeMediaUpload, requestMediaUploadUrl, updateMediaDetails } from "./actions";

/**
 * 上傳（2026-10-22 改版）：
 * - 真正的上傳進度條（XHR 的 upload progress；原本 fetch 只有「上傳中…」文字，大檔案不知道卡住沒）
 * - 一次最多 3 個檔案同時傳，其餘排隊
 * - 上傳完直接歸到「目前篩選的系列／類型」（在 Cumedy 篩選下上傳，就直接進 Cumedy），
 *   不用傳完再一張張指派
 * - 整個頁面都能拖放檔案（不用瞄準一個小框框）
 */

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 25 * 1024 * 1024;
const CONCURRENCY = 3;

export interface QueueItem {
  key: number;
  name: string;
  size: number;
  progress: number;
  status: "queued" | "uploading" | "processing" | "done" | "error";
  error?: string;
}

type UploadedRow = Awaited<ReturnType<typeof finalizeMediaUpload>>;

function putWithProgress(url: string, file: File, onProgress: (p: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`上傳失敗（${xhr.status}）`)));
    xhr.onerror = () => reject(new Error("網路中斷，上傳失敗"));
    xhr.send(file);
  });
}

export function useUploader(onUploaded: (row: UploadedRow) => void) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const keyRef = useRef(0);
  const onUploadedRef = useRef(onUploaded);
  onUploadedRef.current = onUploaded;

  const patch = (key: number, p: Partial<QueueItem>) =>
    setQueue((prev) => prev.map((q) => (q.key === key ? { ...q, ...p } : q)));

  const upload = useCallback(async (files: File[], target: { collectionId: string | null; kind: AdminMediaKind }) => {
    const jobs = files.map((file) => ({ file, key: ++keyRef.current }));
    setQueue((prev) => [
      ...prev.filter((q) => q.status !== "done"),
      ...jobs.map(({ file, key }) => ({ key, name: file.name, size: file.size, progress: 0, status: "queued" as const })),
    ]);

    async function run({ file, key }: { file: File; key: number }) {
      try {
        if (!ALLOWED.has(file.type)) throw new Error("只支援 JPG、PNG、WebP");
        if (file.size > MAX_BYTES) throw new Error("檔案超過 25 MB");
        patch(key, { status: "uploading" });
        const { uploadUrl, stagingKey } = await requestMediaUploadUrl({
          filename: file.name,
          contentType: file.type,
          contentLength: file.size,
        });
        await putWithProgress(uploadUrl, file, (p) => patch(key, { progress: p }));
        patch(key, { status: "processing", progress: 1 });
        let row = await finalizeMediaUpload({
          stagingKey,
          filename: file.name,
          mimeType: file.type as "image/jpeg" | "image/png" | "image/webp",
          fileSize: file.size,
        });
        if (target.collectionId || target.kind !== "misc") {
          const result = await updateMediaDetails({
            mediaId: row.id,
            kind: target.kind,
            collectionId: target.collectionId,
            altEn: "",
            altZh: "",
            focalX: 0.5,
            focalY: 0.5,
          });
          if (result.ok) row = { ...row, kind: target.kind, collectionId: target.collectionId };
        }
        onUploadedRef.current(row);
        patch(key, { status: "done" });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        patch(key, { status: "error", error: message.includes("RATE_LIMITED") ? "上傳太頻繁，請稍後再試" : message });
      }
    }

    const pending = [...jobs];
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, pending.length) }, async () => {
        while (pending.length) await run(pending.shift()!);
      }),
    );
  }, []);

  const clear = useCallback(() => setQueue((prev) => prev.filter((q) => q.status === "uploading" || q.status === "processing" || q.status === "queued")), []);

  return { queue, upload, clear };
}

function formatSize(bytes: number) {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

export function UploadQueuePanel({ queue, onClose }: { queue: QueueItem[]; onClose: () => void }) {
  const active = queue.filter((q) => q.status !== "done" && q.status !== "error").length;
  const done = queue.filter((q) => q.status === "done").length;
  const failed = queue.filter((q) => q.status === "error").length;

  // 全部成功後幾秒自動收起；有失敗的就留著讓人看清楚
  useEffect(() => {
    if (queue.length === 0 || active > 0 || failed > 0) return;
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [queue.length, active, failed, onClose]);

  if (queue.length === 0) return null;
  return (
    <div className="admin-toast-in fixed bottom-4 right-4 z-[60] w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl shadow-stone-900/15">
      <div className="flex items-center gap-2 border-b border-stone-100 px-4 py-3">
        {active > 0 ? <Spinner size={16} className="text-stone-500" /> : <IconCheck size={16} className="text-emerald-600" />}
        <p className="flex-1 text-sm font-medium text-stone-900">
          {active > 0 ? `上傳中（${done}/${queue.length}）` : `已上傳 ${done} 張${failed ? `，${failed} 張失敗` : ""}`}
        </p>
        {active === 0 && (
          <button type="button" onClick={onClose} aria-label="關閉" className="grid h-8 w-8 place-items-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-900">
            <IconX size={16} />
          </button>
        )}
      </div>
      <ul className="max-h-64 overflow-y-auto px-4 py-2">
        {queue.map((q) => (
          <li key={q.key} className="py-2">
            <div className="flex items-center gap-2 text-[13px]">
              <span className="min-w-0 flex-1 truncate text-stone-700">{q.name}</span>
              <span className={cn("shrink-0 text-xs", q.status === "error" ? "text-red-600" : "text-stone-400")}>
                {q.status === "queued" && "等待中"}
                {q.status === "uploading" && `${Math.round(q.progress * 100)}%`}
                {q.status === "processing" && "產生尺寸中…"}
                {q.status === "done" && <IconCheck size={14} className="text-emerald-600" />}
                {q.status === "error" && <IconAlert size={14} />}
              </span>
            </div>
            {q.status === "error" ? (
              <p className="mt-1 text-xs text-red-600">{q.error}</p>
            ) : (
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-stone-100">
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-300",
                    q.status === "done" ? "bg-emerald-500" : q.status === "processing" ? "admin-shimmer bg-stone-500" : "bg-stone-900",
                  )}
                  style={{ width: `${q.status === "queued" ? 0 : Math.max(4, q.progress * 100)}%` }}
                />
              </div>
            )}
            <p className="mt-1 text-[11px] text-stone-400">{formatSize(q.size)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 整頁拖放：把檔案拖進視窗任何地方都會出現提示，放開就上傳。 */
export function PageDropZone({ onFiles, targetLabel }: { onFiles: (files: File[]) => void; targetLabel: string }) {
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  const onFilesRef = useRef(onFiles);
  onFilesRef.current = onFiles;

  useEffect(() => {
    const hasFiles = (e: DragEvent) => !!e.dataTransfer && [...e.dataTransfer.types].includes("Files");
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current += 1;
      setOver(true);
    };
    const onOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setOver(false);
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current = 0;
      setOver(false);
      const files = [...(e.dataTransfer?.files ?? [])];
      if (files.length) onFilesRef.current(files);
    };
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-0 z-[75] grid place-items-center bg-stone-950/40 p-6 backdrop-blur-sm transition-opacity duration-200",
        over ? "opacity-100" : "opacity-0",
      )}
      aria-hidden="true"
    >
      <div
        className={cn(
          "flex w-full max-w-md flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-white/70 bg-white/10 px-8 py-14 text-center text-white transition-transform duration-200",
          over ? "scale-100" : "scale-95",
        )}
      >
        <span className="grid h-14 w-14 place-items-center rounded-full bg-white text-stone-900">
          <IconUpload size={24} />
        </span>
        <p className="text-lg font-semibold">放開即可上傳</p>
        <p className="text-sm text-white/80">會放進：{targetLabel}</p>
      </div>
    </div>
  );
}
