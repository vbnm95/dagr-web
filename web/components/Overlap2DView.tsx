import type { DagrResult } from "@/types/dagr";

type Segment = {
    start: number;
    end: number;
};

const DOMAIN_COLORS = [
    "bg-red-500",
    "bg-green-500",
    "bg-blue-500",
    "bg-orange-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-lime-500",
    "bg-sky-500",
];

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

function indicesToSegments(indices: number[]): Segment[] {
    if (indices.length === 0) return [];

    const segments: Segment[] = [];
    let start = indices[0];
    let prev = indices[0];

    for (let i = 1; i < indices.length; i += 1) {
        const curr = indices[i];

        if (curr === prev || curr === prev + 1) {
            prev = curr;
            continue;
        }

        segments.push({ start, end: prev });
        start = curr;
        prev = curr;
    }

    segments.push({ start, end: prev });
    return segments;
}

function toSegments(input: unknown, length: number): Segment[] {
    return indicesToSegments(toZeroBasedIndices(input, length));
}

function AxisRow({
    startLabel,
    endLabel,
}: {
    startLabel: string;
    endLabel: string;
}) {
    return (
        <div
            className="grid items-center gap-4"
            style={{ gridTemplateColumns: "120px 1fr" }}
        >
            <div className="text-sm font-medium text-zinc-700">Axis</div>

            <div className="relative h-10">
                <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-zinc-300" />
                <span className="absolute left-0 -top-1 text-xs text-zinc-500">
                    {startLabel}
                </span>
                <span className="absolute right-0 -top-1 text-xs text-zinc-500">
                    {endLabel}
                </span>
            </div>
        </div>
    );
}

function SegmentRow({
    label,
    segments,
    length,
    colorClass,
}: {
    label: string;
    segments: Segment[];
    length: number;
    colorClass: string;
}) {
    return (
        <div
            className="grid items-center gap-4"
            style={{ gridTemplateColumns: "120px 1fr" }}
        >
            <div className="text-sm font-medium text-zinc-700">{label}</div>

            <div className="relative h-12 rounded-md bg-zinc-50">
                <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-zinc-200" />

                {segments.map((seg, idx) => {
                    const leftPct = (seg.start / length) * 100;
                    const widthPct = ((seg.end - seg.start + 1) / length) * 100;

                    return (
                        <div
                            key={`${label}-${idx}`}
                            className={`absolute top-1/2 h-8 -translate-y-1/2 rounded-sm ${colorClass}`}
                            style={{
                                left: `${leftPct}%`,
                                width: `max(${widthPct}%, 4px)`,
                            }}
                            title={`${label}: ${seg.start + 1}-${seg.end + 1}`}
                        />
                    );
                })}
            </div>
        </div>
    );
}

export default function Overlap2DView({ result }: { result: DagrResult }) {
    const labelsA = result.matched_labels_a ?? [];
    const labelsB = result.matched_labels_b ?? [];
    const length = result.n_residues || labelsA.length || labelsB.length || 0;

    if (length <= 0) {
        return (
            <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold">2D Overlap View</h2>
                <p className="mt-2 text-sm text-zinc-600">표시할 residue 정보가 없습니다.</p>
            </section>
        );
    }

    const selectedDomains = Array.isArray(result.selected_domains)
        ? result.selected_domains
        : [];

    const domainSegments = selectedDomains.map((domain) =>
        toSegments(domain, length)
    );
    const hingeSegments = toSegments(result.hinge, length);
    const uncoveredSegments = toSegments(result.uncovered, length);

    const startLabel = labelsA[0] ?? "1";
    const endLabel = labelsA[length - 1] ?? String(length);

    return (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
                <h2 className="text-lg font-semibold">2D Overlap View</h2>
                <p className="mt-1 text-sm text-zinc-600">

                </p>
            </div>

            <div className="mb-5 flex flex-wrap gap-4 text-xs text-zinc-700">
                {domainSegments.map((_, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                        <span
                            className={`inline-block h-3 w-3 rounded-sm ${DOMAIN_COLORS[idx % DOMAIN_COLORS.length]
                                }`}
                        />
                        <span>Domain {idx + 1}</span>
                    </div>
                ))}

                <div className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-sm bg-cyan-500" />
                    <span>Hinge</span>
                </div>

                <div className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-sm bg-zinc-500" />
                    <span>Uncovered</span>
                </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-zinc-200 p-4">
                <div className="min-w-[820px] space-y-4">
                    <AxisRow
                        startLabel={String(startLabel)}
                        endLabel={String(endLabel)}
                    />

                    {domainSegments.map((segments, idx) => (
                        <SegmentRow
                            key={idx}
                            label={`Domain ${idx + 1}`}
                            segments={segments}
                            length={length}
                            colorClass={DOMAIN_COLORS[idx % DOMAIN_COLORS.length]}
                        />
                    ))}

                    <SegmentRow
                        label="Hinge"
                        segments={hingeSegments}
                        length={length}
                        colorClass="bg-cyan-500"
                    />

                    <SegmentRow
                        label="Uncovered"
                        segments={uncoveredSegments}
                        length={length}
                        colorClass="bg-zinc-500"
                    />
                </div>
            </div>

            <div className="mt-4 grid gap-2 rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600 md:grid-cols-2">
                <div>
                    <span className="font-medium text-zinc-800">Structure A axis:</span>{" "}
                    {labelsA[0] ?? "-"} → {labelsA[length - 1] ?? "-"}
                </div>
                <div>
                    <span className="font-medium text-zinc-800">Structure B axis:</span>{" "}
                    {labelsB[0] ?? "-"} → {labelsB[length - 1] ?? "-"}
                </div>
            </div>
        </section>
    );
}