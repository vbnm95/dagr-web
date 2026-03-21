import Link from "next/link";

export default function PaperPage() {
    return (
        <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-8 md:px-6">
            <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                <div className="mb-6">
                    <Link
                        href="/"
                        className="inline-flex rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
                    >
                        메인 화면으로 돌아가기
                    </Link>
                </div>

                <h1 className="text-3xl font-semibold tracking-tight">DAGR 논문 소개</h1>

                <p className="mt-4 text-base leading-7 text-zinc-700">
                    Sim, J., Sim, J., Park, E., & Lee, J. (2015). Method for identification of rigid domains and hinge residues in proteins based on exhaustive enumeration.
                    Proteins: Structure, Function, and Bioinformatics, 83(6), 1054-1067.
                </p>

                <div className="mt-6 grid gap-4 md:grid-cols-3">
                    <div className="rounded-xl border border-zinc-200 p-4">
                        <h2 className="font-semibold">개요</h2>
                        <p className="mt-2 text-sm leading-6 text-zinc-600">
                            DAGR는 두 단백질 구조를 비교하여 rigid domain, hinge residue,
                            non-overlapping residue를 구조적으로 분석하는 방법입니다.
                        </p>
                    </div>

                    <div className="rounded-xl border border-zinc-200 p-4">
                        <h2 className="font-semibold">핵심 결과</h2>
                        <p className="mt-2 text-sm leading-6 text-zinc-600">
                            rigid domain, hinge residue, uncovered residue, overlap 정도를 함께 확인할 수 있습니다.
                        </p>
                    </div>

                    <div className="rounded-xl border border-zinc-200 p-4">
                        <h2 className="font-semibold">이 웹앱의 목적</h2>
                        <p className="mt-2 text-sm leading-6 text-zinc-600">
                            논문 예제를 빠르게 재현하고, 이후에는 사용자가 직접 업로드한 단백질에도 적용할 수 있게 하는 것입니다.
                        </p>
                    </div>
                </div>
            </section>

            <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-semibold">논문 이미지</h2>

                <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
                    <img
                        src="/paper/dagr-paper-figure.png"
                        alt="DAGR paper figure"
                        className="h-auto w-full"
                    />
                </div>
            </section>
        </main>
    );
}