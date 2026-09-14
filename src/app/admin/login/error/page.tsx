export default async function LoginErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  // 登入失敗訊息不區分「信箱不存在」與「不在白名單」，一律顯示同一段文字，
  // 避免帳號枚舉 — SPEC.md §12.9
  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="text-xl font-medium">登入失敗</h1>
      <p className="mt-2 text-sm text-neutral-500">
        連結無效、已過期，或此信箱沒有登入權限。請確認信箱後重新登入。
      </p>
      {error && <p className="mt-1 text-xs text-neutral-400">({error})</p>}
      <a href="/admin/login" className="mt-4 inline-block underline">
        回到登入頁
      </a>
    </main>
  );
}
