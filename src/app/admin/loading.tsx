import { Skeleton } from "@/components/admin/ui/primitives";

/** 換頁時立刻顯示的骨架（伺服器還在查資料時，畫面不會卡在上一頁不動）。 */
export default function AdminLoading() {
  return (
    <div aria-busy="true" aria-label="載入中">
      <Skeleton className="mb-3 h-4 w-20" />
      <Skeleton className="mb-2 h-8 w-56" />
      <Skeleton className="mb-8 h-4 w-80 max-w-full" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-stone-200/80 bg-white p-4">
            <Skeleton className="mb-4 aspect-[4/3] w-full rounded-xl" />
            <Skeleton className="mb-2 h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
