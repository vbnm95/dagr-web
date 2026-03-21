import Link from "next/link";
import Overlap2DView from "@/components/Overlap2DView";
import Dagr3DCompare from "@/components/Dagr3DCompare";
import { getApiBaseUrl, getJobMeta, getJobResult } from "@/lib/api";

function formatPercent(value: number | undefined) {
    if (typeof value !== "number" || Number.isNaN(value)) return "-";
    return `${(value * 100).toFixed(1)}%`;
}

function SummaryCard({
    title,
    value,
}: {
    title: string;
    value: string | number;
}) {
    return (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-zinc-500">{title}</div>
            <div className="mt-2 text-2xl font-semibold">{value}</div>
        </div>
    );
}

export default async function JobResultPage({
    params,
}: {
    params: Promise<{ jobId: string }>;
}) {
    const { jobId } = await params;
    const apiBase = getApiBaseUrl();

    try {
        const [meta, result] = await Promise.all([
            getJobMeta(jobId),
            getJobResult(jobId),
        ]);

        const inputs =
            typeof meta === "object" &&
                meta !== null &&
                "inputs" in meta &&
                typeof (meta as Record<string, unknown>).inputs === "object" &&
                (meta as Record<string, unknown>).inputs !== null
                ? ((meta as Record<string, unknown>).inputs as Record<string, unknown>)
                : undefined;

        const method =
            typeof inputs?.method === "string" ? inputs.method : "-";

        const chainA =
            typeof inputs?.chain_a === "string" ? inputs.chain_a : undefined;

        const chainB =
            typeof inputs?.chain_b === "string" ? inputs.chain_b : undefined;

        return (
            <main className="mx-auto max-w-7xl px-6 py-10">
                <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <div className="text-sm text-zinc-500">Job ID</div>
                        <h1 className="mt-1 text-3xl font-bold tracking-tight">{jobId}</h1>
                        <p className="mt-2 text-sm text-zinc-600">
                            status:{" "}
                            <span className="font-medium">{meta.status ?? "unknown"}</span>
                            {" · "}
                            method: <span className="font-medium">{method}</span>
                            {" · "}
                            dcut:{" "}
                            <span className="font-medium">
                                {String(result.dcut ?? "-")}
                            </span>
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <Link
                            href="/"
                            className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700"
                        >
                            새 작업 만들기
                        </Link>

                        <a
                            href={`${apiBase}/v1/jobs/${jobId}/result`}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
                        >
                            JSON 열기
                        </a>
                    </div>
                </div>

                <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <SummaryCard
                        title="Coverage"
                        value={formatPercent(result.coverage_fraction)}
                    />
                    <SummaryCard
                        title="Overlap"
                        value={formatPercent(result.overlap_fraction)}
                    />
                    <SummaryCard
                        title="Hinge Count"
                        value={result.hinge_count ?? "-"}
                    />
                    <SummaryCard
                        title="Uncovered Count"
                        value={result.uncovered_count ?? "-"}
                    />
                </section>

                <section className="mb-8 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                    <h2 className="text-lg font-semibold">Result Summary</h2>

                    <div className="mt-4 grid gap-3 text-sm text-zinc-700 md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-xl bg-zinc-50 p-4">
                            <div className="text-zinc-500">Matched residues</div>
                            <div className="mt-1 text-lg font-semibold">
                                {result.n_residues ?? result.matched_labels_a?.length ?? "-"}
                            </div>
                        </div>

                        <div className="rounded-xl bg-zinc-50 p-4">
                            <div className="text-zinc-500">Selected domains</div>
                            <div className="mt-1 text-lg font-semibold">
                                {Array.isArray(result.selected_domains)
                                    ? result.selected_domains.length
                                    : "-"}
                            </div>
                        </div>

                        <div className="rounded-xl bg-zinc-50 p-4">
                            <div className="text-zinc-500">Chain A</div>
                            <div className="mt-1 text-lg font-semibold">
                                {chainA ?? "-"}
                            </div>
                        </div>

                        <div className="rounded-xl bg-zinc-50 p-4">
                            <div className="text-zinc-500">Chain B</div>
                            <div className="mt-1 text-lg font-semibold">
                                {chainB ?? "-"}
                            </div>
                        </div>
                    </div>
                </section>

                <div className="mb-8">
                    <Overlap2DView result={result} />
                </div>

                <Dagr3DCompare
                    jobId={jobId}
                    result={result}
                    chainA={chainA}
                    chainB={chainB}
                />
            </main>
        );
    } catch (err) {
        const message =
            err instanceof Error ? err.message : "결과를 불러오지 못했습니다.";

        return (
            <main className="mx-auto max-w-3xl px-6 py-10">
                <h1 className="text-2xl font-bold">결과를 불러오지 못했습니다</h1>
                <p className="mt-3 text-sm text-red-600">{message}</p>
                <p className="mt-2 text-sm text-zinc-600">Job ID: {jobId}</p>

                <div className="mt-6 flex gap-3">
                    <Link
                        href="/"
                        className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700"
                    >
                        업로드 페이지로 돌아가기
                    </Link>

                    <a
                        href={`${apiBase}/v1/jobs/${jobId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
                    >
                        Job Meta 열기
                    </a>
                </div>
            </main>
        );
    }
}