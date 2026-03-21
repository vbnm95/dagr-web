"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getJobInputUrl } from "@/lib/api";
import type { DagrResult } from "@/types/dagr";

declare global {
    interface Window {
        $3Dmol?: any;
    }
}

const DOMAIN_COLORS = [
    "#ef4444", // red
    "#22c55e", // green
    "#3b82f6", // blue
    "#f59e0b", // amber
    "#a855f7", // purple
    "#ec4899", // pink
    "#84cc16", // lime
    "#14b8a6", // teal
];

const HINGE_COLOR = "#06b6d4"; // cyan
const UNCOVERED_COLOR = "#3f3f46"; // dark gray
const BASE_COLOR = "#d4d4d8"; // light gray

function normalizeResidues(input: unknown): number[] {
    const values: number[] = [];

    const walk = (node: unknown) => {
        if (node == null) return;

        if (typeof node === "number" && Number.isFinite(node)) {
            values.push(Math.trunc(node));
            return;
        }

        if (Array.isArray(node)) {
            if (
                node.length === 2 &&
                typeof node[0] === "number" &&
                typeof node[1] === "number"
            ) {
                const start = Math.min(node[0], node[1]);
                const end = Math.max(node[0], node[1]);
                for (let i = start; i <= end; i += 1) {
                    values.push(Math.trunc(i));
                }
                return;
            }

            node.forEach(walk);
            return;
        }

        if (typeof node === "object") {
            const obj = node as Record<string, unknown>;

            if (typeof obj.start === "number" && typeof obj.end === "number") {
                const start = Math.min(obj.start, obj.end);
                const end = Math.max(obj.start, obj.end);
                for (let i = start; i <= end; i += 1) {
                    values.push(Math.trunc(i));
                }
                return;
            }

            if ("residues" in obj) {
                walk(obj.residues);
                return;
            }

            if ("indices" in obj) {
                walk(obj.indices);
                return;
            }

            if ("positions" in obj) {
                walk(obj.positions);
                return;
            }

            Object.values(obj).forEach(walk);
        }
    };

    walk(input);

    return Array.from(new Set(values)).sort((a, b) => a - b);
}

function toZeroBasedIndices(input: unknown, length: number): number[] {
    const nums = normalizeResidues(input);
    if (nums.length === 0) return [];

    const hasZero = nums.some((v) => v === 0);
    const minVal = Math.min(...nums);
    const maxVal = Math.max(...nums);

    const looksOneBased = !hasZero && minVal >= 1 && maxVal <= length;
    const converted = looksOneBased ? nums.map((v) => v - 1) : nums;

    return converted
        .filter((v) => Number.isInteger(v) && v >= 0 && v < length)
        .sort((a, b) => a - b);
}

function parseResidueNumber(label: string): number | null {
    const tailMatch = label.match(/(-?\d+)[A-Za-z]?$/);
    if (tailMatch) {
        return Number.parseInt(tailMatch[1], 10);
    }

    const allNums = label.match(/-?\d+/g);
    if (!allNums || allNums.length === 0) return null;

    return Number.parseInt(allNums[allNums.length - 1], 10);
}

function parseChainFromLabel(label: string): string | undefined {
    const idx = label.indexOf(":");
    if (idx > 0) return label.slice(0, idx).trim() || undefined;
    return undefined;
}

function inferChain(labels: string[], chainHint?: string) {
    if (chainHint?.trim()) return chainHint.trim();

    for (const label of labels) {
        const chain = parseChainFromLabel(label);
        if (chain) return chain;
    }

    return undefined;
}

function residueNumbersToRanges(nums: number[]): string[] {
    if (nums.length === 0) return [];

    const unique = Array.from(new Set(nums)).sort((a, b) => a - b);
    const ranges: string[] = [];

    let start = unique[0];
    let prev = unique[0];

    for (let i = 1; i < unique.length; i += 1) {
        const curr = unique[i];

        if (curr === prev + 1) {
            prev = curr;
            continue;
        }

        ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
        start = curr;
        prev = curr;
    }

    ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
    return ranges;
}

function alignedSelectionToResiRanges(
    input: unknown,
    labels: string[],
    length: number
): string[] {
    const indices = toZeroBasedIndices(input, length);

    const residueNumbers = indices
        .map((idx) => labels[idx])
        .filter((label): label is string => typeof label === "string")
        .map((label) => parseResidueNumber(label))
        .filter((v): v is number => v !== null);

    return residueNumbersToRanges(residueNumbers);
}

async function waitFor3Dmol(timeoutMs = 8000) {
    const started = Date.now();

    while (Date.now() - started < timeoutMs) {
        if (typeof window !== "undefined" && window.$3Dmol) return window.$3Dmol;
        await new Promise((resolve) => setTimeout(resolve, 150));
    }

    throw new Error("3Dmol.js 로드에 실패했습니다.");
}

function ViewerCard({
    title,
    subtitle,
    innerRef,
}: {
    title: string;
    subtitle: string;
    innerRef: React.RefObject<HTMLDivElement | null>;
}) {
    return (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="mb-3">
                <div className="text-base font-semibold">{title}</div>
                <div className="text-sm text-zinc-500">{subtitle}</div>
            </div>

            <div
                ref={innerRef}
                className="relative overflow-hidden rounded-xl border border-zinc-200 bg-white"
                style={{ width: "100%", height: "420px" }}
            />
        </div>
    );
}

function LegendItem({
    color,
    label,
}: {
    color: string;
    label: string;
}) {
    return (
        <div className="flex items-center gap-1 whitespace-nowrap">
            <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: color }}
            />
            <span>{label}</span>
        </div>
    );
}

export default function Dagr3DCompare({
    jobId,
    result,
    chainA,
    chainB,
}: {
    jobId: string;
    result: DagrResult;
    chainA?: string;
    chainB?: string;
}) {
    const viewerARef = useRef<HTMLDivElement>(null);
    const viewerBRef = useRef<HTMLDivElement>(null);
    const instanceARef = useRef<any>(null);
    const instanceBRef = useRef<any>(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const labelsA = result.matched_labels_a ?? [];
    const labelsB = result.matched_labels_b ?? [];
    const length = result.n_residues || labelsA.length || labelsB.length || 0;

    const domainSource = useMemo(() => {
        if (Array.isArray(result.selected_domains) && result.selected_domains.length > 0) {
            return result.selected_domains;
        }

        if (
            Array.isArray(result.non_overlapping_parts) &&
            result.non_overlapping_parts.length > 0
        ) {
            return result.non_overlapping_parts;
        }

        return [];
    }, [result.selected_domains, result.non_overlapping_parts]);

    const compactLegend = domainSource.length >= 5;

    useEffect(() => {
        let cancelled = false;

        async function run() {
            try {
                setLoading(true);
                setError("");

                const [$3Dmol, pdbA, pdbB] = await Promise.all([
                    waitFor3Dmol(),
                    fetch(getJobInputUrl(jobId, "a"), { cache: "no-store" }).then((r) => {
                        if (!r.ok) throw new Error("Structure A PDB를 불러오지 못했습니다.");
                        return r.text();
                    }),
                    fetch(getJobInputUrl(jobId, "b"), { cache: "no-store" }).then((r) => {
                        if (!r.ok) throw new Error("Structure B PDB를 불러오지 못했습니다.");
                        return r.text();
                    }),
                ]);

                if (cancelled) return;

                const renderViewer = (
                    container: HTMLDivElement,
                    pdbText: string,
                    labels: string[],
                    chainHint: string | undefined
                ) => {
                    container.innerHTML = "";

                    const viewer = $3Dmol.createViewer(container, {
                        backgroundColor: "white",
                    });

                    viewer.addModel(pdbText, "pdb");
                    viewer.setStyle({}, { cartoon: { color: BASE_COLOR } });

                    const chain = inferChain(labels, chainHint);

                    const applyRanges = (ranges: string[], color: string) => {
                        if (ranges.length === 0) return;

                        const sel: Record<string, unknown> = { resi: ranges };
                        if (chain) sel.chain = chain;

                        viewer.addStyle(sel, { cartoon: { color } });
                    };

                    domainSource.forEach((domain, idx) => {
                        const ranges = alignedSelectionToResiRanges(domain, labels, length);
                        applyRanges(ranges, DOMAIN_COLORS[idx % DOMAIN_COLORS.length]);
                    });

                    applyRanges(
                        alignedSelectionToResiRanges(result.hinge, labels, length),
                        HINGE_COLOR
                    );

                    applyRanges(
                        alignedSelectionToResiRanges(result.uncovered, labels, length),
                        UNCOVERED_COLOR
                    );

                    viewer.zoomTo();
                    viewer.resize();
                    viewer.render();

                    return viewer;
                };

                if (viewerARef.current) {
                    instanceARef.current = renderViewer(
                        viewerARef.current,
                        pdbA,
                        labelsA,
                        chainA
                    );
                }

                if (viewerBRef.current) {
                    instanceBRef.current = renderViewer(
                        viewerBRef.current,
                        pdbB,
                        labelsB,
                        chainB
                    );
                }

                setLoading(false);
            } catch (err) {
                if (cancelled) return;
                setError(
                    err instanceof Error ? err.message : "3D viewer를 그리지 못했습니다."
                );
                setLoading(false);
            }
        }

        run();

        return () => {
            cancelled = true;
            instanceARef.current = null;
            instanceBRef.current = null;
        };
    }, [jobId, result, chainA, chainB, labelsA, labelsB, length, domainSource]);

    return (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                    <h2 className="text-lg font-semibold">3D Structure View</h2>
                    <p className="mt-1 text-sm text-zinc-600">
                        selected_domains를 기준으로 색칠합니다. hinge는 cyan, uncovered는
                        dark gray로 표시합니다.
                    </p>
                </div>

                <div className="max-w-full overflow-x-auto">
                    <div className="flex items-center gap-2 whitespace-nowrap pr-1 text-[11px] text-zinc-700">
                        {domainSource.map((_, idx) => (
                            <LegendItem
                                key={idx}
                                color={DOMAIN_COLORS[idx % DOMAIN_COLORS.length]}
                                label={compactLegend ? `D${idx + 1}` : `Domain ${idx + 1}`}
                            />
                        ))}

                        <LegendItem
                            color={HINGE_COLOR}
                            label={compactLegend ? "H" : "Hinge"}
                        />

                        <LegendItem
                            color={UNCOVERED_COLOR}
                            label={compactLegend ? "U" : "Uncovered"}
                        />
                    </div>
                </div>
            </div>

            {loading && (
                <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
                    3D 구조를 불러오는 중입니다...
                </div>
            )}

            {error && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    {error}
                </div>
            )}

            <div className="grid gap-4 xl:grid-cols-2">
                <ViewerCard
                    title="Structure A"
                    subtitle={chainA ? `Chain ${chainA}` : "Selected chain"}
                    innerRef={viewerARef}
                />
                <ViewerCard
                    title="Structure B"
                    subtitle={chainB ? `Chain ${chainB}` : "Selected chain"}
                    innerRef={viewerBRef}
                />
            </div>
        </section>
    );
}