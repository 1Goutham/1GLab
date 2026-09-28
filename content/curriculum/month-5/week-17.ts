import type { LabSeed, TopicSeed } from "../../types";

export const topics: TopicSeed[] = [
  // ───────────────────────────────────────────────────────────────────────────
  {
    slug: "eval-datasets",
    title: "Eval datasets & golden sets",
    week: 17,
    domain: "ai",
    skills: ["ai-evaluation"],
    difficulty: "medium",
    minutes: 70,
    summary: "Turn \"it looks fine to me\" into a versioned set of cases and a number you can compare across prompts and models.",
    tags: ["evals", "golden-set", "testing", "cortex"],
    lesson: {
      hook: `You tweak the system prompt in Cortex so answers sound less robotic. You try five questions, they look better, you ship.

Two days later someone asks about a PDF table and Cortex now invents numbers it used to quote correctly. Nothing crashed. No test failed. You simply had no way to know.

That is the default state of every LLM app: **vibes-driven development**. A golden set is the fix — a file of real inputs with known-good expectations that you run on every change, exactly like a unit test suite, except the thing under test is non-deterministic and the "assert" is fuzzier.`,
      whyItMatters: "Every serious AI team decides between prompts, models and retrieval settings with an eval set. Without one you cannot tell improvement from noise, and you cannot safely upgrade models.",
      levels: {
        l1: "An eval dataset is a list of questions your app should handle, each paired with what a good answer looks like. You run your app over the whole list and count how many it gets right. Change something, run it again, compare the two numbers.",
        l2: {
          text: `A golden set is a living artefact. It starts small (20–50 cases written by hand), then grows from production: every bug report, every thumbs-down, every weird failure becomes a new case before you fix it — exactly like writing a failing test before fixing a bug.

Tag every case (\`table\`, \`multi-doc\`, \`no-answer\`, \`injection\`) so a score drop tells you *where* things broke, not just that they did.`,
          analogy: "It is the Jest suite for your prompt. You would never refactor FabricNest's checkout without tests; changing a prompt is a refactor of the most fragile code you own.",
          diagram: {
            type: "cycle",
            title: "The golden-set flywheel",
            center: "golden.jsonl",
            steps: [
              { label: "Failure seen", note: "bug report, thumbs-down, trace" },
              { label: "Write the case", note: "input + expected + tags", accent: true },
              { label: "Watch it fail", note: "reproduce before fixing" },
              { label: "Fix prompt / retrieval" },
              { label: "Run full suite", note: "no regressions elsewhere" },
              { label: "Commit case + fix", note: "the set only grows" },
            ],
          },
        },
        l3: {
          text: `A case needs four things: a stable \`id\`, the \`input\`, an \`expected\` value (or reference answer), and \`tags\`. Store it as **JSONL** — one JSON object per line — so diffs are readable in a PR and you can append without rewriting the file.

Pick the cheapest scorer that is still honest:

- **Exact / normalised match** — extraction, classification, short factual answers.
- **Contains / regex** — "the answer must mention 14 days".
- **Structural** — valid JSON, required keys, citation ids exist in the retrieved set.
- **Rubric via LLM judge** — open-ended answers (next topic).

Deterministic scorers first: they are free, fast and never disagree with themselves. Reach for a judge only where no code check exists.`,
          code: [
            {
              title: "golden.jsonl — three Cortex cases",
              lang: "json",
              code: `{"id": "refund-001", "input": "How many days do customers have to request a refund?", "expected": "14 days", "tags": ["policy", "single-doc"]}
{"id": "table-004", "input": "What was Q3 revenue in the 2024 report?", "expected": "4.2M", "tags": ["table", "numbers"]}
{"id": "none-002", "input": "What is the CEO's home address?", "expected": "NOT_IN_DOCS", "tags": ["no-answer", "critical"]}`,
            },
            {
              title: "A minimal eval runner (plug in any generate function)",
              lang: "python",
              code: `import json
from dataclasses import dataclass
from typing import Callable

@dataclass
class Case:
    id: str
    input: str
    expected: str
    tags: list[str]

def load_cases(path: str) -> list[Case]:
    with open(path) as f:
        return [Case(**json.loads(line)) for line in f if line.strip()]

def normalise(s: str) -> str:
    return " ".join(s.lower().strip().rstrip(".").split())

def score(output: str, expected: str) -> bool:
    return normalise(expected) in normalise(output)   # "contains" scorer

def run(cases: list[Case], generate: Callable[[str], str]) -> dict:
    results = []
    for c in cases:
        out = generate(c.input)
        results.append({"id": c.id, "tags": c.tags, "pass": score(out, c.expected), "output": out})
    return {"score": sum(r["pass"] for r in results) / len(results), "results": results}

if __name__ == "__main__":
    fake = lambda q: "Customers have 14 days." if "refund" in q else "NOT_IN_DOCS"
    report = run(load_cases("golden.jsonl"), fake)
    print(f"score={report['score']:.0%}")
    for r in report["results"]:
        if not r["pass"]:
            print("FAIL", r["id"], r["tags"], repr(r["output"]))`,
              note: "Swap `fake` for your real Cortex pipeline. The runner never changes; only generate() does.",
            },
          ],
        },
        l4: {
          text: `**How big does the set need to be?** An accuracy measured on n cases has a standard error of roughly \`sqrt(p(1-p)/n)\`. At p = 0.8 and n = 25 that is 0.08 — a 95% interval of about ±16 points. So "prompt B scored 84% vs 80%" on 25 cases is one case of difference: noise.

Two things fix this. First, **pair the comparison**: run both prompts on the *same* cases and look at per-case wins and losses, which removes the variance from case difficulty. Second, grow n where it matters — 100–300 cases is where differences of a few points start to mean something.

Other properties of a good set:

- **Stratified**: easy cases, hard cases, adversarial cases and "should refuse" cases. A set of only easy questions saturates at 100% and stops telling you anything.
- **Versioned**: \`golden.jsonl\` lives in git next to the prompt. A score is meaningless without the dataset version it was measured on.
- **Uncontaminated**: never paste golden cases into the prompt as few-shot examples. You would be grading the model on the answer key.`,
          code: [
            {
              title: "Paired bootstrap: is prompt B really better than A?",
              lang: "python",
              code: `import random

def paired_bootstrap(a: list[int], b: list[int], iters: int = 10_000, seed: int = 0) -> float:
    """a, b: per-case pass (1) / fail (0) for two prompts on the SAME cases.
    Returns the share of resamples in which B beats A."""
    rng = random.Random(seed)
    n = len(a)
    wins = 0
    for _ in range(iters):
        idx = [rng.randrange(n) for _ in range(n)]
        if sum(b[i] - a[i] for i in idx) > 0:
            wins += 1
    return wins / iters

a = [1,1,0,1,0,1,1,0,1,1,1,0,1,1,0,1,1,1,0,1,1,1,0,1,1]  # 18/25
b = [1,1,1,1,0,1,1,0,1,1,1,1,1,1,0,1,1,1,1,1,1,1,0,1,1]  # 21/25
print(f"A={sum(a)/25:.0%} B={sum(b)/25:.0%} P(B>A)={paired_bootstrap(a, b):.3f}")`,
              note: "B fixes 3 cases and breaks none, so about 96% of resamples favour B (the rest are ties where none of the 3 cases was drawn). If B had fixed 5 and broken 2, the same 3-point gap would be far less convincing.",
            },
          ],
        },
        l5: {
          question: "You are launching a RAG assistant next month and have zero users. How do you build the first evaluation set, and how do you keep it useful after launch?",
          hint: "Where do cases come from before and after you have traffic? What goes in besides happy paths?",
          answer: `Before launch I would write 30–50 cases by hand from the actual documents: pick passages, write the question a real user would ask, and record the reference answer plus the source chunk id so I can score retrieval and generation separately. I would deliberately include hard categories — tables, answers spanning two documents, questions whose answer is not in the corpus, and a few injection attempts — and tag each case. I can use an LLM to draft extra questions from chunks, but I would review every one, because synthetic sets skew towards easy, lexically-matching questions. After launch, the set grows from production: I sample traces weekly, especially thumbs-down and low-confidence ones, and every confirmed failure becomes a case before it is fixed. The file is versioned in git next to the prompts, scores are always reported with the dataset version, and I keep a held-out slice I never look at while tuning so I notice overfitting to the set.`,
        },
      },
      commonMistakes: [
        "Only happy-path cases. The set hits 100% within a week and then cannot detect anything; you need \"should refuse\", adversarial and multi-hop cases.",
        "Declaring a winner from a 2–4 point difference on 25 cases. That is one case — rerun with paired comparison or more cases.",
        "Copying golden cases into the prompt as few-shot examples, which quietly turns the eval into a memory test.",
        "Scoring only the final answer in a RAG app. Store the expected source id too, so you can tell a retrieval miss from a generation mistake.",
      ],
      tryThis: "Run the same eval twice with temperature 0.7 and diff the per-case results. The number of cases that flip is your noise floor — any improvement smaller than that is not real.",
      miniTask: {
        title: "Write Cortex's first 15 golden cases",
        kind: "build",
        minutes: 35,
        steps: [
          "Pick 3 documents you actually use (a README, a PDF with a table, a policy page).",
          "Write 10 answerable questions with short expected answers and the source document id.",
          "Write 3 questions whose answer is NOT in the documents (expected: NOT_IN_DOCS) and 2 that need two documents combined.",
          "Save as golden.jsonl with id, input, expected, source and tags fields.",
          "Run the minimal runner above with a fake generate() to prove the plumbing works.",
        ],
        checklist: [
          "15 lines of valid JSONL (python -c 'import json; [json.loads(l) for l in open(\"golden.jsonl\")]' runs clean)",
          "Every case has at least one tag, and at least 4 distinct tags are used",
          "At least 3 no-answer cases and 2 multi-document cases",
          "The runner prints a score and lists failures by id",
        ],
        deliverable: "golden.jsonl plus run_eval.py committed to the Cortex repo under evals/.",
      },
      quiz: [
        {
          q: "Prompt B scores 84% and prompt A scores 80% on a 25-case set. What is the most accurate conclusion?",
          options: [
            "B is 4 points better and should ship",
            "The difference is one case; look at per-case wins/losses or add cases before deciding",
            "A is better because it is more conservative",
            "The eval is broken because scores should be identical",
          ],
          answer: 1,
          explain: "On 25 cases each case is worth 4 points and the standard error is about 8 points. A paired look at which cases flipped tells you far more than the two totals.",
        },
        {
          q: "Why store golden sets as JSONL rather than one big JSON array?",
          options: [
            "JSONL is faster for the LLM to read",
            "JSON cannot store strings with spaces",
            "One case per line gives clean git diffs, easy appends and streaming reads",
            "JSONL enforces a schema",
          ],
          answer: 2,
          explain: "Adding a case is a one-line diff in a PR, and tools can stream a large file line by line. JSONL does not enforce any schema — you still validate it.",
        },
        {
          q: "Which case is MOST valuable to add to a new RAG golden set?",
          options: [
            "A question whose answer is not in any document, expecting a refusal",
            "A fifth paraphrase of an easy question that already passes",
            "A question copied verbatim from the few-shot examples in the prompt",
            "A question about general world knowledge the base model already knows",
          ],
          answer: 0,
          explain: "No-answer cases catch hallucination, the most damaging RAG failure. Paraphrases of passing cases add little signal, and few-shot copies contaminate the set.",
        },
      ],
      explainPrompt: "Explain to a junior engineer why \"I tried five questions and it looks better\" is not evidence, and what a golden set gives you instead. Use five sentences and mention sample size.",
      implementPrompt: "From memory, write a Python eval runner that loads a JSONL golden set, calls a generate(input) function, scores with a normalised contains-check, and prints the score plus failures grouped by tag.",
      videos: [
        {
          title: "Your AI product needs evals",
          channel: "Hamel Husain",
          url: "https://www.youtube.com/results?search_query=hamel+husain+your+ai+product+needs+evals",
          kind: "search",
          reason: "Watch this for the practitioner view of where eval cases come from and why looking at data beats clever metrics.",
        },
      ],
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    slug: "llm-as-judge",
    title: "LLM-as-judge",
    week: 17,
    domain: "ai",
    skills: ["ai-evaluation"],
    difficulty: "hard",
    minutes: 80,
    summary: "Use a model to grade open-ended answers — and prove, with human labels and agreement stats, that the grader can be trusted.",
    prerequisites: ["eval-datasets"],
    tags: ["evals", "llm-judge", "rubric", "calibration"],
    lesson: {
      hook: `"Summarise the key risks in this contract" has no single right answer. Exact match is useless, and you are not going to hand-grade 300 answers every time you change a prompt.

So you ask a second model to grade the first. It works surprisingly well — and fails in very specific, predictable ways. Judges prefer the answer shown first, prefer longer answers, prefer their own writing style, and will happily give 8/10 to a confident hallucination.

An LLM judge is a measuring instrument. Before you trust a thermometer, you check it against ice water. Before you trust a judge, you check it against your own labels.`,
      whyItMatters: "Judges are how teams evaluate open-ended output at scale. Knowing how to design a rubric and measure judge-human agreement is what separates a real eval pipeline from a random number generator.",
      levels: {
        l1: "You write clear grading instructions, give a model the question, the answer and any sources, and ask it to grade. Then you grade 30 answers yourself and check how often the model agrees with you. If it disagrees a lot, you fix the instructions, not the answers.",
        l2: {
          text: `There are two judge shapes. **Pointwise**: grade one answer against a rubric ("is every claim supported by the sources? yes/no"). **Pairwise**: show two answers and ask which is better — easier for models, and ideal for comparing prompt A with prompt B.

The rubric is the product. Binary, specific criteria ("cites a source for every number") beat vague scales ("rate helpfulness 1–10"), because a 1–10 scale has no shared meaning between you and the model.`,
          analogy: "A new teaching assistant grading exams. You do not let them loose on the whole class — you both grade the same 30 scripts, compare, and tighten the marking scheme where you disagreed.",
          diagram: {
            type: "flow",
            title: "Calibrating a judge",
            lanes: [
              {
                label: "Untrusted",
                tone: "bad",
                steps: [
                  { label: "Vague prompt", note: "\"rate 1-10\"" },
                  { label: "Run judge" },
                  { label: "Report average", note: "nobody knows what 7.3 means" },
                ],
              },
              {
                label: "Calibrated",
                tone: "good",
                steps: [
                  { label: "Human labels", note: "30 outputs, pass/fail" },
                  { label: "Binary rubric" },
                  { label: "Run judge" },
                  { label: "Agreement + kappa", accent: true },
                  { label: "Fix rubric on disagreements" },
                ],
              },
            ],
          },
        },
        l3: {
          text: `Rules that make judges reliable:

- **One criterion per check, binary where possible.** Three yes/no checks beat one 1–10 score.
- **Reasoning before the verdict.** Ask for a short justification *then* the label, so the label is conditioned on the reasoning.
- **Give it the evidence.** For groundedness, pass the retrieved sources; a judge cannot check citations it cannot see.
- **Temperature 0, JSON output**, and log the judge's reasoning — reading it is how you find rubric bugs.
- **Use a model at least as capable as the one being judged** for hard criteria; a cheap model is fine for format checks.`,
          code: [
            {
              title: "A pointwise groundedness judge (OpenAI SDK, JSON mode)",
              lang: "python",
              code: `import json
from openai import OpenAI

client = OpenAI()  # reads OPENAI_API_KEY

RUBRIC = """You grade answers from a research assistant.

Question: {question}
Sources:
{sources}
Answer: {answer}

Check each criterion and answer 1 (yes) or 0 (no):
- grounded: every factual claim in the answer is supported by the sources
- cited: every factual claim has a citation like [doc-3] naming a source above
- responsive: the answer addresses the question that was asked

Return JSON with keys: reasoning (max 2 sentences, written first),
grounded, cited, responsive."""

def judge(question: str, sources: str, answer: str) -> dict:
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        temperature=0,
        response_format={"type": "json_object"},
        messages=[{"role": "user", "content": RUBRIC.format(
            question=question, sources=sources, answer=answer)}],
    )
    return json.loads(resp.choices[0].message.content)

print(judge(
    "How long is the refund window?",
    "[doc-1] Refunds are accepted within 14 days of delivery.",
    "You have 30 days to request a refund [doc-1].",
))`,
              note: "The example answer cites a real doc but misquotes it — a good judge returns grounded=0, cited=1. JSON mode needs the word JSON in the prompt, which it has.",
            },
          ],
        },
        l4: {
          text: `**Agreement is not enough — use Cohen's kappa.** If 90% of outputs are good, a judge that always says "pass" agrees with you 90% of the time and is useless. Kappa corrects for chance: \`(p_observed - p_expected) / (1 - p_expected)\`. Roughly: below 0.4 is poor, 0.6+ is usable, 0.8+ is strong. Also look at the confusion matrix — a judge that misses real failures (false passes) is worse than one that is overly strict.

**Known biases and their fixes:**

- **Position bias** in pairwise judging: run each pair twice with the order swapped; only count a win if it survives the swap, otherwise record a tie.
- **Verbosity bias**: longer answers score higher. State in the rubric that length is not a criterion, and check correlation between score and length.
- **Self-preference**: a model rates text in its own style higher. Where possible, judge with a different model family than the generator.

Treat the judge prompt like production code: version it, and re-run the calibration set whenever you change it or the judge model.`,
          code: [
            {
              title: "Cohen's kappa and a position-debiased pairwise judge",
              lang: "python",
              code: `from collections import Counter
from typing import Callable

def cohens_kappa(human: list[int], judge: list[int]) -> float:
    n = len(human)
    p_obs = sum(h == j for h, j in zip(human, judge)) / n
    ch, cj = Counter(human), Counter(judge)
    p_exp = sum((ch[k] / n) * (cj[k] / n) for k in set(human) | set(judge))
    return 1.0 if p_exp == 1 else (p_obs - p_exp) / (1 - p_exp)

def pairwise(q: str, a: str, b: str, ask: Callable[[str, str, str], str]) -> str:
    """ask(question, first, second) returns 'first' or 'second'."""
    run1 = ask(q, a, b)
    run2 = ask(q, b, a)          # same pair, order swapped
    if run1 == "first" and run2 == "second":
        return "a"
    if run1 == "second" and run2 == "first":
        return "b"
    return "tie"                 # verdict flipped with order: position bias

human = [1] * 27 + [0] * 3
always_pass = [1] * 30
print(sum(h == j for h, j in zip(human, always_pass)) / 30)  # 0.9 agreement
print(cohens_kappa(human, always_pass))                      # 0.0 kappa`,
              note: "90% agreement, zero kappa: the judge learned nothing beyond the base rate.",
            },
          ],
        },
        l5: {
          question: "Your team uses an LLM judge that scores answers 1–10 for \"quality\". The average went from 7.4 to 7.9 after a prompt change and the PM wants to ship. What do you check before trusting that?",
          hint: "Think about what the number means, whether the judge agrees with humans, and whether the change could have gamed the judge.",
          answer: `First, what 7.4 and 7.9 mean: a holistic 1–10 score has no anchored definition, so I would push to replace it with a few binary criteria tied to real failure modes — grounded, cited, answered the question. Second, calibration: I would hand-label a sample of 30–50 outputs from both prompts and measure judge agreement and Cohen's kappa against my labels; if kappa is low, the 0.5 delta is noise from the instrument. Third, bias: if the new prompt produces longer or more confident answers, a verbosity-biased judge will reward that even if accuracy dropped, so I would check score against answer length and read the disagreements. Fourth, statistics: compare per-case, paired, on the same inputs and see how many cases actually flipped. Only if the calibrated judge and a paired comparison both favour the new prompt would I ship it, and I would log the judge prompt version with the result.`,
        },
      },
      commonMistakes: [
        "Using a 1–10 scale and reporting the average. Nobody, including the judge, can say what separates a 6 from a 7.",
        "Never measuring judge-human agreement, so a broken judge silently approves regressions.",
        "Reporting raw agreement on an imbalanced set. Always compute kappa or look at the confusion matrix.",
        "Pairwise judging in one order only — position bias alone can swing results by double digits.",
      ],
      tryThis: "Take one answer, append two paragraphs of polite, irrelevant filler, and judge both versions with a \"rate helpfulness 1-10\" prompt. If the padded version scores higher, you have just measured verbosity bias.",
      miniTask: {
        title: "Catch a judge being wrong",
        kind: "code",
        minutes: 35,
        steps: [
          "Write 8 (question, sources, answer) triples: 4 correct, 2 with a wrong number, 1 with a missing citation, 1 that ignores the question.",
          "Label each yourself for grounded / cited / responsive.",
          "Run the groundedness judge above on all 8 and record its verdicts and reasoning.",
          "Compute agreement per criterion and find every disagreement.",
          "Change one line of the rubric to fix the most common disagreement and re-run.",
        ],
        checklist: [
          "8 labelled triples saved to a JSONL file",
          "A table of human vs judge verdicts per criterion",
          "At least one disagreement explained by reading the judge's reasoning",
          "A rubric edit and a before/after agreement number",
        ],
        deliverable: "judge.py, labels.jsonl and a 5-line note on what the rubric edit fixed.",
      },
      quiz: [
        {
          q: "Your judge agrees with human labels 92% of the time, but 92% of outputs are good. What should you conclude?",
          options: [
            "The judge is excellent",
            "The judge may just be saying \"pass\" to everything; compute kappa and check false passes",
            "The humans are wrong",
            "You need a larger model",
          ],
          answer: 1,
          explain: "Agreement equal to the base rate is exactly what a constant \"pass\" judge achieves. Kappa corrects for chance agreement.",
        },
        {
          q: "What is the standard mitigation for position bias in pairwise judging?",
          options: [
            "Always put the new answer first",
            "Raise the temperature",
            "Judge each pair in both orders and only count consistent wins",
            "Ask for a 1–10 score instead",
          ],
          answer: 2,
          explain: "Swapping the order and requiring consistency turns order-driven verdicts into ties instead of false wins.",
        },
        {
          q: "Why ask the judge for its reasoning before the verdict?",
          options: [
            "It makes the JSON valid",
            "It reduces cost",
            "Tokens are generated left to right, so the verdict is conditioned on the reasoning, and you can read why it decided",
            "The API requires it",
          ],
          answer: 2,
          explain: "A verdict generated first cannot use the reasoning that follows. Reading the reasoning is also how you debug the rubric.",
        },
      ],
      explainPrompt: "Explain LLM-as-judge to a junior engineer in five sentences, including one bias and how calibration against human labels works.",
      implementPrompt: "From memory, implement cohens_kappa(human, judge) and a pairwise(q, a, b, ask) function that swaps order to cancel position bias.",
      videos: [
        {
          title: "LLM-as-a-judge: building judges you can trust",
          channel: "Hamel Husain",
          url: "https://www.youtube.com/results?search_query=hamel+husain+llm+as+a+judge",
          kind: "search",
          reason: "Watch this for the critique-shadowing workflow: aligning a judge with a domain expert's labels step by step.",
        },
      ],
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    slug: "evals-in-ci",
    title: "Regression evals in CI",
    week: 17,
    domain: "ai",
    skills: ["ai-evaluation", "ci-cd"],
    difficulty: "medium",
    minutes: 60,
    summary: "Run your eval suite on every pull request and fail the build when quality drops — with tolerances that respect LLM noise.",
    prerequisites: ["eval-datasets", "llm-as-judge"],
    tags: ["evals", "ci", "regression", "quality-gate"],
    lesson: {
      hook: `You have a golden set and a judge. You run them... when you remember. Which means the prompt tweak you merged on Friday evening never got evaluated.

Tests that run manually do not get run. The moment evals live in CI, every PR that touches a prompt, a retrieval parameter or a model name gets a score next to it — and a red X if it made things worse.

The hard part is not the YAML. It is deciding what "worse" means for a non-deterministic system without either blocking every PR on noise or letting real regressions through.`,
      whyItMatters: "An eval gate is what lets you upgrade models, refactor prompts and accept contributions with confidence. It turns evaluation from a research activity into an engineering guardrail.",
      levels: {
        l1: "Every time someone opens a pull request, a robot runs your eval suite and compares the score to the last known-good score. If the new score is meaningfully lower, the pull request is blocked until someone looks.",
        l2: {
          text: `Not every eval belongs on every PR. Layer them by cost and speed, the same way you layer unit, integration and end-to-end tests.

The PR gate should be fast (under ~5 minutes) and cheap, so people do not learn to ignore or bypass it. The expensive judge-heavy suite runs nightly or before a release.`,
          analogy: "Lighthouse CI for your prompt. Just as you would block a PR that drops FabricNest's performance score from 95 to 70, you block one that drops groundedness from 0.92 to 0.80.",
          diagram: {
            type: "stack",
            title: "Eval tiers",
            layers: [
              { label: "Unit tests", note: "every commit · seconds · parsers, tools, prompt templates" },
              { label: "PR smoke evals", note: "every PR · ~25-50 cases · deterministic scorers + cached calls", accent: true },
              { label: "Nightly full suite", note: "300+ cases · LLM judge · trend dashboard" },
              { label: "Online evals", note: "sampled production traces · judge + user feedback" },
            ],
          },
        },
        l3: {
          text: `The gate compares a fresh results file against a committed **baseline**. Design choices that matter:

- **Tolerance, not equality.** Allow a small drop (for example 2 points) for noise; fail beyond that.
- **Critical cases never fail.** Tag must-pass cases (\`critical\`: refusals, safety, injection). Any failure there blocks, regardless of average.
- **Update the baseline deliberately**, in the PR that improves things, so reviewers see the number move.
- **Print a readable diff** — which metric, which cases — so the red X is actionable from the CI log.`,
          code: [
            {
              title: "evals/gate.py — fail the build on regression",
              lang: "python",
              code: `import json
import sys
from pathlib import Path

TOLERANCE = 0.02  # allowed drop before we call it a regression

def main() -> int:
    current = json.loads(Path("evals/results.json").read_text())
    baseline = json.loads(Path("evals/baseline.json").read_text())
    failed = False

    for metric, base in baseline["metrics"].items():
        now = current["metrics"].get(metric, 0.0)
        delta = now - base
        status = "ok"
        if delta < -TOLERANCE:
            status = "REGRESSION"
            failed = True
        print(f"{metric:<14} base={base:.3f} now={now:.3f} delta={delta:+.3f} {status}")

    critical = [r["id"] for r in current["results"]
                if "critical" in r["tags"] and not r["pass"]]
    if critical:
        print("critical cases failing:", ", ".join(critical))
        failed = True

    return 1 if failed else 0

if __name__ == "__main__":
    sys.exit(main())`,
              note: "A non-zero exit code is all CI needs to mark the check red. Run it after the eval runner writes results.json.",
            },
          ],
        },
        l4: {
          text: `**Noise.** Temperature 0 does not make hosted models deterministic — batching and floating-point order on the provider's GPUs cause occasional different outputs. On a 25-case set one flipped case is 4 points, which is why the tolerance exists. Better still, gate on *per-case* changes: fail if more than k previously-passing cases now fail.

**Cost and speed.** Cache model responses keyed by a hash of everything that affects the output (model, prompt template version, input, parameters). A PR that only touches the UI then re-uses every cached answer and the eval costs nothing. Change the prompt and the hash changes, so only affected calls are re-run.

**Secrets.** Evals need an API key, and GitHub does not pass secrets to workflows triggered by pull requests from forks. For a personal repo that is fine; for open source, run the gated suite only on branches in the main repo.`,
          code: [
            {
              title: "Content-addressed response cache for evals",
              lang: "python",
              code: `import hashlib
import json
from pathlib import Path
from typing import Callable

CACHE = Path(".evalcache")
CACHE.mkdir(exist_ok=True)

def cached_call(model: str, prompt_version: str, prompt: str,
                call: Callable[[str, str], str]) -> str:
    key_src = json.dumps([model, prompt_version, prompt], sort_keys=True)
    key = hashlib.sha256(key_src.encode()).hexdigest()
    path = CACHE / (key + ".json")
    if path.exists():
        return json.loads(path.read_text())["output"]
    output = call(model, prompt)
    path.write_text(json.dumps({"model": model, "output": output}))
    return output`,
              note: "Persist .evalcache between CI runs with actions/cache, keyed on the golden set and prompt files.",
            },
          ],
        },
        l5: {
          question: "Your eval gate is flaky: the same commit passes and fails on re-runs, and the team has started clicking \"re-run\" until it goes green. How do you fix it?",
          hint: "Where does the variance come from, and how can the gate be both stable and still sensitive?",
          answer: `First I would measure the noise: run the suite five times on one commit and count how many cases flip, which gives the real noise floor. Then I would reduce the variance at the source — temperature 0, pinned model versions rather than aliases, a response cache so unchanged inputs reuse identical outputs, and deterministic scorers wherever a code check exists. For the judge-scored metrics I would set the tolerance above the measured noise floor, or switch the gate to per-case comparison: fail only if more than k previously-passing cases now fail, and always fail on critical-tagged cases. If the set is too small to be both stable and sensitive, I would grow it, since noise shrinks with the square root of n. Finally I would make the heavy, noisier judge suite advisory on PRs and blocking only nightly, so the PR gate stays trusted — a gate people bypass is worse than no gate.`,
        },
      },
      commonMistakes: [
        "Gating on exact equality with the baseline, so every harmless one-case flip blocks the PR and people learn to bypass it.",
        "Pointing evals at a model alias like \"latest\", so the score changes when the provider ships an update and nobody touched the code.",
        "Running the full judge-heavy suite on every PR — slow, expensive, and noisy.",
        "Updating baseline.json in a separate commit nobody reviews, which hides regressions.",
      ],
      tryThis: "Run your eval three times in a row without changing anything and write down the three scores. That spread is the minimum tolerance your gate can use.",
      miniTask: {
        title: "Make your eval runner gate-able",
        kind: "code",
        minutes: 30,
        steps: [
          "Change your eval runner to write evals/results.json with metrics and per-case results.",
          "Run it once on the current prompt and save the metrics as evals/baseline.json.",
          "Add gate.py and run it locally; confirm exit code 0 (echo $? after running it).",
          "Deliberately break the prompt (for example remove the citation instruction), re-run the eval and the gate.",
          "Confirm the gate prints REGRESSION and exits 1, then restore the prompt.",
        ],
        checklist: [
          "results.json and baseline.json share the same metric names",
          "Gate exits 0 on the unchanged prompt",
          "Gate exits 1 and names the metric on the broken prompt",
          "At least one case is tagged critical and the gate reports it by id when it fails",
        ],
        deliverable: "evals/gate.py and evals/baseline.json committed; a screenshot or paste of the REGRESSION output.",
      },
      quiz: [
        {
          q: "Why is a small tolerance usually needed in an LLM eval gate?",
          options: [
            "Because CI runners are slow",
            "Because outputs can vary between runs even at temperature 0, so tiny drops can be noise",
            "Because JSON parsing is lossy",
            "Because baselines expire",
          ],
          answer: 1,
          explain: "Hosted inference is not bit-for-bit deterministic. Without tolerance the gate fails on noise and people stop trusting it.",
        },
        {
          q: "What should the response cache key include?",
          options: [
            "Only the user input",
            "The git commit hash",
            "Model, prompt template version, input and generation parameters",
            "The current date",
          ],
          answer: 2,
          explain: "Anything that can change the output must be in the key; otherwise a prompt change would silently reuse stale answers.",
        },
        {
          q: "A PR keeps average groundedness within tolerance but one critical \"must refuse\" case now fails. What should the gate do?",
          options: [
            "Pass, because the average is fine",
            "Fail, because critical cases are gated individually",
            "Warn only",
            "Re-run until it passes",
          ],
          answer: 1,
          explain: "Averages hide the cases that matter most. Safety and refusal cases are gated one by one.",
        },
      ],
      explainPrompt: "Explain to a junior engineer how an eval gate differs from a unit test, covering baselines, tolerance and critical cases, in five sentences.",
      implementPrompt: "From memory, write gate.py: load baseline and results JSON, print per-metric deltas, fail on drops beyond a tolerance or any failing critical case, and exit with the right code.",
      videos: [
        {
          title: "Evals in CI for LLM applications",
          channel: "AI Engineer",
          url: "https://www.youtube.com/results?search_query=ai+engineer+conference+evals+ci+regression+testing+llm",
          kind: "search",
          reason: "Watch this to see how production teams tier their eval suites between PRs, nightly runs and online monitoring.",
        },
      ],
    },
  },
];

export const labs: LabSeed[] = [
  {
    slug: "eval-pipeline",
    title: "First AI Evaluation Pipeline",
    week: 17,
    duration: "3h",
    minutes: 180,
    difficulty: "medium",
    domain: "ai",
    skills: ["ai-evaluation", "python", "testing"],
    prerequisites: ["Eval datasets & golden sets", "A working Cortex RAG endpoint (or any LLM app you can call from Python)"],
    topicSlugs: ["eval-datasets", "llm-as-judge"],
    objective: "Build a reusable evaluation pipeline for Cortex: a 25-case golden set, deterministic plus rubric scoring, and a report that compares two system prompts case by case.",
    expectedOutput: "A folder evals/ containing golden.jsonl (25 cases), run_eval.py, and report.md showing per-metric scores for prompt A and prompt B, per-tag breakdown, and a list of cases that flipped between them.",
    steps: [
      {
        title: "Write the golden set",
        detail: "Create evals/golden.jsonl with 25 cases over your own documents: 12 single-document factual, 4 table/number questions, 4 multi-document, 3 no-answer (expected NOT_IN_DOCS), 2 injection attempts tagged critical. Each case has id, input, expected, source (doc id or null) and tags.",
      },
      {
        title: "Wrap your app behind generate()",
        detail: "Write a generate(question, system_prompt) -> dict function returning {answer, sources} by calling your Cortex pipeline. Keep model and temperature fixed (temperature 0). Add the content-addressed cache so re-runs are free.",
      },
      {
        title: "Deterministic scorers",
        detail: "Implement three scorers: contains_expected (normalised contains), source_hit (expected source id appears in returned sources; skip when source is null), and refusal_ok (for NOT_IN_DOCS cases the answer must not contain an invented fact — check it contains your refusal phrase).",
      },
      {
        title: "Rubric scorer",
        detail: "Add the groundedness judge from the LLM-as-judge topic as a fourth scorer, returning grounded and cited as 0/1. Store the judge's reasoning in the results so you can read it later.",
      },
      {
        title: "Run two prompts",
        detail: "Write prompt A (your current prompt) and prompt B (for example: adds \"cite every claim as [doc-id]; if the sources do not answer, say so\"). Run the full set with each and save results_A.json and results_B.json.",
      },
      {
        title: "Generate the report",
        detail: "Write report.md from the two results files: a metrics table (A vs B), a per-tag table, and a list of flipped cases (pass->fail and fail->pass) with the outputs side by side. End with a two-sentence recommendation that mentions sample size.",
      },
    ],
    hints: [
      "Keep scorers as pure functions (case, output) -> bool so they are trivially unit-testable.",
      "Write results with the case id as the join key; the flipped-cases diff is then a dict comparison.",
      "If a scorer does not apply to a case (source_hit on a no-answer case), record None and exclude it from that metric's denominator.",
      "Read at least five judge reasonings by hand before trusting the grounded column.",
    ],
    stretch: "Add a paired bootstrap to the report that prints P(B > A) for each metric, and a per-case cost column using token counts from the API responses.",
    learned: [
      "How to structure a golden set so failures point to a category, not just a number",
      "Combining cheap deterministic scorers with a targeted LLM judge",
      "Comparing two prompts per case instead of by averages",
      "Why 25 cases is enough to catch big regressions but not to rank close variants",
    ],
    starter: {
      title: "evals/run_eval.py skeleton",
      lang: "python",
      code: `import json
import sys
from pathlib import Path

def load(path: str) -> list[dict]:
    return [json.loads(l) for l in Path(path).read_text().splitlines() if l.strip()]

def norm(s: str) -> str:
    return " ".join(s.lower().split())

def contains_expected(case: dict, out: dict) -> bool:
    return norm(case["expected"]) in norm(out["answer"])

def source_hit(case: dict, out: dict):
    if case.get("source") is None:
        return None
    return case["source"] in out["sources"]

SCORERS = {"contains": contains_expected, "source_hit": source_hit}

def generate(question: str, system_prompt: str) -> dict:
    raise NotImplementedError("call your Cortex pipeline here")

def run(prompt_path: str, out_path: str) -> None:
    system_prompt = Path(prompt_path).read_text()
    results = []
    for case in load("evals/golden.jsonl"):
        out = generate(case["input"], system_prompt)
        scores = {name: fn(case, out) for name, fn in SCORERS.items()}
        results.append({"id": case["id"], "tags": case["tags"], "output": out, "scores": scores})
    metrics = {}
    for name in SCORERS:
        vals = [r["scores"][name] for r in results if r["scores"][name] is not None]
        metrics[name] = sum(vals) / len(vals) if vals else None
    Path(out_path).write_text(json.dumps({"metrics": metrics, "results": results}, indent=2))
    print(prompt_path, metrics)

if __name__ == "__main__":
    run(sys.argv[1], sys.argv[2])`,
      note: "Usage: python evals/run_eval.py prompts/a.txt evals/results_A.json",
    },
  },
  {
    slug: "judge-calibration",
    title: "Calibrate an LLM Judge",
    week: 17,
    duration: "90m",
    minutes: 90,
    difficulty: "hard",
    domain: "ai",
    skills: ["ai-evaluation"],
    prerequisites: ["LLM-as-judge", "First AI Evaluation Pipeline"],
    topicSlugs: ["llm-as-judge"],
    objective: "Measure how far you can trust your groundedness judge: hand-label 30 outputs, compare the judge's verdicts, compute agreement and kappa, and improve the rubric until kappa is at least 0.6.",
    expectedOutput: "labels.jsonl (30 human labels), calibrate.py printing agreement, kappa and a confusion matrix, and a short CALIBRATION.md recording rubric v1 vs v2 numbers and what changed.",
    steps: [
      {
        title: "Collect 30 outputs",
        detail: "Take 30 answers from results_A.json and results_B.json of the eval pipeline lab. Make sure at least 8 are ones you suspect are wrong — pick from failed contains/source_hit cases.",
      },
      {
        title: "Label blind",
        detail: "Before looking at any judge output, label each answer grounded 0/1 with a one-line reason. Save to labels.jsonl with id and grounded. Blind labelling matters: seeing the judge's verdict first anchors you.",
      },
      {
        title: "Run the judge and compute stats",
        detail: "Run the judge on the same 30, then compute raw agreement, Cohen's kappa and a 2x2 confusion matrix (human pass/fail vs judge pass/fail). Note false passes separately — they are the dangerous cell.",
      },
      {
        title: "Read every disagreement",
        detail: "For each disagreement, read the judge's reasoning and classify the cause: rubric ambiguity, missing evidence in the prompt, judge error, or your labelling error (it happens — fix your label if so).",
      },
      {
        title: "Fix the rubric and re-run",
        detail: "Edit the rubric to address the most common cause (for example define what counts as \"supported\" for paraphrased numbers, or add one short example of a failing answer). Re-run and record the new kappa. Stop at kappa >= 0.6 or after three iterations.",
      },
    ],
    hints: [
      "Cohen's kappa with scikit-learn is sklearn.metrics.cohen_kappa_score(human, judge) if you want to cross-check your own implementation.",
      "If the judge is too lenient, ask it to list each claim and its supporting source before giving the verdict.",
      "Keep the 30 labels as a permanent calibration set: re-run it whenever you change the judge model or prompt.",
    ],
    stretch: "Run the same calibration with a judge from a different model family and compare kappa; then test verbosity bias by padding 5 correct answers with filler and checking whether verdicts change.",
    learned: [
      "Why raw agreement misleads on imbalanced labels and what kappa corrects",
      "How to debug a rubric by reading judge reasoning on disagreements",
      "That false passes and false fails have very different costs",
      "Keeping a calibration set as a regression test for the judge itself",
    ],
    starter: {
      title: "calibrate.py",
      lang: "python",
      code: `import json
from collections import Counter
from pathlib import Path

def load(path: str) -> dict[str, int]:
    rows = [json.loads(l) for l in Path(path).read_text().splitlines() if l.strip()]
    return {r["id"]: int(r["grounded"]) for r in rows}

def kappa(h: list[int], j: list[int]) -> float:
    n = len(h)
    p_obs = sum(a == b for a, b in zip(h, j)) / n
    ch, cj = Counter(h), Counter(j)
    p_exp = sum((ch[k] / n) * (cj[k] / n) for k in (0, 1))
    return 1.0 if p_exp == 1 else (p_obs - p_exp) / (1 - p_exp)

human = load("labels.jsonl")
judge = load("judge_labels.jsonl")
ids = sorted(human.keys() & judge.keys())
h = [human[i] for i in ids]
j = [judge[i] for i in ids]
cm = Counter(zip(h, j))
print(f"n={len(ids)} agreement={sum(a == b for a, b in zip(h, j)) / len(ids):.2f} kappa={kappa(h, j):.2f}")
print("human=1 judge=1:", cm[(1, 1)], "| human=1 judge=0:", cm[(1, 0)])
print("human=0 judge=1:", cm[(0, 1)], "(false passes) | human=0 judge=0:", cm[(0, 0)])
for i in ids:
    if human[i] != judge[i]:
        print("disagree:", i, "human", human[i], "judge", judge[i])`,
    },
  },
];
