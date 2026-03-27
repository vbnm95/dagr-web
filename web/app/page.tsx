"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { ApiError, createJob, runJob } from "@/lib/api";

type SourceMode = "example" | "upload";
type MethodType = "iterative" | "exact";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 font-medium text-zinc-900">{value}</div>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();

  const [sourceMode, setSourceMode] = useState<SourceMode>("example");

  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);

  const [chainA, setChainA] = useState("A");
  const [chainB, setChainB] = useState("A");

  const [dcut, setDcut] = useState(3);
  const [method, setMethod] = useState<MethodType>("iterative");
  const [maxDomains, setMaxDomains] = useState(2);
  const [nDomains, setNDomains] = useState(2);
  const [postprocess, setPostprocess] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState("");
  const [longRunWarning, setLongRunWarning] = useState(false);

  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isExample = sourceMode === "example";

  useEffect(() => {
    if (!isExample) return;

    setChainA("A");
    setChainB("A");
    setDcut(3);
    setMethod("iterative");
    setMaxDomains(2);
    setNDomains(2);
  }, [isExample]);

  useEffect(() => {
    return () => {
      if (warningTimerRef.current) {
        clearTimeout(warningTimerRef.current);
      }
    };
  }, []);

  const chainError = useMemo(() => {
    if (isExample) return "";
    if (!chainA.trim() || !chainB.trim()) {
      return "Chain A와 Chain B를 입력해주세요.";
    }
    return "";
  }, [isExample, chainA, chainB]);

  const uploadError = useMemo(() => {
    if (isExample) return "";
    if (!fileA || !fileB) {
      return "PDB file A와 PDB file B를 업로드해주세요.";
    }
    return "";
  }, [isExample, fileA, fileB]);

  const canSubmit = !submitting && !chainError && !uploadError;

  function clearWarningTimer() {
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
  }

  async function handleSubmit() {
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

    if (!isExample) {
      warningTimerRef.current = setTimeout(() => {
        setLongRunWarning(true);
      }, 45000);
    }

    try {
      const created = await createJob({
        sourceMode,
        fileA,
        fileB,
        chainA: isExample ? "A" : chainA.trim(),
        chainB: isExample ? "A" : chainB.trim(),
        dcut: isExample ? 3 : dcut,
        method: isExample ? "iterative" : method,
        maxDomains: isExample ? 2 : maxDomains,
        nDomains: isExample ? 2 : nDomains,
        postprocess,
      });

      setStatusText(
        isExample
          ? "사전 계산된 예제 결과를 불러오고 있습니다..."
          : "DAGR 분석을 실행하고 있습니다..."
      );

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
    <main className="mx-auto max-w-6xl px-6 py-10">
      <section className="mb-10 rounded-[24px] border border-zinc-200 bg-zinc-50 px-6 py-8 shadow-sm md:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-bold tracking-tight text-zinc-950">
              DAGR Web App
            </h1>
            <p className="mt-3 text-2xl leading-8 text-zinc-800">
              Rigid domain and hinge analysis for protein structure pairs
            </p>
            <div className="mt-8 space-y-2 text-lg leading-8 text-zinc-700">
              <p>처음이라면 논문 예제로 결과를 먼저 확인해 보세요.</p>
              <p>
                이후에는 직접 PDB 파일을 업로드해 연구 중인 단백질에도 적용할 수 있습니다.
              </p>
            </div>
          </div>

          <div className="shrink-0">
            <div className="flex flex-col gap-4">
              <Link
                href="/paper"
                className="inline-flex min-w-[220px] items-center justify-center rounded-2xl border border-zinc-300 bg-white px-6 py-4 text-base font-semibold text-zinc-900 transition hover:bg-zinc-100"
              >
                논문 소개 보기
              </Link>

              <a
                href="https://www.rcsb.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-w-[220px] items-center justify-center rounded-2xl border border-zinc-300 bg-white px-6 py-4 text-base font-semibold text-zinc-900 transition hover:bg-zinc-100"
              >
                PDB 바로가기
              </a>
            </div>
          </div>
        </div>
      </section>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
        className="space-y-6"
      >
        <section className="rounded-[24px] border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-zinc-950">입력 방식 선택</h2>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label
              className={`flex cursor-pointer items-start gap-4 rounded-[22px] border px-5 py-5 transition ${sourceMode === "example"
                ? "border-zinc-900 bg-zinc-50"
                : "border-zinc-200 bg-white hover:bg-zinc-50"
                } ${submitting ? "cursor-not-allowed opacity-70" : ""}`}
            >
              <input
                type="radio"
                name="sourceMode"
                checked={sourceMode === "example"}
                onChange={() => setSourceMode("example")}
                disabled={submitting}
                className="mt-1 h-4 w-4"
              />
              <div>
                <div className="text-2xl font-semibold text-zinc-950">예제 데이터 사용</div>
                <p className="mt-2 text-base leading-7 text-zinc-600">
                  논문에 사용된 LsrB 구조(1TJY, 1TM2)로 바로 실행합니다.
                </p>
              </div>
            </label>

            <label
              className={`flex cursor-pointer items-start gap-4 rounded-[22px] border px-5 py-5 transition ${sourceMode === "upload"
                ? "border-zinc-900 bg-zinc-50"
                : "border-zinc-200 bg-white hover:bg-zinc-50"
                } ${submitting ? "cursor-not-allowed opacity-70" : ""}`}
            >
              <input
                type="radio"
                name="sourceMode"
                checked={sourceMode === "upload"}
                onChange={() => setSourceMode("upload")}
                disabled={submitting}
                className="mt-1 h-4 w-4"
              />
              <div>
                <div className="text-2xl font-semibold text-zinc-950">직접 PDB 업로드</div>
                <p className="mt-2 text-base leading-7 text-zinc-600">
                  연구 중인 단백질 구조 파일을 업로드해 직접 분석합니다.
                </p>
              </div>
            </label>
          </div>
        </section>

        {isExample ? (
          <section className="rounded-[24px] border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-zinc-950">예제 설정</h2>

            <div className="mt-5 rounded-[22px] border border-zinc-200 bg-zinc-50 p-5">
              <div className="grid gap-3 text-sm text-zinc-800 sm:grid-cols-2">
                <InfoRow label="Structure A" value="1TJY" />
                <InfoRow label="Structure B" value="1TM2" />
                <InfoRow label="Chain A" value="A" />
                <InfoRow label="Chain B" value="A" />
                <InfoRow label="dcut" value="3.00" />
                <InfoRow label="Method" value="iterative" />
                <InfoRow label="max_domains" value="2" />
                <InfoRow label="실행 방식" value="사전 계산된 JSON 사용" />
              </div>

              <p className="mt-4 text-sm leading-6 text-zinc-700">
                예제는 매번 새로 계산하지 않고, 미리 생성한 결과 파일을 바로 읽어옵니다.
                변경 가능한 옵션은 postprocess뿐입니다.
              </p>
            </div>

            <label className="mt-4 flex items-start gap-3 rounded-[22px] border border-zinc-200 bg-zinc-50 p-5">
              <input
                type="checkbox"
                checked={postprocess}
                onChange={(e) => setPostprocess(e.target.checked)}
                disabled={submitting}
                className="mt-1"
              />
              <div>
                <div className="font-medium text-zinc-950">Postprocess 적용</div>
                <p className="mt-1 text-sm leading-6 text-zinc-600">
                  ON/OFF에 따라 미리 계산된 예제 결과를 각각 불러옵니다.
                </p>
              </div>
            </label>
          </section>
        ) : (
          <>
            <section className="rounded-[24px] border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-zinc-950">PDB 파일 업로드</h2>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-800">
                    PDB file A
                  </label>
                  <input
                    type="file"
                    accept=".pdb"
                    onChange={(e) => setFileA(e.target.files?.[0] ?? null)}
                    disabled={submitting}
                    className="block w-full rounded-2xl border border-zinc-300 p-3 text-sm"
                  />
                  <p className="mt-2 text-xs text-zinc-500">
                    {fileA ? fileA.name : "첫 번째 단백질 구조 파일(.pdb)"}
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-800">
                    PDB file B
                  </label>
                  <input
                    type="file"
                    accept=".pdb"
                    onChange={(e) => setFileB(e.target.files?.[0] ?? null)}
                    disabled={submitting}
                    className="block w-full rounded-2xl border border-zinc-300 p-3 text-sm"
                  />
                  <p className="mt-2 text-xs text-zinc-500">
                    {fileB ? fileB.name : "두 번째 단백질 구조 파일(.pdb)"}
                  </p>
                </div>
              </div>

              {uploadError ? (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {uploadError}
                </div>
              ) : null}
            </section>

            <section className="rounded-[24px] border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-zinc-950">Chain 선택</h2>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-800">
                    Chain A
                  </label>
                  <input
                    value={chainA}
                    onChange={(e) => setChainA(e.target.value)}
                    placeholder="예: A"
                    disabled={submitting}
                    className="w-full rounded-2xl border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-800">
                    Chain B
                  </label>
                  <input
                    value={chainB}
                    onChange={(e) => setChainB(e.target.value)}
                    placeholder="예: A"
                    disabled={submitting}
                    className="w-full rounded-2xl border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {chainError ? (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {chainError}
                </div>
              ) : null}
            </section>

            <section className="rounded-[24px] border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-zinc-950">분석 옵션</h2>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-800">
                    dcut
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={0.25}
                    value={dcut}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      if (Number.isNaN(value)) {
                        setDcut(0);
                        return;
                      }
                      setDcut(Math.round(value * 4) / 4);
                    }}
                    disabled={submitting}
                    className="w-full rounded-2xl border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-800">
                    Method
                  </label>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value as MethodType)}
                    disabled={submitting}
                    className="w-full rounded-2xl border border-zinc-300 px-3 py-2 text-sm"
                  >
                    <option value="iterative">iterative</option>
                    <option value="exact">exact</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-800">
                    max_domains
                  </label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={maxDomains}
                    onChange={(e) => setMaxDomains(Number(e.target.value) || 1)}
                    disabled={submitting || method !== "iterative"}
                    className="w-full rounded-2xl border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-800">
                    n_domains
                  </label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={nDomains}
                    onChange={(e) => setNDomains(Number(e.target.value) || 1)}
                    disabled={submitting || method !== "exact"}
                    className="w-full rounded-2xl border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
                  />
                </div>
              </div>

              <label className="mt-4 flex items-start gap-3 rounded-[22px] border border-zinc-200 bg-zinc-50 p-5">
                <input
                  type="checkbox"
                  checked={postprocess}
                  onChange={(e) => setPostprocess(e.target.checked)}
                  disabled={submitting}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium text-zinc-950">Apply postprocessing</div>
                  <p className="mt-1 text-sm leading-6 text-zinc-600">
                    결과를 더 해석하기 쉽게 정리하는 후처리를 적용합니다.
                  </p>
                </div>
              </label>

              {method === "exact" ? (
                <div className="mt-4 rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  exact는 계산량이 커서 실행 시간이 길어질 수 있습니다.
                </div>
              ) : null}
            </section>
          </>
        )}

        {error ? (
          <div className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {statusText ? (
          <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-4 text-sm text-zinc-700">
            <div>{statusText}</div>
            {submitting ? (
              <div className="mt-1 text-xs text-zinc-500">
                {isExample
                  ? "예제 결과를 불러오는 중입니다."
                  : "구조 비교와 도메인 탐색을 수행하고 있습니다."}
              </div>
            ) : null}
          </div>
        ) : null}

        {!isExample && longRunWarning && submitting ? (
          <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            현재 계산 시간이 길어지고 있습니다. 안정적인 실행을 위해 1분 후 자동 중단됩니다.
          </div>
        ) : null}

        <section className="rounded-[24px] border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-zinc-950">분석 실행</h2>
              <p className="mt-1 text-sm leading-6 text-zinc-600">
                {isExample
                  ? "논문 예제는 사전 계산된 결과를 바로 불러옵니다."
                  : "업로드한 PDB와 선택한 chain 기준으로 분석을 시작합니다."}
              </p>
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
            >
              {submitting ? "실행 중..." : "Run DAGR"}
            </button>
          </div>

          <div className="mt-4 rounded-[22px] border border-zinc-200 bg-zinc-50 px-5 py-4 text-sm text-zinc-600">
            안정적인 운영을 위해 업로드 파일과 결과 데이터는 일정 시간 후 자동 삭제됩니다.
          </div>

          <div className="mt-3 rounded-[22px] border border-zinc-200 bg-zinc-50 px-5 py-4 text-sm text-zinc-700">
            <p className="font-medium text-zinc-900">배포 데모 환경 안내</p>
            <p className="mt-1">
              예제 데이터는 사전 계산된 JSON을 사용하므로 즉시 결과를 볼 수 있습니다.
            </p>
            <p className="mt-1">
              업로드 분석만 실제 계산을 수행하며, 무거운 재현 실험은 로컬 환경 또는 더 높은 성능의 서버에서 실행하는 것을 권장합니다.
            </p>
          </div>
        </section>
      </form>
    </main>
  );
}
