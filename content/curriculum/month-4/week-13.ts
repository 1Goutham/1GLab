import type { LabSeed, TopicSeed } from "../../types";

export const topics: TopicSeed[] = [
  // ───────────────────────────────────────────────────────────────────────
  {
    slug: "vector-databases-pgvector",
    title: "Vector databases & pgvector",
    week: 13,
    domain: "ai",
    skills: ["vector-search", "sql-postgres"],
    difficulty: "medium",
    minutes: 75,
    summary: "Store embeddings next to your rows in Postgres and query them by meaning, fast, with HNSW or IVFFlat indexes.",
    tags: ["pgvector", "postgres", "hnsw", "ivfflat", "ann", "cortex"],
    lesson: {
      hook: `Cortex will ingest every PDF, note and article you give it. A modest library is 2,000 documents, which becomes about 50,000 chunks, each with a 1,536-float embedding. That is 50,000 × 1,536 × 4 bytes ≈ **300 MB** of vectors.

For every question you ask, Cortex must find the 5 chunks closest in meaning to the question. Comparing against all 50,000 is fine on a laptop. Comparing against 5 million, for 100 users at once, is not.

You could reach for a dedicated vector database. But your users, documents and permissions already live in Postgres. If a user deletes a document, you want its vectors gone in the **same transaction**, and you want \`WHERE owner_id = 'goutham'\` to just work.

That is what pgvector gives you: a \`vector\` column type, distance operators and approximate-nearest-neighbour indexes, inside the database you already run.`,
      whyItMatters: `Every RAG system, recommender and semantic search box is a nearest-neighbour query underneath. Knowing how the index works tells you why recall silently drops, why filters return 3 rows instead of 5, and when Postgres is enough.`,
      levels: {
        l1: `An embedding turns a piece of text into a long list of numbers, where texts with similar meaning get similar lists. A vector database stores those lists and answers one question quickly: "which stored lists are closest to this one?" pgvector teaches Postgres to do that, so your meaning-search lives next to your normal tables.`,
        l2: {
          analogy: `Think of a huge library with no catalogue, where books are shelved by topic in a 1,536-dimensional building. Brute force is walking every aisle. An index is a set of signposts: IVFFlat splits the building into neighbourhoods and you only search the few nearest ones; HNSW is a road network with motorways on top and side streets below, so you drive fast to the right area and then walk the last few metres.`,
          text: `A vector query is \`ORDER BY distance LIMIT k\`. Without an index Postgres computes the distance to every row: exact, but O(N·d).

An **approximate nearest neighbour (ANN)** index trades a little recall for a huge speed-up. You do not get a guarantee that the true top 5 come back; you get "almost always, in milliseconds". The knobs (\`ef_search\`, \`probes\`) let you buy recall back with latency.`,
          diagram: {
            type: "flow",
            title: "One Cortex query through Postgres",
            lanes: [
              {
                label: "No index",
                tone: "bad",
                steps: [
                  { label: "Question embedding", note: "1,536 floats" },
                  { label: "Seq scan", note: "distance to all N rows" },
                  { label: "Sort", note: "O(N log N)" },
                  { label: "Top 5", note: "exact, slow at scale" },
                ],
              },
              {
                label: "HNSW index",
                tone: "good",
                steps: [
                  { label: "Question embedding", note: "1,536 floats" },
                  { label: "Enter top layer", note: "few long-range links" },
                  { label: "Greedy descent", note: "layer by layer" },
                  { label: "Top 5", note: "approximate, ~ms", accent: true },
                ],
              },
            ],
          },
        },
        l3: {
          text: `pgvector adds a \`vector(n)\` type and three distance operators:

- \`<->\` Euclidean (L2) distance
- \`<#>\` **negative** inner product (negated so that smaller is still better)
- \`<=>\` cosine distance, i.e. \`1 - cosine_similarity\`

The index opclass must match the operator you query with: an index built with \`vector_cosine_ops\` is only used by \`ORDER BY embedding <=> ...\`. OpenAI embeddings are unit-length, so cosine and inner product give the same ranking; cosine is the safe default.

Run Postgres with pgvector locally in one line: \`docker run -d --name pgv -e POSTGRES_PASSWORD=pg -p 5432:5432 pgvector/pgvector:pg17\`. Then create the schema below. Note the \`ON DELETE CASCADE\`: deleting a document deletes its vectors, atomically, which is the whole point of keeping them in Postgres.`,
          code: [
            {
              title: "Schema for Cortex chunks",
              lang: "sql",
              code: `CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE documents (
  id         bigserial PRIMARY KEY,
  owner_id   text NOT NULL,
  title      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE chunks (
  id          bigserial PRIMARY KEY,
  document_id bigint NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  ord         int NOT NULL,
  content     text NOT NULL,
  embedding   vector(1536) NOT NULL
);

-- Matches ORDER BY embedding <=> query (cosine distance)
CREATE INDEX chunks_embedding_hnsw
  ON chunks USING hnsw (embedding vector_cosine_ops);`,
            },
            {
              title: "Insert and query from Python (psycopg 3)",
              lang: "python",
              note: "pip install psycopg[binary] requests. Vectors are passed as the text literal '[0.1,0.2,...]' and cast with ::vector, so no extra adapter is needed.",
              code: `import os
import psycopg
import requests

def embed(texts: list[str]) -> list[list[float]]:
    r = requests.post(
        "https://api.openai.com/v1/embeddings",
        headers={"Authorization": "Bearer " + os.environ["OPENAI_API_KEY"]},
        json={"model": "text-embedding-3-small", "input": texts},
        timeout=30,
    )
    r.raise_for_status()
    return [d["embedding"] for d in r.json()["data"]]

def to_pgvector(v: list[float]) -> str:
    return "[" + ",".join(f"{x:.6f}" for x in v) + "]"

texts = ["HNSW is a layered proximity graph.", "IVFFlat clusters vectors into lists."]
with psycopg.connect(os.environ["DATABASE_URL"]) as conn:
    doc_id = conn.execute(
        "INSERT INTO documents (owner_id, title) VALUES (%s, %s) RETURNING id",
        ("goutham", "pgvector notes"),
    ).fetchone()[0]
    for i, (text, vec) in enumerate(zip(texts, embed(texts))):
        conn.execute(
            "INSERT INTO chunks (document_id, ord, content, embedding) VALUES (%s, %s, %s, %s::vector)",
            (doc_id, i, text, to_pgvector(vec)),
        )
    q = to_pgvector(embed(["how does the graph index work?"])[0])
    rows = conn.execute(
        "SELECT content, 1 - (embedding <=> %s::vector) AS sim "
        "FROM chunks ORDER BY embedding <=> %s::vector LIMIT 3",
        (q, q),
    ).fetchall()
    for content, sim in rows:
        print(round(sim, 3), content)`,
            },
          ],
        },
        l4: {
          text: `**HNSW (Hierarchical Navigable Small World)** is a multi-layer graph. Every vector is a node in layer 0; a random, exponentially shrinking subset is also promoted to layers 1, 2, 3. Each node links to its \`m\` nearest neighbours in each layer it lives in (\`m = 16\` by default, \`2m\` in layer 0).

A search starts at the entry point in the top layer and walks greedily towards the query, then drops a layer and repeats. In layer 0 it keeps a candidate list of size \`ef_search\` (default 40) and returns the best \`k\`. This is literally a best-first graph search, which is why this week's DSA pattern is graphs. Bigger \`ef_search\` means more nodes visited: higher recall, higher latency.

**IVFFlat** runs k-means over a sample of your vectors to find \`lists\` centroids, then assigns every vector to its nearest centroid (an inverted file). A query compares against the centroids, picks the \`probes\` closest lists (default 1) and scans only those. It builds faster and uses less memory, but the centroids are learned from the data present **at build time**, so build it after loading data and rebuild after large changes.

Rules of thumb from the pgvector docs: IVFFlat \`lists = rows / 1000\` up to 1M rows, \`sqrt(rows)\` beyond; start \`probes\` at \`sqrt(lists)\`. HNSW is the better default for most apps: better speed/recall trade-off, no training step, but slower to build and larger in RAM. Indexes are only fast when they fit in memory; watch \`shared_buffers\` and set \`maintenance_work_mem\` high while building.

**The filter trap.** With \`WHERE owner_id = $1 ORDER BY embedding <=> $2 LIMIT 5\`, the index returns its \`ef_search\` nearest candidates first and Postgres filters afterwards. If only 2 of those 40 belong to Goutham, you get 2 rows, not 5. pgvector 0.8+ fixes this with iterative index scans (\`SET hnsw.iterative_scan = relaxed_order\`); alternatives are partial indexes or partitioning per tenant.`,
          diagram: {
            type: "compare",
            title: "HNSW vs IVFFlat in pgvector",
            left: {
              label: "HNSW",
              points: [
                "Layered proximity graph, greedy best-first search",
                "Build any time; no training step",
                "Best recall/latency trade-off; tune hnsw.ef_search",
                "Slower build, more memory (m links per node)",
                "Default choice for Cortex",
              ],
            },
            right: {
              label: "IVFFlat",
              points: [
                "k-means centroids + inverted lists",
                "Build AFTER loading data; rebuild after big changes",
                "Tune ivfflat.probes (start at sqrt(lists))",
                "Faster build, smaller index",
                "Good for large, mostly static corpora",
              ],
            },
          },
          code: [
            {
              title: "Index knobs you will actually touch",
              lang: "sql",
              code: `-- HNSW: m = links per node, ef_construction = build-time candidate list
CREATE INDEX ON chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
SET hnsw.ef_search = 100;                 -- default 40; must be >= LIMIT
SET hnsw.iterative_scan = relaxed_order;  -- pgvector 0.8+: keep scanning when filters drop rows

-- IVFFlat: train on real data, then choose how many lists to probe
CREATE INDEX ON chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
SET ivfflat.probes = 10;                  -- default 1

-- Speed up index builds for this session
SET maintenance_work_mem = '2GB';`,
            },
          ],
        },
        l5: {
          question: `Cortex now has 20M chunks across 10,000 users in one pgvector table. Queries always filter by owner_id. Users report answers missing obvious documents, and p95 latency is 800 ms. Walk me through your diagnosis and fixes.`,
          hint: "Two separate problems: recall under filtering, and the index not fitting in memory.",
          answer: `First I would separate recall from latency. Missing documents with a selective \`owner_id\` filter is the classic post-filtering problem: the HNSW scan returns its \`ef_search\` global candidates and the \`WHERE\` throws most of them away, so each user sees fewer and worse results. I would confirm it by comparing the ANN result to an exact scan (\`SET enable_indexscan = off\`) for a sample of users and measuring recall@5.

Fixes, in order: enable iterative index scans (\`hnsw.iterative_scan\`, pgvector 0.8+) and raise \`ef_search\`; if tenants are very uneven, partition the table by owner (or hash of owner) so each partition has its own small index, or add partial indexes for the largest tenants; tiny tenants can simply use an exact scan, which is fast at a few thousand rows.

For latency I would check \`EXPLAIN (ANALYZE, BUFFERS)\`: if the index is being read from disk it does not fit in RAM. 20M × 1,536 float32 is ~120 GB of raw vectors, so I would switch to \`halfvec\` (half precision) or shorter embeddings via the model's \`dimensions\` parameter, which roughly halves or quarters the footprint with a small recall cost. Only if we still cannot hit SLOs at that scale would I move vectors to a dedicated engine, and I would keep Postgres as the source of truth.`,
        },
      },
      commonMistakes: [
        "Creating the index with one opclass (e.g. vector_l2_ops) and querying with another operator (<=>). Postgres silently falls back to a sequential scan.",
        "Building an IVFFlat index on an empty table and loading data afterwards: the centroids are meaningless and recall collapses.",
        "Filtering with a selective WHERE clause and assuming LIMIT 5 returns 5 rows. Post-filtering can return fewer; use iterative scans, partitioning or partial indexes.",
        "Mixing embeddings from two different models (or dimensions) in one column. Distances between them are meaningless even when the shapes happen to match.",
      ],
      tryThis: `In psql, run \`SELECT '[1,0]'::vector <=> '[0,1]'::vector, '[1,0]'::vector <-> '[0,1]'::vector, '[1,0]'::vector <#> '[1,1]'::vector;\` and explain each number out loud before you look it up (expect 1, 1.414 and -1).`,
      miniTask: {
        title: "Stand up pgvector and prove the index is used",
        kind: "build",
        minutes: 35,
        steps: [
          "Start Postgres with pgvector: docker run -d --name pgv -e POSTGRES_PASSWORD=pg -p 5432:5432 pgvector/pgvector:pg17",
          "Create the documents and chunks tables from Level 3, but use vector(3) so you can type vectors by hand.",
          "Insert 10,000 random rows in one statement: INSERT INTO chunks (document_id, ord, content, embedding) SELECT 1, g, 'row ' || g, ARRAY[random(), random(), random()]::vector FROM generate_series(1, 10000) g; (insert one documents row with id 1 first).",
          "Run EXPLAIN ANALYZE on SELECT id FROM chunks ORDER BY embedding <=> '[0.5,0.5,0.5]' LIMIT 5; and note the plan and time.",
          "Create an HNSW index with vector_cosine_ops, run the same EXPLAIN ANALYZE, then repeat with ORDER BY embedding <-> ... and see which one uses the index.",
        ],
        checklist: [
          "Seq Scan appears in the plan before the index exists",
          "Index Scan using the hnsw index appears after, for the <=> query",
          "The <-> query does NOT use the cosine index, and I can say why",
          "I recorded both execution times",
        ],
        deliverable: "A short note with the two query plans, the timings, and one sentence on why the opclass must match the operator.",
      },
      quiz: [
        {
          q: "Your index is created with vector_cosine_ops. Which ORDER BY will use it?",
          options: ["ORDER BY embedding <-> $1", "ORDER BY embedding <=> $1", "ORDER BY embedding <#> $1", "Any of them; the planner converts between metrics"],
          answer: 1,
          explain: "Each opclass supports exactly one operator. vector_cosine_ops serves <=> (cosine distance); <-> needs vector_l2_ops and <#> needs vector_ip_ops.",
        },
        {
          q: "Why should an IVFFlat index be built after the table is loaded?",
          options: [
            "Postgres cannot index an empty table",
            "It learns k-means centroids from existing rows; with no data the lists are meaningless",
            "IVFFlat indexes are read-only once created",
            "It needs the table statistics from ANALYZE to pick the distance metric",
          ],
          answer: 1,
          explain: "IVFFlat partitions space using centroids learned at build time. New rows are assigned to existing lists, so a bad initial clustering hurts recall until you rebuild.",
        },
        {
          q: "Raising hnsw.ef_search from 40 to 200 will most likely…",
          options: [
            "Rebuild the index with more links per node",
            "Reduce memory usage of the index",
            "Increase recall and increase query latency",
            "Have no effect unless you also change m",
          ],
          answer: 2,
          explain: "ef_search is the size of the candidate list during a query. A bigger list visits more graph nodes: better recall, more work. m and ef_construction are build-time parameters.",
        },
      ],
      explainPrompt: "Explain to a junior engineer, in 5 sentences, what an HNSW index does inside pgvector and why a WHERE filter can make a LIMIT 5 query return 2 rows.",
      implementPrompt: "From memory: write the SQL to create a chunks table with a vector(1536) column, an HNSW cosine index, and a query that returns the top 5 chunks for one owner with their cosine similarity.",
      videos: [
        {
          title: "HNSW for vector search, explained and implemented",
          channel: "James Briggs",
          url: "https://www.youtube.com/results?search_query=james+briggs+hnsw+explained+faiss",
          kind: "search",
          reason: "Watch this if the layered-graph search in Level 4 is not clicking; it animates the greedy descent layer by layer.",
        },
      ],
    },
  },

  // ───────────────────────────────────────────────────────────────────────
  {
    slug: "chunking-strategies",
    title: "Chunking strategies",
    week: 13,
    domain: "ai",
    skills: ["chunking"],
    difficulty: "medium",
    minutes: 60,
    summary: "How you cut documents into pieces sets the ceiling on retrieval quality. Split on structure, size in tokens, overlap, and carry context.",
    prerequisites: ["vector-databases-pgvector"],
    tags: ["chunking", "rag", "tokens", "overlap", "contextual-retrieval"],
    lesson: {
      hook: `Upload a 40-page product spec to Cortex and embed it as **one** vector. Ask "what is the refund window?" and it will not be found. That single vector is an average of pricing, onboarding, legal and refunds; it is close to nothing in particular.

So you split it every 500 characters. Now the sentence "The refund window is 30 days from delivery" is cut into "The refund window is" and "30 days from delivery". Neither half answers the question.

Chunking is the least glamorous part of RAG and the one that most often decides whether it works. The LLM can only cite what retrieval hands it, and retrieval can only find what chunking kept intact.`,
      whyItMatters: `Chunk size, boundaries and metadata set the upper bound on recall. When a RAG system gives vague answers, bad chunks are the first suspect, before the prompt or the model.`,
      levels: {
        l1: `Search works on pieces, not whole files, so you have to cut documents up. Each piece should hold one complete idea: big enough to make sense alone, small enough to be about one thing. Good cuts follow the document's own structure, like headings and paragraphs, instead of a blind character count.`,
        l2: {
          analogy: `Chunking is like cutting a textbook into flashcards. A flashcard with a whole chapter is useless for quick lookup; a flashcard with half a sentence is useless for understanding. The best cards hold one concept, and each card says which chapter it came from.`,
          text: `Two forces pull against each other. **Small chunks** give precise embeddings (one topic per vector) but lose surrounding context. **Large chunks** keep context but dilute the embedding and waste prompt tokens.

The practical answer for most text is 200 to 500 tokens, split on natural boundaries, with 10 to 20% overlap, and every chunk stamped with where it came from (document title, section heading, page).`,
          diagram: {
            type: "flow",
            title: "Blind vs structure-aware chunking",
            lanes: [
              {
                label: "Fixed 500 chars",
                tone: "bad",
                steps: [
                  { label: "Slice every 500 chars" },
                  { label: "Cuts mid-sentence", note: "\"refund window is\" | \"30 days\"" },
                  { label: "Half-idea embeddings" },
                  { label: "Missed at query time" },
                ],
              },
              {
                label: "Structure-aware",
                tone: "good",
                steps: [
                  { label: "Split on headings, then paragraphs" },
                  { label: "~400 tokens, 15% overlap" },
                  { label: "Prefix title + section path" },
                  { label: "One idea per vector", accent: true },
                ],
              },
            ],
          },
        },
        l3: {
          text: `The workhorse is a **recursive splitter**: try to split on the biggest natural boundary (blank line = paragraph), and only if a piece is still too long, recurse with a smaller boundary (newline, sentence end, space). Greedily pack pieces up to the size limit so you do not end up with 40 one-line chunks.

**Overlap** repeats the tail of the previous chunk at the start of the next, so an idea that straddles a boundary survives in at least one chunk.

This is roughly what LangChain's RecursiveCharacterTextSplitter does; writing it yourself once means you will know exactly what your pipeline is doing when results look odd.`,
          code: [
            {
              title: "Blind fixed-size slicing",
              lang: "python",
              variant: "bad",
              note: "Ignores sentences, paragraphs and headings. Cheap, and the reason many first RAG demos feel dumb.",
              code: `def chunk_fixed(text: str, size: int = 500) -> list[str]:
    return [text[i:i + size] for i in range(0, len(text), size)]`,
            },
            {
              title: "Recursive splitter with overlap",
              lang: "python",
              variant: "good",
              code: `SEPARATORS = ["\\n\\n", "\\n", ". ", " "]

def split_recursive(text: str, max_chars: int = 1600, seps: list[str] = SEPARATORS) -> list[str]:
    if len(text) <= max_chars:
        return [text]
    if not seps:  # no boundary left: hard cut
        return [text[i:i + max_chars] for i in range(0, len(text), max_chars)]
    sep, rest = seps[0], seps[1:]
    chunks, current = [], ""
    for part in text.split(sep):
        candidate = current + sep + part if current else part
        if len(candidate) <= max_chars:
            current = candidate          # keep packing
            continue
        if current:
            chunks.append(current)
        if len(part) > max_chars:        # this piece alone is too big: go finer
            chunks.extend(split_recursive(part, max_chars, rest))
            current = ""
        else:
            current = part
    if current:
        chunks.append(current)
    return chunks

def add_overlap(chunks: list[str], overlap_chars: int = 240) -> list[str]:
    out = []
    for i, chunk in enumerate(chunks):
        prefix = chunks[i - 1][-overlap_chars:] if i > 0 else ""
        out.append((prefix + " " + chunk).strip())
    return out

if __name__ == "__main__":
    doc = open("notes.md", encoding="utf-8").read()
    chunks = add_overlap(split_recursive(doc))
    print(len(chunks), "chunks; sizes:", [len(c) for c in chunks][:10])`,
            },
          ],
        },
        l4: {
          text: `**Measure in tokens, not characters.** Embedding models have token limits (\`text-embedding-3-small\` accepts up to 8,191 tokens) and you pay per token. English averages roughly 4 characters per token, but code, tables and non-English text vary widely, so a character budget is only an approximation. \`tiktoken\` with \`cl100k_base\` is the tokenizer for OpenAI's v3 embedding models.

**Chunks need context they do not contain.** A chunk that says "It increased 12% over the previous quarter" is unfindable: what is "it"? Three fixes, in increasing cost:

- **Contextual headers**: prefix every chunk with \`Document title > Section > Subsection\` before embedding. Free and surprisingly effective.
- **Small-to-big (parent-child)**: embed small chunks for precise matching, but return the parent section to the LLM. Retrieval precision and generation context, both.
- **Contextual retrieval**: ask an LLM to write one or two sentences situating each chunk within the whole document, and prepend that before embedding and keyword indexing. Anthropic reported this cut failed retrievals by 49% combined with BM25, and 67% with reranking added. Costs one LLM call per chunk at ingestion (prompt caching makes it cheap).

**Semantic chunking** embeds each sentence and starts a new chunk where similarity between neighbouring sentences drops sharply. It helps on unstructured prose, costs an embedding per sentence, and is rarely better than structure-aware splitting on well-formatted docs. Try the cheap thing first and **evaluate** (Week 14) before paying for the clever thing.

**Special content:** tables should be kept whole (or converted to one row per chunk with headers repeated); code should split on functions or classes; PDFs need page numbers kept as metadata so Cortex can cite "p. 12".`,
          code: [
            {
              title: "Token windows with overlap and a contextual header",
              lang: "python",
              note: "pip install tiktoken",
              code: `import tiktoken

enc = tiktoken.get_encoding("cl100k_base")

def token_windows(text: str, size: int = 400, overlap: int = 60) -> list[str]:
    ids = enc.encode(text)
    if not ids:
        return []
    step = size - overlap
    return [enc.decode(ids[i:i + size]) for i in range(0, max(len(ids) - overlap, 1), step)]

def with_header(chunk: str, title: str, section: str) -> str:
    # What gets embedded: the chunk plus where it lives.
    return title + " > " + section + "\\n\\n" + chunk

section_text = open("refunds.md", encoding="utf-8").read()
for w in token_windows(section_text):
    text = with_header(w, "FabricNest Policies", "Refunds")
    print(len(enc.encode(text)), "tokens:", text[:80].replace("\\n", " "))`,
            },
          ],
        },
        l5: {
          question: `Your RAG over internal engineering docs answers "what is our Redis TTL policy?" with generic text, even though the answer is in a Confluence page. How would you debug whether chunking is the problem, and what would you change?`,
          hint: "Look at what was actually retrieved before touching the prompt.",
          answer: `I would start by logging the retrieved chunks for that query, not the final answer. If the right page is not in the top k at all, it is a retrieval problem; if it is there but the answer is still vague, it is a generation problem. Then I would find the chunk that actually contains the policy and read it as the embedder sees it.

Typical chunking failures: the sentence was split across two chunks; the chunk says "we set it to 1 hour" without mentioning Redis because the heading lived in the previous chunk; or the chunk is 2,000 tokens covering five topics so its embedding is diluted. Fixes are structure-aware splitting on headings, 300 to 500 token chunks with overlap, and prefixing each chunk with the page title and heading path. If key terms like "TTL" are acronyms, I would also add BM25 hybrid search.

Crucially I would not tune by eyeballing one query: I would build a small golden set of 30 real questions with known source chunks and compare recall@5 across chunking configs before shipping the change.`,
        },
      },
      commonMistakes: [
        "Chunking by characters and assuming it matches the token budget; code and tables can blow past model limits.",
        "Dropping metadata: without document title, section and page on every chunk, you cannot cite sources or filter by document.",
        "Choosing chunk size by gut feel. Run the same golden questions over two or three configs and pick by recall@k.",
        "Splitting tables and code blocks mid-way, producing chunks that are syntactically broken and semantically empty.",
      ],
      tryThis: `Take one page of your own notes. Chunk it with chunk_fixed(text, 300) and with split_recursive(text, 300) and print both. Count how many fixed chunks start or end mid-word.`,
      miniTask: {
        title: "Compare three chunkers on a real document",
        kind: "code",
        minutes: 40,
        steps: [
          "Pick a real markdown or text document of at least 3,000 words (a README, your portfolio notes, a long blog post).",
          "Implement chunk_fixed and split_recursive + add_overlap from Level 3, and token_windows from Level 4.",
          "Run all three and print: number of chunks, min/median/max size in tokens (use tiktoken for all three).",
          "For each chunker, print the chunk that contains one specific fact you pick in advance (search with a substring).",
          "Write down which chunker kept that fact in a self-contained, understandable chunk.",
        ],
        checklist: [
          "All three chunkers run on the same document",
          "Sizes are reported in tokens, not characters",
          "I found my chosen fact in each chunker's output",
          "I can say in one sentence which chunker I would ship for Cortex and why",
        ],
        deliverable: "A chunking_compare.py script and a 3-line summary of the results.",
      },
      quiz: [
        {
          q: "Why does a very large chunk (say 3,000 tokens covering many topics) retrieve poorly?",
          options: [
            "Embedding models refuse inputs over 512 tokens",
            "Its single vector blends many topics, so it is not strongly similar to any specific question",
            "pgvector cannot index long text",
            "Cosine similarity is undefined for long inputs",
          ],
          answer: 1,
          explain: "One vector summarises the whole chunk. Mixing topics pulls it towards an average that is moderately close to many queries and very close to none.",
        },
        {
          q: "What is overlap between consecutive chunks for?",
          options: [
            "Making the index smaller",
            "Ensuring an idea that straddles a boundary appears whole in at least one chunk",
            "Letting the LLM see the whole document",
            "Deduplicating identical chunks",
          ],
          answer: 1,
          explain: "Repeating the tail of the previous chunk gives boundary-crossing sentences a second chance to land intact. It costs extra storage and tokens, so keep it around 10 to 20%.",
        },
        {
          q: "In small-to-big (parent-child) retrieval, what is embedded and what is sent to the LLM?",
          options: [
            "Parents embedded, children sent",
            "Small child chunks embedded for precise matching; their larger parent section sent as context",
            "Both embedded, only the query sent",
            "The whole document embedded and sent",
          ],
          answer: 1,
          explain: "You match on small, focused vectors and then expand to the surrounding section so the model has enough context to answer.",
        },
      ],
      explainPrompt: "Explain to a junior engineer in 5 sentences why chunk size is a trade-off, and what a contextual header is.",
      implementPrompt: "From memory: write a function that splits text on blank lines, packs paragraphs into chunks of at most N characters, and adds a fixed overlap from the previous chunk.",
      videos: [
        {
          title: "The 5 Levels of Text Splitting for Retrieval",
          channel: "Greg Kamradt",
          url: "https://www.youtube.com/results?search_query=greg+kamradt+5+levels+of+text+splitting",
          kind: "search",
          reason: "Watch this after Level 3 to see character, recursive, document-specific, semantic and agentic chunking side by side on real text.",
        },
      ],
    },
  },

  // ───────────────────────────────────────────────────────────────────────
  {
    slug: "semantic-search",
    title: "Semantic search end-to-end",
    week: 13,
    domain: "ai",
    skills: ["vector-search", "embeddings"],
    difficulty: "medium",
    minutes: 70,
    summary: "Embed documents and queries into the same space, normalise, score by dot product, return top-k. The core loop under every RAG system.",
    prerequisites: ["vector-databases-pgvector", "chunking-strategies"],
    tags: ["embeddings", "cosine-similarity", "numpy", "top-k", "search"],
    lesson: {
      hook: `On FabricNest, a customer types "something breathable for a Chennai summer wedding". Your keyword search looks for products containing "breathable", "Chennai", "summer" and "wedding", and returns a raincoat tagged "summer sale".

The product they wanted is described as "lightweight handloom cotton kurta, ideal for humid evenings". It shares **zero** words with the query.

Semantic search fixes this by comparing meaning instead of spelling. It is also the exact retrieval step inside Cortex, so this week you build it from scratch in 30 lines of numpy before letting a database do it for you.`,
      whyItMatters: `Embedding search is the first half of RAG and the backbone of recommendations, deduplication and clustering. Building it by hand once removes the magic and makes every vector-DB setting make sense.`,
      levels: {
        l1: `An embedding model reads a piece of text and outputs a list of numbers that captures what it is about. Texts with similar meaning get lists that point in a similar direction. To search, you turn the question into a list the same way and pick the stored texts whose lists point most nearly the same way.`,
        l2: {
          analogy: `Imagine every sentence as an arrow from the centre of a sphere. "Cheap flights to Goa" and "budget airfare to Goa" are arrows almost on top of each other; "Goa has beaches" is nearby; "gradient descent" points somewhere else entirely. Search is: draw the arrow for the question, then find the arrows with the smallest angle to it.`,
          text: `Two phases. **Indexing** happens once per document: chunk, embed, normalise, store. **Querying** happens on every search: embed the question with the **same model**, score against every stored vector, return the top k.

Cosine similarity measures the angle between arrows and ignores their length. If you normalise every vector to length 1 up front, cosine similarity becomes a plain dot product, and scoring the whole corpus is one matrix-vector multiply.`,
          diagram: {
            type: "flow",
            title: "Semantic search: index once, query many times",
            lanes: [
              {
                label: "Index",
                tone: "neutral",
                steps: [
                  { label: "Documents" },
                  { label: "Chunk" },
                  { label: "Embed", note: "same model always" },
                  { label: "Normalise", note: "length 1" },
                  { label: "Store matrix", note: "N × d" },
                ],
              },
              {
                label: "Query",
                tone: "good",
                steps: [
                  { label: "Question" },
                  { label: "Embed + normalise" },
                  { label: "Scores = M · q", note: "one matmul", accent: true },
                  { label: "Top-k", note: "argpartition" },
                  { label: "Results" },
                ],
              },
            ],
          },
        },
        l3: {
          text: `The code below is a complete semantic search engine. It batches all documents into **one** embeddings request (the API accepts a list), normalises the vectors, and uses \`np.argpartition\` to find the top k in O(N) instead of sorting all N scores.

Things to notice: the query and documents go through the same \`embed\` function; scores are cosine similarities in [-1, 1] but in practice most unrelated pairs sit around 0.1 to 0.3 with modern models, so **never hard-code a "relevance threshold" without looking at your own score distribution**.`,
          code: [
            {
              title: "Semantic search in numpy",
              lang: "python",
              note: "pip install numpy requests; export OPENAI_API_KEY. Any embeddings API works: swap the URL and response parsing.",
              code: `import os
import numpy as np
import requests

def embed(texts: list[str]) -> np.ndarray:
    r = requests.post(
        "https://api.openai.com/v1/embeddings",
        headers={"Authorization": "Bearer " + os.environ["OPENAI_API_KEY"]},
        json={"model": "text-embedding-3-small", "input": texts},
        timeout=30,
    )
    r.raise_for_status()
    vecs = np.array([d["embedding"] for d in r.json()["data"]], dtype=np.float32)
    return vecs / np.linalg.norm(vecs, axis=1, keepdims=True)  # unit length

docs = [
    "Lightweight handloom cotton kurta, ideal for humid evenings",
    "Waterproof raincoat, summer sale",
    "Redis caches repeated LLM responses to cut cost",
    "pgvector adds vector similarity search to Postgres",
    "Silk saree with zari border for festive occasions",
    "Rate limiting protects an API from abusive clients",
]
doc_vecs = embed(docs)  # shape (N, 1536), computed once

def search(query: str, k: int = 3) -> list[tuple[float, str]]:
    q = embed([query])[0]
    scores = doc_vecs @ q                        # cosine similarity, shape (N,)
    top = np.argpartition(-scores, k - 1)[:k]    # unordered top k in O(N)
    top = top[np.argsort(-scores[top])]          # order just those k
    return [(float(scores[i]), docs[i]) for i in top]

for score, doc in search("something breathable for a summer wedding"):
    print(f"{score:.3f}  {doc}")`,
            },
          ],
        },
        l4: {
          text: `**The math.** Cosine similarity is \`a·b / (|a||b|)\`. For unit vectors the denominator is 1, so it is just \`a·b\`. And squared Euclidean distance between unit vectors is \`|a-b|² = 2 - 2·cos\`, so L2, inner product and cosine all produce the **same ranking** once vectors are normalised. That is why OpenAI's already-normalised embeddings work with any of pgvector's operators.

**Cost.** Brute force is N × d multiply-adds per query: 50,000 × 1,536 ≈ 77M FLOPs, a few milliseconds with BLAS. It scales linearly, which is why ANN indexes exist (previous topic). Below ~100k vectors, brute force in numpy is a perfectly good production choice and has perfect recall.

**Top-k.** \`argsort\` is O(N log N). \`argpartition\` uses introselect to put the k largest in the first k slots in O(N), then you sort only those k. At scale, ANN indexes replace this step entirely.

**Asymmetry.** Queries are short questions; documents are long statements. Some models (E5, BGE and others) are trained with prefixes like \`query: \` and \`passage: \` and lose accuracy without them; read the model card. OpenAI's v3 models need no prefixes.

**Dimensions.** \`text-embedding-3\` models were trained so that the first dimensions carry the most information (Matryoshka representation learning). Passing \`dimensions: 512\` returns shorter vectors, a third of the storage, for a small quality loss. Re-normalise if you truncate manually.

**Why it fails.** Embeddings are weak at exact identifiers ("error E1043", SKU codes, names they never saw), negation ("not cotton") and numbers. That is what hybrid search with BM25 fixes in Week 14.`,
          code: [
            {
              title: "Proving the three metrics agree on unit vectors",
              lang: "python",
              code: `import numpy as np

rng = np.random.default_rng(0)
a, b = rng.normal(size=1536), rng.normal(size=1536)

cos = a @ b / (np.linalg.norm(a) * np.linalg.norm(b))
an, bn = a / np.linalg.norm(a), b / np.linalg.norm(b)

print("cosine        ", cos)
print("dot (unit)    ", an @ bn)                 # identical to cosine
print("L2^2 (unit)   ", np.sum((an - bn) ** 2))
print("2 - 2*cos     ", 2 - 2 * cos)             # identical to L2^2`,
            },
          ],
        },
        l5: {
          question: `You are asked to add "search by meaning" to a notes app with 30,000 notes per user. A teammate wants to add Pinecone. What would you build, and how would you know it is good?`,
          hint: "Size the problem first, then talk about evaluation.",
          answer: `First I would size it: 30,000 notes, maybe 60,000 chunks at 1,536 float32 dimensions, is around 370 MB per user in the worst case, and exact brute-force search over that is a few milliseconds. So I would start with pgvector in the Postgres we already run, with an HNSW index and an owner_id filter, keeping vectors transactionally consistent with notes. A separate vector service adds a second source of truth, sync jobs and deletion bugs for no measurable win at this size.

The pipeline: structure-aware chunking with a title prefix, one embedding model pinned by name and version, batched embedding on write via a background job, and the same model at query time. I would store the model name alongside each vector so a future model migration is a re-embed, not a mystery.

To know it is good, I would collect 30 to 50 real queries with the notes that should come back, measure recall@5 and MRR, and compare against the existing keyword search. Common failures, like exact codes or names, I would expect to fix by adding BM25 and fusing results rather than by changing the embedding model.`,
        },
      },
      commonMistakes: [
        "Embedding documents with one model and queries with another (or a different version). The vectors live in unrelated spaces.",
        "Calling the embeddings API once per document in a loop instead of batching; slow, and easy to hit rate limits.",
        "Using a fixed similarity threshold like 0.8 copied from a blog post. Score distributions differ by model; inspect yours.",
        "Forgetting to normalise when you compute a dot product yourself, so long vectors win regardless of meaning.",
      ],
      tryThis: `Search your six-document index for "not a sale item" and for "E1043". Notice that embeddings handle neither negation nor exact codes well. Keep that in mind for hybrid search next week.`,
      miniTask: {
        title: "Search your own writing by meaning",
        kind: "build",
        minutes: 40,
        steps: [
          "Collect 20 to 30 short texts you wrote: project descriptions from 1goutham.space, README intros, commit messages.",
          "Embed them in one batched call with the Level 3 code and save the matrix with np.save so you do not pay twice.",
          "Write 5 queries that share few words with the target text (e.g. \"the app that stops me scrolling\" for ZtudyLock).",
          "Print the top 3 with scores for each query.",
          "Print the score distribution (min, median, max) across all query-document pairs.",
        ],
        checklist: [
          "Embeddings are fetched in a single batched request",
          "At least 4 of 5 paraphrased queries return the intended text in the top 3",
          "I know the typical score of an unrelated pair for this model",
          "The embedding matrix is cached on disk",
        ],
        deliverable: "A search.py that loads cached embeddings and answers queries from the command line.",
      },
      quiz: [
        {
          q: "After normalising all vectors to unit length, which statement is true?",
          options: [
            "Only cosine similarity still works",
            "Dot product, cosine and L2 distance all produce the same ranking",
            "L2 distance ranking is reversed",
            "Dot product becomes always positive",
          ],
          answer: 1,
          explain: "For unit vectors, dot = cosine and |a-b|² = 2 - 2cos, so ordering by any of them gives the same top-k.",
        },
        {
          q: "Why use np.argpartition instead of np.argsort for top-k?",
          options: [
            "argsort is not stable",
            "argpartition finds the k largest in O(N) without fully sorting",
            "argpartition returns similarity scores",
            "argsort cannot handle float32",
          ],
          answer: 1,
          explain: "You only need the best k in order. Partition in O(N), then sort only k elements.",
        },
        {
          q: "Which query is plain embedding search most likely to get wrong?",
          options: [
            "\"how do I make my API cheaper\"",
            "\"shoes for running on trails\"",
            "\"error code E1043 on checkout\"",
            "\"explain attention simply\"",
          ],
          answer: 2,
          explain: "Rare identifiers and codes carry little semantic signal for the embedding model. Keyword search (BM25) matches them exactly, which is why hybrid search exists.",
        },
      ],
      explainPrompt: "Explain to a junior engineer in 5 sentences how semantic search works, and why normalising vectors lets you use a dot product.",
      implementPrompt: "From memory: write a numpy function that takes an (N, d) matrix of unit vectors and a query vector and returns the indices of the top k by cosine similarity, in order, in O(N + k log k).",
      videos: [
        {
          title: "Cosine Similarity, Clearly Explained",
          channel: "StatQuest",
          url: "https://www.youtube.com/results?search_query=statquest+cosine+similarity+clearly+explained",
          kind: "search",
          reason: "Watch this if the angle-between-arrows idea or the formula in Level 4 feels shaky.",
        },
        {
          title: "Text embeddings and semantic search",
          channel: "James Briggs",
          url: "https://www.youtube.com/results?search_query=james+briggs+semantic+search+sentence+embeddings",
          kind: "search",
          reason: "Watch this for a hands-on walkthrough of building and evaluating an embedding search index.",
        },
      ],
    },
  },
];

export const labs: LabSeed[] = [
  {
    slug: "semantic-search-engine",
    title: "Build Your Own Semantic Search",
    week: 13,
    duration: "90m",
    minutes: 90,
    difficulty: "easy",
    domain: "ai",
    skills: ["embeddings", "vector-search", "python", "api-design"],
    prerequisites: ["Semantic search end-to-end", "Basic Python and numpy", "An embeddings API key (OpenAI, Gemini or Voyage)"],
    topicSlugs: ["semantic-search", "vector-databases-pgvector"],
    objective: "Build a tiny search engine that understands meaning instead of exact keywords: it should find the right document even when the query shares no words with it.",
    expectedOutput: "A CLI (python search.py \"your query\") that prints the top 3 documents with similarity scores in under a second after the first run, plus a note showing at least three paraphrased queries it gets right and one it gets wrong.",
    steps: [
      {
        title: "1. Create documents",
        detail: "Write 25 to 40 short documents (1 to 3 sentences each) across 4 or 5 topics you know: your projects (IdeaGuard, ZtudyLock, FabricNest), web dev concepts, cricket, cooking. Save them to docs.json as a list of {\"id\", \"text\"}. Deliberately include near-duplicates and topics that share vocabulary (\"Python the language\" vs \"python the snake\").",
      },
      {
        title: "2. Generate embeddings",
        detail: "Send all texts in a single batched request to your embeddings API. Convert the response into a float32 numpy array of shape (N, d). Print the shape and the norm of the first vector.",
      },
      {
        title: "3. Store vectors",
        detail: "Normalise each row to unit length and save with np.save(\"vectors.npy\", vecs). Store ids in the same order in ids.json. On startup, load from disk if both files exist and the document count matches; only call the API when docs change.",
      },
      {
        title: "4. Embed the query",
        detail: "Read the query from sys.argv, embed it with the same model, and normalise it. Add a guard that raises a clear error if the query vector's dimension does not match the stored matrix.",
      },
      {
        title: "5. Calculate similarity",
        detail: "Compute scores = vectors @ q (one matrix-vector product). Also compute a keyword-overlap score (fraction of query words present in the doc) so you can print both and see where they disagree.",
      },
      {
        title: "6. Return top results",
        detail: "Use np.argpartition to get the top 3, sort them, and print rank, score (3 decimals), id and text. Then run 8 test queries: 4 paraphrases, 2 exact-keyword queries, 1 negation (\"not about food\"), 1 nonsense string. Record which ones work.",
      },
    ],
    hints: [
      "If every score is between 0.2 and 0.5, that is normal for many modern embedding models. Rank matters more than absolute value.",
      "If results look random, check you normalised both sides and that you are not accidentally embedding the document ids instead of the text.",
      "np.argpartition(-scores, k - 1)[:k] gives the k highest; remember to sort those k afterwards.",
      "Cache embeddings keyed by the text's hash so editing one document only re-embeds that one.",
    ],
    stretch: "Add reranking: take the top 10 by cosine, then re-score each (query, doc) pair with a cross-encoder (sentence-transformers CrossEncoder with cross-encoder/ms-marco-MiniLM-L-6-v2) or an LLM that returns a 0-10 relevance score, and print how the order changes.",
    learned: [
      "How to batch, normalise and cache embeddings so search is cheap after the first run",
      "Why a dot product over unit vectors is cosine similarity, and how top-k selection works in O(N)",
      "Where embeddings beat keywords (paraphrase) and where they lose (exact codes, negation)",
      "What a realistic score distribution looks like for your embedding model",
    ],
    starter: {
      title: "search.py starter",
      lang: "python",
      code: `import json
import os
import sys
import numpy as np
import requests

MODEL = "text-embedding-3-small"

def embed(texts: list[str]) -> np.ndarray:
    r = requests.post(
        "https://api.openai.com/v1/embeddings",
        headers={"Authorization": "Bearer " + os.environ["OPENAI_API_KEY"]},
        json={"model": MODEL, "input": texts},
        timeout=30,
    )
    r.raise_for_status()
    v = np.array([d["embedding"] for d in r.json()["data"]], dtype=np.float32)
    return v / np.linalg.norm(v, axis=1, keepdims=True)

docs = json.load(open("docs.json", encoding="utf-8"))
if os.path.exists("vectors.npy"):
    vecs = np.load("vectors.npy")
else:
    vecs = embed([d["text"] for d in docs])
    np.save("vectors.npy", vecs)

query = " ".join(sys.argv[1:]) or "an app that helps students focus"
q = embed([query])[0]
scores = vecs @ q
top = np.argpartition(-scores, 2)[:3]
for rank, i in enumerate(top[np.argsort(-scores[top])], start=1):
    print(rank, f"{scores[i]:.3f}", docs[i]["id"], docs[i]["text"])`,
    },
  },
];
