"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SyntheticEvent } from "react";
import { createJob, runJob } from "@/lib/api";

type MethodType = "iterative" | "exact";

export default function HomePage() {
  const router = useRouter();

  const [pdbA, setPdbA] = useState<File | null>(null);
  const [pdbB, setPdbB] = useState<File | null>(null);

  const [chainA, setChainA] = useState("");
  const [chainB, setChainB] = useState("");
  const [dcut, setDcut] = useState("1.25");
  const [method, setMethod] = useState<MethodType>("iterative");
  const [maxDomains, setMaxDomains] = useState("2");
  const [nDomains, setNDomains] = useState("2");
  const [postprocess, setPostprocess] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(
    e: SyntheticEvent<HTMLFormElement, SubmitEvent>
  ) {
    e.preventDefault();
    setError("");

    if (!pdbA || !pdbB) {
      setError("PDB 파일 2개를 모두 선택해 주세요.");
      return;
    }

    const formData = new FormData();
    formData.append("pdb_a", pdbA);
    formData.append("pdb_b", pdbB);

    if (chainA.trim()) formData.append("chain_a", chainA.trim());
    if (chainB.trim()) formData.append("chain_b", chainB.trim());

    formData.append("dcut", dcut);
    formData.append("method", method);
    formData.append("postprocess", String(postprocess));

    if (method === "iterative" && maxDomains.trim()) {
      formData.append("max_domains", maxDomains.trim());
    }

    if (method === "exact" && nDomains.trim()) {
      formData.append("n_domains", nDomains.trim());
    }

    try {
      setSubmitting(true);

      setStatusText("작업을 생성하고 있습니다...");
      const created = await createJob(formData);

      setStatusText("계산 엔진을 실행하고 있습니다...");
      await runJob(created.job_id);

      router.push(`/jobs/${created.job_id}`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
      setError(message);
      setSubmitting(false);
      setStatusText("");
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">DAGR Web</h1>
        <p className="mt-2 text-sm text-zinc-600">
          PDB 2개를 업로드하고 DAGR 계산을 실행합니다.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
      >
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">1. PDB 업로드</h2>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <div className="mb-2 text-sm font-medium">PDB A</div>
              <input
                type="file"
                accept=".pdb"
                onChange={(e) => setPdbA(e.target.files?.[0] ?? null)}
                className="block w-full rounded-xl border border-zinc-300 p-3 text-sm"
                disabled={submitting}
              />
            </label>

            <label className="block">
              <div className="mb-2 text-sm font-medium">PDB B</div>
              <input
                type="file"
                accept=".pdb"
                onChange={(e) => setPdbB(e.target.files?.[0] ?? null)}
                className="block w-full rounded-xl border border-zinc-300 p-3 text-sm"
                disabled={submitting}
              />
            </label>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">2. 옵션</h2>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <div className="mb-2 text-sm font-medium">Chain A</div>
              <input
                type="text"
                value={chainA}
                onChange={(e) => setChainA(e.target.value)}
                placeholder="예: A"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
                disabled={submitting}
              />
            </label>

            <label className="block">
              <div className="mb-2 text-sm font-medium">Chain B</div>
              <input
                type="text"
                value={chainB}
                onChange={(e) => setChainB(e.target.value)}
                placeholder="예: A"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
                disabled={submitting}
              />
            </label>

            <label className="block">
              <div className="mb-2 text-sm font-medium">dcut</div>
              <input
                type="number"
                step="0.01"
                value={dcut}
                onChange={(e) => setDcut(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
                disabled={submitting}
              />
            </label>

            <label className="block">
              <div className="mb-2 text-sm font-medium">Method</div>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as MethodType)}
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
                disabled={submitting}
              >
                <option value="iterative">iterative</option>
                <option value="exact">exact</option>
              </select>
            </label>

            <label className="block">
              <div className="mb-2 text-sm font-medium">max_domains</div>
              <input
                type="number"
                min="1"
                value={maxDomains}
                onChange={(e) => setMaxDomains(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
                disabled={submitting || method !== "iterative"}
              />
            </label>

            <label className="block">
              <div className="mb-2 text-sm font-medium">n_domains</div>
              <input
                type="number"
                min="1"
                value={nDomains}
                onChange={(e) => setNDomains(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
                disabled={submitting || method !== "exact"}
              />
            </label>
          </div>

          <label className="flex items-start gap-3 rounded-xl border border-zinc-200 p-4">
            <input
              type="checkbox"
              checked={postprocess}
              onChange={(e) => setPostprocess(e.target.checked)}
              disabled={submitting}
              className="mt-1"
            />
            <div>
              <div className="text-sm font-medium">Apply postprocessing</div>
              <div className="mt-1 text-sm text-zinc-600">
                기본적으로 후처리가 적용됩니다. 해제하면 gap fill, 작은
                fragment 제거, spatial split 단계를 수행하지 않습니다.
              </div>
            </div>
          </label>

          {method === "exact" && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              정확 탐색(exact)은 계산량이 커서 수분 이상 소요될 수 있습니다.
            </div>
          )}
        </section>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {statusText && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
            {statusText}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-black px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "실행 중..." : "Run DAGR"}
          </button>
          <span className="text-sm text-zinc-500">
            업로드 → job 생성 → 계산 실행 → 결과 페이지 이동
          </span>
        </div>
      </form>
    </main>
  );
}