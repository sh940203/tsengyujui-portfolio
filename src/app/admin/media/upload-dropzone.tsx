"use client";

import { useRef, useState } from "react";
import type { media } from "@/lib/db/schema";
import { finalizeMediaUpload, requestMediaUploadUrl } from "./actions";

type MediaRow = typeof media.$inferSelect;

interface UploadState {
  filename: string;
  status: "uploading" | "processing" | "done" | "error";
  error?: string;
}

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function UploadDropzone({ onUploaded }: { onUploaded: (item: MediaRow) => void }) {
  const [dragOver, setDragOver] = useState(false);
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  async function uploadOne(file: File) {
    setUploads((prev) => [...prev, { filename: file.name, status: "uploading" }]);
    const setStatus = (status: UploadState["status"], error?: string) =>
      setUploads((prev) =>
        prev.map((u) => (u.filename === file.name ? { ...u, status, error } : u)),
      );

    try {
      if (!ALLOWED_TYPES.has(file.type)) {
        throw new Error("不支援的檔案格式（僅限 jpg/png/webp）");
      }

      const { uploadUrl, stagingKey } = await requestMediaUploadUrl({
        filename: file.name,
        contentType: file.type,
        contentLength: file.size,
      });

      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!putRes.ok) throw new Error(`上傳失敗（${putRes.status}）`);

      setStatus("processing");
      const row = await finalizeMediaUpload({
        stagingKey,
        filename: file.name,
        mimeType: file.type as "image/jpeg" | "image/png" | "image/webp",
        fileSize: file.size,
      });

      onUploaded(row);
      setStatus("done");
    } catch (err) {
      setStatus("error", err instanceof Error ? err.message : String(err));
    }
  }

  function handleFiles(fileList: FileList | null) {
    if (!fileList) return;
    for (const file of Array.from(fileList)) {
      void uploadOne(file);
    }
  }

  return (
    <div>
      <div
        className={`rounded border-2 border-dashed p-8 text-center text-sm ${
          dragOver ? "border-blue-500 bg-blue-50" : "border-neutral-300"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
      >
        拖放圖片到這裡，或點擊選擇檔案（可多選，jpg/png/webp）
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {uploads.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs">
          {uploads.map((u, i) => (
            <li key={`${u.filename}-${i}`}>
              {u.filename} —{" "}
              {u.status === "uploading" && "上傳中…"}
              {u.status === "processing" && "處理中（生成尺寸變體）…"}
              {u.status === "done" && "完成"}
              {u.status === "error" && <span className="text-red-600">失敗：{u.error}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
