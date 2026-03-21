export default function Loading() {
    return (
        <main className="mx-auto max-w-7xl px-6 py-10 animate-pulse">
            <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-3">
                    <div className="h-4 w-20 rounded bg-zinc-200" />
                    <div className="h-10 w-56 rounded bg-zinc-200" />
                    <div className="h-4 w-72 rounded bg-zinc-200" />
                </div>

                <div className="h-10 w-32 rounded-xl bg-zinc-200" />
            </div>

            <div className="mb-8 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="h-5 w-28 rounded bg-zinc-200" />
                <div className="mt-4 h-4 w-full rounded bg-zinc-100" />
                <div className="mt-2 h-4 w-2/3 rounded bg-zinc-100" />
            </div>

            <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, idx) => (
                    <div
                        key={idx}
                        className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
                    >
                        <div className="h-4 w-24 rounded bg-zinc-200" />
                        <div className="mt-3 h-8 w-20 rounded bg-zinc-100" />
                    </div>
                ))}
            </section>

            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                <div className="h-6 w-40 rounded bg-zinc-200" />
                <div className="mt-4 h-80 rounded bg-zinc-100" />
            </div>
        </main>
    );
}