import type { LabSeed, TopicSeed } from "../../types";

/** Join paragraphs with a blank line. */
const p = (...paras: string[]) => paras.join("\n\n");

export const topics: TopicSeed[] = [
  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "tokenisation-bpe",
    title: "Tokenisation & BPE",
    week: 9,
    domain: "ai",
    skills: ["tokenisation"],
    difficulty: "medium",
    minutes: 75,
    summary: "Models read integer IDs, not letters. Byte-pair encoding decides which chunks of text become one ID — and that shapes cost, context and weird failures.",
    tags: ["tokenizer", "bpe", "tiktoken", "cost", "llm-internals"],
    lesson: {
      hook: p(
        "Ask a model how many r's are in \"strawberry\" and it has historically got it wrong. The model is not bad at counting. It never saw the letters — it saw something like `[\"str\", \"aw\", \"berry\"]`, three integers.",
        "Now look at your OpenAI bill for IdeaGuard. You were charged per **token**, not per word or character. The same sentence in Tamil can cost several times more tokens than in English, and a JSON blob with lots of braces and whitespace costs more than you think.",
        "Every LLM call you make passes through a tokenizer twice: your text goes in as IDs, and IDs come back out as text. Understanding that layer explains cost, context limits, and a whole class of strange model behaviour.",
      ),
      whyItMatters: "Token counts drive price, latency and context-window limits in every LLM product; the tokenizer also explains failures with spelling, arithmetic, code and non-English text.",
      levels: {
        l1: "A language model cannot read text directly — it only handles numbers. A tokenizer chops text into chunks called tokens and gives each chunk an ID from a fixed dictionary. Common chunks like \" the\" or \"ing\" get their own ID; rare words are built from several smaller pieces.",
        l2: {
          text: p(
            "BPE builds its dictionary bottom-up. Start with the 256 possible bytes. Find the pair of neighbours that appears most often in a big pile of text, glue them into a new symbol, and repeat tens of thousands of times.",
            "Frequent strings end up as single tokens (\" the\", \"tion\", \" function\"). Rare strings fall back to smaller pieces, all the way down to raw bytes — so nothing is ever \"unknown\".",
          ),
          analogy: "It is like a court stenographer inventing shorthand. Phrases they hear constantly get one squiggle; unusual names get spelled out letter by letter.",
          diagram: {
            type: "flow",
            title: "From text to model input",
            lanes: [
              {
                tone: "neutral",
                steps: [
                  { label: "Text", note: "\" unbelievably\"" },
                  { label: "Pre-split", note: "regex splits words, digits, punctuation" },
                  { label: "UTF-8 bytes", note: "0–255" },
                  { label: "Apply merges", note: "in the order they were learned", accent: true },
                  { label: "Tokens", note: "\" un\" \"belie\" \"vably\" (illustrative)" },
                  { label: "IDs → embeddings", note: "row lookup in a V × d table" },
                ],
              },
            ],
          },
        },
        l3: {
          text: p(
            "In practice you use the model's own tokenizer: `tiktoken` for OpenAI models, the Hugging Face `AutoTokenizer` for open models. Different models have different vocabularies, so token counts are **not** portable between providers.",
            "Rule of thumb for English prose: roughly 4 characters or 0.75 words per token. Code, numbers, JSON and non-Latin scripts are usually worse. Measure instead of guessing — the snippet below compares GPT-4's `cl100k_base` (~100k tokens) with GPT-4o's `o200k_base` (~200k tokens).",
            "Notice the leading space in `\" strawberry\"`: in byte-level BPE, the space is usually glued to the *start* of the next word, so `\"strawberry\"` and `\" strawberry\"` tokenize differently.",
          ),
          code: [
            {
              title: "Count and inspect tokens with tiktoken",
              lang: "python",
              code: `# pip install tiktoken
import tiktoken

texts = {
    "english": "Cortex answers questions about your documents.",
    "code": "def add(a: int, b: int) -> int: return a + b",
    "tamil": "வணக்கம், எப்படி இருக்கிறீர்கள்?",
    "number": "3.14159265358979",
    "strawberry": " strawberry",
}

for name in ["cl100k_base", "o200k_base"]:
    enc = tiktoken.get_encoding(name)
    print(f"--- {name} (vocab size {enc.n_vocab})")
    for label, text in texts.items():
        ids = enc.encode(text)
        pieces = [enc.decode_single_token_bytes(i) for i in ids]
        print(f"{label:>10}: {len(text):>3} chars -> {len(ids):>2} tokens {pieces[:6]}")

def estimate_cost(prompt: str, expected_output_tokens: int, in_per_m: float, out_per_m: float) -> float:
    enc = tiktoken.get_encoding("o200k_base")
    n_in = len(enc.encode(prompt))
    return n_in / 1e6 * in_per_m + expected_output_tokens / 1e6 * out_per_m

# prices are placeholders: copy real ones from your provider's pricing page
print(f"$ {estimate_cost('Summarise this PDF ' * 500, 400, 0.15, 0.60):.5f}")`,
              note: "Tamil text often needs several times more tokens than an English sentence of similar meaning — which directly multiplies cost for those users.",
            },
          ],
        },
        l4: {
          text: p(
            "**Training** a byte-level BPE tokenizer: encode the corpus to UTF-8 bytes (IDs 0–255). Count every adjacent pair. Replace the most frequent pair everywhere with a new ID (256, 257, …) and record the merge. Repeat until the vocabulary hits the target size (50,257 for GPT-2, ~100k for cl100k, ~200k for o200k).",
            "**Encoding** new text replays the merges **in the order they were learned** (by rank), not by frequency in the new text. That is why encoding is deterministic. **Decoding** is a lookup: each ID maps to a byte string; concatenate and UTF-8 decode.",
            "Two production details: (1) a **pre-tokenisation regex** splits text into words, numbers and punctuation first, so merges never cross those boundaries (no token for \"dog.\" + \" The\"); (2) **special tokens** like `<|endoftext|>` or chat role markers are added outside BPE and are never produced by merging.",
            "Vocabulary size is a real trade-off: a bigger vocab means shorter sequences (cheaper attention, more text per context window) but a bigger embedding table and output softmax, and rare tokens get fewer training updates.",
          ),
          code: [
            {
              title: "Minimal byte-level BPE: train and encode",
              lang: "python",
              code: `from collections import Counter

def pair_counts(ids):
    return Counter(zip(ids, ids[1:]))

def merge(ids, pair, new_id):
    out, i = [], 0
    while i < len(ids):
        if i + 1 < len(ids) and (ids[i], ids[i + 1]) == pair:
            out.append(new_id)
            i += 2
        else:
            out.append(ids[i])
            i += 1
    return out

def train(text, num_merges):
    ids, merges = list(text.encode("utf-8")), {}
    for n in range(num_merges):
        counts = pair_counts(ids)
        if not counts:
            break
        best = max(counts, key=counts.get)   # most frequent adjacent pair
        merges[best] = 256 + n
        ids = merge(ids, best, 256 + n)
    return merges

def encode(text, merges):
    ids = list(text.encode("utf-8"))
    while len(ids) >= 2:
        # replay the earliest-learned merge that applies, exactly like training did
        pair = min(pair_counts(ids), key=lambda p: merges.get(p, float("inf")))
        if pair not in merges:
            break
        ids = merge(ids, pair, merges[pair])
    return ids

merges = train("low lower lowest newer newest wider widest " * 20, 12)
print(len(merges), "merges;", encode("lowest newest", merges))`,
              note: "This is the core of the week's BPE lab. Real tokenizers add the pre-split regex and special tokens on top.",
            },
          ],
        },
        l5: {
          question: "What are the trade-offs when choosing a tokenizer's vocabulary size?",
          hint: "Think about sequence length, the embedding and output matrices, and how often each token is seen in training.",
          answer: p(
            "A larger vocabulary compresses text into fewer tokens, so the same context window holds more content and attention — which scales quadratically with sequence length — is cheaper per character. It also helps multilingual text and code, which fragment badly under small English-centric vocabularies.",
            "The cost is parameters and compute at both ends: the embedding table and the output projection are each V × d, so going from 50k to 200k tokens at d = 4096 adds roughly 600M parameters per matrix, and every decoding step computes a softmax over all V logits. Rare tokens also get few gradient updates, so their embeddings are undertrained, which can produce glitchy behaviour on odd strings.",
            "A small vocabulary does the opposite: tiny tables, but long sequences and worse handling of spelling-sensitive tasks. Modern frontier models settle around 100k–260k because long contexts and multilingual users make sequence length the more expensive side.",
          ),
        },
      },
      commonMistakes: [
        "Estimating tokens as words. Code, JSON, numbers and non-English text routinely run 1.5–4x the English rule of thumb — measure with the real tokenizer.",
        "Counting tokens with one model's tokenizer and applying the number to another provider's model. Vocabularies differ, so context-limit checks silently break.",
        "Truncating prompts by characters instead of tokens, which either wastes context or overflows the window with an API error.",
        "Forgetting chat-template overhead: role markers, tool schemas and system prompts are tokens too and are billed on every request.",
      ],
      tryThis: "Open tiktokenizer.vercel.app, paste a paragraph of English, then the same paragraph in Tamil or Hindi, then a minified JSON object. Watch how the token count changes for the same meaning.",
      miniTask: {
        title: "Measure the token tax",
        kind: "code",
        minutes: 25,
        steps: [
          "`pip install tiktoken` and run the l3 snippet.",
          "Add three strings of your own: a real prompt from IdeaGuard or ZtudyLock, a 20-line JSON response, and one sentence in a language you speak other than English.",
          "Print chars, tokens and chars-per-token for each under `o200k_base`.",
          "Run `enc.encode(\"strawberry\")` vs `enc.encode(\" strawberry\")` and print the decoded pieces.",
          "Estimate the monthly cost of your real prompt at 1,000 calls/day using current published prices.",
        ],
        checklist: [
          "I have a table of chars/token for English, code/JSON and a non-English language",
          "I can explain why the leading space changes the tokens",
          "I computed a monthly cost figure from real token counts, not word counts",
        ],
        deliverable: "A short script output (or notes) with token counts, chars-per-token ratios and one monthly cost estimate.",
      },
      quiz: [
        {
          q: "Why can byte-level BPE tokenizers encode any string without an \"unknown\" token?",
          options: [
            "They store every word in the dictionary",
            "The base vocabulary contains all 256 byte values, so anything can fall back to bytes",
            "They replace unknown characters with spaces",
            "They use character-level encoding for rare words only in English",
          ],
          answer: 1,
          explain: "Every string is a sequence of UTF-8 bytes, and all 256 bytes are in the base vocabulary. Merges only make common sequences shorter.",
        },
        {
          q: "When encoding new text, in what order are BPE merges applied?",
          options: [
            "Most frequent pair in the new text first",
            "Left to right, one character at a time",
            "In the order the merges were learned during training (lowest rank first)",
            "Randomly, then the shortest result is kept",
          ],
          answer: 2,
          explain: "Encoding replays training: at each step it applies the applicable merge with the lowest rank. This makes tokenization deterministic.",
        },
        {
          q: "Doubling vocabulary size mostly affects which part of a model's parameter count?",
          options: [
            "The attention Q/K/V projections",
            "The MLP hidden layers",
            "The token embedding table and output projection",
            "The LayerNorm parameters",
          ],
          answer: 2,
          explain: "Both the input embedding and the output (unembedding) matrix are V × d; attention and MLP sizes depend on d, not V.",
        },
      ],
      explainPrompt: "Explain to a junior engineer in 5 sentences why their LLM bill is priced in tokens, how BPE decides what a token is, and why Tamil text costs more than English.",
      implementPrompt: "From memory, write BPE `train(text, num_merges)` and `encode(text, merges)` in Python, then verify `decode(encode(s)) == s` on three strings including one with emoji.",
      videos: [
        {
          title: "Let's build the GPT Tokenizer",
          channel: "Andrej Karpathy",
          url: "https://www.youtube.com/watch?v=zduSFxRajkE",
          kind: "video",
          minutes: 133,
          reason: "Watch the first hour before the BPE lab; it builds exactly this tokenizer and explains the regex pre-split and special tokens.",
        },
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "embeddings",
    title: "Embeddings: meaning as numbers",
    week: 9,
    domain: "ai",
    skills: ["embeddings"],
    difficulty: "easy",
    minutes: 60,
    summary: "An embedding turns text into a vector so that similar meanings land close together — the foundation of search, RAG, clustering and Cortex.",
    prerequisites: ["tokenisation-bpe"],
    tags: ["embeddings", "cosine-similarity", "sentence-transformers", "rag"],
    lesson: {
      hook: p(
        "A Cortex user searches their notes for \"how do I stop paying twice for the same prompt?\". The relevant note says \"cache LLM responses in Redis\". Not one word overlaps. Keyword search returns nothing.",
        "You need search that matches **meaning**, not spelling. That requires turning text into something a computer can compare: a list of numbers where \"stop paying twice for the same prompt\" and \"cache LLM responses\" come out nearly identical.",
        "That list of numbers is an embedding. Every RAG system, recommendation feed and semantic search you will build this year starts here.",
      ),
      whyItMatters: "Embeddings power retrieval in RAG, semantic search, deduplication, clustering and classification — they are how Cortex will find the right passage to cite.",
      levels: {
        l1: "An embedding converts meaning into numbers. You give a model a sentence, and it gives back a long list of numbers that captures what the sentence is about. Sentences that mean similar things get similar lists of numbers, even if they use completely different words.",
        l2: {
          text: p(
            "Picture every possible sentence placed on a giant map. The embedding is the sentence's coordinates. Similar meanings sit close together: \"reset my password\" is next door to \"forgot my login\", and far away from \"the weather in Chennai is humid\".",
            "The map has hundreds of dimensions instead of two, so it can hold many kinds of closeness at once — topic, tone, language, intent. Searching becomes geometry: embed the query, find the nearest points.",
          ),
          analogy: "Like a well-organised library where books on the same subject sit on the same shelf, except the shelving is learned automatically and every sentence gets its own precise spot.",
          diagram: {
            type: "grid",
            title: "Cosine similarity between four sentences (illustrative)",
            rowLabels: ["reset my password", "forgot my login", "cache LLM calls", "Chennai weather"],
            colLabels: ["password", "login", "cache", "weather"],
            values: [
              [1.0, 0.72, 0.08, 0.05],
              [0.72, 1.0, 0.1, 0.04],
              [0.08, 0.1, 1.0, 0.06],
              [0.05, 0.04, 0.06, 1.0],
            ],
            caption: "Bright cells = close on the map. The password/login pair shares no key words but scores high.",
          },
        },
        l3: {
          text: p(
            "An embedding is a vector: `all-MiniLM-L6-v2` outputs 384 floats, OpenAI's `text-embedding-3-small` outputs 1536. Closeness is measured with **cosine similarity** — the cosine of the angle between two vectors: `cos(a, b) = a·b / (‖a‖ ‖b‖)`. 1 means same direction, 0 means unrelated, negative means opposed (rare in practice).",
            "If you normalise every vector to length 1 first, cosine similarity is just the dot product, and a whole similarity matrix is one matrix multiply: `E @ E.T`.",
            "Important: only compare embeddings from the **same model**. Vectors from two different models live on two different maps; comparing them is meaningless.",
          ),
          code: [
            {
              title: "Embed sentences and find the most similar pair",
              lang: "python",
              code: `# pip install sentence-transformers
import numpy as np
from sentence_transformers import SentenceTransformer

model = SentenceTransformer("all-MiniLM-L6-v2")
sentences = [
    "How do I reset my password?",
    "I forgot my login credentials.",
    "The weather in Chennai is humid today.",
    "Best way to cache LLM responses in Redis",
    "Storing model outputs so repeated prompts are cheap",
]
emb = model.encode(sentences, normalize_embeddings=True)   # (5, 384), each row length 1
print(emb.shape, np.linalg.norm(emb, axis=1).round(3))

sims = emb @ emb.T                  # cosine similarity matrix, (5, 5)
np.fill_diagonal(sims, -1)          # ignore self-similarity
i, j = np.unravel_index(sims.argmax(), sims.shape)
print(f"most similar: {sentences[i]!r} <-> {sentences[j]!r} ({sims[i, j]:.3f})")

def cosine(a, b):
    return float(a @ b / (np.linalg.norm(a) * np.linalg.norm(b)))
print(round(cosine(emb[0], emb[2]), 3))  # password vs weather: low`,
            },
          ],
        },
        l4: {
          text: p(
            "**How the model is built.** A sentence-embedding model is a transformer encoder. It produces one vector per token; a **pooling** step (usually the mean over non-padding tokens) collapses them into one sentence vector.",
            "**How it learns closeness.** It is trained **contrastively** on pairs that should match (question/answer, title/body, paraphrases). In a batch of B pairs, each query must score its own partner higher than the B−1 other documents — the InfoNCE loss, which is just cross-entropy over a B × B similarity matrix. Meaning emerges because the only way to win is to encode what the text is about.",
            "**Dimensions.** More dimensions can hold finer distinctions but cost memory and search time: 1M vectors × 1536 dims × 4 bytes ≈ 6 GB. Models trained with Matryoshka representation learning (such as OpenAI's `text-embedding-3` family, via the `dimensions` parameter) let you truncate vectors to 256 or 512 dims with a small quality loss.",
            "**Normalisation.** Because training uses cosine similarity, direction carries the meaning and length is mostly noise. Normalise once at write time and every later comparison is a cheap dot product.",
          ),
          code: [
            {
              title: "Mean pooling and the contrastive (InfoNCE) loss",
              lang: "python",
              code: `import torch
import torch.nn.functional as F

def mean_pool(token_embs, attention_mask):
    # token_embs: (B, T, D), attention_mask: (B, T) with 1 for real tokens, 0 for padding
    mask = attention_mask.unsqueeze(-1).float()
    return (token_embs * mask).sum(dim=1) / mask.sum(dim=1).clamp(min=1e-9)

def info_nce(q, d, temperature=0.05):
    # q, d: (B, D) — row i of q should match row i of d; every other row is a negative
    q, d = F.normalize(q, dim=-1), F.normalize(d, dim=-1)
    logits = q @ d.T / temperature          # (B, B) cosine similarities, sharpened
    labels = torch.arange(q.size(0))        # the diagonal is the correct match
    return F.cross_entropy(logits, labels)

B, T, D = 8, 12, 384
q = mean_pool(torch.randn(B, T, D), torch.ones(B, T))
d = q + 0.1 * torch.randn(B, D)             # near-copies = easy positives
print(info_nce(q, d).item(), info_nce(q, torch.randn(B, D)).item())  # low vs high`,
              note: "Low loss when each query's partner is its nearest neighbour; around ln(8) ≈ 2.08 or higher when the pairs are random.",
            },
          ],
        },
        l5: {
          question: "Why might cosine similarity be preferred over Euclidean distance for embeddings?",
          hint: "What does vector length encode, and what happens to both metrics when vectors are unit length?",
          answer: p(
            "Embedding models are trained with a cosine-based objective, so meaning lives in the vector's direction; its length tends to reflect incidental things like input length or token frequency. Euclidean distance mixes that length into the score, so a long document can look far from a short query that means the same thing.",
            "Cosine ignores magnitude and compares only direction, which matches how the model was trained. It is also bounded in [−1, 1], which makes thresholds easier to reason about.",
            "The nice detail: for unit-normalised vectors, ‖a − b‖² = 2 − 2·cos(a, b), so Euclidean distance and cosine produce the identical ranking. In practice you normalise once at ingestion and use the dot product, which is the cheapest of the three and what most vector indexes optimise for.",
          ),
        },
      },
      commonMistakes: [
        "Comparing embeddings produced by different models, or by the same provider's old and new model versions, after an upgrade without re-embedding the corpus.",
        "Embedding whole 30-page documents as one vector. Most models truncate (all-MiniLM-L6-v2 stops at 256 word pieces) and one vector cannot represent many topics — chunk first.",
        "Treating a similarity score as a probability. 0.62 is not \"62% relevant\"; score ranges differ per model, so calibrate thresholds on your own data.",
        "Using asymmetric models without their required prefixes (some E5/BGE-style models expect `query: ` / `passage: ` prefixes), which quietly degrades retrieval.",
      ],
      tryThis: "Embed \"I love this product\" and \"I do not love this product\". The similarity will be surprisingly high — embeddings capture topic far more strongly than negation.",
      miniTask: {
        title: "Five sentences, one nearest pair",
        kind: "code",
        minutes: 30,
        steps: [
          "`pip install sentence-transformers` (first run downloads the ~90 MB model).",
          "Write five sentences: two pairs that mean the same thing with different words, plus one unrelated sentence.",
          "Convert all five into embeddings with `all-MiniLM-L6-v2` and `normalize_embeddings=True`; print the shape.",
          "Compute the 5 × 5 similarity matrix with `emb @ emb.T` and print it rounded to 2 decimals.",
          "Find which two sentences are most similar (ignore the diagonal) and check it matches your intuition.",
          "Compute cosine for one pair by hand with the formula and confirm it equals the matrix entry.",
        ],
        checklist: [
          "Embedding shape is (5, 384) and every row has norm 1.0",
          "The most similar pair is one of my paraphrase pairs",
          "My manual cosine matches the matrix value to 3 decimals",
          "I can say why the unrelated sentence scores low against everything",
        ],
        deliverable: "A script that prints the similarity matrix and the most similar pair of your five sentences.",
      },
      quiz: [
        {
          q: "You normalise all embeddings to length 1. Which operation now equals cosine similarity?",
          options: ["Euclidean distance", "Dot product", "Manhattan distance", "Element-wise product sum of squares"],
          answer: 1,
          explain: "cos(a, b) = a·b / (‖a‖‖b‖). With ‖a‖ = ‖b‖ = 1 the denominator is 1, leaving the dot product.",
        },
        {
          q: "What does contrastive training optimise for in an embedding model?",
          options: [
            "Predicting the next token in a sentence",
            "Making matching pairs score higher than non-matching pairs in the same batch",
            "Minimising the length of each vector",
            "Reconstructing the input text from the vector",
          ],
          answer: 1,
          explain: "InfoNCE pushes each query toward its positive and away from in-batch negatives — cross-entropy over a similarity matrix.",
        },
        {
          q: "You upgrade Cortex from embedding model A to model B. What must you do with stored vectors?",
          options: [
            "Nothing, all embeddings are compatible",
            "Re-normalise them",
            "Re-embed the whole corpus with model B",
            "Multiply them by a conversion matrix provided by the API",
          ],
          answer: 2,
          explain: "Different models define different vector spaces. Queries embedded with B are meaningless against documents embedded with A.",
        },
      ],
      explainPrompt: "Explain to a junior engineer in 5 sentences what an embedding is, how it is trained, and why Cortex compares them with cosine similarity.",
      implementPrompt: "From memory, embed ten sentences with sentence-transformers, build the similarity matrix, and print each sentence's nearest neighbour.",
      videos: [
        {
          title: "Word embeddings and sentence embeddings, explained",
          channel: "StatQuest",
          url: "https://www.youtube.com/results?search_query=statquest+word+embedding+and+word2vec+clearly+explained",
          kind: "search",
          reason: "Watch this if the idea of learning coordinates for words still feels abstract.",
        },
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "vector-similarity",
    title: "Vector similarity: cosine, dot product & distance",
    week: 9,
    domain: "ai",
    skills: ["embeddings", "vector-search"],
    difficulty: "medium",
    minutes: 60,
    summary: "Three ways to measure closeness, when they agree, and how to find the top-k nearest vectors fast — from a NumPy matmul and a heap to HNSW and pgvector.",
    prerequisites: ["embeddings"],
    tags: ["cosine", "dot-product", "top-k", "heap", "pgvector", "ann"],
    lesson: {
      hook: p(
        "Cortex has 200,000 chunks from Goutham's notes and PDFs. A question arrives. You need the 5 most relevant chunks in under 50 ms, before the LLM even starts.",
        "That is two problems. Which **number** says \"these two vectors are close\"? And how do you find the top 5 out of 200,000 without sorting everything on every request?",
        "Get the metric wrong and retrieval quietly degrades. Get the search wrong and your p95 latency explodes as the corpus grows.",
      ),
      whyItMatters: "Every vector database, pgvector index and RAG retriever is a similarity metric plus a top-k search; choosing both correctly is most of retrieval engineering.",
      levels: {
        l1: "To compare two embeddings you need a single number that says how close they are. Cosine similarity asks whether they point the same way. The dot product also rewards longer vectors. Euclidean distance measures the straight-line gap between their tips.",
        l2: {
          text: p(
            "Think of each embedding as an arrow from the origin. **Cosine** compares only the angle between arrows. **Dot product** is angle times both lengths. **Euclidean** is the length of the gap between the arrow tips.",
            "Normalise every arrow to length 1 and all three give the same ranking. That is why the standard pipeline normalises once at ingestion and then uses the cheapest one: the dot product.",
          ),
          analogy: "Two people pointing at the same star from different distances: cosine says they agree completely; Euclidean distance says they are far apart; the dot product also cares how long their arms are.",
          diagram: {
            type: "flow",
            title: "Top-k retrieval for one query",
            lanes: [
              {
                tone: "neutral",
                steps: [
                  { label: "Query text" },
                  { label: "Embed", note: "same model as the corpus" },
                  { label: "Normalise", note: "‖q‖ = 1" },
                  { label: "Scores = E · q", note: "(N, d) × (d,) → (N,)", accent: true },
                  { label: "Top-k", note: "heap or argpartition, O(N log k)" },
                  { label: "Chunks → LLM" },
                ],
              },
            ],
          },
        },
        l3: {
          text: p(
            "**Cosine similarity**: `a·b / (‖a‖‖b‖)`, range [−1, 1], higher is closer. **Dot product**: `a·b`, unbounded; used when the model was trained for it (some retrieval models intentionally let magnitude encode importance). **Euclidean (L2)**: `‖a − b‖`, lower is closer.",
            "For unit vectors: `‖a − b‖² = 2 − 2·(a·b)`. Same order, flipped direction.",
            "For top-k you never sort all N scores. `np.argpartition` finds the k best in O(N), then you sort just those k. In a streaming setting (scores arriving from shards), keep a **min-heap of size k** — the heap pattern from this week's DSA practice.",
          ),
          code: [
            {
              title: "Three metrics, one ranking, fast top-k",
              lang: "python",
              code: `import heapq
import numpy as np

rng = np.random.default_rng(42)
N, d, k = 200_000, 384, 5
E = rng.normal(size=(N, d)).astype(np.float32)
E /= np.linalg.norm(E, axis=1, keepdims=True)          # normalise once at ingestion
q = E[123] + 0.05 * rng.normal(size=d).astype(np.float32)
q /= np.linalg.norm(q)

dot = E @ q                                            # (N,) == cosine, since all unit length
l2 = np.linalg.norm(E - q, axis=1)                     # (N,)
assert np.allclose(l2 ** 2, 2 - 2 * dot, atol=1e-4)    # the identity, numerically

top = np.argpartition(-dot, k)[:k]                     # k best in O(N), unordered
top = top[np.argsort(-dot[top])]                       # sort only k items
print("argpartition:", top, dot[top].round(3))
print("same by L2:  ", np.argsort(l2)[:k])

def topk_stream(scored_items, k):
    heap = []                                          # min-heap of (score, id), size <= k
    for idx, s in scored_items:
        if len(heap) < k:
            heapq.heappush(heap, (s, idx))
        elif s > heap[0][0]:
            heapq.heapreplace(heap, (s, idx))          # evict the current worst
    return sorted(heap, reverse=True)

print("heap:        ", [i for _, i in topk_stream(enumerate(dot.tolist()), k)])`,
              note: "Item 123 should come first. All three methods agree on the ranking because the vectors are normalised.",
            },
          ],
        },
        l4: {
          text: p(
            "**Brute force** is O(N·d) per query: 200k × 384 ≈ 77M multiply-adds, a few milliseconds with BLAS. It is exact and perfectly fine up to roughly a few hundred thousand vectors. Memory is the first wall: 1M × 1536 float32 ≈ 6.1 GB.",
            "**Approximate nearest neighbour (ANN)** trades a little recall for big speedups. **HNSW** builds a layered proximity graph: search starts at a sparse top layer, greedily walks toward the query, then drops to denser layers — roughly logarithmic hops. **IVF** clusters vectors with k-means and only scans the few clusters nearest the query. **Quantisation** (int8, binary, product quantisation) shrinks memory 4–32x at some accuracy cost.",
            "In Postgres, pgvector exposes the metrics as operators: `<->` L2 distance, `<#>` **negative** inner product, `<=>` cosine distance (1 − cosine). An HNSW index only accelerates queries that use the same operator class it was built with — a classic silent performance bug.",
            "Always measure **recall@k** of your ANN index against brute force on a sample of real queries. 0.95+ is typical; tune `ef_search` (HNSW) or `probes` (IVF) to trade latency for recall.",
          ),
          code: [
            {
              title: "pgvector: table, HNSW index and a cosine top-5 query",
              lang: "sql",
              code: `CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE chunks (
  id        bigserial PRIMARY KEY,
  doc_id    bigint NOT NULL,
  content   text   NOT NULL,
  embedding vector(384) NOT NULL
);

-- the operator class must match the operator used in queries
CREATE INDEX chunks_embedding_hnsw
  ON chunks USING hnsw (embedding vector_cosine_ops);

-- higher ef_search = better recall, slower queries (default 40)
SET hnsw.ef_search = 80;

-- $1 is the query embedding; <=> is cosine DISTANCE, so ascending order = most similar first
SELECT id, doc_id, 1 - (embedding <=> $1) AS cosine_similarity
FROM chunks
ORDER BY embedding <=> $1
LIMIT 5;`,
            },
          ],
        },
        l5: {
          question: "You have 10 million 768-dimensional embeddings and need the top-10 neighbours in under 50 ms at p95. Walk me through your design.",
          hint: "Start with memory math, then choose between exact and approximate search, then say how you would validate it.",
          answer: p(
            "First the arithmetic: 10M × 768 × 4 bytes ≈ 31 GB of float32, so brute force on one box is both memory-heavy and around 7.7 billion multiply-adds per query — too slow for 50 ms on CPU. That pushes me to an ANN index.",
            "I would normalise vectors at ingestion and use inner product, then build HNSW (or IVF-PQ if memory is tight; int8 or product quantisation cuts the footprint 4–16x). With HNSW I tune `M` and `ef_construction` at build time and `ef_search` at query time.",
            "I would validate with recall@10 against exact brute-force results on a few thousand real queries, targeting about 0.95, and chart latency vs recall as I sweep `ef_search`. If there are metadata filters (per-user documents in Cortex), I would check the index handles filtered search without collapsing recall, or partition by tenant.",
            "Finally, over-fetch (say top 50) and rerank with a cross-encoder if quality matters more than a few milliseconds.",
          ),
        },
      },
      commonMistakes: [
        "Sorting all N scores (`np.argsort`) for every query when you only need k — O(N log N) where O(N) or O(N log k) would do.",
        "Using the dot product on unnormalised vectors from a cosine-trained model, which lets long chunks dominate results.",
        "Building a pgvector index with `vector_l2_ops` but querying with `<=>`: the index is silently ignored and you get a sequential scan.",
        "Shipping an ANN index without ever measuring recall against exact search.",
      ],
      tryThis: "In the l3 snippet, remove the normalisation lines and rerun. Compare the top-5 by dot product vs by L2 — they will now disagree.",
      miniTask: {
        title: "Benchmark exact top-k three ways",
        kind: "code",
        minutes: 35,
        steps: [
          "Run the l3 snippet and confirm item 123 is first in all three rankings.",
          "Time `np.argsort(-dot)[:k]` vs `np.argpartition` vs `heapq.nlargest(k, range(N), key=dot.__getitem__)` with `time.perf_counter`.",
          "Increase N to 1,000,000 and repeat; note memory use of E (`E.nbytes / 1e9` GB).",
          "Remove normalisation and show that dot-product and L2 rankings diverge.",
        ],
        checklist: [
          "I have timings for three top-k methods at two corpus sizes",
          "I know the memory footprint of 1M × 384 float32 vectors",
          "I demonstrated that rankings only agree when vectors are normalised",
        ],
        deliverable: "A small benchmark table (method × N → ms) plus one sentence on which you would use in Cortex and why.",
      },
      quiz: [
        {
          q: "For unit-length vectors a and b, ‖a − b‖² equals:",
          options: ["a·b", "1 − a·b", "2 − 2(a·b)", "2(a·b) − 1"],
          answer: 2,
          explain: "‖a − b‖² = ‖a‖² + ‖b‖² − 2a·b = 1 + 1 − 2a·b.",
        },
        {
          q: "What is the time complexity of keeping the top-k of N streamed scores with a size-k min-heap?",
          options: ["O(N)", "O(N log k)", "O(N log N)", "O(k log N)"],
          answer: 1,
          explain: "Each of N items does at most one push or replace on a heap of size k, costing O(log k).",
        },
        {
          q: "In pgvector, `ORDER BY embedding <=> $1 LIMIT 5` returns:",
          options: [
            "The 5 least similar rows",
            "The 5 rows with the smallest cosine distance, i.e. most similar",
            "The 5 rows with the largest inner product",
            "An error, because <=> is L2 distance",
          ],
          answer: 1,
          explain: "<=> is cosine distance (1 − cosine similarity); ascending order puts the most similar first.",
        },
      ],
      explainPrompt: "Explain to a junior engineer in 5 sentences the difference between cosine, dot product and Euclidean distance, and why normalising makes the choice mostly irrelevant.",
      implementPrompt: "From memory, write `top_k(E, q, k)` in NumPy using argpartition, plus a streaming heap version, and assert they return the same ids.",
      videos: [
        {
          title: "Vector databases and HNSW explained",
          channel: "ByteByteGo",
          url: "https://www.youtube.com/results?search_query=bytebytego+vector+database+hnsw+explained",
          kind: "search",
          reason: "Watch this before month 4's RAG work if the HNSW layered-graph idea needs a picture.",
        },
      ],
    },
  },
];

export const labs: LabSeed[] = [
  {
    slug: "sentence-similarity-explorer",
    title: "Sentence similarity explorer",
    week: 9,
    duration: "45m",
    minutes: 45,
    difficulty: "easy",
    domain: "ai",
    skills: ["embeddings", "vector-search", "python"],
    prerequisites: ["Embeddings: meaning as numbers", "Vector similarity: cosine, dot product & distance"],
    topicSlugs: ["embeddings", "vector-similarity"],
    objective: "Embed a set of real sentences, build a similarity matrix and surface the nearest pairs — the retrieval core of Cortex in miniature.",
    expectedOutput: "A script that prints a similarity heatmap (or table) for ~20 sentences, the top 5 most similar pairs with scores, and a nearest-neighbour lookup for any query you type.",
    steps: [
      {
        title: "Collect 20 sentences",
        detail: "Take them from your own world: IdeaGuard feature descriptions, ZtudyLock notes, FabricNest product blurbs. Include at least three deliberate paraphrase pairs and two sentences that share keywords but differ in meaning (\"Python the language\" vs \"python the snake\").",
      },
      {
        title: "Embed and normalise",
        detail: "Use `SentenceTransformer(\"all-MiniLM-L6-v2\")` with `normalize_embeddings=True`. Assert the shape is (20, 384) and all row norms are 1. Optionally, repeat with an embeddings API (e.g. `text-embedding-3-small`) for comparison.",
      },
      {
        title: "Build the similarity matrix",
        detail: "`S = E @ E.T`. Plot it with `matplotlib.pyplot.imshow` and label both axes with shortened sentences, or print a rounded table.",
      },
      {
        title: "Find the top pairs with a heap",
        detail: "Iterate the upper triangle (i < j) and keep the 5 highest pairs with `heapq.nlargest`. Print them with scores and check your paraphrase pairs appear.",
      },
      {
        title: "Interactive query",
        detail: "Loop on `input()`, embed the query, print its 3 nearest sentences with scores. Try queries with zero word overlap with the target.",
      },
      {
        title: "Write down three observations",
        detail: "Where did the model succeed without shared words? Where did it get fooled by shared words? What threshold would you use to say \"not relevant\"?",
      },
    ],
    hints: [
      "The first `SentenceTransformer(...)` call downloads the model; later runs are offline and fast.",
      "Negation is a known weakness: \"supports dark mode\" and \"does not support dark mode\" score high. Note it, it matters for RAG.",
      "`heapq.nlargest(5, ((S[i, j], i, j) for i in range(n) for j in range(i + 1, n)))` is all you need for the pair search.",
    ],
    stretch: "Embed 500 sentences from a real document, reduce to 2D with PCA or UMAP, and scatter-plot them coloured by section to see the \"map\" from Level 2.",
    learned: [
      "How to embed text and verify normalisation",
      "Building a similarity matrix with one matmul",
      "Top-k with a heap over pairwise scores",
      "Where embedding similarity succeeds and where it fails (negation, keyword traps)",
    ],
    starter: {
      title: "similarity_explorer.py",
      lang: "python",
      code: `import heapq
import numpy as np
from sentence_transformers import SentenceTransformer

SENTENCES = [
    "How do I reset my password?",
    "I forgot my login credentials.",
    "Cache LLM responses in Redis to save money.",
    "Store model outputs so repeated prompts are cheap.",
    "Python is great for data pipelines.",
    "The python slid silently through the grass.",
]

model = SentenceTransformer("all-MiniLM-L6-v2")
E = model.encode(SENTENCES, normalize_embeddings=True)
S = E @ E.T
n = len(SENTENCES)

pairs = heapq.nlargest(5, ((float(S[i, j]), i, j) for i in range(n) for j in range(i + 1, n)))
for score, i, j in pairs:
    print(f"{score:.3f}  {SENTENCES[i]}  <->  {SENTENCES[j]}")

while True:
    q = input("query> ").strip()
    if not q:
        break
    qv = model.encode([q], normalize_embeddings=True)[0]
    scores = E @ qv
    for idx in np.argsort(-scores)[:3]:
        print(f"  {scores[idx]:.3f}  {SENTENCES[idx]}")`,
    },
  },
  {
    slug: "bpe-tokenizer-from-scratch",
    title: "BPE tokenizer from scratch",
    week: 9,
    duration: "3h",
    minutes: 180,
    difficulty: "medium",
    domain: "ai",
    skills: ["tokenisation", "python", "hashing"],
    prerequisites: ["Tokenisation & BPE"],
    topicSlugs: ["tokenisation-bpe"],
    objective: "Train a byte-level BPE tokenizer on a text file, then encode and decode with a perfect round-trip — the same algorithm behind GPT tokenizers.",
    expectedOutput: "A `bpe.py` module with `train`, `encode` and `decode`; a vocab of 512–1,000 tokens trained on your text; a test proving `decode(encode(s)) == s` for tricky strings; and a compression ratio compared with tiktoken.",
    steps: [
      {
        title: "Get a corpus",
        detail: "Use Tiny Shakespeare (~1 MB) or concatenate your own markdown notes/READMEs. Load it as one string and print its length in characters and UTF-8 bytes.",
      },
      {
        title: "Implement pair counting and merging",
        detail: "Convert text to `list(text.encode(\"utf-8\"))`. Write `pair_counts(ids)` with `collections.Counter(zip(ids, ids[1:]))` and `merge(ids, pair, new_id)` as a single left-to-right pass.",
      },
      {
        title: "Train",
        detail: "Loop `vocab_size - 256` times: find the most frequent pair, assign ID `256 + i`, merge, and store `merges[pair] = new_id`. Also build `vocab[new_id] = vocab[a] + vocab[b]` (bytes), starting from `vocab = {i: bytes([i]) for i in range(256)}`. Print the first 20 merges decoded as text — you should see \" t\", \"he\", \" the\" early.",
      },
      {
        title: "Decode and encode",
        detail: "`decode(ids)` joins `vocab[i]` bytes and calls `.decode(\"utf-8\", errors=\"replace\")`. `encode(text)` repeatedly applies the lowest-rank merge present (`min` over pairs by `merges.get(p, inf)`) until none applies.",
      },
      {
        title: "Round-trip tests",
        detail: "Assert `decode(encode(s)) == s` for English, Tamil or Hindi text, emoji (\"ship it 🚀\"), code and an empty string. Tokens can split a multi-byte character — explain why round-trip still works.",
      },
      {
        title: "Measure compression",
        detail: "Compute bytes-per-token on a held-out paragraph for your tokenizer and for `tiktoken` `cl100k_base`. Write one paragraph on why a 100k vocab compresses better than your 512.",
      },
      {
        title: "Add pre-tokenisation",
        detail: "Split text into chunks first with a regex (for example `re.findall(r\"\\s?\\w+|\\s?[^\\w\\s]+|\\s+\", text)`), count pairs within chunks only, and compare which merges appear. This is what GPT-2 does with its regex pattern.",
      },
    ],
    hints: [
      "Training is O(merges × corpus length). For speed, train on the first 200 KB, or count pairs over unique chunks weighted by frequency (a `Counter` of chunks).",
      "`vocab[new_id] = vocab[a] + vocab[b]` must be filled in merge order, since later merges reference earlier IDs.",
      "If decode raises on invalid UTF-8, you forgot `errors=\"replace\"` — individual tokens are not guaranteed to be valid UTF-8 on their own.",
    ],
    stretch: "Save and load the tokenizer as JSON (merges as a list of [a, b] pairs in rank order), then add a special token `<|endoftext|>` that is never split and is handled before BPE.",
    learned: [
      "The BPE training and encoding algorithms exactly",
      "Why byte-level tokenizers never have unknown tokens",
      "How vocabulary size maps to compression and sequence length",
      "Why pre-tokenisation regexes exist",
    ],
    starter: {
      title: "bpe.py (skeleton)",
      lang: "python",
      code: `from collections import Counter

def pair_counts(ids: list[int]) -> Counter:
    return Counter(zip(ids, ids[1:]))

def merge(ids: list[int], pair: tuple[int, int], new_id: int) -> list[int]:
    raise NotImplementedError  # single left-to-right pass

class BPE:
    def __init__(self) -> None:
        self.merges: dict[tuple[int, int], int] = {}
        self.vocab: dict[int, bytes] = {i: bytes([i]) for i in range(256)}

    def train(self, text: str, vocab_size: int) -> None:
        raise NotImplementedError

    def encode(self, text: str) -> list[int]:
        raise NotImplementedError

    def decode(self, ids: list[int]) -> str:
        return b"".join(self.vocab[i] for i in ids).decode("utf-8", errors="replace")

if __name__ == "__main__":
    text = open("input.txt", encoding="utf-8").read()
    bpe = BPE()
    bpe.train(text[:200_000], vocab_size=512)
    for s in ["hello world", "வணக்கம்", "ship it 🚀", ""]:
        assert bpe.decode(bpe.encode(s)) == s, s
    held_out = text[200_000:210_000]
    ratio = len(held_out.encode("utf-8")) / len(bpe.encode(held_out))
    print(f"round-trip ok; {ratio:.2f} bytes/token on held-out text")`,
    },
  },
];
