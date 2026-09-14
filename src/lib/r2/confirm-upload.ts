import "server-only";
import { DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { fileTypeFromBuffer } from "file-type";
import { r2 } from "./client";
import { ALLOWED_MIME_TYPES, UploadValidationError } from "./presign";

async function streamToBuffer(stream: AsyncIterable<Uint8Array>): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

/**
 * Step 4 of SPEC.md §12.4's upload validation order: extension and
 * Content-Type headers can be forged by the client, so after a direct-to-R2
 * upload completes we re-read the object's real magic bytes server-side.
 * A mismatch deletes the object immediately rather than leaving bad content
 * sitting in the bucket.
 */
export async function verifyUploadedObject(bucket: string, key: string) {
  const res = await r2.send(
    new GetObjectCommand({ Bucket: bucket, Key: key, Range: "bytes=0-4100" }),
  );
  const head = await streamToBuffer(res.Body as AsyncIterable<Uint8Array>);
  const detected = await fileTypeFromBuffer(head);

  if (!detected || !ALLOWED_MIME_TYPES.has(detected.mime)) {
    await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    throw new UploadValidationError("INVALID_FILE_CONTENT");
  }

  return detected;
}

export async function getObjectBuffer(bucket: string, key: string): Promise<Buffer> {
  const res = await r2.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  return streamToBuffer(res.Body as AsyncIterable<Uint8Array>);
}

export async function deleteObject(bucket: string, key: string): Promise<void> {
  await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
