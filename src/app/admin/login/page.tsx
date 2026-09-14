import { signIn } from "@/auth";

export default function AdminLoginPage() {
  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="text-xl font-medium">後台登入</h1>
      <p className="mt-2 text-sm text-neutral-500">
        輸入白名單信箱，我們會寄一封 10 分鐘內有效的登入連結給你。
      </p>
      <form
        action={async (formData) => {
          "use server";
          await signIn("nodemailer", formData);
        }}
        className="mt-4 flex flex-col gap-2"
      >
        <input
          type="email"
          name="email"
          required
          placeholder="you@example.com"
          className="rounded border px-3 py-2"
        />
        <button type="submit" className="rounded border px-3 py-2">
          寄送登入連結
        </button>
      </form>
    </main>
  );
}
