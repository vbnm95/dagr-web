"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";

import { ApiError, createJob, runJob } from "@/lib/api";
import type { MethodType, SourceMode } from "@/types/dagr";

export default function HomePage() {
  const router = useRouter();

  const [sourceMode, setSourceMode] = useState<SourceMode>("example");
  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);

  const [chainA, setChainA] = useState("A");
  const [chainB, setChainB] = useState("A");
  const [dcut, setDcut] = useState(1.25);
  const [method, setMethod] = useState<MethodType>("iterative");
  const [maxDomains, setMaxDomains] = useState(2);
  const [nDomains, setNDomains] = useState(2);
  const [postprocess, setPostprocess] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState("");
  const [longRunWarning, setLongRunWarning] = useState(false);

  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const chainError = useMemo(() => {
    if (!chainA.trim() || !chainB.trim()) {
      return "체인이 선택되지 않았습니다. Chain A와 Chain B를 입력해주세요.";
    }
    return "";
  }, [chainA, chainB]);

  const uploadError = useMemo(() => {
    if (sourceMode !== "upload") return "";
    if (!fileA || !fileB) {
      return "PDB file A와 PDB file B를 업로드해주세요.";
    }
    return "";
  }, [sourceMode, fileA, fileB]);

  const canSubmit = !submitting && !chainError && !uploadError;

  function clearWarningTimer() {
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLongRunWarning(false);

    if (chainError) {
      setError(chainError);
      return;
    }

    if (uploadError) {
      setError(uploadError);
      return;
    }

    setSubmitting(true);
    setStatusText("작업을 생성하고 있습니다...");

    warningTimerRef.current = setTimeout(() => {
      setLongRunWarning(true);
    }, 45000);

    try {
      const created = await createJob({
        sourceMode,
        fileA,
        fileB,
        chainA,
        chainB,
        dcut,
        method,
        maxDomains,
        nDomains,
        postprocess,
      });

      setStatusText("DAGR 분석을 실행하고 있습니다...");
      await runJob(created.job_id);

      setStatusText("결과 페이지로 이동하고 있습니다...");
      router.push(`/jobs/${created.job_id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("알 수 없는 오류가 발생했습니다.");
      }
      setSubmitting(false);
      setStatusText("");
    } finally {
      clearWarningTimer();
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 py-8 md:px-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-semibold tracking-tight">DAGR Web App</h1>
            <p className="mt-2 text-base text-zinc-700">
              Rigid domain and hinge analysis for protein structure pairs
            </p>

            <p className="mt-4 text-sm leading-6 text-zinc-600">
              처음이라면 논문 예제로 결과를 먼저 확인해 보세요.
              <br />
              이후에는 직접 PDB 파일을 업로드해 연구 중인 단백질에도 적용할 수 있습니다.
            </p>
          </div>

          <div className="flex flex-col gap-3 md:min-w-[220px]">
            <Link
              href="/paper"
              className="rounded-lg border border-zinc-300 px-4 py-2 text-center text-sm font-medium hover:bg-zinc-50"
            >
              논문 소개 보기
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <h2 className="text-xl font-semibold">Run DAGR Analysis</h2>
          <p className="mt-2 text-sm text-zinc-600">
            비교할 단백질 구조를 선택하고 분석 조건을 설정하세요.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div>
            <h3 className="mb-3 text-sm font-semibold text-zinc-800">입력 방식 선택</h3>

            <div className="grid gap-3 md:grid-cols-2">
              <label
                className={`rounded-xl border p-4 ${sourceMode === "example"
                    ? "border-zinc-900 bg-zinc-50"
                    : "border-zinc-200"
                  }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="sourceMode"
                    checked={sourceMode === "example"}
                    onChange={() => setSourceMode("example")}
                    className="mt-1"
                    disabled={submitting}
                  />
                  <div>
                    <div className="font-medium">예제 데이터 사용</div>
                    <p className="mt-1 text-sm text-zinc-600">
                      논문에 사용된 LsrB 구조(1TJY, 1TM2)로 바로 실행합니다.
                    </p>
                  </div>
                </div>
              </label>

              <label
                className={`rounded-xl border p-4 ${sourceMode === "upload"
                    ? "border-zinc-900 bg-zinc-50"
                    : "border-zinc-200"
                  }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="sourceMode"
                    checked={sourceMode === "upload"}
                    onChange={() => setSourceMode("upload")}
                    className="mt-1"
                    disabled={submitting}
                  />
                  <div>
                    <div className="font-medium">직접 PDB 업로드</div>
                    <p className="mt-1 text-sm text-zinc-600">
                      연구 중인 단백질 구조 파일을 업로드해 직접 분석합니다.
                    </p>
                  </div>
                </div>
              </label>
            </div>
          </div>

          {sourceMode === "example" ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <h3 className="text-sm font-semibold text-emerald-900">예제 데이터</h3>

              <div className="mt-3 grid gap-2 text-sm text-emerald-950 md:grid-cols-2">
                <div>
                  Structure A: <span className="font-semibold">1TJY</span>
                </div>
                <div>
                  Structure B: <span className="font-semibold">1TM2</span>
                </div>
                <div>
                  Chain A: <span className="font-semibold">A</span>
                </div>
                <div>
                  Chain B: <span className="font-semibold">A</span>
                </div>
              </div>

              <p className="mt-3 text-sm text-emerald-900">
                논문 예제가 기본 선택되어 있습니다. Run DAGR를 눌러 바로 결과를 확인해 보세요.
              </p>
            </div>
          ) : (
            <div>
              <h3 className="mb-3 text-sm font-semibold text-zinc-800">PDB 파일 업로드</h3>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="rounded-xl border border-dashed border-zinc-300 p-4">
                  <div className="font-medium">PDB file A</div>
                  <p className="mt-1 text-sm text-zinc-600">
                    첫 번째 단백질 구조 파일(.pdb)
                  </p>
                  <input
                    type="file"
                    accept=".pdb"
                    className="mt-3 block w-full text-sm"
                    disabled={submitting}
                    onChange={(e) => setFileA(e.target.files?.[0] ?? null)}
                  />
                </label>

                <label className="rounded-xl border border-dashed border-zinc-300 p-4">
                  <div className="font-medium">PDB file B</div>
                  <p className="mt-1 text-sm text-zinc-600">
                    두 번째 단백질 구조 파일(.pdb)
                  </p>
                  <input
                    type="file"
                    accept=".pdb"
                    className="mt-3 block w-full text-sm"
                    disabled={submitting}
                    onChange={(e) => setFileB(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>

              {uploadError ? (
                <p className="mt-3 text-sm text-red-600">{uploadError}</p>
              ) : null}
            </div>
          )}

          <div>
            <h3 className="mb-3 text-sm font-semibold text-zinc-800">Chain selection</h3>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <div className="mb-2 text-sm font-medium">Chain A</div>
                <input
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
                  value={chainB}
                  onChange={(e) => setChainB(e.target.value)}
                  placeholder="예: A"
                  className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
                  disabled={submitting}
                />
              </label>
            </div>

            <p className="mt-2 text-sm text-zinc-600">
              분석할 체인을 입력하세요. 예제 데이터는 A 체인이 기본 설정되어 있습니다.
            </p>

            {chainError ? (
              <p className="mt-2 text-sm text-red-600">{chainError}</p>
            ) : null}
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-zinc-800">Analysis settings</h3>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <div className="mb-2 text-sm font-medium">dcut</div>
                <input
                  type="number"
                  step={0.25}
                  min={0.25}
                  value={dcut}
                  onChange={(e) => setDcut(Number(e.target.value))}
                  className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
                  disabled={submitting}
                />
                <p className="mt-2 text-sm text-zinc-600">
                  도메인 분할 기준값입니다.
                </p>
              </label>

              <div>
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

                <p className="mt-2 text-sm text-zinc-600">
                  {method === "iterative"
                    ? "빠르게 도메인을 탐색하는 기본 방식입니다."
                    : "가능한 조합을 더 엄밀하게 탐색하지만 시간이 오래 걸릴 수 있습니다."}
                </p>

                {method === "exact" ? (
                  <p className="mt-2 text-sm text-amber-700">
                    exact 방식은 계산량이 매우 커 1분 이내에 자동 중단될 수 있습니다.
                  </p>
                ) : null}
              </div>

              {method === "iterative" ? (
                <label className="block">
                  <div className="mb-2 text-sm font-medium">max_domains</div>
                  <input
                    type="number"
                    min={1}
                    value={maxDomains}
                    onChange={(e) => setMaxDomains(Number(e.target.value))}
                    className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
                    disabled={submitting}
                  />
                </label>
              ) : (
                <label className="block">
                  <div className="mb-2 text-sm font-medium">n_domains</div>
                  <input
                    type="number"
                    min={1}
                    value={nDomains}
                    onChange={(e) => setNDomains(Number(e.target.value))}
                    className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
                    disabled={submitting}
                  />
                </label>
              )}

              <label className="flex items-start gap-3 rounded-xl border border-zinc-200 p-4 md:col-span-2">
                <input
                  type="checkbox"
                  checked={postprocess}
                  onChange={(e) => setPostprocess(e.target.checked)}
                  disabled={submitting}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium">Postprocess 적용</div>
                  <p className="mt-1 text-sm text-zinc-600">
                    결과를 더 해석하기 쉽게 정리하는 후처리를 적용합니다.
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full rounded-xl bg-zinc-900 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
            >
              Run DAGR
            </button>

            <p className="mt-3 text-sm text-zinc-600">
              {sourceMode === "example"
                ? "논문 예제로 바로 결과를 확인할 수 있습니다."
                : "업로드한 PDB와 선택한 chain 기준으로 분석을 시작합니다."}
            </p>

            <p className="mt-2 text-xs text-zinc-500">
              안정적인 운영을 위해 업로드 파일과 결과 데이터는 일정 시간 후 자동 삭제됩니다.
            </p>

            {statusText ? (
              <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                <p className="font-medium">{statusText}</p>
                {submitting ? (
                  <p className="mt-1">
                    구조 비교와 도메인 탐색을 수행하고 있습니다.
                  </p>
                ) : null}
              </div>
            ) : null}

            {longRunWarning && submitting ? (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                현재 계산 시간이 길어지고 있습니다. 안정적인 실행을 위해 1분 후 자동 중단됩니다.
              </div>
            ) : null}

            {error ? (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {error}
              </div>
            ) : null}
          </div>
        </form>
      </section>
    </main>
  );
}