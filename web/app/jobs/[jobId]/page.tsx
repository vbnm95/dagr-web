import Link from "next/link";
import type { ReactNode } from "react";
import Overlap2DView from "@/components/Overlap2DView";
import Dagr3DCompare from "@/components/Dagr3DCompare";
import { ApiError, getApiBaseUrl, getJobMeta, getJobResult } from "@/lib/api";
import type { DagrResult, JobMetaResponse } from "@/types/dagr";

function formatPercent(value: number | undefined) {
    if (typeof value !== "number" || Number.isNaN(value)) return "-";
    return `${(value * 100).toFixed(1)}%`;
}

function formatDateTime(value?: string | null) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    return new Intl.DateTimeFormat("ko-KR", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Seoul",
    }).format(date);
}

function getErrorStatus(err: unknown) {
    if (err instanceof ApiError) return err.status;
    if (
        typeof err === "object" &&
        err !== null &&
        "status" in err &&
        typeof (err as { status?: unknown }).status === "number"
    ) {
        return (err as { status: number }).status;
    }
    return undefined;
}

function getErrorMessage(err: unknown) {
    if (err instanceof Error) return err.message;
    return "결과를 불러오지 못했습니다.";
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

function InfoCard({
    title,
    value,
}: {
    title: string;
    value: string | number | boolean;
}) {
    return (
        <div className="rounded-xl bg-zinc-50 p-4">
            <div className="text-sm text-zinc-500">{title}</div>
            <div className="mt-1 text-lg font-semibold break-all">{String(value)}</div>
        </div>
    );
}

function NoticePanel({
    title,
    children,
    tone = "amber",
}: {
    title: string;
    children: ReactNode;
    tone?: "amber" | "blue" | "red";
}) {
    const styles = {
        amber: "border-amber-200 bg-amber-50 text-amber-900",
        blue: "border-sky-200 bg-sky-50 text-sky-900",
        red: "border-red-200 bg-red-50 text-red-900",
    }[tone];

    return (
        <section className={`rounded-2xl border p-5 ${styles}`}>
            <h2 className="text-base font-semibold">{title}</h2>
            <div className="mt-2 text-sm leading-6">{children}</div>
        </section>
    );
}

function getResultStateMessage(meta: JobMetaResponse, err: unknown) {
    const status = meta.status ?? "unknown";
    const errorStatus = getErrorStatus(err);

    if (status === "created" || status === "running") {
        return {
            title: "아직 결과가 준비되지 않았습니다",
            body: "분석이 아직 진행 중이거나, 결과 파일이 아직 생성되지 않았습니다. 잠시 후 다시 확인해주세요.",
            tone: "blue" as const,
        };
    }

    if (status === "timeout") {
        return {
            title: "분석이 자동 중단되었습니다",
            body:
                meta.error ??
                "실행 시간이 길어져 분석이 자동 중단되었고, 결과 파일이 생성되지 않았습니다.",
            tone: "red" as const,
        };
    }

    if (status === "failed") {
        return {
            title: "분석이 완료되지 않았습니다",
            body:
                meta.error ??
                "분석 중 오류가 발생하여 결과 파일을 표시할 수 없습니다.",
            tone: "red" as const,
        };
    }

    if (status === "completed" && errorStatus === 404) {
        return {
            title: "결과를 찾을 수 없습니다",
            body:
                "결과 파일이 이미 삭제되었을 수 있습니다. 안정적인 운영을 위해 업로드 파일과 결과 데이터는 일정 시간 후 자동 삭제됩니다.",
            tone: "amber" as const,
        };
    }

    return {
        title: "결과를 불러오지 못했습니다",
        body:
            meta.error ??
            getErrorMessage(err) ??
            "요청 처리 중 문제가 발생했습니다.",
        tone: "red" as const,
    };
}

function ResultMissingView({
    jobId,
    apiBase,
    meta,
    err,
}: {
    jobId: string;
    apiBase: string;
    meta: JobMetaResponse;
    err: unknown;
}) {
    const inputs = meta.inputs;
    const cleanupAtText = formatDateTime(meta.cleanup_at);
    const message = getResultStateMessage(meta, err);

    return (
        <main className="mx-auto max-w-5xl px-6 py-10">
            <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
                <div>
                    <div className="text-sm text-zinc-500">Job ID</div>
                    <h1 className="mt-1 text-3xl font-bold tracking-tight">{jobId}</h1>
                    <p className="mt-2 text-sm text-zinc-600">
                        status:{" "}
                        <span className="font-medium">{meta.status ?? "unknown"}</span>
                        {" · "}
                        method:{" "}
                        <span className="font-medium">{inputs?.method ?? "-"}</span>
                        {" · "}
                        dcut:{" "}
                        <span className="font-medium">
                            {String(inputs?.dcut ?? "-")}
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
                        href={`${apiBase}/v1/jobs/${jobId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
                    >
                        Job Meta 열기
                    </a>
                </div>
            </div>

            <div className="space-y-6">
                <NoticePanel title={message.title} tone={message.tone}>
                    <p>{message.body}</p>
                    {cleanupAtText ? (
                        <p className="mt-2">
                            현재 작업 데이터는 <span className="font-semibold">{cleanupAtText}</span>{" "}
                            전후에 정리될 수 있습니다.
                        </p>
                    ) : (
                        <p className="mt-2">
                            안정적인 운영을 위해 업로드 파일과 결과 데이터는 일정 시간 후 자동
                            삭제됩니다.
                        </p>
                    )}
                </NoticePanel>

                <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                    <h2 className="text-lg font-semibold">작업 정보</h2>

                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <InfoCard title="Source mode" value={meta.source_mode ?? "-"} />
                        <InfoCard title="Chain A" value={inputs?.chain_a ?? "-"} />
                        <InfoCard title="Chain B" value={inputs?.chain_b ?? "-"} />
                        <InfoCard title="Method" value={inputs?.method ?? "-"} />
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <InfoCard
                            title="Input file A"
                            value={inputs?.original_filename_a ?? "-"}
                        />
                        <InfoCard
                            title="Input file B"
                            value={inputs?.original_filename_b ?? "-"}
                        />
                    </div>

                    {meta.error ? (
                        <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                            <div className="font-medium text-zinc-900">상세 메시지</div>
                            <div className="mt-2 whitespace-pre-wrap break-words">
                                {meta.error}
                            </div>
                        </div>
                    ) : null}
                </section>
            </div>
        </main>
    );
}

export default async function JobResultPage({
    params,
}: {
    params: Promise<{ jobId: string }>;
}) {
    const { jobId } = await params;
    const apiBase = getApiBaseUrl();

    let meta: JobMetaResponse;

    try {
        meta = await getJobMeta(jobId);
    } catch (err) {
        const status = getErrorStatus(err);
        const message = getErrorMessage(err);
        const isNotFound = status === 404;

        return (
            <main className="mx-auto max-w-3xl px-6 py-10">
                <h1 className="text-2xl font-bold">
                    {isNotFound ? "작업을 찾을 수 없습니다" : "결과를 불러오지 못했습니다"}
                </h1>

                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
                    {isNotFound ? (
                        <>
                            <p>
                                요청한 작업이 이미 삭제되었을 수 있습니다. 안정적인 운영을 위해
                                업로드 파일과 결과 데이터는 일정 시간 후 자동 삭제됩니다.
                            </p>
                            <p className="mt-2">Job ID: {jobId}</p>
                        </>
                    ) : (
                        <>
                            <p>{message}</p>
                            <p className="mt-2">Job ID: {jobId}</p>
                        </>
                    )}
                </div>

                <div className="mt-6 flex gap-3">
                    <Link
                        href="/"
                        className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700"
                    >
                        업로드 페이지로 돌아가기
                    </Link>
                </div>
            </main>
        );
    }

    let result: DagrResult | null = null;
    let resultError: unknown = null;

    try {
        result = await getJobResult(jobId);
    } catch (err) {
        resultError = err;
    }

    if (result && !meta.cleanup_at) {
        try {
            meta = await getJobMeta(jobId);
        } catch {
            // cleanup_at 재조회 실패 시에도 결과는 그대로 렌더링
        }
    }

    if (!result) {
        return (
            <ResultMissingView
                jobId={jobId}
                apiBase={apiBase}
                meta={meta}
                err={resultError}
            />
        );
    }

    const inputs = meta.inputs;
    const method = typeof inputs?.method === "string" ? inputs.method : "-";
    const chainA =
        typeof inputs?.chain_a === "string" ? inputs.chain_a : undefined;
    const chainB =
        typeof inputs?.chain_b === "string" ? inputs.chain_b : undefined;
    const cleanupAtText = formatDateTime(meta.cleanup_at);

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
                            {String(result.dcut ?? inputs?.dcut ?? "-")}
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
                        JSON 결과 보기
                    </a>
                </div>
            </div>

            <div className="mb-8 space-y-4">
                <NoticePanel title="자동 삭제 안내" tone="amber">
                    <p>
                        안정적인 운영을 위해 업로드 파일과 결과 데이터는 일정 시간 후 자동
                        삭제됩니다.
                    </p>
                    {cleanupAtText ? (
                        <p className="mt-2">
                            현재 결과는 <span className="font-semibold">{cleanupAtText}</span>{" "}
                            전후까지 유지될 수 있습니다.
                        </p>
                    ) : null}
                </NoticePanel>

                {method === "exact" ? (
                    <NoticePanel title="exact 방식 안내" tone="blue">
                        <p>
                            exact 방식은 계산량이 매우 커 자동 중단되거나, 조합 수 제한으로
                            실행되지 않을 수 있습니다.
                        </p>
                    </NoticePanel>
                ) : null}
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

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <InfoCard
                        title="Matched residues"
                        value={result.n_residues ?? result.matched_labels_a?.length ?? "-"}
                    />
                    <InfoCard
                        title="Selected domains"
                        value={
                            Array.isArray(result.selected_domains)
                                ? result.selected_domains.length
                                : "-"
                        }
                    />
                    <InfoCard title="Chain A" value={chainA ?? "-"} />
                    <InfoCard title="Chain B" value={chainB ?? "-"} />
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <InfoCard title="Source mode" value={meta.source_mode ?? "-"} />
                    <InfoCard
                        title="Input file A"
                        value={inputs?.original_filename_a ?? "-"}
                    />
                    <InfoCard
                        title="Input file B"
                        value={inputs?.original_filename_b ?? "-"}
                    />
                    <InfoCard
                        title="Postprocess"
                        value={inputs?.postprocess === false ? "OFF" : "ON"}
                    />
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
}