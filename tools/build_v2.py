"""Build questions_v2.json from source_v2.py and check it for answer cues.

Run:  python3 tools/build_v2.py
Fails (exit 1) if a cue is found:
  - correct option is the unique longest too often (more than chance)
  - correct option is the unique shortest too often (reverse cue)
  - text options with very different lengths inside one question
  - absolute words (always/never/only/all) only in wrong options
  - unbalanced answer letters or 3+ same letter in a row
"""
import json
import random
import re
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from source_v2 import SOURCE

ROOT = Path(__file__).resolve().parent.parent
SEED = 20261103
MAX_RATIO = 1.30      # longest/shortest option length, text options only
MAX_RUN = 2
ABSOLUTE = re.compile(r"\b(always|never|only|all|none|every)\b", re.I)


def place_answers(source):
    """Move each correct option to a position so A-D are balanced, no long runs."""
    rng = random.Random(SEED)
    n = len(source)
    fixed = {i: q["answer"] for i, q in enumerate(source) if q.get("fixed")}
    free = [i for i in range(n) if i not in fixed]
    target = Counter({k: n // 4 for k in range(4)})
    for k in range(n % 4):
        target[k] += 1
    for pos in fixed.values():
        target[pos] -= 1
    for _ in range(10000):
        pool = [k for k in range(4) for _ in range(max(target[k], 0))]
        rng.shuffle(pool)
        seq = dict(fixed)
        seq.update(zip(free, pool))
        order = [seq[i] for i in range(n)]
        if all(len(set(order[i:i + MAX_RUN + 1])) > 1 for i in range(n - MAX_RUN)):
            break
    else:
        sys.exit("could not place answers without long runs")
    out = []
    for i, q in enumerate(source):
        q = dict(q)
        opts = list(q["options"])
        if not q.get("fixed"):
            correct, wrong = opts[0], opts[1:]
            rng.shuffle(wrong)
            wrong.insert(order[i], correct)
            opts = wrong
        q["options"], q["answer"] = opts, order[i]
        q.pop("fixed", None)
        out.append(q)
    return out


def check(qs):
    problems, rank = [], Counter()
    for n, q in enumerate(qs, 1):
        lens = [len(o) for o in q["options"]]
        c = lens[q["answer"]]
        if lens.count(max(lens)) == 1 and c == max(lens):
            rank["unique longest"] += 1
        elif lens.count(min(lens)) == 1 and c == min(lens):
            rank["unique shortest"] += 1
        else:
            rank["middle / tied"] += 1
        if min(lens) > 20 and max(lens) / min(lens) > MAX_RATIO:
            problems.append(f"Q{n}: option lengths {lens} vary too much (ratio > {MAX_RATIO})")
        for i, o in enumerate(q["options"]):
            if i != q["answer"] and ABSOLUTE.search(o) and not ABSOLUTE.search(q["options"][q["answer"]]):
                problems.append(f"Q{n}: absolute word only in a wrong option: {o!r}")
        if len(set(q["options"])) != 4:
            problems.append(f"Q{n}: duplicate options")
    chance = len(qs) / 4
    if rank["unique longest"] > chance:
        problems.append(f"correct is unique longest {rank['unique longest']}x (chance ≈ {chance:.1f})")
    if rank["unique shortest"] > chance:
        problems.append(f"correct is unique shortest {rank['unique shortest']}x (chance ≈ {chance:.1f})")
    letters = "".join("ABCD"[q["answer"]] for q in qs)
    pos = Counter(letters)
    if max(pos.values()) - min(pos.values()) > 1:
        problems.append(f"answer letters unbalanced: {dict(pos)}")
    if re.search(r"(.)\1{%d}" % MAX_RUN, letters):
        problems.append(f"same letter more than {MAX_RUN}x in a row: {letters}")
    return problems, rank, letters, pos


if __name__ == "__main__":
    qs = place_answers(SOURCE)
    for i, q in enumerate(qs, 1):
        q["id"] = i
    problems, rank, letters, pos = check(qs)
    print(f"{len(qs)} questions | length rank of correct: {dict(rank)}")
    print(f"answer letters: {dict(sorted(pos.items()))} | sequence {letters}")
    if problems:
        print("\nPROBLEMS:\n- " + "\n- ".join(problems))
        sys.exit(1)
    keys = ["id", "q", "code", "visual", "options", "answer", "topic", "hint", "explain"]
    data = {"title": "ML Classification & Regression Test", "version": 2, "passing": 60, "time_limit_min": 40,
            "questions": [{k: q[k] for k in keys if k in q} for q in qs]}
    (ROOT / "questions_v2.json").write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print("OK -> questions_v2.json")
