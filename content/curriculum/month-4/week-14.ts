import type { LabSeed, TopicSeed } from "../../types";

export const topics: TopicSeed[] = [
  // ───────────────────────────────────────────────────────────────────────
  {
    slug: "rag-pipeline",
    title: "The RAG pipeline",
    week: 14,
    domain: "ai",
    skills: ["rag"],
    difficulty: "medium",
    minutes: 90,
    summary: "Upload, chunk, embed, store; then embed the question, retrieve, augment the prompt and generate an answer that cites its sources.",
    prerequisites: ["semantic-search", "chunking-strategies", "vector-databases-pgvector"],
    tags: ["rag", "citations", "pgvector", "pdf", "grounding", "cortex"],
    lesson: {
      hook: `Ask a model "what did I decide about auth in the ZtudyLock design doc?" and it will answer confidently. It has never seen your design doc. It is guessing, fluently.

Fine-tuning will not fix this: it is slow, expensive, and bad at memorising facts that change every week. What you actually want is the behaviour of a good engineer in a meeting: "let me pull up the doc", read the relevant section, then answer and point at the page.

That is **Retrieval-Augmented Generation**. It is the core of Cortex, and most of the "AI features" shipped at companies in the last two years are some version of it.`,
      whyItMatters: `RAG is the default way to make an LLM answer from private, fresh or large knowledge with citations you can check. Every AI engineering interview will ask you to design one.`,
      levels: {
        l1: `Before the model answers, your code searches your documents for the few passages most related to the question. It pastes those passages into the prompt and tells the model: answer only from these, and say which one you used. The model does the reading and writing; your search decides what it gets to read.`,
        l2: {
          analogy: `An open-book exam. The model is a clever student who has not read your course notes. Retrieval is the librarian who hands over the 5 most relevant pages. The prompt is the exam rule: "answer only from these pages and cite the page number". A great student with the wrong pages still fails, which is why most RAG work is retrieval work.`,
          text: `RAG is two pipelines sharing one store. **Ingestion** runs when a document arrives: extract text, chunk, embed, store with metadata (source, page). **Query** runs on every question: embed the question with the same model, retrieve the top k chunks, build a prompt with numbered sources, generate an answer that cites them.

Each box is a place where quality leaks. Bad extraction, bad chunks, wrong k, a prompt that allows outside knowledge: all produce the same symptom, a wrong answer.`,
          diagram: {
            type: "flow",
            title: "The RAG pipeline",
            lanes: [
              {
                label: "Ingest (once per document)",
                tone: "neutral",
                steps: [
                  { label: "Upload", note: "PDF, markdown, URL" },
                  { label: "Chunk", note: "~400 tokens + page no." },
                  { label: "Embed", note: "batched" },
                  { label: "Store", note: "pgvector + metadata" },
                ],
              },
              {
                label: "Query (every question)",
                tone: "good",
                steps: [
                  { label: "Embed question", note: "same model" },
                  { label: "Retrieve", note: "top k chunks" },
                  { label: "Augment prompt", note: "numbered sources" },
                  { label: "Generate with citations", note: "[1] [3]", accent: true },
                ],
              },
            ],
          },
        },
        l3: {
          text: `Two scripts. **ingest.py** reads a PDF page by page (keeping page numbers for citations), chunks each page, embeds all chunks in one batched call and inserts them into pgvector. **ask.py** embeds the question, retrieves the top 5 chunks, numbers them as sources, and asks the model to answer only from them with \`[n]\` citations, or say it does not know.

Both import \`embed\` and \`to_pgvector\` from \`embed_utils.py\`, the two helpers you wrote in Week 13 (vector-databases-pgvector, Level 3). Put them in that file once and reuse them everywhere.

The system prompt matters more than it looks. "Use only the sources", "cite every claim", and "say you do not know" are three separate instructions; drop any one and you will see the corresponding failure.`,
          code: [
            {
              title: "ingest.py: PDF to pgvector",
              lang: "python",
              note: "pip install pypdf psycopg[binary] requests. Usage: python ingest.py paper.pdf",
              code: `import os
import sys
import psycopg
from pypdf import PdfReader
from embed_utils import embed, to_pgvector  # Week 13 helpers

SCHEMA = """
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS rag_chunks (
  id bigserial PRIMARY KEY, source text NOT NULL, page int NOT NULL,
  content text NOT NULL, embedding vector(1536) NOT NULL);
"""

def page_chunks(path: str, size: int = 1500, overlap: int = 200):
    for page_no, page in enumerate(PdfReader(path).pages, start=1):
        text = " ".join((page.extract_text() or "").split())  # collapse whitespace
        for start in range(0, len(text), size - overlap):
            piece = text[start:start + size]
            if len(piece) > 50:
                yield page_no, piece

path = sys.argv[1]
chunks = list(page_chunks(path))
vectors = []
for i in range(0, len(chunks), 100):  # embed in batches of 100
    vectors += embed([c for _, c in chunks[i:i + 100]])

with psycopg.connect(os.environ["DATABASE_URL"]) as conn:
    conn.execute(SCHEMA)
    conn.execute("DELETE FROM rag_chunks WHERE source = %s", (path,))  # re-ingest safely
    for (page_no, text), vec in zip(chunks, vectors):
        conn.execute(
            "INSERT INTO rag_chunks (source, page, content, embedding) VALUES (%s, %s, %s, %s::vector)",
            (path, page_no, text, to_pgvector(vec)),
        )
print("ingested", len(chunks), "chunks from", path)`,
            },
            {
              title: "ask.py: retrieve, augment, generate with citations",
              lang: "python",
              note: "pip install anthropic. Usage: python ask.py \"What optimiser did the authors use?\"",
              code: `import os
import sys
import anthropic
import psycopg
from embed_utils import embed, to_pgvector

SYSTEM = (
    "Answer using ONLY the numbered sources provided. "
    "Cite every claim with its source number like [2]. "
    "If the sources do not contain the answer, say you don't know."
)

question = " ".join(sys.argv[1:])
q = to_pgvector(embed([question])[0])
with psycopg.connect(os.environ["DATABASE_URL"]) as conn:
    rows = conn.execute(
        "SELECT source, page, content FROM rag_chunks "
        "ORDER BY embedding <=> %s::vector LIMIT 5",
        (q,),
    ).fetchall()

sources = "\\n\\n".join(
    f"[{i}] ({src}, p.{page})\\n{text}" for i, (src, page, text) in enumerate(rows, start=1)
)
client = anthropic.Anthropic()
resp = client.messages.create(
    model=os.environ.get("MODEL", "claude-opus-5"),
    max_tokens=4000,
    system=SYSTEM,
    messages=[{"role": "user", "content": "Sources:\\n" + sources + "\\n\\nQuestion: " + question}],
)
print("".join(b.text for b in resp.content if b.type == "text"))
for i, (src, page, _) in enumerate(rows, start=1):
    print(f"[{i}] {src} p.{page}")`,
            },
          ],
        },
        l4: {
          text: `**Retrieval quality dominates.** If the right chunk is not in the top k, no prompt can save the answer. Measure retrieval separately from generation (see retrieval-evaluation).

**Choosing k.** Too small and you miss the answer; too large and you pay for tokens and dilute attention. Long-context models still show "lost in the middle" effects (Liu et al., 2023): facts buried in the middle of a long prompt are used less reliably than facts at the start or end. A common pattern is retrieve 20 to 50 cheaply, rerank, then send the best 5 to 8.

**Context assembly** is real engineering: deduplicate overlapping chunks, merge adjacent chunks from the same page, order by relevance or by document position, and enforce a token budget.

**Citations are a claim, not a guarantee.** The model can cite [2] for a sentence that [2] does not support. Cheap checks: every cited number exists; every sentence has a citation; optionally ask a second, small model "does source [2] support this sentence?" and flag failures in the UI. Anthropic's API also has a native citations feature for documents passed as content blocks, which returns exact cited spans.

**Documents are untrusted input.** A PDF can contain "ignore previous instructions and ...". Put sources in a clearly delimited block, tell the model they are data, and never give a RAG answerer tools with side effects without guardrails (Week 16).

**Refusal is a feature.** "I don't know" when retrieval is weak beats a confident hallucination. You can also short-circuit before calling the LLM when the best similarity is below a threshold you have calibrated on your own data.`,
          code: [
            {
              title: "Cheap citation checks before showing an answer",
              lang: "python",
              code: `import re

CITE = re.compile(r"\\[(\\d+)\\]")

def check_citations(answer: str, n_sources: int) -> list[str]:
    problems = []
    cited = {int(n) for n in CITE.findall(answer)}
    if not cited and "don't know" not in answer.lower():
        problems.append("answer has no citations")
    for n in sorted(cited):
        if not 1 <= n <= n_sources:
            problems.append(f"cites [{n}] but only {n_sources} sources were given")
    for sentence in re.split(r"(?<=[.!?])\\s+", answer.strip()):
        if len(sentence) > 40 and not CITE.search(sentence):
            problems.append("uncited claim: " + sentence[:60])
    return problems

print(check_citations("Adam was used [1]. The learning rate was 3e-4 [7].", 5))`,
            },
          ],
        },
        l5: {
          question: `Design the RAG system behind "ask questions about your company's 200,000 internal documents" for 5,000 employees. Documents have per-team permissions and change daily. Walk me through ingestion, retrieval, generation and how you would evaluate it.`,
          hint: "Permissions and freshness are the hard parts, not the LLM call.",
          answer: `Ingestion is an event-driven pipeline: document create/update/delete events go onto a queue; workers extract text (with page and heading structure), chunk structure-aware at ~400 tokens with title and section headers, embed in batches, and upsert into Postgres with pgvector keyed by document id and version, deleting old chunks in the same transaction. Every chunk carries the document's ACL (team ids) so permission filtering happens in the database query, never in the prompt.

Retrieval is hybrid: vector search plus BM25 over the same chunks, fused with reciprocal rank fusion, filtered by the caller's team ids, then a cross-encoder reranks the top 50 down to 6 to 8. Generation gets numbered sources in a delimited block with instructions to answer only from them, cite every claim and admit when it does not know; the UI shows clickable citations and I run a lightweight citation check before display.

I would evaluate the two halves separately: a golden set of a few hundred real questions with labelled source documents to track recall@k and MRR for retrieval, and an LLM-judge plus human spot checks for faithfulness and answer quality, run in CI on every change to chunking, embedding model or prompt. In production I would log queries, retrieved ids and thumbs up/down to grow the golden set from real failures.`,
        },
      },
      commonMistakes: [
        "Debugging the prompt when the real problem is that the right chunk was never retrieved. Log retrieved chunks for every query.",
        "Losing page numbers and titles at ingestion, which makes real citations impossible later.",
        "Letting the model use its own knowledge (no 'only from sources' rule), so answers mix your docs with plausible fiction.",
        "Enforcing document permissions by telling the LLM who may see what. Filter in the retrieval query instead.",
      ],
      tryThis: `Ask ask.py a question your PDF definitely does not answer (e.g. "What is the capital of Peru?"). If it answers anyway, your prompt is leaking outside knowledge; tighten it until it says it doesn't know.`,
      miniTask: {
        title: "Chat with one PDF",
        kind: "build",
        minutes: 60,
        steps: [
          "Upload a PDF: pick a paper or spec you actually care about (e.g. the 'Attention Is All You Need' PDF).",
          "Chunk it: run ingest.py and confirm the chunk count and that page numbers are stored (SELECT page, count(*) FROM rag_chunks GROUP BY page).",
          "Embed: check that embeddings were requested in batches, not one call per chunk.",
          "Retrieve relevant chunks: for 3 questions, print the retrieved chunks and pages before generation, and judge whether the answer is in them.",
          "Generate the answer: run ask.py and verify each [n] citation against the printed source list.",
        ],
        checklist: [
          "Chunks are stored with source and page number",
          "At least 2 of 3 questions retrieve a chunk that contains the answer",
          "Answers carry [n] citations that point to real pages",
          "An unanswerable question gets \"I don't know\" instead of a guess",
        ],
        deliverable: "ingest.py and ask.py working against your PDF, plus a screenshot or paste of one cited answer.",
      },
      quiz: [
        {
          q: "A RAG answer is wrong. What should you check first?",
          options: [
            "Switch to a bigger model",
            "Whether the chunk containing the answer was in the retrieved top k",
            "Increase temperature",
            "Rewrite the system prompt",
          ],
          answer: 1,
          explain: "If retrieval missed the evidence, generation cannot recover. Separate retrieval failures from generation failures before changing anything.",
        },
        {
          q: "Why is it risky to enforce document permissions via the prompt (\"do not reveal HR docs to non-HR users\")?",
          options: [
            "LLMs cannot read permission rules",
            "Restricted text is already in the context; a model can be tricked or simply err into revealing it",
            "It uses too many tokens",
            "Permissions change too often",
          ],
          answer: 1,
          explain: "Anything in the context window can leak. Filter chunks by the user's ACL in the retrieval query so restricted text never reaches the model.",
        },
        {
          q: "What does the \"lost in the middle\" finding suggest for RAG prompts?",
          options: [
            "Always send 50+ chunks",
            "Put the most relevant sources at the start or end and keep the context focused",
            "Put the question in the middle",
            "Use shorter embeddings",
          ],
          answer: 1,
          explain: "Models use information at the beginning and end of long contexts more reliably. Fewer, better-ranked chunks usually beat many.",
        },
      ],
      explainPrompt: "Explain the RAG pipeline to a junior engineer in 5 sentences, naming both the ingestion and query halves and where citations come from.",
      implementPrompt: "From memory: write the query half of RAG in Python: embed a question, fetch the top 5 chunks from pgvector, build a numbered-sources prompt and call an LLM with a 'cite or say you don't know' instruction.",
      videos: [
        {
          title: "RAG from scratch",
          channel: "freeCodeCamp (Lance Martin, LangChain)",
          url: "https://www.youtube.com/results?search_query=freecodecamp+rag+from+scratch+lance+martin",
          kind: "search",
          reason: "Watch the first few parts after building ask.py to see indexing, retrieval and generation variants you can add to Cortex.",
        },
      ],
    },
  },

  // ───────────────────────────────────────────────────────────────────────
  {
    slug: "hybrid-search-reranking",
    title: "Hybrid search & reranking",
    week: 14,
    domain: "ai",
    skills: ["reranking", "vector-search"],
    difficulty: "hard",
    minutes: 80,
    summary: "Combine BM25 keyword search with vectors using reciprocal rank fusion, then let a cross-encoder reorder the shortlist.",
    prerequisites: ["semantic-search", "rag-pipeline"],
    tags: ["bm25", "hybrid-search", "rrf", "cross-encoder", "reranking", "postgres-fts"],
    lesson: {
      hook: `A FabricNest customer searches "SKU FN-2291 return". Your semantic search returns three lovely paragraphs about return policies. None of them mention FN-2291, the one product the customer actually asked about.

Embeddings are great at meaning and bad at exact strings: product codes, error IDs, people's names, acronyms your model never saw. Keyword search is the opposite: perfect at "FN-2291", useless at "something breathable for a wedding".

Production search uses **both**, fuses the lists, then asks a slower, smarter model to put the best few on top. This is the single biggest quality upgrade you will make to Cortex after basic RAG.`,
      whyItMatters: `Hybrid retrieval plus reranking is the standard production recipe for RAG. It fixes the exact-match blind spot of embeddings and usually lifts recall and answer quality more than changing the LLM.`,
      levels: {
        l1: `Run two searches for the same question: one that matches exact words and one that matches meaning. Merge the two ranked lists so documents that do well in either (or both) rise to the top. Then have a more careful model reread the top few dozen against the question and reorder them.`,
        l2: {
          analogy: `Hiring with two recruiters. One scans CVs for exact keywords ("Postgres", "FastAPI"); the other reads for overall fit. You shortlist anyone either of them ranks highly, favouring people both liked. Then a senior engineer interviews only the shortlist, one by one, and makes the final order. Recruiters are fast and rough; the interview is slow and accurate.`,
          text: `**Retrieval** has to be fast over millions of chunks, so it uses cheap scores: BM25 over an inverted index and vector distance over an ANN index. Each produces a ranked list.

**Fusion** merges lists whose scores are not comparable (a BM25 score of 12.4 means nothing next to a cosine of 0.61), so it uses **ranks** instead of scores: reciprocal rank fusion.

**Reranking** runs a cross-encoder over only the top 30 to 100 candidates, reading query and chunk together. It is far more accurate and far too slow to run over the whole corpus.`,
          diagram: {
            type: "flow",
            title: "Hybrid retrieval with reranking",
            lanes: [
              {
                label: "Keyword",
                tone: "neutral",
                steps: [
                  { label: "Query" },
                  { label: "BM25 / Postgres FTS", note: "exact terms, codes" },
                  { label: "Top 50 by rank" },
                ],
              },
              {
                label: "Semantic",
                tone: "neutral",
                steps: [
                  { label: "Query embedding" },
                  { label: "pgvector HNSW", note: "meaning" },
                  { label: "Top 50 by rank" },
                ],
              },
              {
                label: "Merge",
                tone: "good",
                steps: [
                  { label: "Reciprocal rank fusion", note: "sum 1/(60+rank)" },
                  { label: "Cross-encoder rerank", note: "top 50 → 8", accent: true },
                  { label: "LLM context" },
                ],
              },
            ],
          },
        },
        l3: {
          text: `**Reciprocal Rank Fusion (RRF)**: for each document, sum \`1 / (k + rank)\` over every list it appears in, with \`k = 60\` (the constant from the original paper by Cormack et al.). A doc ranked 1st in one list scores 1/61; ranked 3rd in both scores 2/63, which beats it. RRF needs no score normalisation and no tuning, which is why it is the default.

In Postgres you get keyword search for free with full-text search: a generated \`tsvector\` column, a GIN index, and \`websearch_to_tsquery\` for Google-style queries. Note that \`ts_rank_cd\` is **not** BM25 (no document-length normalisation by default), but inside RRF only the rank order matters, so it works well in practice. If you want true BM25 in Python, \`rank_bm25\` is a small, well-known package.

The SQL below does hybrid search plus RRF in a single query.`,
          code: [
            {
              title: "Hybrid search with RRF in one Postgres query",
              lang: "sql",
              note: "$1 = query embedding as '[...]' text, $2 = raw query string. Run the ALTER/INDEX once.",
              code: `ALTER TABLE chunks ADD COLUMN IF NOT EXISTS tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;
CREATE INDEX IF NOT EXISTS chunks_tsv_gin ON chunks USING gin (tsv);

WITH semantic AS (
  SELECT id, row_number() OVER (ORDER BY embedding <=> $1::vector) AS rnk
  FROM chunks
  ORDER BY embedding <=> $1::vector
  LIMIT 50
), keyword AS (
  SELECT id, row_number() OVER (ORDER BY ts_rank_cd(tsv, q) DESC) AS rnk
  FROM chunks, websearch_to_tsquery('english', $2) AS q
  WHERE tsv @@ q
  ORDER BY ts_rank_cd(tsv, q) DESC
  LIMIT 50
)
SELECT c.id, c.content,
       coalesce(1.0 / (60 + s.rnk), 0) + coalesce(1.0 / (60 + k.rnk), 0) AS rrf
FROM semantic s
FULL OUTER JOIN keyword k ON s.id = k.id
JOIN chunks c ON c.id = coalesce(s.id, k.id)
ORDER BY rrf DESC
LIMIT 20;`,
            },
            {
              title: "RRF and a cross-encoder reranker in Python",
              lang: "python",
              note: "pip install sentence-transformers. The MiniLM cross-encoder runs on CPU; ~50 pairs take well under a second.",
              code: `from collections import defaultdict
from sentence_transformers import CrossEncoder

def rrf(ranked_lists: list[list[str]], k: int = 60) -> list[str]:
    scores: dict[str, float] = defaultdict(float)
    for ranking in ranked_lists:
        for rank, doc_id in enumerate(ranking, start=1):
            scores[doc_id] += 1.0 / (k + rank)
    return sorted(scores, key=scores.get, reverse=True)

reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")

def rerank(query: str, candidates: dict[str, str], top_n: int = 5) -> list[tuple[str, float]]:
    ids = list(candidates)
    scores = reranker.predict([(query, candidates[i]) for i in ids])
    return sorted(zip(ids, map(float, scores)), key=lambda p: p[1], reverse=True)[:top_n]

keyword_ids = ["c7", "c2", "c9"]         # from BM25 / FTS
vector_ids = ["c2", "c4", "c7", "c1"]    # from pgvector
fused = rrf([keyword_ids, vector_ids])
print(fused)  # c2 and c7 appear in both lists, so they lead

texts = {"c2": "Returns for FN-2291 are accepted within 30 days.",
         "c7": "SKU FN-2291 is a handloom cotton kurta.",
         "c4": "Our general return policy covers most items."}
print(rerank("SKU FN-2291 return window", texts))`,
            },
          ],
        },
        l4: {
          text: `**BM25** scores a document D for query terms q:

\`score = Σ IDF(q) · f(q,D)·(k1+1) / (f(q,D) + k1·(1 − b + b·|D|/avgdl))\`

- \`f(q,D)\` is term frequency in the document, **saturated** by \`k1\` (≈1.2 to 2.0) so the 10th mention adds little over the 3rd.
- \`b\` (≈0.75) normalises by document length so long documents do not win by being long.
- \`IDF\` rewards rare terms: "FN-2291" appears in 2 chunks and gets a huge weight; "the" gets almost none. That is exactly why keyword search nails identifiers.

It is served from an **inverted index**: term → list of (doc id, frequency). Postgres GIN over \`tsvector\` is the same structure.

**Bi-encoder vs cross-encoder.** Your embedding model is a bi-encoder: query and document are encoded **separately**, so document vectors can be precomputed and indexed. A cross-encoder feeds \`[query] [SEP] [document]\` through one transformer, so every query token can attend to every document token. It captures "FN-2291 **return window**" vs "FN-2291 **fabric**" precisely, but nothing can be precomputed: cost is one forward pass per (query, candidate) pair. Hence: retrieve wide and cheap, rerank narrow and expensive.

Hosted rerankers (Cohere Rerank, Voyage rerank, Jina) and LLM-as-reranker (ask a model to score 0 to 10) are alternatives; they trade latency and cost for quality and are easy to A/B against your golden set.`,
          code: [
            {
              title: "BM25 from scratch (to understand, not to ship)",
              lang: "python",
              code: `import math
from collections import Counter

def bm25_scores(query: str, docs: list[str], k1: float = 1.5, b: float = 0.75) -> list[float]:
    tokenized = [d.lower().split() for d in docs]
    n = len(docs)
    avgdl = sum(len(t) for t in tokenized) / n
    df = Counter(term for t in tokenized for term in set(t))  # document frequency
    scores = []
    for tokens in tokenized:
        tf = Counter(tokens)
        s = 0.0
        for term in query.lower().split():
            if term not in tf:
                continue
            idf = math.log(1 + (n - df[term] + 0.5) / (df[term] + 0.5))
            f = tf[term]
            s += idf * f * (k1 + 1) / (f + k1 * (1 - b + b * len(tokens) / avgdl))
        scores.append(s)
    return scores

docs = ["return window for fn-2291 is 30 days", "general return policy for all items", "fn-2291 cotton kurta"]
print([round(s, 3) for s in bm25_scores("fn-2291 return", docs)])  # doc 0 matches both terms
print([round(s, 3) for s in bm25_scores("returns", docs)])  # all zero: no stemming here, Postgres FTS stems`,
            },
          ],
        },
        l5: {
          question: `Your RAG system uses pure vector search. Support tickets show it fails on product codes and error IDs, and sometimes returns the right document at rank 12 when you only send 5 to the LLM. What would you change, and how would you prove it helped?`,
          hint: "Two different problems: candidate generation and ordering.",
          answer: `These are two separate failures. Missing codes and IDs is a candidate-generation problem: embeddings do not preserve rare exact tokens, so I would add a keyword retriever (Postgres full-text or BM25) over the same chunks and fuse both lists with reciprocal rank fusion, which needs no score normalisation. Right document at rank 12 is an ordering problem: I would retrieve 50 candidates from the fused list and rerank them with a cross-encoder, sending the top 5 to 8 to the LLM.

To prove it, I would build a golden set that includes the failing ticket queries plus normal ones, and measure recall@5 and MRR for three configs: vector only, hybrid with RRF, and hybrid plus rerank. I would also measure p95 latency, since the reranker adds a model call; if it is too slow I would shrink the candidate pool or use a smaller reranker. I would ship only if recall@5 improves on the whole set, not just on the code queries, so we do not regress natural-language questions.`,
        },
      },
      commonMistakes: [
        "Adding raw BM25 scores to cosine similarities. They are on different scales; fuse by rank (RRF) or normalise carefully.",
        "Running a cross-encoder over the whole corpus. It is O(candidates) model calls per query; only rerank a shortlist.",
        "Reranking the top 5 when the right answer sits at rank 20. Retrieve wide (30 to 100), then rerank down.",
        "Forgetting the language config in to_tsvector/websearch_to_tsquery, so stemming differs between indexing and querying.",
      ],
      tryThis: `Run bm25_scores with query "return" against the three docs, then with "fn-2291". Watch how IDF makes the rare code dominate the score.`,
      miniTask: {
        title: "Add hybrid search to your semantic search",
        kind: "code",
        minutes: 50,
        steps: [
          "Reuse the documents from your Week 13 semantic search lab and add 5 documents that contain codes or names (e.g. 'Error E1043: payment gateway timeout').",
          "Implement BM25 ranking with rank_bm25 (BM25Okapi) or the from-scratch function in Level 4.",
          "Implement rrf() and fuse the BM25 and vector rankings for each query.",
          "Run 6 queries (3 paraphrase, 3 exact-code) and print the top 3 from vector-only, BM25-only and fused.",
          "Rerank the fused top 10 with the MiniLM cross-encoder and print the final top 3.",
        ],
        checklist: [
          "Exact-code queries find the right doc in fused results even when vector-only misses",
          "Paraphrase queries still work after fusion",
          "RRF uses ranks, not raw scores",
          "Reranker runs only on a shortlist",
        ],
        deliverable: "hybrid.py printing a side-by-side table of vector, BM25, fused and reranked top 3 for each query.",
      },
      quiz: [
        {
          q: "Why does reciprocal rank fusion use ranks instead of scores?",
          options: [
            "Ranks are faster to compute",
            "Scores from BM25 and cosine similarity are on incomparable scales",
            "Scores are not available from pgvector",
            "Ranks make results deterministic",
          ],
          answer: 1,
          explain: "A BM25 score of 12 and a cosine of 0.6 cannot be added meaningfully. Ranks are comparable across any retrievers.",
        },
        {
          q: "What makes a cross-encoder more accurate but slower than a bi-encoder?",
          options: [
            "It uses a bigger vocabulary",
            "It reads query and document together in one forward pass, so nothing can be precomputed",
            "It stores more dimensions",
            "It uses BM25 internally",
          ],
          answer: 1,
          explain: "Joint attention over query and document captures fine relevance, but each (query, candidate) pair needs its own model call.",
        },
        {
          q: "In BM25, what is the IDF term for?",
          options: [
            "Penalising long queries",
            "Giving rare terms more weight than common ones",
            "Normalising by document length",
            "Capping term frequency",
          ],
          answer: 1,
          explain: "Inverse document frequency makes rare terms like product codes highly discriminative. Length normalisation is b; saturation is k1.",
        },
      ],
      explainPrompt: "Explain to a junior engineer in 5 sentences why production RAG uses BM25 + vectors + a reranker, and what RRF does.",
      implementPrompt: "From memory: implement reciprocal rank fusion in Python for any number of ranked id lists, with k = 60.",
      videos: [
        {
          title: "Hybrid search and rerankers for RAG",
          channel: "James Briggs",
          url: "https://www.youtube.com/results?search_query=james+briggs+rerankers+hybrid+search+rag",
          kind: "search",
          reason: "Watch this if the bi-encoder vs cross-encoder distinction is still fuzzy; it shows the two-stage pipeline with real numbers.",
        },
      ],
    },
  },

  // ───────────────────────────────────────────────────────────────────────
  {
    slug: "retrieval-evaluation",
    title: "Evaluating retrieval: recall@k & MRR",
    week: 14,
    domain: "ai",
    skills: ["ai-evaluation", "rag"],
    difficulty: "medium",
    minutes: 70,
    summary: "Build a golden set and measure retrieval with recall@k and MRR, so chunking and search changes are decisions, not vibes.",
    prerequisites: ["rag-pipeline", "hybrid-search-reranking"],
    tags: ["evals", "recall-at-k", "mrr", "golden-set", "rag"],
    lesson: {
      hook: `You changed chunk size from 800 to 400 tokens. You asked Cortex three questions and the answers "felt better". You ship it.

A week later a question that used to work breaks. Was it the chunk size? The new embedding model you tried on Tuesday? Nobody knows, because nothing was measured.

Retrieval is the part of RAG you can measure cheaply and objectively: for each question, did the right chunk come back, and how high? Thirty labelled questions and twenty lines of Python turn every future change into a number.`,
      whyItMatters: `Without a retrieval eval, every RAG change is a guess. With one, you can compare chunkers, embedding models, hybrid search and rerankers in minutes, and you have a regression test for the whole system.`,
      levels: {
        l1: `Write down questions where you already know which piece of text holds the answer. Run your search for each question and check whether that piece shows up in the top few results, and how close to the top. Average those checks and you have a score you can compare before and after every change.`,
        l2: {
          analogy: `An answer key for a library. You give the librarian 30 requests where you already know the correct book. Recall@5 is "how often was the right book among the first 5 handed over". MRR is "on average, how quickly did it appear": first place is perfect, third place earns a third.`,
          text: `A **golden set** is a list of (question, relevant chunk ids). Retrieval returns a ranked list per question. Two metrics cover most needs:

- **recall@k**: fraction of relevant chunks found in the top k (with one relevant chunk per question, it is simply the hit rate).
- **MRR** (mean reciprocal rank): average of 1/rank of the first relevant result, 0 if not found.

Recall@k tells you whether the answer is in the context the LLM sees. MRR tells you whether it is near the top, which matters for reranking and small k.`,
          diagram: {
            type: "grid",
            title: "Where the relevant chunk landed, by config (1 = found at that rank)",
            rowLabels: ["Q1", "Q2", "Q3", "Q4", "Q5"],
            colLabels: ["rank 1", "rank 2", "rank 3", "rank 4", "rank 5"],
            values: [
              [1, 0, 0, 0, 0],
              [0, 0, 1, 0, 0],
              [0, 1, 0, 0, 0],
              [0, 0, 0, 0, 0],
              [1, 0, 0, 0, 0],
            ],
            caption: "recall@5 = 4/5 = 0.8. MRR = (1 + 1/3 + 1/2 + 0 + 1) / 5 = 0.567.",
          },
        },
        l3: {
          text: `Golden set format: one JSON object per line with the question and the ids of chunks that contain the answer. Label by **content**, not by chunk id, when you plan to compare chunkers: chunk ids change when chunking changes. A robust trick is to store an \`answer_span\` (a short verbatim quote) and count a retrieved chunk as relevant if it contains that span.

The harness below runs any \`retrieve(question, k)\` function over the set and reports recall@k and MRR. Plug in vector-only, hybrid and hybrid+rerank and you get a comparison table.

Where do questions come from? Best: real user questions. Next best: write them yourself while reading the docs. Scalable: ask an LLM to generate a question from each sampled chunk, then **review them by hand**, because generated questions tend to copy the chunk's wording and flatter embedding search.`,
          code: [
            {
              title: "recall@k and MRR harness",
              lang: "python",
              code: `import json
from typing import Callable

def load_golden(path: str) -> list[dict]:
    # each line: {"question": "...", "answer_span": "30 days from delivery"}
    with open(path, encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]

def evaluate(retrieve: Callable[[str, int], list[str]], golden: list[dict], k: int = 5) -> dict:
    hits, rr, misses = 0, 0.0, []
    for item in golden:
        chunks = retrieve(item["question"], k)   # ranked chunk texts
        span = item["answer_span"].lower()
        rank = next((i for i, c in enumerate(chunks, start=1) if span in c.lower()), None)
        if rank is None:
            misses.append(item["question"])
        else:
            hits += 1
            rr += 1.0 / rank
    n = len(golden)
    return {"recall@k": round(hits / n, 3), "mrr": round(rr / n, 3), "misses": misses}

if __name__ == "__main__":
    golden = load_golden("golden.jsonl")
    corpus = ["Refunds are accepted 30 days from delivery.", "Shipping takes 3-5 days."]
    def naive_retrieve(q: str, k: int) -> list[str]:  # stand-in: swap in your real retriever
        words = set(q.lower().split())
        return sorted(corpus, key=lambda c: -len(words & set(c.lower().split())))[:k]
    print(evaluate(naive_retrieve, golden))`,
            },
          ],
        },
        l4: {
          text: `**Definitions precisely.** With a set R of relevant items and the top-k list T: \`recall@k = |R ∩ T| / |R|\`, \`precision@k = |R ∩ T| / k\`. Reciprocal rank = \`1 / rank of first relevant\`. **nDCG@k** handles graded relevance (highly relevant vs partially relevant) with a log discount: \`DCG = Σ rel_i / log2(i + 1)\`, normalised by the ideal ordering. For RAG with one or two relevant chunks per question, recall@k and MRR are usually enough.

**Small sets are noisy.** With 30 questions, one question flips recall by 3.3 points. A change from 0.70 to 0.73 is noise. Bootstrap a confidence interval (below), grow the set over time, and look at **which** questions changed, not just the average.

**Retrieval vs generation evals.** Retrieval metrics are deterministic and cheap: run them on every change. Generation quality (faithfulness, correctness, citation accuracy) needs an LLM judge or humans; run those less often. If recall@5 is 0.6, fix retrieval before tuning prompts: the ceiling on answer accuracy is roughly the retrieval hit rate.

**Evaluate at the k you actually use.** If you rerank 50 down to 6, report recall@50 for the candidate stage (did the reranker have a chance?) and recall@6 after reranking (did it pick well?).

**Keep a failure log.** Every miss is a labelled example of what your system cannot do: exact codes, multi-hop questions, tables. Group misses by type and you have your roadmap.`,
          code: [
            {
              title: "Bootstrap confidence interval for a small golden set",
              lang: "python",
              code: `import numpy as np

def bootstrap_ci(per_question: list[float], n_boot: int = 10_000, seed: int = 0) -> tuple[float, float]:
    rng = np.random.default_rng(seed)
    x = np.array(per_question)
    means = rng.choice(x, size=(n_boot, len(x)), replace=True).mean(axis=1)
    return float(np.percentile(means, 2.5)), float(np.percentile(means, 97.5))

# 1 = hit in top 5, 0 = miss, for 30 questions
config_a = [1] * 21 + [0] * 9   # recall@5 = 0.70
config_b = [1] * 23 + [0] * 7   # recall@5 = 0.77
print("A", np.mean(config_a), bootstrap_ci(config_a))
print("B", np.mean(config_b), bootstrap_ci(config_b))  # intervals overlap heavily`,
            },
          ],
        },
        l5: {
          question: `Your team wants to switch embedding models because a leaderboard says the new one is better. How do you decide?`,
          hint: "Public benchmarks are not your data.",
          answer: `Leaderboards like MTEB measure average performance across public datasets that may look nothing like our documents and queries, so I treat them as a shortlist, not a decision. I would run both models through our own retrieval eval: the same golden set of real questions with labelled answer spans, the same chunking, and report recall@k and MRR at the k we actually use, with bootstrap intervals because the set is small.

I would also look at per-question differences, since an average can hide the new model fixing easy questions while breaking our important ones, like product codes. Then I would weigh cost and operations: embedding dimension affects storage and index memory, price per token affects re-embedding the corpus, and switching means re-embedding everything and keeping the model name stored with each vector. If the gain is inside the noise band, I would not switch; if it is real, I would roll out behind a flag with a dual index until the migration is done.`,
        },
      },
      commonMistakes: [
        "Labelling relevance by chunk id and then changing the chunker, so every label silently becomes wrong. Label by answer span or document + span.",
        "Using only LLM-generated questions that reuse the chunk's exact wording; they overstate vector search quality.",
        "Declaring a winner on a 2-point difference over 30 questions. Check the confidence interval and the per-question diff.",
        "Evaluating only the final answer, so you cannot tell whether retrieval or generation failed.",
      ],
      tryThis: `Compute MRR by hand for ranks [1, 4, none, 2]: (1 + 0.25 + 0 + 0.5) / 4. Then check your harness gives 0.4375.`,
      miniTask: {
        title: "Your first 15-question golden set",
        kind: "build",
        minutes: 50,
        steps: [
          "Pick the PDF you ingested for the RAG pipeline topic.",
          "Write 15 questions by hand while skimming it; for each, copy a short verbatim answer_span (5 to 12 words) into golden.jsonl.",
          "Include at least 3 questions that use different words from the text, and 2 that mention a specific number or name.",
          "Wrap your pgvector retrieval from ask.py as retrieve(question, k) returning chunk texts, and run the Level 3 harness at k = 3 and k = 10.",
          "Read every miss and label its cause: chunk split, vocabulary mismatch, needs two chunks, or ranked just below k.",
        ],
        checklist: [
          "golden.jsonl has 15 lines with question and answer_span",
          "Harness prints recall@3, recall@10 and MRR",
          "Every miss has a written cause",
          "I can name the single change most likely to improve the score",
        ],
        deliverable: "golden.jsonl, eval.py and a 5-line note with scores and miss causes.",
      },
      quiz: [
        {
          q: "For ranks of the first relevant result [1, 2, not found, 4], what is MRR?",
          options: ["0.4375", "0.5", "0.583", "0.75"],
          answer: 0,
          explain: "(1 + 0.5 + 0 + 0.25) / 4 = 1.75 / 4 = 0.4375.",
        },
        {
          q: "Your pipeline retrieves 50 candidates then reranks to 6. Which pair of numbers best diagnoses it?",
          options: [
            "precision@50 and precision@6",
            "recall@50 before reranking and recall@6 after",
            "MRR of the LLM answer",
            "Average cosine similarity of the top 6",
          ],
          answer: 1,
          explain: "recall@50 shows whether the answer reached the reranker; recall@6 after reranking shows whether the reranker kept it.",
        },
        {
          q: "Why prefer an answer_span over chunk ids as relevance labels?",
          options: [
            "Spans are shorter",
            "Chunk ids change when chunking changes; spans stay valid across configs",
            "Spans are required by recall@k",
            "It makes MRR higher",
          ],
          answer: 1,
          explain: "You want to compare chunking configs with the same golden set, so labels must not depend on how the text was cut.",
        },
      ],
      explainPrompt: "Explain recall@k and MRR to a junior engineer in 5 sentences, and why a 30-question eval needs a confidence interval.",
      implementPrompt: "From memory: write evaluate(retrieve, golden, k) that returns recall@k and MRR, where relevance means the retrieved chunk contains the golden answer span.",
      videos: [
        {
          title: "Your AI product needs evals",
          channel: "Hamel Husain",
          url: "https://www.youtube.com/results?search_query=hamel+husain+evals+rag",
          kind: "search",
          reason: "Watch this for the mindset behind evals: looking at data, error analysis, and why generic metrics are not enough.",
        },
      ],
    },
  },
];

export const labs: LabSeed[] = [
  {
    slug: "pdf-rag-assistant",
    title: "PDF RAG Assistant with Citations",
    week: 14,
    duration: "1d",
    minutes: 420,
    difficulty: "medium",
    domain: "ai",
    skills: ["rag", "chunking", "vector-search", "sql-postgres", "python"],
    prerequisites: ["The RAG pipeline", "Vector databases & pgvector", "Chunking strategies", "Docker running locally"],
    topicSlugs: ["rag-pipeline", "chunking-strategies", "vector-databases-pgvector"],
    objective: "Build a working assistant that ingests any PDF into pgvector and answers questions with page-level citations, via a CLI or a minimal web UI.",
    expectedOutput: "Running `cortex ingest paper.pdf` then `cortex ask \"...\"` (or a small FastAPI/Next.js page) prints an answer with [n] citations and a source list with file name and page. Unanswerable questions return \"I don't know\". Re-ingesting the same file does not duplicate chunks.",
    steps: [
      {
        title: "Database and schema",
        detail: "Run pgvector in Docker (pgvector/pgvector:pg17). Create documents (id, owner_id, title, sha256, created_at) and chunks (id, document_id FK ON DELETE CASCADE, page, ord, content, embedding vector(1536)) with an HNSW cosine index. Store the file's sha256 so you can skip unchanged re-uploads.",
      },
      {
        title: "Extraction and chunking",
        detail: "Extract text per page with pypdf, collapse whitespace, and chunk each page with your recursive splitter (target ~400 tokens, 15% overlap). Prefix each chunk with the document title before embedding, but store the raw chunk text for display. Print a summary: pages, chunks, median chunk tokens.",
      },
      {
        title: "Embedding and storage",
        detail: "Embed in batches of 100 with retries on 429/5xx (exponential backoff). Insert all chunks for a document in one transaction; if the document already exists by sha256, skip; if the title exists with a different hash, delete its old chunks first.",
      },
      {
        title: "Retrieval",
        detail: "Implement retrieve(question, k=6) returning (chunk_id, title, page, content, similarity). Log every query and retrieved ids to a queries.jsonl file; you will reuse these as golden-set candidates.",
      },
      {
        title: "Cited generation",
        detail: "Build a prompt with numbered sources in a delimited block and the three rules: only use sources, cite every claim with [n], say you don't know otherwise. Call the LLM, then run a citation check (all [n] exist, no long uncited sentences) and print warnings.",
      },
      {
        title: "Interface",
        detail: "Wrap it in a CLI with ingest and ask subcommands (argparse or typer), or a FastAPI app with POST /documents (file upload) and POST /ask, plus a single HTML page. Show citations as clickable items that reveal the chunk text and page.",
      },
      {
        title: "Smoke test",
        detail: "Ingest two different PDFs. Ask 5 questions: 3 answerable from PDF A, 1 from PDF B, 1 unanswerable. Record the answers and whether each citation is correct.",
      },
    ],
    hints: [
      "Some PDFs are scanned images: extract_text() returns empty strings. Detect pages with no text and report them rather than silently ingesting nothing.",
      "Pass vectors as '[x,y,...]' strings with ::vector casts to avoid needing an adapter; or pip install pgvector and use register_vector if you prefer.",
      "If answers ignore the sources, put the sources before the question and keep the rules in the system prompt.",
      "Keep MODEL and EMBED_MODEL in environment variables and store the embedding model name in the documents table.",
    ],
    stretch: "Add a per-document filter (ask --doc paper.pdf), stream the answer token by token, and highlight the cited sentence inside the chunk text in the UI.",
    learned: [
      "The full RAG loop end to end: extraction, chunking, embedding, storage, retrieval, prompting, citation",
      "Why page-level metadata and idempotent ingestion matter for a real product",
      "How to make a model refuse when the evidence is missing",
      "How to log queries so evaluation data accumulates from day one",
    ],
    starter: {
      title: "cortex.py CLI skeleton",
      lang: "python",
      code: `import argparse

def ingest(path: str) -> None:
    raise NotImplementedError("extract pages -> chunk -> embed -> insert")

def ask(question: str, k: int = 6) -> None:
    raise NotImplementedError("embed -> retrieve -> prompt -> generate -> check citations")

def main() -> None:
    parser = argparse.ArgumentParser(prog="cortex")
    sub = parser.add_subparsers(dest="cmd", required=True)
    p_ingest = sub.add_parser("ingest")
    p_ingest.add_argument("path")
    p_ask = sub.add_parser("ask")
    p_ask.add_argument("question")
    p_ask.add_argument("-k", type=int, default=6)
    args = parser.parse_args()
    if args.cmd == "ingest":
        ingest(args.path)
    else:
        ask(args.question, args.k)

if __name__ == "__main__":
    main()`,
    },
  },
  {
    slug: "retrieval-eval-harness",
    title: "Retrieval Eval Harness",
    week: 14,
    duration: "3h",
    minutes: 180,
    difficulty: "medium",
    domain: "ai",
    skills: ["ai-evaluation", "rag", "chunking", "python"],
    prerequisites: ["Evaluating retrieval: recall@k & MRR", "PDF RAG Assistant with Citations (or any working retriever)"],
    topicSlugs: ["retrieval-evaluation", "chunking-strategies", "hybrid-search-reranking"],
    objective: "Build a 30-question golden set and a harness that measures recall@5 and MRR for three chunking configurations, producing a results table you can defend.",
    expectedOutput: "A command (python eval.py) that re-ingests the corpus under three chunking configs into separate tables, runs all 30 questions against each, and prints a markdown table of recall@5, recall@10, MRR (with 95% bootstrap intervals), chunk count and ingestion cost, plus a per-question diff of wins and losses.",
    steps: [
      {
        title: "Write the golden set",
        detail: "30 questions over 2 to 3 documents in golden.jsonl with question, answer_span (verbatim, 5 to 12 words) and doc. Mix: 10 paraphrased, 8 exact-fact (numbers, names), 6 that need a specific section, 6 from real queries logged in your RAG assistant. Have at least 3 questions whose answer spans two paragraphs.",
      },
      {
        title: "Define three configs",
        detail: "A: fixed 800 characters, no overlap. B: recursive split ~400 tokens, 15% overlap. C: B plus a contextual header (title > section) prepended before embedding. Store each in its own table (chunks_a, chunks_b, chunks_c) so runs never collide.",
      },
      {
        title: "Ingest each config",
        detail: "Reuse your ingestion code parameterised by chunker and table name. Record chunk count and total embedded tokens (tiktoken) per config; that is your cost column.",
      },
      {
        title: "Run the harness",
        detail: "For each config, call retrieve(question, 10) once and compute recall@5, recall@10 and MRR from the same ranked list (relevance = chunk contains answer_span, case-insensitive, whitespace-normalised). Save per-question ranks to results_<config>.json.",
      },
      {
        title: "Report",
        detail: "Print a markdown table with the metrics, bootstrap 95% intervals and cost. Then list questions where configs disagree (found by one, missed by another) with the rank in each.",
      },
      {
        title: "Decide",
        detail: "Write 5 sentences in RESULTS.md: which config you would ship for Cortex, whether the difference is outside the noise, and the most common miss cause.",
      },
    ],
    hints: [
      "Normalise whitespace on both the span and chunk text before the containment check; PDF extraction adds odd line breaks.",
      "If a span is split across two chunks, the question will miss under every config; that is a real finding about overlap, not a harness bug.",
      "Cache query embeddings: the same 30 questions are embedded once and reused across configs.",
    ],
    stretch: "Add a fourth config that uses hybrid search (FTS + vectors with RRF) on top of config C, and a fifth with cross-encoder reranking of the top 30. Report the latency of each alongside quality.",
    learned: [
      "How to build a golden set that survives changes to chunking",
      "How to compare retrieval configs with recall@k, MRR and confidence intervals instead of vibes",
      "The cost side of chunking decisions (chunk count, tokens embedded)",
      "How to turn misses into a prioritised list of retrieval improvements",
    ],
    starter: {
      title: "Results table printer",
      lang: "python",
      code: `def print_table(results: dict[str, dict]) -> None:
    header = "| config | recall@5 | recall@10 | MRR | chunks | tokens |"
    print(header)
    print("|" + "---|" * 6)
    for name, r in results.items():
        print(
            f"| {name} | {r['r5']:.2f} | {r['r10']:.2f} | {r['mrr']:.3f} "
            f"| {r['chunks']} | {r['tokens']} |"
        )

print_table({
    "A fixed-800": {"r5": 0.57, "r10": 0.70, "mrr": 0.41, "chunks": 212, "tokens": 41000},
    "B recursive-400": {"r5": 0.70, "r10": 0.83, "mrr": 0.52, "chunks": 260, "tokens": 47000},
})`,
    },
  },
];
