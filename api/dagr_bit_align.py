from __future__ import annotations

import argparse
import itertools
import json
import math
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple

import numpy as np
from Bio import Align


# =========================================================
# Amino-acid mapping
# =========================================================

AA3_TO_1 = {
    "ALA": "A", "ARG": "R", "ASN": "N", "ASP": "D", "CYS": "C",
    "GLN": "Q", "GLU": "E", "GLY": "G", "HIS": "H", "ILE": "I",
    "LEU": "L", "LYS": "K", "MET": "M", "PHE": "F", "PRO": "P",
    "SER": "S", "THR": "T", "TRP": "W", "TYR": "Y", "VAL": "V",
    "MSE": "M", "SEC": "U", "PYL": "O", "ASX": "B", "GLX": "Z",
    "UNK": "X", "HID": "H", "HIE": "H", "HIP": "H",
}


# =========================================================
# Data structures / errors
# =========================================================

@dataclass(frozen=True)
class ResidueRecord:
    chain_id: str
    resseq: int
    icode: str
    resname: str
    coord: np.ndarray

    @property
    def label(self) -> str:
        icode = self.icode.strip()
        return f"{self.chain_id}:{self.resname}{self.resseq}{icode}" if icode else f"{self.chain_id}:{self.resname}{self.resseq}"

    @property
    def one_letter(self) -> str:
        return AA3_TO_1.get(self.resname.upper(), "X")


class CliqueLimitExceeded(RuntimeError):
    pass


# =========================================================
# Basic bitmask helpers
# =========================================================

def fullmask(n: int) -> int:
    return (1 << n) - 1 if n > 0 else 0


def bit_to_index(bit: int) -> int:
    return bit.bit_length() - 1


def mask_popcount(mask: int) -> int:
    return mask.bit_count()


def mask_to_indices(mask: int) -> List[int]:
    out: List[int] = []
    while mask:
        bit = mask & -mask
        out.append(bit.bit_length() - 1)
        mask ^= bit
    return out


def indices_to_mask(indices: Sequence[int]) -> int:
    mask = 0
    for idx in indices:
        mask |= 1 << int(idx)
    return mask


def unique_masks_sorted(masks: Sequence[int]) -> List[int]:
    uniq = [m for m in set(masks) if m != 0]
    uniq.sort(key=lambda m: (-mask_popcount(m), m))
    return uniq


def union_masks(masks: Sequence[int]) -> int:
    out = 0
    for m in masks:
        out |= m
    return out


def overlap_union_mask(masks: Sequence[int]) -> int:
    out = 0
    for i in range(len(masks)):
        for j in range(i + 1, len(masks)):
            out |= masks[i] & masks[j]
    return out


def non_overlapping_parts_masks(masks: Sequence[int]) -> List[int]:
    parts: List[int] = []
    for i, mi in enumerate(masks):
        others_union = 0
        for j, mj in enumerate(masks):
            if i != j:
                others_union |= mj
        parts.append(mi & ~others_union)
    return parts


def masks_to_label_lists(masks: Sequence[int], residue_labels: Sequence[str]) -> List[List[str]]:
    return [[residue_labels[i] for i in mask_to_indices(m)] for m in masks]


# =========================================================
# PDB parsing
# =========================================================

def parse_pdb_ca(pdb_path: str | Path, chain_id: Optional[str] = None) -> List[ResidueRecord]:
    residues: List[ResidueRecord] = []

    with open(pdb_path, "r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            if not line.startswith(("ATOM", "HETATM")):
                continue

            atom_name = line[12:16].strip()
            altloc = line[16].strip()
            resname = line[17:20].strip()
            chain = line[21].strip() or "_"

            if atom_name != "CA":
                continue
            if altloc not in ("", "A"):
                continue
            if chain_id is not None and chain != chain_id:
                continue

            try:
                resseq = int(line[22:26].strip())
                icode = line[26].strip()
                x = float(line[30:38].strip())
                y = float(line[38:46].strip())
                z = float(line[46:54].strip())
            except ValueError:
                continue

            residues.append(
                ResidueRecord(
                    chain_id=chain,
                    resseq=resseq,
                    icode=icode,
                    resname=resname,
                    coord=np.array([x, y, z], dtype=np.float64),
                )
            )

    if not residues:
        raise ValueError(f"No CA atoms found in {pdb_path} for chain={chain_id!r}")

    return residues


# =========================================================
# Alignment-based residue matching
# =========================================================

def align_residue_lists(
    residues_a: Sequence[ResidueRecord],
    residues_b: Sequence[ResidueRecord],
    match_score: float = 2.0,
    mismatch_score: float = -1.0,
    open_gap_score: float = -10.0,
    extend_gap_score: float = -0.5,
) -> Tuple[List[ResidueRecord], List[ResidueRecord], Dict[str, float]]:
    seq_a = "".join(r.one_letter for r in residues_a)
    seq_b = "".join(r.one_letter for r in residues_b)

    aligner = Align.PairwiseAligner()
    aligner.mode = "global"
    aligner.match_score = match_score
    aligner.mismatch_score = mismatch_score
    aligner.open_gap_score = open_gap_score
    aligner.extend_gap_score = extend_gap_score

    alignment = aligner.align(seq_a, seq_b)[0]
    blocks_a, blocks_b = alignment.aligned

    matched_a: List[ResidueRecord] = []
    matched_b: List[ResidueRecord] = []
    identity_count = 0
    aligned_pairs = 0

    for (a0, a1), (b0, b1) in zip(blocks_a, blocks_b):
        block_len = a1 - a0
        if block_len != (b1 - b0):
            raise RuntimeError("Alignment block length mismatch.")

        for k in range(block_len):
            ra = residues_a[a0 + k]
            rb = residues_b[b0 + k]
            matched_a.append(ra)
            matched_b.append(rb)
            aligned_pairs += 1
            if ra.one_letter == rb.one_letter and ra.one_letter != "X":
                identity_count += 1

    if not matched_a:
        raise ValueError("Sequence alignment produced no matched residue pairs with CA coordinates.")

    meta = {
        "alignment_score": float(alignment.score),
        "seq_a_length": len(seq_a),
        "seq_b_length": len(seq_b),
        "aligned_pairs": aligned_pairs,
        "identity_count": identity_count,
        "identity_fraction": (identity_count / aligned_pairs) if aligned_pairs else 0.0,
    }
    return matched_a, matched_b, meta


# =========================================================
# Distance / graph construction
# =========================================================

def pairwise_distances(coords: np.ndarray) -> np.ndarray:
    diff = coords[:, None, :] - coords[None, :, :]
    return np.sqrt(np.sum(diff * diff, axis=2))


def build_neighbor_masks(coords_a: np.ndarray, coords_b: np.ndarray, dcut: float) -> List[int]:
    """
    |dA_ij - dB_ij| < dcut 이면 edge = 1
    """
    if coords_a.shape != coords_b.shape:
        raise ValueError("coords_a and coords_b must have the same shape.")

    dist_a = pairwise_distances(coords_a)
    dist_b = pairwise_distances(coords_b)

    invariant = np.abs(dist_a - dist_b) < dcut
    np.fill_diagonal(invariant, False)

    n = invariant.shape[0]
    neighbors = [0] * n
    for i in range(n):
        mask = 0
        for j in np.flatnonzero(invariant[i]):
            mask |= 1 << int(j)
        neighbors[i] = mask

    return neighbors


def build_contact_neighbor_masks(coords_a: np.ndarray, coords_b: np.ndarray, cutoff: float = 10.0) -> List[int]:
    """
    두 구조 중 하나에서라도 cutoff 이내면 contact.
    spatial split용 global contact masks.
    """
    if coords_a.shape != coords_b.shape:
        raise ValueError("coords_a and coords_b must have the same shape.")

    dist_a = pairwise_distances(coords_a)
    dist_b = pairwise_distances(coords_b)

    contact = (dist_a <= cutoff) | (dist_b <= cutoff)
    np.fill_diagonal(contact, False)

    n = contact.shape[0]
    neighbors = [0] * n
    for i in range(n):
        mask = 0
        for j in np.flatnonzero(contact[i]):
            mask |= 1 << int(j)
        neighbors[i] = mask

    return neighbors


# =========================================================
# Bron–Kerbosch maximal cliques (bitmask)
# =========================================================

def enumerate_maximal_cliques_bit(
    neighbors: Sequence[int],
    min_clique_size: int = 1,
    clique_limit: Optional[int] = None,
) -> List[int]:
    n = len(neighbors)
    if n == 0:
        return []

    sys.setrecursionlimit(max(10000, n * 20))
    all_vertices = fullmask(n)
    cliques: List[int] = []

    def choose_pivot(P: int, X: int) -> Optional[int]:
        PX = P | X
        if PX == 0:
            return None

        best_u = None
        best_score = -1
        tmp = PX

        while tmp:
            u_bit = tmp & -tmp
            u = bit_to_index(u_bit)
            score = mask_popcount(P & neighbors[u])
            if score > best_score:
                best_score = score
                best_u = u
            tmp ^= u_bit

        return best_u

    def bron_kerbosch(R: int, P: int, X: int) -> None:
        if clique_limit is not None and len(cliques) >= clique_limit:
            raise CliqueLimitExceeded(f"Stopped because clique_limit={clique_limit} was reached.")

        if P == 0 and X == 0:
            if mask_popcount(R) >= min_clique_size:
                cliques.append(R)
            return

        u = choose_pivot(P, X)
        candidates = P if u is None else (P & ~neighbors[u])

        while candidates:
            v_bit = candidates & -candidates
            v = bit_to_index(v_bit)

            bron_kerbosch(
                R | v_bit,
                P & neighbors[v],
                X & neighbors[v],
            )

            P &= ~v_bit
            X |= v_bit
            candidates &= ~v_bit

    bron_kerbosch(0, all_vertices, 0)
    cliques.sort(key=lambda m: (-mask_popcount(m), m))
    return cliques


# =========================================================
# Bitwise postprocessing: gap fill / fragment remove
# =========================================================

def k_consecutive_zero_starts(mask: int, n: int, k: int) -> int:
    """
    bit s가 1이면 s..s+k-1 구간이 전부 0
    """
    fm = fullmask(n)
    z = (~mask) & fm
    starts = z
    for t in range(1, k):
        starts &= (z >> t)
    return starts & fm


def k_consecutive_one_starts(mask: int, n: int, k: int) -> int:
    """
    bit s가 1이면 s..s+k-1 구간이 전부 1
    """
    fm = fullmask(n)
    starts = mask & fm
    for t in range(1, k):
        starts &= (mask >> t)
    return starts & fm


def expand_starts_to_runmask(starts: int, k: int, n: int) -> int:
    fm = fullmask(n)
    out = 0
    for t in range(k):
        out |= (starts << t)
    return out & fm


def smooth_domain_mask_bitwise(mask: int, n: int, min_len: int = 4) -> int:
    """
    길이 1,2,3 순서로
      1) 내부 gap fill
      2) exact fragment remove
    """
    fm = fullmask(n)
    m = mask & fm

    for k in range(1, min_len):
        # exact length-k internal gap fill
        zero_starts = k_consecutive_zero_starts(m, n, k)
        left_flank = (m << 1) & fm          # bit s <- original bit s-1
        right_flank = (m >> k) & fm         # bit s <- original bit s+k
        gap_starts = zero_starts & left_flank & right_flank
        m |= expand_starts_to_runmask(gap_starts, k, n)

        # exact length-k fragment remove
        one_starts = k_consecutive_one_starts(m, n, k)
        left_boundary = (~(m << 1)) & fm    # bit s <- not original bit s-1
        right_boundary = (~(m >> k)) & fm   # bit s <- not original bit s+k
        frag_starts = one_starts & left_boundary & right_boundary
        m &= ~expand_starts_to_runmask(frag_starts, k, n)

    return m & fm


# =========================================================
# Bitwise postprocessing: spatial split
# =========================================================

def split_mask_by_contact_bitwise(domain_mask: int, contact_neighbors: Sequence[int]) -> List[int]:
    """
    domain_mask 내부를 contact graph connected components로 분해
    """
    remaining = domain_mask
    components: List[int] = []

    while remaining:
        seed = remaining & -remaining
        frontier = seed
        component = 0

        while frontier:
            component |= frontier

            nbrs = 0
            tmp = frontier
            while tmp:
                bit = tmp & -tmp
                idx = bit_to_index(bit)
                nbrs |= contact_neighbors[idx]
                tmp ^= bit

            frontier = nbrs & domain_mask & ~component

        components.append(component)
        remaining &= ~component

    return components


def postprocess_candidate_domains(
    maximal_domains: Sequence[int],
    n_residues: int,
    contact_neighbors: Sequence[int],
    min_len: int = 4,
) -> List[int]:
    """
    raw maximal domains -> bitwise smoothing -> contact split -> dedup
    """
    out: List[int] = []

    for domain_mask in maximal_domains:
        smooth_mask = smooth_domain_mask_bitwise(domain_mask, n=n_residues, min_len=min_len)
        if mask_popcount(smooth_mask) < min_len:
            continue

        components = split_mask_by_contact_bitwise(smooth_mask, contact_neighbors)

        for comp in components:
            if mask_popcount(comp) >= min_len:
                out.append(comp)

    return unique_masks_sorted(out)


# =========================================================
# Selection methods
# =========================================================

def score_domains(domains: Sequence[int]) -> Tuple[int, int]:
    """
    higher is better:
      coverage 최대
      overlap(hinge) 최소
    """
    covered = union_masks(domains)
    hinge = overlap_union_mask(domains)
    return (mask_popcount(covered), -mask_popcount(hinge))


def select_domains_iterative_bit(
    candidate_domains: Sequence[int],
    n_residues: int,
    max_domains: Optional[int] = None,
    max_uncovered: int = 0,
) -> List[int]:
    selected: List[int] = []
    remaining = list(candidate_domains)

    current_union = 0
    current_hinge = 0

    while remaining:
        uncovered = n_residues - mask_popcount(current_union)
        if uncovered <= max_uncovered:
            break

        if max_domains is not None and len(selected) >= max_domains:
            break

        best_idx = None
        best_score = None

        for idx, domain in enumerate(remaining):
            new_union = current_union | domain
            new_hinge = current_hinge | (current_union & domain)

            score = (
                mask_popcount(new_union),      # coverage 최대
                -mask_popcount(new_hinge),     # overlap 최소
                mask_popcount(domain),         # tie-break
            )

            if best_score is None or score > best_score:
                best_score = score
                best_idx = idx

        if best_idx is None:
            break

        chosen = remaining.pop(best_idx)

        if mask_popcount(current_union | chosen) == mask_popcount(current_union):
            break

        current_hinge |= current_union & chosen
        current_union |= chosen
        selected.append(chosen)

    return selected


def select_domains_exact_bit(
    candidate_domains: Sequence[int],
    n_domains: int,
    max_exact_combinations: Optional[int] = 10_000_000,
) -> List[int]:
    if n_domains <= 0:
        raise ValueError("n_domains must be positive for exact mode.")

    if n_domains > len(candidate_domains):
        raise ValueError(
            f"n_domains={n_domains} cannot exceed number of candidate domains ({len(candidate_domains)})."
        )

    n_combinations = math.comb(len(candidate_domains), n_domains)

    if max_exact_combinations is not None and n_combinations > max_exact_combinations:
        raise ValueError(
            f"Exact search would require {n_combinations} combinations, "
            f"which exceeds max_exact_combinations={max_exact_combinations}."
        )

    best_combo = None
    best_score = None

    for combo in itertools.combinations(candidate_domains, n_domains):
        score = score_domains(combo)
        if best_score is None or score > best_score:
            best_score = score
            best_combo = combo

    return list(best_combo) if best_combo is not None else []

# =========================================================
# Result builder
# =========================================================

def build_result_dict(
    matched_a: Sequence[ResidueRecord],
    matched_b: Sequence[ResidueRecord],
    candidate_domains: Sequence[int],
    selected_domains: Sequence[int],
    dcut: float,
    metadata: Optional[Dict[str, object]] = None,
    maximal_domains: Optional[Sequence[int]] = None,
) -> Dict[str, object]:
    labels_a = [r.label for r in matched_a]
    labels_b = [r.label for r in matched_b]
    n = len(matched_a)

    covered = union_masks(selected_domains)
    hinge = overlap_union_mask(selected_domains)
    uncovered = fullmask(n) & ~covered
    non_overlap = non_overlapping_parts_masks(selected_domains)

    result = {
        "dcut": dcut,
        "n_residues": n,

        # 2D/3D 뷰에서 필요한 최소 매핑 정보
        "matched_labels_a": labels_a,
        "matched_labels_b": labels_b,

        # 실제 화면에 필요한 핵심 결과
        "selected_domains": [mask_to_indices(m) for m in selected_domains],
        "hinge": mask_to_indices(hinge),
        "uncovered": mask_to_indices(uncovered),
        "non_overlapping_parts": [mask_to_indices(m) for m in non_overlap],

        # summary
        "coverage_fraction": (mask_popcount(covered) / n) if n else 0.0,
        "overlap_fraction": (mask_popcount(hinge) / n) if n else 0.0,
        "hinge_count": mask_popcount(hinge),
        "uncovered_count": mask_popcount(uncovered),

        "metadata": {
            **(metadata or {}),
            # 개수 정도만 남기고 무거운 실제 리스트는 빼기
            "n_candidate_domains": len(candidate_domains),
            "n_selected_domains": len(selected_domains),
            "n_maximal_domains": len(maximal_domains) if maximal_domains is not None else None,
        },
    }

    return result


# =========================================================
# Main pipeline
# =========================================================

def run_dagr(
    pdb_a: str | Path,
    pdb_b: str | Path,
    chain_a: Optional[str] = None,
    chain_b: Optional[str] = None,
    dcut: float = 3.0,
    min_clique_size: int = 2,
    method: str = "iterative",
    max_domains: Optional[int] = None,
    n_domains: Optional[int] = None,
    max_uncovered: int = 0,
    clique_limit: Optional[int] = None,
    match_score: float = 2.0,
    mismatch_score: float = -1.0,
    open_gap_score: float = -10.0,
    extend_gap_score: float = -0.5,
    do_postprocess: bool = True,
    post_min_len: int = 4,
    post_contact_cutoff: float = 10.0,
    max_exact_combinations: int = 1_000_000,
    include_maximal_domains: bool = False,
) -> Dict[str, object]:
    residues_a = parse_pdb_ca(pdb_a, chain_a)
    residues_b = parse_pdb_ca(pdb_b, chain_b)

    matched_a, matched_b, align_meta = align_residue_lists(
        residues_a=residues_a,
        residues_b=residues_b,
        match_score=match_score,
        mismatch_score=mismatch_score,
        open_gap_score=open_gap_score,
        extend_gap_score=extend_gap_score,
    )

    coords_a = np.vstack([r.coord for r in matched_a])
    coords_b = np.vstack([r.coord for r in matched_b])

    rigidity_neighbors = build_neighbor_masks(coords_a, coords_b, dcut=dcut)

    maximal_domains = enumerate_maximal_cliques_bit(
        neighbors=rigidity_neighbors,
        min_clique_size=min_clique_size,
        clique_limit=clique_limit,
    )

    if do_postprocess:
        contact_neighbors = build_contact_neighbor_masks(
            coords_a=coords_a,
            coords_b=coords_b,
            cutoff=post_contact_cutoff,
        )
        candidate_domains = postprocess_candidate_domains(
            maximal_domains=maximal_domains,
            n_residues=len(matched_a),
            contact_neighbors=contact_neighbors,
            min_len=post_min_len,
        )
    else:
        candidate_domains = list(maximal_domains)

    if method == "iterative":
        selected_domains = select_domains_iterative_bit(
            candidate_domains=candidate_domains,
            n_residues=len(matched_a),
            max_domains=max_domains,
            max_uncovered=max_uncovered,
        )
    elif method == "exact":
        if n_domains is None:
            raise ValueError("Exact mode requires n_domains.")
        selected_domains = select_domains_exact_bit(
            candidate_domains=candidate_domains,
            n_domains=n_domains,
            max_exact_combinations=max_exact_combinations,
        )
    else:
        raise ValueError("method must be 'iterative' or 'exact'.")

    metadata = {
        "mapping_method": "global_sequence_alignment",
        "bitmask_backend": True,
        "method": method,
        "postprocessed": do_postprocess,
        "post_min_len": post_min_len,
        "post_contact_cutoff": post_contact_cutoff,
        "pdb_a": str(pdb_a),
        "pdb_b": str(pdb_b),
        "chain_a": chain_a,
        "chain_b": chain_b,
        "min_clique_size": min_clique_size,
        "max_domains": max_domains,
        "n_domains": n_domains,
        "max_uncovered": max_uncovered,
        "n_matched_residues": len(matched_a),
        "n_maximal_domains": len(maximal_domains),
        "n_candidate_domains": len(candidate_domains),
        "n_selected_domains": len(selected_domains),
        **align_meta,
    }

    return build_result_dict(
        matched_a=matched_a,
        matched_b=matched_b,
        candidate_domains=candidate_domains,
        selected_domains=selected_domains,
        dcut=dcut,
        metadata=metadata,
        maximal_domains=maximal_domains if include_maximal_domains else None,
    )


# =========================================================
# CLI / summary
# =========================================================

def print_summary(result: Dict[str, object]) -> None:
    meta = result["metadata"]
    print("=" * 90)
    print("DAGR bitmask result")
    print("=" * 90)
    print(f"method               : {meta['method']}")
    print(f"dcut                 : {result['dcut']}")
    print(f"n residues           : {result['n_residues']}")
    print(f"aligned pairs        : {meta['aligned_pairs']}")
    print(f"identity fraction    : {meta['identity_fraction']:.4f}")
    print(f"postprocessed        : {meta['postprocessed']}")
    print(f"n maximal domains    : {meta['n_maximal_domains']}")
    print(f"n candidate domains  : {meta['n_candidate_domains']}")
    print(f"n selected domains   : {meta['n_selected_domains']}")
    print(f"coverage fraction    : {result['coverage_fraction']:.4f}")
    print(f"overlap fraction     : {result['overlap_fraction']:.4f}")
    print(f"hinge size           : {len(result['hinge'])}")
    print(f"uncovered size       : {len(result['uncovered'])}")
    print()

    for i, domain in enumerate(result["selected_domains"], start=1):
        print(f"[Selected Domain {i}] size={len(domain)} first10={domain[:10]}")
    print()

    print("First 10 matched residue pairs:")
    for a_label, b_label in list(zip(result["matched_labels_a"], result["matched_labels_b"]))[:10]:
        print(f"  {a_label:<18} <-> {b_label}")

def none_or_int(x):
    if isinstance(x, str) and x.lower() == "none":
        return None
    return int(x)

def build_argparser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="DAGR bitmask implementation with alignment-based matching and optional postprocessing"
    )
    p.add_argument("pdb_a", type=str)
    p.add_argument("pdb_b", type=str)
    p.add_argument("--chain-a", type=str, default=None)
    p.add_argument("--chain-b", type=str, default=None)
    p.add_argument("--dcut", type=float, default=3.0)
    p.add_argument("--min-clique-size", type=int, default=2)
    p.add_argument("--method", choices=["iterative", "exact"], default="iterative")

    # iterative
    p.add_argument("--max-domains", type=int, default=None)
    p.add_argument("--max-uncovered", type=int, default=0)

    # exact
    p.add_argument("--n-domains", type=int, default=None)
    #p.add_argument("--max-exact-combinations", type=int, default=1_000_000)
    p.add_argument(
    "--max-exact-combinations",
    type=none_or_int,
    default=10_000_000,
    help="Maximum combinations allowed for exact mode. Use 'none' to disable the limit."
    )

    # safety
    p.add_argument("--clique-limit", type=int, default=None)

    # alignment
    p.add_argument("--match-score", type=float, default=2.0)
    p.add_argument("--mismatch-score", type=float, default=-1.0)
    p.add_argument("--open-gap-score", type=float, default=-10.0)
    p.add_argument("--extend-gap-score", type=float, default=-0.5)

    # postprocess
    p.add_argument("--no-postprocess", action="store_true")
    p.add_argument("--post-min-len", type=int, default=4)
    p.add_argument("--post-contact-cutoff", type=float, default=10.0)

    # output
    p.add_argument("--include-maximal-domains", action="store_true")
    p.add_argument("--json-out", type=str, default=None)

    return p


def main() -> None:
    args = build_argparser().parse_args()

    result = run_dagr(
        pdb_a=args.pdb_a,
        pdb_b=args.pdb_b,
        chain_a=args.chain_a,
        chain_b=args.chain_b,
        dcut=args.dcut,
        min_clique_size=args.min_clique_size,
        method=args.method,
        max_domains=args.max_domains,
        n_domains=args.n_domains,
        max_uncovered=args.max_uncovered,
        clique_limit=args.clique_limit,
        match_score=args.match_score,
        mismatch_score=args.mismatch_score,
        open_gap_score=args.open_gap_score,
        extend_gap_score=args.extend_gap_score,
        do_postprocess=not args.no_postprocess,
        post_min_len=args.post_min_len,
        post_contact_cutoff=args.post_contact_cutoff,
        max_exact_combinations=args.max_exact_combinations,
        include_maximal_domains=args.include_maximal_domains,
    )

    print_summary(result)

    if args.json_out:
        with open(args.json_out, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2)
        print(f"\nSaved JSON to: {args.json_out}")


if __name__ == "__main__":
    main()