import type { LabSeed, TopicSeed } from "../../types";

/** Join paragraphs with a blank line. */
const p = (...paras: string[]) => paras.join("\n\n");

export const topics: TopicSeed[] = [
  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "self-attention",
    title: "Self-attention: why Q, K and V exist",
    week: 10,
    domain: "ai",
    skills: ["attention"],
    difficulty: "medium",
    minutes: 90,
    summary: "Each token looks at every other token, decides which ones matter, and blends their information into its own vector. Three projections — query, key, value — make that possible.",
    prerequisites: ["embeddings"],
    tags: ["attention", "qkv", "softmax", "causal-mask", "numpy"],
    lesson: {
      hook: p(
        "\"I sat by the **bank** of the river.\" \"I opened a **bank** account.\" Last week's embeddings would give the token \"bank\" the exact same vector in both sentences. The meaning obviously is not the same.",
        "A word's meaning depends on its neighbours. \"It\" in \"the trophy didn't fit in the suitcase because **it** was too big\" means the trophy; change \"big\" to \"small\" and it means the suitcase.",
        "Self-attention is the mechanism that lets every token look around the sentence and rewrite its own vector based on what it finds. It is the one idea that separates transformers from everything before them.",
      ),
      whyItMatters: "Attention is the core operation of every LLM you call; understanding it explains context windows, quadratic cost, KV caches, long-context degradation and why prompts are sensitive to placement.",
      levels: {
        l1: "Self-attention lets each word in a sentence look at all the other words and decide which ones help it understand itself. It then mixes in information from those important words. After this step, \"bank\" near \"river\" and \"bank\" near \"account\" end up with different meanings.",
        l2: {
          text: p(
            "Every token plays three roles. Its **query** says \"here is what I am looking for\". Its **key** says \"here is what I can offer, if you are looking for it\". Its **value** is the actual information it hands over when chosen.",
            "Each token compares its query against every key, turns those match scores into weights that sum to 1, and takes a weighted average of the values. Below: in \"the cat sat on the mat\", \"sat\" attends mostly to \"cat\" (who sat?) and the second \"the\" attends mostly to \"mat\".",
          ),
          analogy: "It is a search engine inside the sentence. The query is what you type, the keys are page titles, the values are page contents — except you get a blend of all pages weighted by how well their titles match.",
          diagram: {
            type: "grid",
            title: "Attention weights for one head (illustrative)",
            rowLabels: ["the", "cat", "sat", "on", "the", "mat"],
            colLabels: ["the", "cat", "sat", "on", "the", "mat"],
            values: [
              [0.3, 0.4, 0.1, 0.05, 0.1, 0.05],
              [0.15, 0.45, 0.25, 0.03, 0.02, 0.1],
              [0.05, 0.45, 0.25, 0.1, 0.03, 0.12],
              [0.03, 0.1, 0.35, 0.22, 0.05, 0.25],
              [0.05, 0.05, 0.05, 0.1, 0.25, 0.5],
              [0.03, 0.12, 0.2, 0.25, 0.15, 0.25],
            ],
            caption: "Row = the token doing the looking (query). Column = the token being looked at (key). Every row sums to 1.",
          },
        },
        l3: {
          text: p(
            "Start with X: T tokens, each a d_model-dimensional vector (embedding plus position). Three learned matrices project it: `Q = X·W_q`, `K = X·W_k`, `V = X·W_v`, each (T, d_k).",
            "Scores `Q·Kᵀ` form a (T, T) matrix: entry (i, j) is how much token i's query matches token j's key. Divide by √d_k, apply softmax on each row, and multiply by V. Output is (T, d_k): one context-aware vector per token.",
            "That is the whole formula: **Attention(Q, K, V) = softmax(Q·Kᵀ / √d_k) · V**. Everything else in this month is plumbing around it.",
          ),
          code: [
            {
              title: "Single-head self-attention in NumPy",
              lang: "python",
              code: `import numpy as np

rng = np.random.default_rng(0)
T, d_model, d_k = 6, 16, 8          # 6 tokens: "the cat sat on the mat"

def softmax(x, axis=-1):
    x = x - x.max(axis=axis, keepdims=True)    # subtract max for numerical stability
    e = np.exp(x)
    return e / e.sum(axis=axis, keepdims=True)

X = rng.normal(size=(T, d_model))              # token embeddings (+ positions)
W_q = rng.normal(size=(d_model, d_k)) / np.sqrt(d_model)
W_k = rng.normal(size=(d_model, d_k)) / np.sqrt(d_model)
W_v = rng.normal(size=(d_model, d_k)) / np.sqrt(d_model)

Q, K, V = X @ W_q, X @ W_k, X @ W_v            # each (T, d_k)
scores = Q @ K.T / np.sqrt(d_k)                # (T, T): query i vs key j
weights = softmax(scores, axis=-1)             # each row sums to 1
out = weights @ V                              # (T, d_k): blended values

print(Q.shape, scores.shape, out.shape)        # (6, 8) (6, 6) (6, 8)
print(weights.sum(axis=-1).round(6))           # [1. 1. 1. 1. 1. 1.]
print(np.round(weights[2], 2))                 # how token 2 ("sat") spreads its attention`,
              note: "With random weights the pattern is meaningless; training is what makes \"sat\" look at \"cat\". The shapes and mechanics are exactly the real thing.",
            },
          ],
        },
        l4: {
          text: p(
            "**Why √d_k.** If q and k have independent components with mean 0 and variance 1, their dot product is a sum of d_k such products, so its variance is d_k and its standard deviation √d_k. With d_k = 128, raw scores routinely hit ±20. Softmax of numbers that spread out is nearly one-hot, and its gradient is nearly zero everywhere — training stalls. Dividing by √d_k brings the variance back to 1 regardless of head size.",
            "**Causal masking.** A GPT-style model is trained to predict token t+1 from tokens ≤ t, so token t must not see the future. Before the softmax, set every score above the diagonal to −∞. exp(−∞) = 0, so those weights become exactly zero and each row still sums to 1. One matrix op trains all T next-token predictions in parallel without cheating.",
            "**Cost.** The score matrix is T × T, so compute and memory grow quadratically with context length. Kernels like FlashAttention never materialise the full matrix in GPU memory — they tile it and use an online softmax — but the arithmetic is still O(T²·d).",
          ),
          code: [
            {
              title: "The √d_k effect and causal masking, measured",
              lang: "python",
              code: `import numpy as np

rng = np.random.default_rng(0)

def softmax(x, axis=-1):
    x = x - x.max(axis=axis, keepdims=True)
    e = np.exp(x)
    return e / e.sum(axis=axis, keepdims=True)

# 1) dot products of unit-variance vectors have variance d_k; scaling restores ~1
for d_k in [16, 64, 256]:
    q, k = rng.normal(size=(10_000, d_k)), rng.normal(size=(10_000, d_k))
    dots = (q * k).sum(axis=1)
    print(f"d_k={d_k:>3}  var(q.k)={dots.var():6.1f}  var(q.k/sqrt(d_k))={(dots / np.sqrt(d_k)).var():.2f}")

# 2) causal scaled dot-product attention
def causal_attention(Q, K, V):
    T, d_k = Q.shape
    scores = Q @ K.T / np.sqrt(d_k)                       # (T, T)
    future = np.triu(np.ones((T, T), dtype=bool), k=1)    # True strictly above the diagonal
    scores = np.where(future, -np.inf, scores)
    W = softmax(scores, axis=-1)                          # exp(-inf) -> exactly 0
    return W @ V, W

Q, K, V = (rng.normal(size=(5, 8)) for _ in range(3))
out, W = causal_attention(Q, K, V)
print(np.round(W, 2))                                     # lower-triangular, rows sum to 1
assert np.all(np.triu(W, k=1) == 0) and np.allclose(W.sum(axis=-1), 1)`,
            },
          ],
          diagram: {
            type: "grid",
            title: "Causal mask: weights after softmax (illustrative)",
            rowLabels: ["the", "cat", "sat", "on"],
            colLabels: ["the", "cat", "sat", "on"],
            values: [
              [1.0, 0, 0, 0],
              [0.4, 0.6, 0, 0],
              [0.1, 0.6, 0.3, 0],
              [0.05, 0.2, 0.5, 0.25],
            ],
            caption: "Everything above the diagonal is exactly zero: a token can only attend to itself and the past.",
          },
        },
        l5: {
          question: "Why do we need separate Q, K and V projections? Why not just compute softmax(X·Xᵀ)·X?",
          hint: "Think about symmetry, self-matching, and the difference between what makes a token relevant and what it should contribute.",
          answer: p(
            "X·Xᵀ is symmetric: token a would attend to b exactly as strongly as b attends to a. Real relations are asymmetric — a verb looks for its subject, but the subject does not need the verb in the same way — so we need different projections for the asker (query) and the answerer (key).",
            "X·Xᵀ also puts each token's squared norm on the diagonal, which usually dominates, so tokens would mostly attend to themselves. Learned W_q and W_k define a separate \"matching space\" where relevance is not the same as similarity.",
            "V decouples what gets matched from what gets transmitted: a token might be found because it is a noun but should pass along its gender or number. Finally, projecting to d_k < d_model lets many heads each learn a different relation cheaply. So Q/K control the routing, V controls the payload.",
          ),
        },
      },
      commonMistakes: [
        "Applying softmax over the wrong axis (columns instead of rows). Each query's weights must sum to 1: `softmax(scores, axis=-1)`.",
        "Forgetting the √d_k scale — the model still runs but trains badly as heads grow.",
        "Masking after the softmax (multiplying by zero) instead of before it with −∞: rows no longer sum to 1 and the future still leaked into the normalisation.",
        "Using a large negative like −1e4 in float16, which can overflow; use `-inf` or the dtype's minimum via `torch.finfo(dtype).min`.",
      ],
      tryThis: "In the l3 code, multiply `scores` by 10 before the softmax and print `weights[2]`. Watch it collapse to nearly one-hot — that is what happens without √d_k scaling at large d_k.",
      miniTask: {
        title: "Implement self-attention in NumPy",
        kind: "code",
        minutes: 40,
        steps: [
          "Write a stable `softmax(x, axis=-1)` that subtracts the row max first.",
          "Create X with shape (6, 16) for \"the cat sat on the mat\" and random W_q, W_k, W_v of shape (16, 8).",
          "Compute Q, K, V, the scaled score matrix and the output; assert shapes (6, 8), (6, 6), (6, 8).",
          "Add a causal mask with `np.triu(..., k=1)` and −∞; assert all weights above the diagonal are exactly 0.",
          "Print the weight matrix rounded to 2 decimals and label rows/cols with the six words.",
        ],
        checklist: [
          "Every row of the weight matrix sums to 1",
          "Masked weights are exactly zero, not just small",
          "I can say what the (i, j) entry of Q·Kᵀ means",
          "I can explain why the scores are divided by √d_k",
        ],
        deliverable: "`attention.py` with `self_attention(X, W_q, W_k, W_v, causal=False)` and passing asserts.",
      },
      quiz: [
        {
          q: "Q has shape (T, d_k) and K has shape (T, d_k). What is the shape of Q·Kᵀ?",
          options: ["(d_k, d_k)", "(T, T)", "(T, d_k)", "(T,)"],
          answer: 1,
          explain: "(T, d_k) × (d_k, T) = (T, T): one score for every (query token, key token) pair.",
        },
        {
          q: "Why are attention scores divided by √d_k?",
          options: [
            "To make the output the same size as the input",
            "Because dot products of d_k-dimensional random vectors have variance d_k, which saturates the softmax",
            "To normalise each key to unit length",
            "To implement the causal mask",
          ],
          answer: 1,
          explain: "Scaling by √d_k restores unit variance, keeping softmax in a region with useful gradients.",
        },
        {
          q: "In causal attention, how is a token prevented from attending to future tokens?",
          options: [
            "Future tokens are deleted from the sequence",
            "Their values are set to zero",
            "Their scores are set to −∞ before the softmax",
            "Their weights are set to zero after the softmax",
          ],
          answer: 2,
          explain: "−∞ scores become exact zeros after softmax while the remaining weights still sum to 1.",
        },
      ],
      explainPrompt: "Explain to a junior engineer in 5 sentences what Q, K and V are, what the softmax(Q·Kᵀ/√d_k)·V formula does, and why the causal mask exists.",
      implementPrompt: "From memory, implement causal scaled dot-product attention in NumPy and assert that rows sum to 1 and future weights are exactly zero.",
      videos: [
        {
          title: "Attention in transformers, step-by-step",
          channel: "3Blue1Brown",
          url: "https://www.youtube.com/watch?v=eMlx5fFNoYc",
          kind: "video",
          minutes: 26,
          reason: "Watch this if the Q/K/V explanation isn't clicking yet.",
        },
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "multi-head-attention",
    title: "Multi-head attention",
    week: 10,
    domain: "ai",
    skills: ["attention", "transformer-architecture"],
    difficulty: "medium",
    minutes: 75,
    summary: "Run several smaller attention operations in parallel so each head can track a different relationship — at the same parameter cost as one big head.",
    prerequisites: ["self-attention"],
    tags: ["multi-head", "pytorch", "reshape", "gqa", "flash-attention"],
    lesson: {
      hook: p(
        "In \"Goutham deployed the app to Vercel because **it** was ready\", the token \"it\" needs several things at once: which noun it refers to, that it is the subject of \"was\", and that the sentence is about deployment.",
        "A single attention head produces one weighted average per token. If it spreads weight across all three relationships, it blurs them. If it picks one, it loses the others.",
        "The fix is almost embarrassingly simple: run many attention operations side by side, each in its own smaller subspace, and concatenate the results.",
      ),
      whyItMatters: "Every production transformer uses multi-head attention (or its GQA/MQA variants), and the reshape/transpose pattern is the single most common source of shape bugs when you implement or debug models.",
      levels: {
        l1: "Instead of one attention step that must notice everything, the model runs several in parallel. Each one, called a head, can focus on a different kind of relationship — grammar, references, nearby words. Their findings are glued together and mixed into one result.",
        l2: {
          text: p(
            "Split the model dimension into h slices. Each head gets its own Q, K, V of size d_k = d_model / h, computes its own attention pattern, and returns its own (T, d_k) output. Concatenate the h outputs back to (T, d_model) and apply one final linear layer W_O to mix what the heads found.",
            "Researchers have found heads that clearly specialise: previous-token heads, heads that match brackets, and \"induction heads\" that copy patterns seen earlier in the context.",
          ),
          analogy: "A code review with several reviewers who each check one thing — security, performance, naming — instead of one reviewer trying to hold everything in mind. The lead (W_O) merges their notes.",
          diagram: {
            type: "flow",
            title: "Multi-head attention, shapes for one sequence",
            lanes: [
              {
                tone: "neutral",
                steps: [
                  { label: "X", note: "(T, d_model)" },
                  { label: "Linear → Q, K, V", note: "each (T, d_model)" },
                  { label: "Split heads", note: "(h, T, d_k), d_k = d_model / h" },
                  { label: "Attention per head", note: "h independent (T, T) patterns", accent: true },
                  { label: "Concat", note: "(T, d_model)" },
                  { label: "W_O", note: "mix heads → (T, d_model)" },
                ],
              },
            ],
          },
        },
        l3: {
          text: p(
            "In code you never loop over heads. You compute Q, K, V for all heads with one matmul, then **reshape** (B, T, d_model) → (B, T, h, d_k) and **transpose** to (B, h, T, d_k). Batched matmul treats (B, h) as batch dimensions, so all heads run at once.",
            "After attention, reverse it: transpose back to (B, T, h, d_k) and reshape to (B, T, d_model). The `.contiguous()` call is needed because `transpose` only changes strides, and `view` requires contiguous memory.",
          ),
          code: [
            {
              title: "Causal multi-head self-attention in PyTorch",
              lang: "python",
              code: `import torch
import torch.nn as nn

class MultiHeadSelfAttention(nn.Module):
    def __init__(self, d_model: int = 64, n_heads: int = 4):
        super().__init__()
        assert d_model % n_heads == 0
        self.h, self.d_k = n_heads, d_model // n_heads
        self.qkv = nn.Linear(d_model, 3 * d_model)      # W_q, W_k, W_v fused
        self.proj = nn.Linear(d_model, d_model)         # W_O

    def forward(self, x):                               # x: (B, T, C)
        B, T, C = x.shape
        q, k, v = self.qkv(x).split(C, dim=-1)          # each (B, T, C)
        q = q.view(B, T, self.h, self.d_k).transpose(1, 2)   # (B, h, T, d_k)
        k = k.view(B, T, self.h, self.d_k).transpose(1, 2)
        v = v.view(B, T, self.h, self.d_k).transpose(1, 2)
        att = q @ k.transpose(-2, -1) / self.d_k ** 0.5      # (B, h, T, T)
        future = torch.triu(torch.ones(T, T, dtype=torch.bool, device=x.device), diagonal=1)
        att = att.masked_fill(future, float("-inf")).softmax(dim=-1)
        y = att @ v                                          # (B, h, T, d_k)
        y = y.transpose(1, 2).contiguous().view(B, T, C)     # concat heads
        return self.proj(y)

x = torch.randn(2, 10, 64)
mha = MultiHeadSelfAttention(64, 4)
print(mha(x).shape)                                     # torch.Size([2, 10, 64])
print(sum(p.numel() for p in mha.parameters()))         # 4*64*64 + 4*64 = 16640`,
            },
          ],
        },
        l4: {
          text: p(
            "**Cost is the same as one big head.** The projections are d_model × d_model whether you have 1 head or 16; the score computation is h × T² × d_k = T² × d_model either way. You get h different attention patterns for roughly free. GPT-2 small: d_model = 768, 12 heads, d_k = 64, and 4 × 768² ≈ 2.36M attention weights per layer.",
            "**Fused kernels.** In production you call `torch.nn.functional.scaled_dot_product_attention(q, k, v, is_causal=True)`, which dispatches to FlashAttention or memory-efficient kernels. It computes exactly the same result without writing the (B, h, T, T) matrix to GPU memory.",
            "**GQA and MQA.** At inference time, K and V for every past token are cached per head (next week's KV cache topic). Multi-query attention shares one K/V head across all query heads; grouped-query attention (Llama 2 70B, Llama 3, Mistral) shares each K/V head across a group, e.g. 32 query heads and 8 KV heads. That cuts KV-cache memory 4x with little quality loss.",
          ),
          code: [
            {
              title: "Manual attention equals the fused kernel",
              lang: "python",
              code: `import torch
import torch.nn.functional as F

torch.manual_seed(0)
B, h, T, d_k = 2, 4, 10, 16
q, k, v = (torch.randn(B, h, T, d_k) for _ in range(3))

att = q @ k.transpose(-2, -1) / d_k ** 0.5
future = torch.triu(torch.ones(T, T, dtype=torch.bool), diagonal=1)
manual = att.masked_fill(future, float("-inf")).softmax(-1) @ v

fused = F.scaled_dot_product_attention(q, k, v, is_causal=True)
print(torch.allclose(manual, fused, atol=1e-5))        # True

# grouped-query attention: 8 query heads share 2 KV heads (groups of 4)
q8 = torch.randn(B, 8, T, d_k)
k2, v2 = torch.randn(B, 2, T, d_k), torch.randn(B, 2, T, d_k)
k8, v8 = k2.repeat_interleave(4, dim=1), v2.repeat_interleave(4, dim=1)
print(F.scaled_dot_product_attention(q8, k8, v8, is_causal=True).shape)  # (2, 8, 10, 16)`,
              note: "Only k2 and v2 would be stored in the KV cache — a quarter of the memory of full multi-head attention.",
            },
          ],
        },
        l5: {
          question: "Why use multiple attention heads instead of one head with the full dimension? Does it cost more?",
          hint: "Count parameters and FLOPs for both, then think about what a single softmax can express.",
          answer: p(
            "It costs essentially the same: the Q/K/V/O projections are d_model × d_model in both cases, and the score computation is h·T²·d_k = T²·d_model. The only extra is some reshaping.",
            "What you gain is expressiveness. One softmax yields one probability distribution per token, i.e. one weighted average. A token often needs information from several places for different reasons — its subject, its antecedent, the previous token — and averaging them together blurs all of them.",
            "With h heads, each operating in its own d_k-dimensional subspace, the model gets h independent routing patterns per layer and W_O learns how to combine them. Empirically heads specialise (previous-token heads, induction heads), and ablations show too few heads hurts. The trade-off is that each head has a smaller d_k, so there is a sweet spot; and at inference, K/V memory scales with KV heads, which is why GQA shares K/V across query heads.",
          ),
        },
      },
      commonMistakes: [
        "Reshaping (B, T, C) straight to (B, h, T, d_k) with `view` instead of view-to-(B, T, h, d_k)-then-transpose. It runs, shapes look right, and heads get scrambled data.",
        "Calling `.view` after `.transpose` without `.contiguous()` (runtime error) — or using `.reshape` and not realising it copied.",
        "Forgetting the output projection W_O, so heads can never be mixed.",
        "Assuming more heads means more parameters; it means smaller heads, not a bigger layer.",
      ],
      tryThis: "Swap the correct `view(B, T, h, d_k).transpose(1, 2)` for `view(B, h, T, d_k)` and compare outputs on the same input. Same shape, different numbers — a bug no type checker catches.",
      miniTask: {
        title: "Build and verify multi-head attention",
        kind: "code",
        minutes: 40,
        steps: [
          "Paste the l3 class and run it on `torch.randn(2, 10, 64)`.",
          "Add shape prints after each reshape and confirm (2, 4, 10, 16) and (2, 4, 10, 10).",
          "Replace your manual attention with `F.scaled_dot_product_attention(..., is_causal=True)` and assert outputs match within 1e-5.",
          "Change a token at position 7 and confirm outputs at positions 0–6 do not change (causality check).",
          "Compute the parameter count for d_model = 768 and confirm about 2.36M.",
        ],
        checklist: [
          "Manual and fused attention outputs match",
          "Changing a future token never changes past outputs",
          "I can state why multi-head costs the same as single-head",
        ],
        deliverable: "`mha.py` with the module, the equivalence assert and the causality assert.",
      },
      quiz: [
        {
          q: "d_model = 512 with 8 heads. What is d_k per head?",
          options: ["512", "8", "64", "4096"],
          answer: 2,
          explain: "d_k = d_model / h = 512 / 8 = 64.",
        },
        {
          q: "Compared with one head of size d_model, multi-head attention with h heads has:",
          options: [
            "h times more parameters",
            "The same projection parameters and roughly the same FLOPs",
            "Fewer parameters because each head is smaller",
            "Quadratically more FLOPs in h",
          ],
          answer: 1,
          explain: "Projections stay d_model × d_model; heads just partition the dimension.",
        },
        {
          q: "What does grouped-query attention mainly reduce?",
          options: ["Training time", "KV-cache memory at inference", "Vocabulary size", "The number of layers"],
          answer: 1,
          explain: "Several query heads share one key/value head, so fewer K/V tensors are cached per token.",
        },
      ],
      explainPrompt: "Explain to a junior engineer in 5 sentences why transformers use multiple attention heads, how the tensors are reshaped, and what GQA changes.",
      implementPrompt: "From memory, write a causal multi-head self-attention `nn.Module` in PyTorch and verify it against `F.scaled_dot_product_attention`.",
      videos: [
        {
          title: "Attention is all you need — paper and code walkthrough",
          channel: "Umar Jamil",
          url: "https://www.youtube.com/results?search_query=umar+jamil+attention+is+all+you+need+transformer+explained",
          kind: "search",
          reason: "Watch this if you want the multi-head reshapes traced line by line alongside the original paper.",
        },
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "positional-encoding",
    title: "Positional encoding: teaching order to a set",
    week: 10,
    domain: "ai",
    skills: ["transformer-architecture"],
    difficulty: "hard",
    minutes: 75,
    summary: "Attention on its own cannot tell \"dog bites man\" from \"man bites dog\". Positional encodings — sinusoidal, learned, RoPE — inject order, and they decide how far a model's context can stretch.",
    prerequisites: ["self-attention"],
    tags: ["positional-encoding", "rope", "sinusoidal", "context-length"],
    lesson: {
      hook: p(
        "Shuffle the words of a sentence and feed them through self-attention. The outputs come back shuffled in exactly the same way, and otherwise identical. Attention treats its input as a **set**.",
        "So \"dog bites man\" and \"man bites dog\" would look the same to a transformer with no position information. So would every permutation of your function's lines of code.",
        "Positional encoding is how order gets in. The design choice also explains why models have a maximum context length and why \"128k context\" models sometimes fall apart at 100k.",
      ),
      whyItMatters: "Position schemes like RoPE determine how models handle long context and how context windows get extended — knowledge you need when choosing models for long-document RAG.",
      levels: {
        l1: "Attention compares every word with every other word, but it has no idea which came first. Positional encoding adds a signal to each word that says where it sits in the sentence. Now the model can tell the difference between orders that use the same words.",
        l2: {
          text: p(
            "The original transformer added a unique \"position fingerprint\" vector to each token's embedding: a mix of sine and cosine waves at different frequencies. Fast waves distinguish neighbours; slow waves distinguish the start of a document from the end.",
            "Modern LLMs mostly use **RoPE** instead: rather than adding a fingerprint, they rotate each query and key by an angle proportional to its position. The dot product between two rotated vectors then depends only on how far apart the tokens are.",
          ),
          analogy: "Seat numbers at a cinema. Everyone (token) is the same person regardless of seat, but the ticket tells you where they sit — and with RoPE, what matters is how many seats apart two people are, not their absolute seat numbers.",
          diagram: {
            type: "flow",
            title: "Same words, different order",
            lanes: [
              {
                label: "No positions",
                tone: "bad",
                steps: [
                  { label: "dog bites man" },
                  { label: "man bites dog" },
                  { label: "Attention", note: "sees the same set of vectors" },
                  { label: "Same meaning", note: "outputs only permuted" },
                ],
              },
              {
                label: "With positions",
                tone: "good",
                steps: [
                  { label: "token + position" },
                  { label: "or rotate Q, K by position", note: "RoPE" },
                  { label: "Attention", note: "scores depend on order", accent: true },
                  { label: "Different meaning" },
                ],
              },
            ],
          },
        },
        l3: {
          text: p(
            "Sinusoidal encoding (Vaswani et al., 2017): for position `pos` and pair index `i`, `PE[pos, 2i] = sin(pos / 10000^(2i/d))` and `PE[pos, 2i+1] = cos(pos / 10000^(2i/d))`. It is added to the token embeddings once, before the first layer.",
            "The code proves the problem and the fix: without positions, attention of a shuffled input equals the shuffled attention output (permutation equivariance). Add positions and that equality breaks — order now changes the result.",
            "GPT-2 used **learned** absolute positions instead: an `nn.Embedding(1024, d)` table. Simple, but it has literally no vector for position 1025.",
          ),
          code: [
            {
              title: "Attention is order-blind until you add positions",
              lang: "python",
              code: `import numpy as np

rng = np.random.default_rng(0)

def softmax(x, axis=-1):
    e = np.exp(x - x.max(axis=axis, keepdims=True))
    return e / e.sum(axis=axis, keepdims=True)

def attention(X):                     # projections omitted; enough to show the point
    return softmax(X @ X.T / np.sqrt(X.shape[1])) @ X

def sinusoidal(T, d):
    pos = np.arange(T)[:, None]                      # (T, 1)
    two_i = np.arange(0, d, 2)[None, :]              # (1, d/2)
    angle = pos / (10000 ** (two_i / d))             # (T, d/2)
    PE = np.zeros((T, d))
    PE[:, 0::2], PE[:, 1::2] = np.sin(angle), np.cos(angle)
    return PE

T, d = 5, 16
X = rng.normal(size=(T, d))
perm = np.array([4, 2, 0, 3, 1])
P = sinusoidal(T, d)

print(np.allclose(attention(X)[perm], attention(X[perm])))          # True: order ignored
print(np.allclose(attention(X + P)[perm], attention(X[perm] + P)))  # False: order matters
print(P.shape, P[0, :4].round(2), P[1, :4].round(2))`,
            },
          ],
        },
        l4: {
          text: p(
            "**RoPE (rotary position embedding)**, used by Llama, Mistral, Qwen and most open models, splits each query and key into d/2 pairs and rotates pair i by angle `m·θ_i`, where m is the position and `θ_i = base^(−2i/d)` (base usually 10,000). It is applied inside every attention layer, to Q and K only — never to V.",
            "Rotations preserve length, and rotating q by angle α and k by β gives `R(α)q · R(β)k = q · R(β − α)k`. So the score between positions m and n depends only on **m − n**: relative position for free, with no extra parameters.",
            "**Why context limits exist.** Past the trained length the model sees rotation angles (or learned position IDs) it never trained on, and attention patterns go haywire. Context extension methods — position interpolation, NTK-aware scaling, YaRN — rescale the angles so long sequences map back into the trained range, followed by a little fine-tuning. **ALiBi** takes a different route: no encoding at all, just a linear penalty on scores proportional to distance.",
          ),
          code: [
            {
              title: "RoPE: scores depend only on relative position",
              lang: "python",
              code: `import numpy as np

def rope(x, pos, base=10000.0):
    # rotate consecutive pairs (x[0], x[1]), (x[2], x[3]), ... by pos * theta_i
    d = x.shape[-1]
    theta = base ** (-np.arange(0, d, 2) / d)       # (d/2,) from 1 down to ~1/base
    cos, sin = np.cos(pos * theta), np.sin(pos * theta)
    x1, x2 = x[0::2], x[1::2]
    out = np.empty_like(x)
    out[0::2] = x1 * cos - x2 * sin
    out[1::2] = x1 * sin + x2 * cos
    return out

rng = np.random.default_rng(0)
q, k = rng.normal(size=64), rng.normal(size=64)

near = rope(q, 3) @ rope(k, 1)          # positions 3 and 1: distance 2
far = rope(q, 1003) @ rope(k, 1001)     # positions 1003 and 1001: distance 2
other = rope(q, 10) @ rope(k, 1)        # distance 9
print(round(near, 4), round(far, 4), round(other, 4))
print(np.isclose(near, far))            # True: only m - n matters
print(np.isclose(np.linalg.norm(rope(q, 500)), np.linalg.norm(q)))  # rotation keeps length`,
              note: "Hugging Face's Llama code rotates the first half against the second half (\"rotate_half\") rather than interleaved pairs — a different layout, identical math.",
            },
          ],
        },
        l5: {
          question: "Why do most modern LLMs use RoPE instead of learned absolute position embeddings, and what goes wrong when you run a model past its trained context length?",
          hint: "Relative vs absolute, parameters, and what the model has seen during training.",
          answer: p(
            "Learned absolute embeddings give each position an independent vector, so the model has to learn separately that positions 5→6 and 505→506 relate the same way, and it has no embedding at all beyond the maximum length. RoPE encodes position by rotating Q and K, which makes the attention score a function of relative distance by construction, adds no parameters, and naturally decays the influence of far-away tokens.",
            "Past the trained length, though, RoPE still sees rotation angles for large m − n combinations that never occurred in training — especially in the low-frequency dimensions — so attention distributions become out-of-distribution and quality drops sharply, often as repetition or nonsense.",
            "Extension methods such as position interpolation, NTK-aware scaling and YaRN rescale the frequencies so long contexts map into the familiar range, then fine-tune briefly on long data. Even then, effective context is usually shorter than advertised, so for Cortex I would test retrieval accuracy at the lengths I actually use rather than trusting the spec sheet.",
          ),
        },
      },
      commonMistakes: [
        "Applying RoPE to the values as well as queries and keys. Only Q and K are rotated; position should affect who attends to whom, not the payload.",
        "Mixing interleaved-pair and half-split RoPE layouts when porting weights between implementations — the model loads fine and produces garbage.",
        "Believing the advertised context window equals usable context. Retrieval accuracy often degrades well before the limit, especially for facts in the middle.",
      ],
      tryThis: "Plot `sinusoidal(100, 64)` with `plt.imshow`. The left columns oscillate quickly (fine position), the right columns barely change (coarse position) — a binary-counter-like pattern made of waves.",
      miniTask: {
        title: "Break and fix order-blindness",
        kind: "code",
        minutes: 35,
        steps: [
          "Run the l3 snippet and confirm the True/False outputs.",
          "Explain in a comment why `attention(X)[perm] == attention(X[perm])` must hold mathematically (hint: softmax is applied per row).",
          "Run the RoPE snippet; confirm scores at distance 2 match at positions (3, 1) and (1003, 1001).",
          "Plot the score `rope(q, m) @ rope(k, 0)` for m = 0..200 with q = k and observe how it varies with distance.",
        ],
        checklist: [
          "I demonstrated permutation equivariance without positions",
          "I showed RoPE scores depend only on relative distance",
          "I can explain why RoPE touches Q and K but not V",
        ],
        deliverable: "`positions.py` with both experiments and a saved plot of RoPE score vs distance.",
      },
      quiz: [
        {
          q: "Self-attention without any positional information is best described as:",
          options: [
            "Invariant to vocabulary",
            "Permutation-equivariant: shuffling inputs shuffles outputs the same way",
            "Causal by default",
            "Unable to process more than 512 tokens",
          ],
          answer: 1,
          explain: "Without position, each output depends only on the set of inputs, so permuting the input permutes the output identically.",
        },
        {
          q: "RoPE is applied to:",
          options: ["Token embeddings once at the input", "Values only", "Queries and keys in every attention layer", "The output logits"],
          answer: 2,
          explain: "RoPE rotates Q and K inside each attention layer so that Q·K depends on relative position.",
        },
        {
          q: "GPT-2 with learned absolute positions of size 1024 is given 1,500 tokens. What happens?",
          options: [
            "It extrapolates smoothly",
            "It fails: there is no embedding for positions beyond 1023",
            "It automatically switches to RoPE",
            "It compresses the sequence to 1024 tokens",
          ],
          answer: 1,
          explain: "A learned table has exactly 1024 rows; the model can only run on 1024 tokens (in practice you truncate or slide a window).",
        },
      ],
      explainPrompt: "Explain to a junior engineer in 5 sentences why transformers need positional encoding, how RoPE works, and why context windows have limits.",
      implementPrompt: "From memory, implement sinusoidal positional encoding and a RoPE rotation in NumPy, and write the test that shows RoPE scores depend only on m − n.",
      videos: [
        {
          title: "Rotary positional embeddings (RoPE) explained",
          channel: "Umar Jamil",
          url: "https://www.youtube.com/results?search_query=umar+jamil+rotary+positional+embeddings+rope",
          kind: "search",
          reason: "Watch this if the rotation-in-pairs picture of RoPE still feels like magic.",
        },
      ],
    },
  },
];

export const labs: LabSeed[] = [
  {
    slug: "self-attention-numpy",
    title: "Self-attention from scratch in NumPy",
    week: 10,
    duration: "90m",
    minutes: 90,
    difficulty: "medium",
    domain: "ai",
    skills: ["attention", "transformer-architecture", "python"],
    prerequisites: ["Self-attention: why Q, K and V exist", "Multi-head attention"],
    topicSlugs: ["self-attention", "multi-head-attention"],
    objective: "Implement scaled dot-product attention, causal masking and multi-head attention in pure NumPy, with shape and correctness checks — no framework hiding the details.",
    expectedOutput: "`attention_numpy.py` whose tests all pass: correct shapes at every step, rows summing to 1, masked weights exactly zero, causality holding, and (optionally) a match against PyTorch within 1e-5.",
    steps: [
      {
        title: "Stable softmax",
        detail: "Implement `softmax(x, axis=-1)` by subtracting the max along the axis. Test with `np.array([1000.0, 1001.0])` — a naive version returns nan.",
      },
      {
        title: "Scaled dot-product attention",
        detail: "`sdpa(Q, K, V, mask=None)` for inputs of shape (..., T, d_k). Use `Q @ np.swapaxes(K, -1, -2) / np.sqrt(d_k)` so it works for batched and multi-head inputs. Return both output and weights.",
      },
      {
        title: "Causal mask",
        detail: "Build `np.triu(np.ones((T, T), bool), k=1)` and apply with `np.where(mask, -np.inf, scores)` before softmax. Assert `np.all(np.triu(W, 1) == 0)` and `np.allclose(W.sum(-1), 1)`.",
      },
      {
        title: "Multi-head via reshape",
        detail: "Given X (B, T, d_model) and weights W_q, W_k, W_v, W_o each (d_model, d_model): project, reshape to (B, T, h, d_k), transpose to (B, h, T, d_k), run sdpa, transpose back, reshape to (B, T, d_model), multiply by W_o. Print shapes at every stage.",
      },
      {
        title: "Causality test",
        detail: "Run the model on X, then change X[:, 5] and run again. Assert outputs at positions 0–4 are unchanged and position 5 onward changed. This single test catches most masking bugs.",
      },
      {
        title: "Cross-check against PyTorch",
        detail: "Convert the same arrays with `torch.from_numpy` and compare against `F.scaled_dot_product_attention(q, k, v, is_causal=True)` using `np.allclose(..., atol=1e-5)`.",
      },
    ],
    hints: [
      "`np.swapaxes(K, -1, -2)` transposes only the last two axes; `K.T` reverses all axes and breaks for 3D/4D arrays.",
      "If a row is fully masked (never true for causal self-attention, but possible with padding masks), softmax returns nan. Handle it by only masking valid rows.",
      "Use float64 for the NumPy checks and cast to float32 only for the PyTorch comparison.",
    ],
    stretch: "Add a padding mask for a batch with sequences of different lengths, combine it with the causal mask, and verify padded positions receive zero attention.",
    learned: [
      "The full attention formula with real shapes",
      "Why masking happens before softmax with −∞",
      "The reshape/transpose pattern for multi-head attention",
      "A causality test you can reuse on any model",
    ],
    starter: {
      title: "attention_numpy.py (skeleton)",
      lang: "python",
      code: `import numpy as np

def softmax(x, axis=-1):
    x = x - x.max(axis=axis, keepdims=True)
    e = np.exp(x)
    return e / e.sum(axis=axis, keepdims=True)

def sdpa(Q, K, V, causal=False):
    d_k = Q.shape[-1]
    scores = Q @ np.swapaxes(K, -1, -2) / np.sqrt(d_k)        # (..., T, T)
    if causal:
        T = scores.shape[-1]
        scores = np.where(np.triu(np.ones((T, T), dtype=bool), k=1), -np.inf, scores)
    W = softmax(scores, axis=-1)
    return W @ V, W

def multi_head(X, W_q, W_k, W_v, W_o, h, causal=True):
    B, T, C = X.shape
    d_k = C // h
    def split(M):                                               # (B, T, C) -> (B, h, T, d_k)
        return M.reshape(B, T, h, d_k).transpose(0, 2, 1, 3)
    out, W = sdpa(split(X @ W_q), split(X @ W_k), split(X @ W_v), causal)
    out = out.transpose(0, 2, 1, 3).reshape(B, T, C)            # concat heads
    return out @ W_o, W

rng = np.random.default_rng(0)
B, T, C, h = 2, 8, 32, 4
X = rng.normal(size=(B, T, C))
Ws = [rng.normal(size=(C, C)) / np.sqrt(C) for _ in range(4)]
Y, W = multi_head(X, *Ws, h=h)
assert Y.shape == (B, T, C) and W.shape == (B, h, T, T)
assert np.all(np.triu(W, k=1) == 0) and np.allclose(W.sum(-1), 1)
print("shapes and mask ok")`,
    },
  },
];
