import type { LabSeed, TopicSeed } from "../../types";

/** Join paragraphs with a blank line. */
const p = (...paras: string[]) => paras.join("\n\n");

export const topics: TopicSeed[] = [
  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "transformer-block",
    title: "The transformer block",
    week: 11,
    domain: "ai",
    skills: ["transformer-architecture"],
    difficulty: "medium",
    minutes: 75,
    summary: "Attention lets tokens talk; the MLP lets each token think; residual connections and LayerNorm let you stack 12, 32 or 120 of these blocks and still train.",
    prerequisites: ["multi-head-attention", "positional-encoding"],
    tags: ["transformer", "residual", "layernorm", "mlp", "gpt-2", "pytorch"],
    lesson: {
      hook: p(
        "GPT-2 small, Llama 3 8B and the frontier model behind your IdeaGuard API calls are, structurally, the same thing: one block, copied N times, with an embedding table at the bottom and a projection to the vocabulary at the top.",
        "If you understand one block — about 15 lines of PyTorch — you understand the skeleton of every LLM. The differences between models are mostly the numbers: width, depth, heads, and a few small swaps like RMSNorm or SwiGLU.",
        "This week you build that block, then stack it into a working GPT.",
      ),
      whyItMatters: "Knowing the block lets you read model cards and papers, estimate parameters and memory from a config file, and reason about where compute actually goes.",
      levels: {
        l1: "A transformer block does two jobs, one after another. First, every token looks at the others and gathers useful context (attention). Then each token processes what it gathered on its own (a small neural network). Stack many blocks and the understanding gets deeper at each level.",
        l2: {
          text: p(
            "Think of a **residual stream**: one vector per token flowing up through the model. Each block **reads** from the stream, computes something, and **adds** its result back. Nothing is overwritten; blocks only write updates.",
            "Inside a block: normalise, attend (communication between tokens), add back; normalise, MLP (computation within each token), add back. The MLP expands each vector 4x, applies a non-linearity, and projects it back — this is where much of the model's factual knowledge seems to be stored.",
          ),
          analogy: "A shared Google Doc passed through a team: each reviewer (block) reads the current draft and adds tracked-change suggestions on top, never deleting the original. The final draft contains everyone's contributions.",
          diagram: {
            type: "stack",
            title: "One pre-norm transformer block (GPT-2 style)",
            layers: [
              { label: "Residual stream in", note: "x: (B, T, d)" },
              { label: "LayerNorm 1" },
              { label: "Causal multi-head attention", note: "tokens exchange information", accent: true },
              { label: "Add: x = x + attn(ln1(x))", note: "residual connection" },
              { label: "LayerNorm 2" },
              { label: "MLP: d → 4d → GELU → d", note: "each token processed independently", accent: true },
              { label: "Add: x = x + mlp(ln2(x))", note: "residual connection" },
              { label: "Residual stream out → next block", note: "repeat N times" },
            ],
          },
        },
        l3: {
          text: p(
            "The code is short on purpose. Attention uses the fused `F.scaled_dot_product_attention` from last week. The MLP is two linear layers with GELU in between. Each sub-layer is wrapped as `x = x + f(norm(x))`.",
            "Shapes never change inside a block: (B, T, d) in, (B, T, d) out. That is what makes blocks stackable — `nn.Sequential(*[Block() for _ in range(n_layer)])`.",
          ),
          code: [
            {
              title: "A GPT-style transformer block in PyTorch",
              lang: "python",
              code: `import torch
import torch.nn as nn
import torch.nn.functional as F

class CausalSelfAttention(nn.Module):
    def __init__(self, d: int, h: int):
        super().__init__()
        self.h = h
        self.qkv = nn.Linear(d, 3 * d)
        self.proj = nn.Linear(d, d)

    def forward(self, x):
        B, T, C = x.shape
        q, k, v = self.qkv(x).split(C, dim=-1)
        q, k, v = (t.view(B, T, self.h, C // self.h).transpose(1, 2) for t in (q, k, v))
        y = F.scaled_dot_product_attention(q, k, v, is_causal=True)   # (B, h, T, d_k)
        return self.proj(y.transpose(1, 2).contiguous().view(B, T, C))

class Block(nn.Module):
    def __init__(self, d: int = 384, h: int = 6, dropout: float = 0.1):
        super().__init__()
        self.ln1, self.ln2 = nn.LayerNorm(d), nn.LayerNorm(d)
        self.attn = CausalSelfAttention(d, h)
        self.mlp = nn.Sequential(
            nn.Linear(d, 4 * d), nn.GELU(), nn.Linear(4 * d, d), nn.Dropout(dropout)
        )

    def forward(self, x):
        x = x + self.attn(self.ln1(x))    # communicate
        x = x + self.mlp(self.ln2(x))     # compute
        return x

x = torch.randn(4, 32, 384)
blocks = nn.Sequential(*[Block() for _ in range(6)])
print(blocks(x).shape)                                    # torch.Size([4, 32, 384])
print(sum(p.numel() for p in Block().parameters()))       # 1774464 ~= 12 * 384**2`,
            },
          ],
        },
        l4: {
          text: p(
            "**Where the parameters are.** Per block: attention has W_q, W_k, W_v, W_o = 4d²; the MLP has d×4d + 4d×d = 8d². So a block is ≈ **12d²**, two-thirds of it in the MLP. Add the embedding table V×d (often tied to the output projection) and you can compute any GPT's size from its config.",
            "**Why residuals.** Gradients flow straight down the `x + ...` path, so a 96-layer network trains like a shallow one at initialisation; each block learns a small correction. Without residuals, deep transformers simply do not train.",
            "**Why pre-norm.** The original paper normalised *after* the add (post-norm), which needs careful learning-rate warm-up. GPT-2 onward normalises the *input* to each sub-layer and adds one final LayerNorm before the output head; the residual path stays clean, and training is far more stable.",
            "**Modern swaps.** Llama-family models use RMSNorm (no mean subtraction, no bias — cheaper), SwiGLU MLPs (three matrices with a gated activation, hidden size ≈ 8d/3 to keep ≈ 8d² parameters), RoPE, no biases, and grouped-query attention. Same skeleton, better constants.",
            "**Compute.** A forward pass costs roughly 2 FLOPs per parameter per token (one multiply, one add), plus the attention term that grows with context length.",
          ),
          code: [
            {
              title: "Derive GPT-2 small's 124M parameters from its config",
              lang: "python",
              code: `V, n_ctx, d, n_layer = 50257, 1024, 768, 12

token_emb = V * d                     # also reused as the output projection (weight tying)
pos_emb = n_ctx * d                   # learned absolute positions
attn = 4 * d * d + 4 * d              # W_q, W_k, W_v, W_o + biases
mlp = 8 * d * d + 5 * d               # d->4d and 4d->d + biases (4d + d)
norms = 2 * (2 * d)                   # two LayerNorms, each with gain and bias
per_block = attn + mlp + norms        # 12*d^2 + 13*d
final_ln = 2 * d

total = token_emb + pos_emb + n_layer * per_block + final_ln
print(f"per block: {per_block:,}")    # 7,087,872
print(f"total:     {total:,}")        # 124,439,808
print(f"share in blocks: {n_layer * per_block / total:.0%}, in embeddings: {token_emb / total:.0%}")`,
              note: "This matches the parameter count Hugging Face reports for `gpt2`. Try it with Llama-style numbers to see the MLP share grow.",
            },
          ],
        },
        l5: {
          question: "Walk me through a transformer block and explain why residual connections and pre-norm are essential for deep models.",
          hint: "Two sub-layers, what each is for, then gradients and activation scale.",
          answer: p(
            "A block takes the residual stream (one d-dimensional vector per token) and applies two sub-layers, each as x = x + f(LayerNorm(x)). The first f is causal multi-head attention — the only place tokens exchange information. The second is a position-wise MLP that expands to 4d, applies GELU and projects back — per-token computation that holds most of the parameters.",
            "Residual connections give gradients an identity path from the loss to every layer, so depth does not cause vanishing gradients and each block can start as a near no-op and learn a small update. They also make the stream a shared workspace that later layers read from.",
            "Pre-norm keeps the input to each sub-layer at a controlled scale while leaving the residual path untouched; post-norm puts LayerNorm on the main path, which makes gradients at early layers depend on every norm above them and requires delicate warm-up. That is why essentially every modern LLM is pre-norm, usually with RMSNorm, plus a final norm before the unembedding.",
          ),
        },
      },
      commonMistakes: [
        "Writing `x = self.attn(self.ln1(x))` without the `x +` — the model trains, badly, and deeper stacks fail entirely.",
        "Forgetting the final LayerNorm before the language-model head in a pre-norm model; activations grow through the stack unnormalised.",
        "Assuming attention dominates the parameter count. For typical context lengths the MLP holds two-thirds of the block's weights and a large share of the FLOPs.",
      ],
      tryThis: "Load `AutoModelForCausalLM.from_pretrained(\"gpt2\")` and `print(model)`. Map each printed module (c_attn, c_proj, c_fc, ln_1, ln_2, ln_f) to a layer of the stack diagram.",
      miniTask: {
        title: "Build a block and account for every parameter",
        kind: "code",
        minutes: 40,
        steps: [
          "Paste the l3 code and run it; confirm (4, 32, 384) in and out.",
          "Compute 12·d² + 13·d for d = 384 by hand and match the printed count.",
          "Run the GPT-2 parameter script and confirm 124,439,808.",
          "Remove both residual additions, stack 12 blocks, and compare output standard deviation with and without residuals on the same input.",
          "Print `model` for Hugging Face `gpt2` and match modules to the stack diagram.",
        ],
        checklist: [
          "My block's parameter count matches 12d² + 13d",
          "I reproduced GPT-2 small's 124M from its config",
          "I can say what attention does vs what the MLP does",
          "I can explain pre-norm vs post-norm in one sentence",
        ],
        deliverable: "`block.py` plus a comment block with your parameter arithmetic.",
      },
      quiz: [
        {
          q: "Roughly how many parameters does one standard GPT block with width d have?",
          options: ["4d²", "8d²", "12d²", "d³"],
          answer: 2,
          explain: "4d² in attention (Q, K, V, O) plus 8d² in the 4x-wide MLP.",
        },
        {
          q: "Which sub-layer is the only place where information moves between token positions?",
          options: ["LayerNorm", "The MLP", "Attention", "The residual addition"],
          answer: 2,
          explain: "The MLP, LayerNorm and residual add all act on each position independently; attention mixes across positions.",
        },
        {
          q: "In a pre-norm block, where is LayerNorm applied?",
          options: [
            "After each residual addition",
            "To the input of each sub-layer, leaving the residual path untouched",
            "Only once, at the very end of the model",
            "Only on the attention scores",
          ],
          answer: 1,
          explain: "x = x + f(LN(x)). Pre-norm models also add one final LN before the output head.",
        },
      ],
      explainPrompt: "Explain to a junior engineer in 5 sentences what happens inside one transformer block and why it can be stacked dozens of times.",
      implementPrompt: "From memory, write a pre-norm GPT block in PyTorch (attention + MLP + residuals) and a function that computes a GPT's parameter count from V, n_ctx, d and n_layer.",
      videos: [
        {
          title: "Transformers, the tech behind LLMs",
          channel: "3Blue1Brown",
          url: "https://www.youtube.com/watch?v=wjZofJX0v4M",
          kind: "video",
          minutes: 27,
          reason: "Watch this for the big picture of embeddings flowing through stacked blocks before you write the code.",
        },
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "next-token-prediction",
    title: "Decoder-only models & next-token prediction",
    week: 11,
    domain: "ai",
    skills: ["transformer-architecture", "inference"],
    difficulty: "medium",
    minutes: 75,
    summary: "A GPT is trained on one task — predict the next token — for every position at once. Generation is that prediction in a loop. Chat, reasoning and tool use all sit on top of it.",
    prerequisites: ["transformer-block", "tokenisation-bpe"],
    tags: ["gpt", "autoregressive", "cross-entropy", "logits", "decoder-only"],
    lesson: {
      hook: p(
        "Every response you have streamed from an LLM API was produced one token at a time. The model computed a probability for each of ~100,000 possible next tokens, one was picked, appended to the input, and the whole thing ran again.",
        "That is it. There is no separate \"answer module\". A chatbot is a next-token predictor that was shown enough conversations formatted as `<user> ... <assistant> ...` that continuing the text **is** answering.",
        "Understanding this loop explains streaming, why output tokens cost more than input tokens, why models can't \"go back and fix\" earlier words, and what a KV cache is for.",
      ),
      whyItMatters: "Next-token prediction is the training objective and the inference loop of every GPT-style model; it frames everything from streaming UIs to sampling settings to inference cost.",
      levels: {
        l1: "A language model is a machine that looks at some text and guesses what comes next, one small piece at a time. To write a whole answer, it guesses the next piece, adds it to the text, and guesses again. It learned to guess well by reading an enormous amount of text and checking its guesses against what actually came next.",
        l2: {
          text: p(
            "**Training** is parallel: take a sequence of T+1 tokens; inputs are the first T, targets are the last T (shifted by one). The causal mask means position t only sees tokens ≤ t, so one forward pass yields T predictions and T loss terms at once.",
            "**Inference** is sequential: you only need the prediction at the **last** position. Pick a token, append it, run again. Each new token depends on all the ones before it.",
          ),
          analogy: "Autocomplete on your phone, run in a loop and trained on a large chunk of the internet. Tap the middle suggestion forever and you get text; make the suggestions good enough and the text is useful.",
          diagram: {
            type: "cycle",
            title: "The autoregressive loop",
            center: "one token per turn",
            steps: [
              { label: "Tokens so far", note: "prompt + generated" },
              { label: "Forward pass", note: "N transformer blocks" },
              { label: "Logits at last position", note: "one score per vocab token", accent: true },
              { label: "Pick next token", note: "greedy or sampled" },
              { label: "Append + stream to UI", note: "stop on EOS or max tokens" },
            ],
          },
        },
        l3: {
          text: p(
            "The model outputs logits of shape (B, T, V). During generation only `logits[:, -1, :]` matters. Softmax turns it into a probability distribution; greedy decoding takes the argmax.",
            "The snippet runs GPT-2 (124M, downloads ~500 MB) with a hand-written greedy loop and prints the top-3 candidates at each step, so you can watch the model's uncertainty.",
            "This is exactly what `model.generate()` and every hosted API do — plus sampling, stop sequences and a KV cache so previous tokens are not recomputed.",
          ),
          code: [
            {
              title: "A manual greedy generation loop with GPT-2",
              lang: "python",
              code: `# pip install torch transformers
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

tok = AutoTokenizer.from_pretrained("gpt2")
model = AutoModelForCausalLM.from_pretrained("gpt2").eval()

ids = tok("The capital of France is", return_tensors="pt").input_ids   # (1, T)

with torch.no_grad():
    for step in range(8):
        logits = model(ids).logits                 # (1, T, 50257): a prediction at every position
        probs = logits[0, -1].softmax(dim=-1)      # only the last position predicts the future
        top = torch.topk(probs, 3)
        cands = [(tok.decode(int(i)), round(float(p), 3)) for p, i in zip(top.values, top.indices)]
        print(step, cands)
        next_id = top.indices[:1].view(1, 1)       # greedy: take the argmax
        ids = torch.cat([ids, next_id], dim=1)     # append and go again
        if next_id.item() == tok.eos_token_id:
            break

print(tok.decode(ids[0]))`,
              note: "Notice the whole sequence is re-processed every step. That wasted work is what the KV cache removes (week 12).",
            },
          ],
        },
        l4: {
          text: p(
            "**The loss.** Cross-entropy between the predicted distribution and the actual next token, averaged over all B×T positions: −log p(correct token). An untrained model predicts roughly uniformly, so the starting loss is ln(V): about 4.17 for a 65-character vocabulary and about 10.8 for GPT-2's 50,257 tokens. If your first loss is far from ln(V), your initialisation or data pipeline is wrong.",
            "**Teacher forcing.** During training the model always conditions on the *true* previous tokens, never its own guesses. At inference it conditions on its own outputs, so an early mistake can compound — one reason long generations drift.",
            "**From base model to assistant.** Pretraining gives a document completer. Supervised fine-tuning on conversations formatted with a chat template (special role tokens) teaches it to answer. Preference tuning (RLHF, DPO) shapes which answers it prefers. Every stage is still next-token prediction; only the data and the loss weighting change.",
            "**Decoder-only vs encoder models.** BERT-style encoders see both directions (no causal mask) and are used for embeddings and classification. Decoder-only models see only the past, which is what makes generation possible — and is why the embedding models you used in week 9 are a different family.",
          ),
          code: [
            {
              title: "Targets are inputs shifted by one; loss starts at ln(V)",
              lang: "python",
              code: `import math
import torch
import torch.nn.functional as F

V, B, T = 65, 4, 8                                  # character-level vocab like tiny-gpt
tokens = torch.randint(0, V, (B, T + 1))
x, y = tokens[:, :-1], tokens[:, 1:]                # (B, T) inputs and (B, T) targets

# every position is a training example: context x[0, :t+1] must predict y[0, t]
for t in range(3):
    print(x[0, : t + 1].tolist(), "->", y[0, t].item())

logits = torch.zeros(B, T, V, requires_grad=True)   # an untrained model ~ uniform guesses
loss = F.cross_entropy(logits.view(B * T, V), y.reshape(B * T))
print(round(loss.item(), 4), round(math.log(V), 4))  # both 4.1744
loss.backward()                                     # gradients for all B*T predictions at once`,
            },
          ],
        },
        l5: {
          question: "If a GPT generates one token at a time, how can its training be fully parallel? And what are the consequences of that asymmetry?",
          hint: "Causal mask, teacher forcing, and what inference has to recompute or cache.",
          answer: p(
            "In training we already know the whole sequence, so we feed all T tokens at once. The causal mask ensures position t attends only to positions ≤ t, which makes the output at t a legitimate prediction of token t+1. One forward pass gives T predictions, and the loss averages all of them — a sequence of length T is effectively T training examples, all computed with large, efficient matrix multiplies.",
            "At inference we do not know future tokens, so generation is inherently sequential: token t+1 needs token t to exist first. That creates three consequences. Latency scales with output length, so output tokens are slow and priced higher than input tokens. Naively you would recompute attention over the whole prefix each step, which is why servers keep a KV cache. And because training used ground-truth prefixes while inference uses the model's own samples, errors can compound over long outputs.",
            "The input prompt, by contrast, is processed in one parallel \"prefill\" pass, which is why long prompts affect time-to-first-token but each extra output token costs a separate decode step.",
          ),
        },
      },
      commonMistakes: [
        "Using `logits[:, 0]` or averaging over positions when generating — only the last position predicts the next token.",
        "Forgetting to shift targets by one, so the model learns to copy its input and the loss drops to near zero suspiciously fast.",
        "Treating a base (pretrained-only) model as a chat model and wondering why it continues your question with more questions.",
        "Formatting chat prompts by hand instead of using the tokenizer's chat template, so role tokens are wrong and quality drops.",
      ],
      tryThis: "Change the prompt to \"Q: What is 17 + 25?\\nA:\" and watch GPT-2's top-3 candidates. A 124M base model has no idea — then try the same with an instruction-tuned model via an API.",
      miniTask: {
        title: "Watch a model think one token at a time",
        kind: "observe",
        minutes: 35,
        steps: [
          "Run the l3 greedy loop on GPT-2 with the given prompt.",
          "Try three prompts of your own: one factual, one code (\"def fibonacci(n):\"), one about your portfolio at 1goutham.space.",
          "For each step, note the top-1 probability. Mark steps where the model is confident (> 0.5) vs unsure (< 0.2).",
          "Run the l4 snippet and confirm the initial loss equals ln(V).",
        ],
        checklist: [
          "I printed top-3 candidates per step for three prompts",
          "I found at least one step where the model was clearly unsure",
          "I verified untrained loss ≈ ln(V)",
          "I can explain why only the last position's logits are used",
        ],
        deliverable: "A short log of one generation with per-step top-3 probabilities, annotated with where the model was confident.",
      },
      quiz: [
        {
          q: "For a batch of B sequences of length T, how many next-token predictions contribute to the training loss in one forward pass?",
          options: ["B", "T", "B × T", "B × T × V"],
          answer: 2,
          explain: "Every position in every sequence predicts its next token; the causal mask keeps each prediction honest.",
        },
        {
          q: "A freshly initialised model with a 50,257-token vocabulary should start with a loss of about:",
          options: ["0.0", "1.0", "10.8", "50,257"],
          answer: 2,
          explain: "Uniform predictions give −log(1/V) = ln(50257) ≈ 10.8.",
        },
        {
          q: "What turns a pretrained base model into a chat assistant?",
          options: [
            "A different architecture with an answer head",
            "Fine-tuning on conversations in a chat template, then preference tuning — still next-token prediction",
            "Removing the causal mask",
            "Increasing the temperature",
          ],
          answer: 1,
          explain: "The objective never changes; the data (and preference signals) teach it to continue conversations helpfully.",
        },
      ],
      explainPrompt: "Explain to a junior engineer in 5 sentences how a GPT is trained with next-token prediction and how that same model generates a full answer.",
      implementPrompt: "From memory, write a greedy generation loop for a Hugging Face causal LM that stops at EOS, and the shifted-target cross-entropy loss for a batch.",
      videos: [
        {
          title: "Intro to Large Language Models",
          channel: "Andrej Karpathy",
          url: "https://www.youtube.com/watch?v=zjkBMFhNj_g",
          kind: "video",
          minutes: 60,
          reason: "Watch this for the pretraining → fine-tuning → assistant story and why \"it's just predicting the next token\" is both true and misleading.",
        },
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "sampling-decoding",
    title: "Sampling: temperature, top-k & top-p",
    week: 11,
    domain: "ai",
    skills: ["inference"],
    difficulty: "medium",
    minutes: 60,
    summary: "The model outputs a probability distribution; decoding decides which token you actually get. Temperature, top-k and top-p are three knobs on that choice.",
    prerequisites: ["next-token-prediction"],
    tags: ["temperature", "top-k", "top-p", "nucleus", "determinism"],
    lesson: {
      hook: p(
        "Same prompt, same model, two different answers. Then you set `temperature: 0` for your ZtudyLock quiz generator to make it repeatable — and still see occasional differences in production.",
        "Meanwhile the brainstorming feature in Ideako gives bland, repetitive ideas at low temperature and word salad at high temperature.",
        "All three problems live in the few lines of code between the model's logits and the token that gets streamed to your user.",
      ),
      whyItMatters: "Sampling parameters are the cheapest quality lever you have: the right settings differ between extraction, code, chat and creative features, and misunderstanding them causes flaky tests and bad UX.",
      levels: {
        l1: "At each step the model gives every possible next word a probability. Decoding is how you pick one. Always taking the most likely word is safe but boring; picking randomly by probability is more varied but can go off the rails. Temperature, top-k and top-p control how adventurous the pick is.",
        l2: {
          text: p(
            "**Temperature** reshapes the distribution: below 1 sharpens it toward the favourite, above 1 flattens it toward uniform. **Top-k** keeps only the k most likely tokens. **Top-p** (nucleus) keeps the smallest set of tokens whose probabilities add up to p — a list that is short when the model is confident and long when it is unsure.",
            "Truncation (top-k/top-p) exists to cut the long tail of individually tiny but collectively large probability mass, where the nonsense lives.",
          ),
          analogy: "Ordering at a restaurant. Temperature is how adventurous you feel. Top-k is \"only consider the 5 most popular dishes\". Top-p is \"consider dishes until 90% of diners are covered\" — two options on a night everyone orders biryani, twelve on a night orders are spread out.",
          diagram: {
            type: "compare",
            title: "Low vs high temperature",
            left: {
              label: "Low (0–0.3)",
              points: [
                "Distribution sharpened; near-greedy",
                "Consistent, repeatable-ish",
                "Can loop or repeat phrases",
                "Use for extraction, classification, code, JSON",
              ],
            },
            right: {
              label: "High (0.8–1.2)",
              points: [
                "Distribution flattened; more diverse",
                "Different output every run",
                "Higher risk of incoherence and errors",
                "Use for brainstorming, naming, creative writing",
              ],
            },
          },
        },
        l3: {
          text: p(
            "The whole pipeline fits in one function: divide logits by T, optionally mask everything below the k-th largest, softmax, optionally keep only the nucleus, renormalise, sample.",
            "Temperature 0 is handled as a special case (argmax) since dividing by zero is undefined — which is what APIs do too.",
            "Run it and look at the three distributions: the same logits at T = 0.2, 1.0 and 2.0. Then note that with top-p = 0.95 at T = 1.5, the absurd \"banana\" token is never sampled, even though raw sampling would pick it occasionally.",
          ),
          code: [
            {
              title: "Temperature, top-k and top-p from scratch",
              lang: "python",
              code: `import numpy as np

rng = np.random.default_rng(0)

def softmax(z):
    e = np.exp(z - z.max())
    return e / e.sum()

def sample(logits, temperature=1.0, top_k=None, top_p=None):
    if temperature == 0:
        return int(np.argmax(logits))                     # greedy
    z = logits / temperature
    if top_k is not None:
        kth = np.sort(z)[-top_k]
        z = np.where(z < kth, -np.inf, z)                 # drop everything below the k-th best
    probs = softmax(z)
    if top_p is not None:
        order = np.argsort(-probs)
        cum = np.cumsum(probs[order])
        keep = order[cum - probs[order] < top_p]          # smallest prefix reaching mass p
        mask = np.zeros_like(probs, dtype=bool)
        mask[keep] = True
        probs = np.where(mask, probs, 0.0)
        probs /= probs.sum()                              # renormalise the nucleus
    return int(rng.choice(len(probs), p=probs))

vocab = ["Paris", "London", "the", "a", "Lyon", "banana"]
logits = np.array([5.0, 2.5, 2.0, 1.8, 1.5, -1.0])
for t in [0.2, 1.0, 2.0]:
    print(f"T={t}:", softmax(logits / t).round(3))

draws = [sample(logits, temperature=1.5, top_p=0.95) for _ in range(2000)]
print(dict(zip(vocab, np.bincount(draws, minlength=len(vocab)).tolist())))  # banana: 0`,
            },
          ],
        },
        l4: {
          text: p(
            "**The math.** p_i = exp(z_i / T) / Σ_j exp(z_j / T). As T → 0 all mass goes to the argmax; as T → ∞ the distribution becomes uniform. Ratios between two tokens scale as exp((z_i − z_j)/T), so halving T squares the odds ratio.",
            "**Top-k vs top-p.** A fixed k is wrong in both directions: when the model is certain (\"The capital of France is\"), k = 40 lets in 39 bad options; when it is uncertain (first word of a story), k = 40 may cut good ones. Top-p adapts to the shape of the distribution. **Min-p**, a newer alternative, keeps tokens with probability ≥ min_p × p_max and behaves well at high temperatures.",
            "**Order matters.** Most libraries apply temperature first, then top-k, then top-p, so a high temperature also widens the nucleus. Penalties (repetition, frequency, presence) adjust logits before any of these.",
            "**Why temperature 0 is not deterministic.** GPU floating-point addition is not associative; kernels choose different reduction orders depending on batch size and hardware, and hosted APIs batch your request with strangers' requests. Tiny logit differences flip near-ties in argmax, and once one token differs, the rest of the text diverges. Mixture-of-experts routing adds more of this. Seeds help but providers do not guarantee bit-exact reproducibility — design tests around validation, not exact string matches.",
            "**Beam search** keeps the n most likely partial sequences. It suits short, constrained outputs like translation, but for open-ended text it produces bland, repetitive output, which is why chat models sample.",
          ),
          diagram: {
            type: "flow",
            title: "A typical decoding pipeline for one step",
            lanes: [
              {
                tone: "neutral",
                steps: [
                  { label: "Logits", note: "(V,)" },
                  { label: "Penalties", note: "repetition / frequency" },
                  { label: "÷ temperature" },
                  { label: "Top-k mask" },
                  { label: "Softmax + top-p", note: "keep nucleus, renormalise", accent: true },
                  { label: "Sample 1 token" },
                ],
              },
            ],
          },
        },
        l5: {
          question: "You are shipping two features on the same model: a structured data-extraction endpoint and a brainstorming assistant. What decoding settings would you choose for each, and how would you test them?",
          hint: "Think about what \"correct\" means for each, reproducibility, and what the sampling knobs can and cannot guarantee.",
          answer: p(
            "For extraction there is one right answer, so I want the mode of the distribution: temperature 0 (or around 0.1), no top-k/top-p tuning needed, plus structured outputs or a JSON schema so validity does not depend on sampling at all. I would not rely on temperature 0 for determinism, because batching and floating-point effects make hosted inference slightly non-deterministic; tests should validate the parsed fields against expected values, not compare raw strings.",
            "For brainstorming I want diversity without incoherence: temperature around 0.8–1.0 with top-p around 0.9–0.95 to cut the tail, and perhaps a frequency or presence penalty to avoid the same idea five times. Often better than cranking temperature is asking for n candidates and deduplicating by embedding similarity.",
            "I would evaluate both with a fixed prompt set: exact-field accuracy for extraction, and for brainstorming a mix of diversity metrics (distinct n-grams, pairwise embedding distance) plus human or LLM-judge ratings for quality, then tune the knobs against those numbers rather than vibes.",
          ),
        },
      },
      commonMistakes: [
        "Relying on `temperature: 0` for reproducible tests or caching keys. It reduces variation; it does not guarantee identical outputs.",
        "Tuning temperature and top-p aggressively at the same time and not knowing which one changed the behaviour — change one knob at a time.",
        "Using high temperature to \"make the model smarter\" or more creative for factual tasks; it mostly adds errors.",
        "Forgetting to renormalise after top-p filtering, so the probabilities no longer sum to 1 (NumPy's `choice` will raise).",
      ],
      tryThis: "Call your usual LLM API five times with the same prompt at temperature 1.0 and five times at 0. Diff the outputs. Then ask for a list of 10 startup ideas at 0.2 vs 1.0 and count how many ideas overlap.",
      miniTask: {
        title: "Visualise the knobs",
        kind: "code",
        minutes: 35,
        steps: [
          "Run the l3 sampler and print the distributions at T = 0.2, 1.0, 2.0.",
          "Plot them as bar charts side by side with matplotlib.",
          "Sample 2,000 times with (T=1.5, no truncation), (T=1.5, top_k=3) and (T=1.5, top_p=0.95); print counts per token.",
          "Change the logits to a flat distribution (all within 0.5 of each other) and repeat; notice how top-p keeps more tokens but top-k keeps the same number.",
        ],
        checklist: [
          "I have plots for three temperatures",
          "I showed top-p drops the tail token while raw sampling does not",
          "I can explain why top-p adapts to the distribution but top-k does not",
        ],
        deliverable: "`sampling.py` plus a saved figure comparing the three temperatures.",
      },
      quiz: [
        {
          q: "What happens to the next-token distribution as temperature approaches 0?",
          options: ["It becomes uniform", "It collapses onto the highest-logit token", "Top-p is disabled", "Every token's probability doubles"],
          answer: 1,
          explain: "Dividing logits by a tiny T magnifies differences, so softmax puts nearly all mass on the argmax.",
        },
        {
          q: "Why is top-p often preferred over a fixed top-k?",
          options: [
            "It is faster to compute",
            "It adapts the number of candidates to how confident the model is",
            "It guarantees deterministic outputs",
            "It works without a softmax",
          ],
          answer: 1,
          explain: "The nucleus is small for peaked distributions and large for flat ones; top-k is the same size regardless.",
        },
        {
          q: "Why can a hosted API return different outputs at temperature 0?",
          options: [
            "Temperature 0 secretly means 0.7",
            "Floating-point non-associativity and batch-dependent GPU kernels can flip near-ties",
            "The tokenizer is random",
            "Top-k is still applied randomly",
          ],
          answer: 1,
          explain: "Tiny numerical differences change which token wins a near-tie, and one different token changes everything after it.",
        },
      ],
      explainPrompt: "Explain to a junior engineer in 5 sentences what temperature, top-k and top-p do, and which settings to use for extraction vs brainstorming.",
      implementPrompt: "From memory, implement `sample(logits, temperature, top_k, top_p)` in NumPy, including the temperature-0 case and renormalisation after top-p.",
      videos: [
        {
          title: "Deep Dive into LLMs like ChatGPT",
          channel: "Andrej Karpathy",
          url: "https://www.youtube.com/watch?v=7xTGNNLPyMI",
          kind: "video",
          minutes: 211,
          reason: "Watch the inference section (not the whole thing) to see sampling from real model distributions and why outputs vary run to run.",
        },
      ],
    },
  },
];

export const labs: LabSeed[] = [
  {
    slug: "tiny-gpt",
    title: "Tiny GPT: a character-level transformer from scratch",
    week: 11,
    duration: "1d",
    minutes: 480,
    difficulty: "hard",
    domain: "ai",
    skills: ["transformer-architecture", "pytorch", "inference", "attention"],
    prerequisites: [
      "The transformer block",
      "Decoder-only models & next-token prediction",
      "Sampling: temperature, top-k & top-p",
    ],
    topicSlugs: ["transformer-block", "next-token-prediction", "sampling-decoding", "multi-head-attention", "positional-encoding"],
    objective: "Build and train a character-level GPT in PyTorch in the spirit of Karpathy's nanoGPT, then generate text from it with temperature and top-k.",
    expectedOutput: "A `tiny_gpt.py` that trains on a small text file, logs train/val loss starting near ln(vocab) ≈ 4.2 and falling below ~2.0 (lower with a GPU and a bigger config), saves a checkpoint, and prints generated samples at temperatures 0.5, 1.0 and 1.5.",
    steps: [
      {
        title: "Data and character tokenizer",
        detail: "Download Tiny Shakespeare (`input.txt`, ~1.1M characters) or concatenate your own writing. Build `stoi`/`itos` from `sorted(set(text))`, encode the whole text to a `torch.long` tensor, and split 90/10 into train/val. Use the starter below.",
      },
      {
        title: "Bigram baseline",
        detail: "Write `BigramLM` with a single `nn.Embedding(V, V)` whose rows are logits. `forward(idx, targets)` returns `(logits, loss)` using `F.cross_entropy` on flattened (B·T, V). Train 2,000 steps with AdamW (lr 1e-3). Confirm the first loss ≈ ln(V) and it plateaus around 2.5. This is the number the transformer must beat.",
      },
      {
        title: "Add the transformer",
        detail: "Token embedding (V, d) + learned position embedding (block_size, d) → N pre-norm `Block`s from this week's topic → final LayerNorm → `nn.Linear(d, V)`. Start small for CPU: d = 128, n_head = 4, n_layer = 4, block_size = 128, dropout 0.1, batch 32.",
      },
      {
        title: "Training loop with evaluation",
        detail: "AdamW, lr 3e-4 to 1e-3, 3,000–5,000 steps. Every 250 steps, estimate mean train and val loss over 50 batches under `torch.no_grad()` with `model.eval()`, then switch back to `model.train()`. Print step, losses and elapsed time. Save `state_dict` when val loss improves.",
      },
      {
        title: "Generate with temperature and top-k",
        detail: "Use the starter's `generate` (crop context to `block_size`, take last-position logits, divide by temperature, optional top-k mask, `torch.multinomial`). Print 300 characters at T = 0.5, 1.0 and 1.5 from a newline start token and describe the differences.",
      },
      {
        title: "Run the experiments that teach you something",
        detail: "One change at a time, record val loss: remove positional embeddings; remove residual connections; set n_head = 1 vs 4 at the same d. Put results in a small table in your README.",
      },
    ],
    hints: [
      "If loss is stuck at ln(V), check that targets are shifted by one and that you call `optimizer.zero_grad()` each step.",
      "On Apple Silicon use `device = \"mps\"`; on CPU keep the model under ~1M parameters so 3,000 steps finish in minutes, not hours.",
      "Val loss rising while train loss falls means overfitting: raise dropout, shrink the model, or stop earlier.",
      "Karpathy's \"Let's build GPT\" builds exactly this; pause it after each section and write your version before watching his.",
    ],
    stretch: "Swap the character tokenizer for your week-9 BPE tokenizer (vocab 512) and compare sample quality per training minute; or replace learned positions with RoPE from week 10.",
    learned: [
      "How every piece of a GPT fits together in ~150 lines",
      "What healthy training curves look like and how to sanity-check the first loss",
      "The effect of positions, residuals and heads, measured rather than assumed",
      "Sampling behaviour on a model you trained yourself",
    ],
    starter: {
      title: "tiny_gpt.py (data, batching and generation)",
      lang: "python",
      code: `import torch
import torch.nn.functional as F

torch.manual_seed(1337)
device = "cuda" if torch.cuda.is_available() else ("mps" if torch.backends.mps.is_available() else "cpu")
block_size, batch_size = 128, 32

text = open("input.txt", encoding="utf-8").read()
chars = sorted(set(text))
stoi = {c: i for i, c in enumerate(chars)}
itos = {i: c for c, i in stoi.items()}
encode = lambda s: [stoi[c] for c in s]
decode = lambda ids: "".join(itos[i] for i in ids)

data = torch.tensor(encode(text), dtype=torch.long)
n = int(0.9 * len(data))
train_data, val_data = data[:n], data[n:]

def get_batch(split):
    d = train_data if split == "train" else val_data
    ix = torch.randint(len(d) - block_size, (batch_size,))
    x = torch.stack([d[i : i + block_size] for i in ix])
    y = torch.stack([d[i + 1 : i + block_size + 1] for i in ix])     # shifted by one
    return x.to(device), y.to(device)

@torch.no_grad()
def generate(model, idx, max_new_tokens, temperature=1.0, top_k=None):
    for _ in range(max_new_tokens):
        logits, _ = model(idx[:, -block_size:])                       # crop to context window
        logits = logits[:, -1, :] / temperature
        if top_k is not None:
            v, _ = torch.topk(logits, top_k)
            logits[logits < v[:, [-1]]] = -float("inf")
        next_id = torch.multinomial(F.softmax(logits, dim=-1), num_samples=1)
        idx = torch.cat([idx, next_id], dim=1)
    return idx

print(f"vocab {len(chars)}, train {len(train_data):,} chars, device {device}")`,
    },
  },
];
