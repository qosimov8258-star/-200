import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-sm font-medium text-brand-600">404</p>
      <h1 className="text-xl font-semibold text-slate-900">Sahifa topilmadi</h1>
      <p className="text-sm text-slate-500">Bu bo&apos;lim mavjud emas yoki hali qo&apos;shilmagan.</p>
      <Link
        href="/"
        className="mt-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        Bosh sahifaga qaytish
      </Link>
    </main>
  );
}
