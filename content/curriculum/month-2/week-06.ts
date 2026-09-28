import type { LabSeed, TopicSeed } from "../../types";

/**
 * Week 6 — Neural networks.
 * Arrays and shapes, the MLP, and backpropagation done by hand.
 */

export const topics: TopicSeed[] = [
  // ────────────────────────────────────────────────────────────────────────
  {
    slug: "numpy-for-ml",
    title: "NumPy: thinking in arrays",
    week: 6,
    domain: "ai",
    skills: ["python", "neural-networks"],
    difficulty: "easy",
    minutes: 60,
    summary: "Vectorisation, shapes, axes and broadcasting: the language every ML library (and every shape bug) is written in.",
    prerequisites: ["linear-logistic-regression"],
    tags: ["numpy", "broadcasting", "vectorisation", "shapes", "python"],
    lesson: {
      hook: `Last week you wrote gradient descent with Python list comprehensions. On 100 points it was instant. On the 1.8 million pixels of one batch of images it would take minutes per step.

The fix is not a faster loop. It is **no loop**: describe the operation on whole arrays and let NumPy run it in C, with SIMD instructions, over contiguous memory. That is typically 50 to 200 times faster.

But arrays bring a new class of bug. Subtract a shape \`(3, 1)\` array from a shape \`(3,)\` array and NumPy happily returns a \`(3, 3)\` matrix. No error. Your loss is just silently wrong.

PyTorch tensors behave exactly like NumPy arrays, so every hour you spend here pays back next week.`,
      whyItMatters:
        "Every model, embedding pipeline and eval script is array code. Fluency with shapes, axes and broadcasting is what lets you read Karpathy's code, debug a PyTorch shape error in seconds and write vectorised similarity search for Cortex.",
      levels: {
        l1: `A NumPy array is a grid of numbers of one type, stored tightly in memory. Instead of looping over each number yourself, you write one expression for the whole grid and NumPy does the looping in fast compiled code. The grid's **shape** tells you its dimensions, like (64 images, 784 pixels).`,
        l2: {
          analogy: `Think of Tailwind versus writing inline styles on every element. You do not style each button individually; you declare a rule once and it applies to all of them. Vectorised code is the same: \`X * 2\` states the rule once and it applies to every element.

**Broadcasting** is the rule that stretches a smaller array to match a bigger one without copying: subtracting a per-column mean \`(64,)\` from a data matrix \`(1797, 64)\` works because NumPy virtually repeats the mean for every row.`,
          text: `Broadcasting compares shapes **from the right**. Two dimensions are compatible if they are equal or one of them is 1. Missing leading dimensions count as 1.

- \`(1797, 64) - (64,)\` → \`(1797, 64)\`: subtract column means.
- \`(1797, 64) / (1797, 1)\` → \`(1797, 64)\`: divide each row by its own norm.
- \`(3, 1) - (3,)\` → \`(3, 3)\`: the silent bug. \`(3,)\` is treated as \`(1, 3)\`.

**axis** names the dimension that gets collapsed: \`X.sum(axis=0)\` on \`(1797, 64)\` returns \`(64,)\`, one sum per column.`,
          diagram: {
            type: "stack",
            title: "Broadcasting (1797, 64) - (64,)",
            layers: [
              { label: "X: shape (1797, 64)", note: "one row per image, one column per pixel" },
              { label: "mu: shape (64,)  →  treated as (1, 64)", note: "leading 1 added on the left" },
              { label: "(1, 64) stretched to (1797, 64)", note: "virtual repeat, stride 0, no copy", accent: true },
              { label: "Result: shape (1797, 64)", note: "every row has its column mean removed" },
            ],
          },
        },
        l3: {
          text: `The habits that matter:

1. **Write the shape next to every line** as a comment. Senior ML engineers genuinely do this.
2. **Replace loops with matrix products.** A batch of dot products is one \`@\`.
3. **Use keepdims=True** when you reduce and then combine with the original, so shapes stay aligned.
4. **Assert shapes** at function boundaries: \`assert preds.shape == y.shape\`.

The second snippet is the cosine-similarity search you will use in Cortex's retrieval: all queries against all documents in one line.`,
          code: [
            {
              title: "Loop vs vectorised, and the broadcasting bug",
              lang: "python",
              code: `import time
import numpy as np

rng = np.random.default_rng(0)
x = rng.normal(size=1_000_000)
w, b = 3.0, 2.0

t = time.perf_counter()
slow = [w * xi + b for xi in x]                  # Python loop
t_loop = time.perf_counter() - t

t = time.perf_counter()
fast = w * x + b                                 # one vectorised expression
t_vec = time.perf_counter() - t
print(f"loop {t_loop:.3f}s  vectorised {t_vec:.4f}s  speed-up {t_loop / t_vec:.0f}x")

# The silent broadcasting bug
y = np.array([1.0, 2.0, 3.0])                    # (3,)
preds = np.array([[1.1], [1.9], [3.2]])          # (3, 1), e.g. X @ W with W of shape (d, 1)
print((preds - y).shape)                         # (3, 3)  <- wrong, no error
print(np.mean((preds - y) ** 2))                 # a meaningless 'loss'
print(np.mean((preds.ravel() - y) ** 2))         # correct: 0.02`,
              note: "The last two lines differ by an order of magnitude. Always flatten or assert shapes before a loss.",
            },
            {
              title: "Batched cosine similarity: every query vs every document",
              lang: "python",
              code: `import numpy as np

rng = np.random.default_rng(0)
docs = rng.normal(size=(10_000, 384))     # 10k document embeddings, dim 384
queries = rng.normal(size=(5, 384))       # 5 queries

def normalise(a):
    return a / np.linalg.norm(a, axis=1, keepdims=True)   # (n, 384) / (n, 1)

sims = normalise(queries) @ normalise(docs).T   # (5, 384) @ (384, 10000) -> (5, 10000)
top3 = np.argsort(-sims, axis=1)[:, :3]         # (5, 3) best doc ids per query
print(sims.shape, top3.shape)
print(top3[0], sims[0, top3[0]].round(3))`,
              note: "This is exactly what a vector database does for small collections. Brute force over 10k x 384 takes milliseconds.",
            },
          ],
        },
        l4: {
          text: `**An array is a pointer plus metadata.** A NumPy array is one contiguous block of raw bytes plus a small header: \`dtype\`, \`shape\` and \`strides\` (how many bytes to jump to move one step along each axis). A \`(1797, 64)\` float64 array has strides \`(512, 8)\`: next row is 512 bytes away, next column is 8.

**Views, not copies.** Transpose, slicing and reshape (usually) just create a new header with different strides over the same memory. \`X.T\` is free; it swaps the strides. That is why modifying a slice modifies the original, and why \`.copy()\` exists. Broadcasting uses stride 0: "move along this axis without moving in memory".

**Why vectorised is fast.** Three things: the loop runs in C with no per-element Python object creation or type checks; contiguous memory is cache-friendly; and inner loops use SIMD instructions that process 4 to 8 floats per instruction. Matrix products go further and call BLAS (OpenBLAS or MKL), which tiles the computation for the CPU cache and uses all cores. \`A @ B\` for 1000x1000 matrices is a billion multiply-adds, done in tens of milliseconds.

**dtype matters.** float64 is NumPy's default; deep learning uses float32 (half the memory and bandwidth) or bfloat16. Mixing an int array into float maths silently upcasts; integer division on int arrays truncates. Check \`.dtype\` when a result looks off.`,
          code: [
            {
              title: "Strides, views and why transpose is free",
              lang: "python",
              code: `import numpy as np

X = np.arange(12, dtype=np.float64).reshape(3, 4)
print(X.shape, X.strides)       # (3, 4) (32, 8)
T = X.T
print(T.shape, T.strides)       # (4, 3) (8, 32)  same memory, swapped strides
print(np.shares_memory(X, T))   # True

row = X[1]                      # a view
row[:] = -1                     # modifies X too
print(X)

b = np.broadcast_to(np.array([1.0, 2.0, 3.0, 4.0]), (3, 4))
print(b.strides)                # (0, 8): stride 0 means 'repeat without copying'`,
            },
          ],
        },
        l5: {
          question: "Explain NumPy broadcasting and describe a real bug it can cause in a training script.",
          hint: "(n,) vs (n, 1).",
          answer: `Broadcasting lets NumPy combine arrays of different shapes by aligning shapes from the right and virtually stretching any dimension of size 1 (or any missing leading dimension) to match, using a stride of 0 so nothing is copied. It is what makes expressions like subtracting a per-feature mean from a data matrix a single line. The classic bug is a regression target y of shape (n,) and predictions of shape (n, 1), which is what X @ W gives when W has shape (d, 1). The subtraction preds - y broadcasts to (n, n), every prediction minus every target, and the mean of that is a meaningless number that still decreases a bit during training, so nothing crashes. I prevent it by asserting shapes at loss boundaries, keeping targets and predictions the same rank, and using keepdims=True on reductions. PyTorch has the same semantics and warns in some losses like MSELoss, but not in hand-written ones.`,
        },
      },
      commonMistakes: [
        "Mixing (n,) and (n, 1) arrays in one expression, producing an (n, n) result with no error.",
        "Reducing without keepdims and then dividing: X / X.sum(axis=1) fails or, worse, broadcasts along the wrong axis on a square matrix.",
        "Modifying a slice and being surprised the original array changed. Slices are views; call .copy() when you need independence.",
        "Using np.matrix or the * operator expecting matrix multiplication. * is element-wise; use @.",
      ],
      tryThis:
        "Make a (4, 4) matrix A and compute A / A.sum(axis=1) and A / A.sum(axis=1, keepdims=True). Check which one actually makes each row sum to 1. The first one runs without error: why is that dangerous?",
      miniTask: {
        title: "Vectorise the week-5 gradient descent",
        kind: "code",
        minutes: 30,
        steps: [
          "Run the loop-vs-vectorised snippet and write down the speed-up on your machine.",
          "Rewrite last week's pure-Python gradient descent for y = w*x + b using NumPy arrays only, no Python loops over examples.",
          "Generalise it to multiple features: X of shape (n, d), w of shape (d,), gradient X.T @ err * 2 / n. Add shape comments on every line.",
          "Add assert statements checking the shapes of preds, err and the gradient.",
          "Deliberately introduce the (n, 1) vs (n,) bug and confirm your assert catches it.",
        ],
        checklist: [
          "No Python for-loop over examples remains in the training step",
          "Every line has a shape comment",
          "The multi-feature version recovers known true weights on synthetic data",
          "My assert fires on the broadcasting bug instead of producing a silent wrong loss",
        ],
        deliverable: "gd_numpy.py: vectorised multi-feature linear regression with shape comments and assertions.",
      },
      quiz: [
        {
          q: "What is the shape of A - B when A has shape (5, 1) and B has shape (3,)?",
          options: ["(5, 3)", "(5, 1)", "Error: shapes incompatible", "(3, 5)"],
          answer: 0,
          explain: "B is treated as (1, 3). Aligning from the right: 1 vs 3 stretches to 3, 5 vs 1 stretches to 5. Result (5, 3).",
        },
        {
          q: "X has shape (1797, 64). What does X.mean(axis=0) return?",
          options: [
            "A (1797,) array: the mean of each row",
            "A (64,) array: the mean of each column",
            "A single number",
            "A (1, 64) array",
          ],
          answer: 1,
          explain: "axis=0 is the dimension that gets collapsed (the 1797 rows), leaving one mean per column. With keepdims=True it would be (1, 64).",
        },
        {
          q: "Why is X.T essentially free in NumPy even for a huge array?",
          options: [
            "NumPy transposes lazily in a background thread",
            "It returns a view with swapped strides over the same memory; no data is moved",
            "It uses the GPU",
            "It is cached from the last call",
          ],
          answer: 1,
          explain: "Transpose only rewrites the header: shape and strides are swapped. Data stays where it was until something needs a contiguous copy.",
        },
      ],
      explainPrompt:
        "Explain broadcasting to a junior engineer in 5 sentences, including the right-alignment rule and the (n,) vs (n, 1) trap.",
      implementPrompt:
        "From memory, write a vectorised function top_k(queries, docs, k) that returns the indices of the k most cosine-similar documents for each query, with shape comments.",
      videos: [
        {
          title: "NumPy broadcasting and vectorisation",
          channel: "mCoding / various",
          url: "https://www.youtube.com/results?search_query=numpy+broadcasting+explained+vectorization",
          kind: "search",
          reason: "Watch this if the right-alignment rule does not feel automatic yet; seeing shapes animated helps.",
        },
      ],
    },
  },

  // ────────────────────────────────────────────────────────────────────────
  {
    slug: "neural-networks-mlp",
    title: "Neurons to networks: the MLP",
    week: 6,
    domain: "ai",
    skills: ["neural-networks"],
    difficulty: "medium",
    minutes: 75,
    summary: "Stack logistic regressions with a non-linearity between them and you get a network that can learn curved boundaries.",
    prerequisites: ["linear-logistic-regression", "numpy-for-ml"],
    tags: ["mlp", "relu", "softmax", "activation-functions", "initialisation"],
    lesson: {
      hook: `Logistic regression draws one straight line. Now try to separate handwritten 3s from 8s using 64 pixel values. No single straight cut through 64-dimensional space does it well.

What if the first layer learned 128 different "detectors" (a loop at the top, a stroke on the left, a gap in the middle), and a second layer combined those detector outputs to decide the digit? That is a **multi-layer perceptron**: logistic regressions feeding logistic regressions.

There is one catch. Stack two linear layers without anything between them and the result collapses into a single linear layer. The magic ingredient is a tiny non-linear function between layers.

Every feed-forward block inside GPT is exactly this: Linear, non-linearity, Linear.`,
      whyItMatters:
        "The MLP is the basic unit of deep learning. Transformers are attention plus MLPs; the MLPs hold most of the parameters. Understanding shapes, activations and initialisation here makes every later architecture readable.",
      levels: {
        l1: `A neuron takes some numbers, multiplies each by a weight, adds them up and passes the total through a simple bend, like "if negative, output zero". A layer is many neurons looking at the same input. A network stacks layers, so later neurons build on the patterns earlier ones found, turning pixels into strokes into digits.`,
        l2: {
          analogy: `A hiring pipeline. The first round has 128 screeners, each checking one narrow thing on a CV and giving a score (zero if it is not there at all). The final panel of 10 does not read CVs; it reads the 128 screener scores and decides. Nobody told the screeners what to look for: training discovers which checks are useful for the final decision.`,
          text: `For a batch of B digit images with 64 pixels each, a 2-layer MLP is:

- \`z1 = X @ W1 + b1\` — \`(B, 64) @ (64, 128) + (128,)\` → \`(B, 128)\`
- \`h = relu(z1)\` — element-wise \`max(0, z)\`
- \`logits = h @ W2 + b2\` — \`(B, 128) @ (128, 10) + (10,)\` → \`(B, 10)\`
- \`probs = softmax(logits)\` — each row sums to 1

**Why the non-linearity?** Without it, \`(X @ W1) @ W2 = X @ (W1 @ W2)\`: a single linear map. ReLU lets the network bend space, and with enough hidden units it can approximate any reasonable function (the universal approximation theorem).`,
          diagram: {
            type: "stack",
            title: "2-layer MLP on 8x8 digits",
            layers: [
              { label: "Input X", note: "(B, 64) pixels scaled to 0..1" },
              { label: "Linear W1, b1", note: "(64, 128) + (128,) → (B, 128)" },
              { label: "ReLU", note: "max(0, z): the non-linearity", accent: true },
              { label: "Linear W2, b2", note: "(128, 10) + (10,) → logits (B, 10)" },
              { label: "Softmax + cross-entropy", note: "probabilities over 10 digits, loss = -log p_true" },
            ],
          },
        },
        l3: {
          text: `Below is a complete forward pass on scikit-learn's digits dataset (1797 images, 8x8 pixels). The network is untrained, which makes it a perfect sanity check:

- **Parameter count**: \`64*128 + 128 + 128*10 + 10 = 9,610\`.
- **Initial loss should be about ln(10) ≈ 2.303.** A network that knows nothing should give each of 10 classes about 10%, and \`-log(0.1) = 2.303\`. If your initial loss is 15, your initialisation is wrong before you train a single step. Karpathy calls this the single most useful check in deep learning.

Choosing activations: **ReLU** is the default for hidden layers (cheap, does not saturate for positive inputs). **GELU** is the smooth cousin used in GPT and BERT. Sigmoid and tanh saturate at both ends, so gradients vanish in deep stacks; keep sigmoid for binary outputs only.`,
          code: [
            {
              title: "Forward pass and the ln(10) sanity check",
              lang: "python",
              code: `import numpy as np
from sklearn.datasets import load_digits

X, y = load_digits(return_X_y=True)      # X: (1797, 64) pixel values 0..16, y: (1797,)
X = X / 16.0                             # scale to 0..1
rng = np.random.default_rng(0)
D, H, C = 64, 128, 10

W1 = rng.normal(0, np.sqrt(2 / D), size=(D, H))   # He init for ReLU layers
b1 = np.zeros(H)
W2 = rng.normal(0, np.sqrt(1 / H), size=(H, C)) * 0.1   # small output layer -> near-uniform probs
b2 = np.zeros(C)

def forward(Xb):
    h = np.maximum(0, Xb @ W1 + b1)                # (B, 128)
    logits = h @ W2 + b2                           # (B, 10)
    logits = logits - logits.max(axis=1, keepdims=True)   # stability: softmax is shift-invariant
    e = np.exp(logits)
    return e / e.sum(axis=1, keepdims=True)        # (B, 10), rows sum to 1

B = 32
probs = forward(X[:B])
loss = -np.log(probs[np.arange(B), y[:B]]).mean()  # cross-entropy: -log p(true class)
n_params = W1.size + b1.size + W2.size + b2.size
print(probs.shape, "params:", n_params)
print(f"initial loss {loss:.3f}  vs ln(10) = {np.log(10):.3f}")`,
              note: "probs[np.arange(B), y] is fancy indexing: for each row i it picks column y[i], the probability assigned to the true class.",
            },
          ],
        },
        l4: {
          text: `**Softmax must be computed stably.** \`e^z\` overflows float64 at z ≈ 710 and float32 at z ≈ 89. Because \`softmax(z) = softmax(z - c)\` for any constant c, subtract the row max first: the largest exponent becomes \`e^0 = 1\`. For the loss, go further and use **log-softmax**: \`log p_k = z_k - logsumexp(z)\`, which never takes the log of a number that underflowed to 0. This is what \`torch.nn.CrossEntropyLoss\` does internally, which is why it takes raw logits.

**Initialisation controls signal size.** Each hidden unit sums D inputs. If weights have variance \`v\`, the output variance is roughly \`D * v * Var(x)\`. Too big and activations explode layer after layer; too small and they shrink to zero, and so do the gradients. **Xavier/Glorot** (\`v = 1/D\`, for tanh) and **He/Kaiming** (\`v = 2/D\`, for ReLU, the 2 compensates for ReLU zeroing half the inputs) keep the variance roughly constant through depth. PyTorch's \`nn.Linear\` uses a Kaiming-uniform variant by default.

**Dead ReLUs.** If a unit's pre-activation is negative for every input, its gradient is always 0 and it never recovers. A too-high learning rate can kill a large fraction of units in one step. Check the fraction of units that are zero across a whole batch.

**Why depth instead of one huge layer?** Universal approximation says one wide hidden layer suffices in principle, but may need exponentially many units. Depth composes features (edges → strokes → digits) and is vastly more parameter-efficient for structured data.`,
          code: [
            {
              title: "Naive vs stable softmax",
              lang: "python",
              variant: "bad",
              code: `import numpy as np

z = np.array([1000.0, 1001.0, 1002.0])
p = np.exp(z) / np.exp(z).sum()
print(p)          # [nan nan nan] plus an overflow warning`,
            },
            {
              title: "Subtract the max; use log-sum-exp for the loss",
              lang: "python",
              variant: "good",
              code: `import numpy as np

z = np.array([1000.0, 1001.0, 1002.0])
shifted = z - z.max()
p = np.exp(shifted) / np.exp(shifted).sum()
print(p.round(4))                                     # [0.09 0.2447 0.6652]

log_p = shifted - np.log(np.exp(shifted).sum())       # log-softmax
print(-log_p[2])                                      # loss if class 2 is correct: 0.4076`,
            },
          ],
        },
        l5: {
          question: "Why do neural networks need non-linear activation functions, and why is ReLU usually preferred over sigmoid in hidden layers?",
          hint: "Compose two linear maps. Then look at the derivative of sigmoid far from zero.",
          answer: `Without a non-linearity, stacking layers is pointless: W2(W1 x + b1) + b2 is just another affine function, so a 50-layer network has the expressive power of logistic regression. A non-linearity between layers lets the network carve curved decision boundaries and, with enough units, approximate essentially any continuous function. Sigmoid works in principle, but its derivative is at most 0.25 and near zero once inputs are large in magnitude, so gradients shrink multiplicatively through each layer and deep networks barely train: the vanishing gradient problem. ReLU has derivative exactly 1 for positive inputs, so gradients pass through unchanged, and it is a single max operation, which is cheap. Its drawback is dead units that output zero for every input, which is why variants like Leaky ReLU and smooth ones like GELU (used in transformers) exist. Sigmoid remains the right choice for a binary output probability, not for hidden layers.`,
        },
      },
      commonMistakes: [
        "Forgetting the non-linearity between layers. The network trains, but no better than logistic regression.",
        "Applying softmax yourself and then feeding the probabilities into a loss that expects logits (PyTorch's CrossEntropyLoss). You get a double softmax and slow, poor training.",
        "Initialising weights with a standard normal (std 1) for a 784-input layer. Activations are huge, softmax saturates and the initial loss is far above ln(C).",
        "Not scaling inputs. Raw 0-255 pixels make the first layer's pre-activations enormous.",
      ],
      tryThis:
        "In the forward-pass snippet, remove the * 0.1 on W2 and change W1 to rng.normal(0, 1, ...). Rerun and compare the initial loss to ln(10). Then check what fraction of hidden units are exactly 0 for the batch.",
      miniTask: {
        title: "Build and sanity-check an MLP forward pass",
        kind: "code",
        minutes: 35,
        steps: [
          "Run the forward-pass snippet and confirm the parameter count is 9,610 and the initial loss is close to 2.303.",
          "Compute accuracy of the untrained network on all 1797 images (argmax of probs vs y). It should be about 10%.",
          "Change H to 256 and add a second hidden layer of 64 units. Predict the new parameter count by hand first, then verify in code.",
          "Replace the stable softmax with the naive one, feed it logits multiplied by 1000, and observe the NaN.",
          "Write down, in your own words, why two stacked linear layers without ReLU equal one linear layer.",
        ],
        checklist: [
          "Initial loss within 0.1 of ln(10)",
          "My hand-computed parameter count for the deeper network matches the code",
          "Untrained accuracy is near chance (about 0.1)",
          "I reproduced the softmax overflow and fixed it with the max-subtraction trick",
        ],
        deliverable: "mlp_forward.py with parameter count, initial loss and untrained accuracy printed for both architectures.",
      },
      quiz: [
        {
          q: "An MLP has layers 784 → 256 → 10 (with biases). How many parameters?",
          options: ["203,530", "200,960", "203,264", "2,570"],
          answer: 0,
          explain: "784*256 + 256 = 200,960 for layer 1; 256*10 + 10 = 2,570 for layer 2; total 203,530.",
        },
        {
          q: "Your untrained 10-class network's first loss is 2.30. What does that tell you?",
          options: [
            "Training has already converged",
            "Initialisation is sensible: predictions are roughly uniform, -log(1/10) ≈ 2.30",
            "The learning rate is too high",
            "The labels are wrong",
          ],
          answer: 1,
          explain: "A network that knows nothing should spread probability evenly. A much higher initial loss means it is confidently wrong from the start, usually a bad init.",
        },
        {
          q: "Why subtract the row maximum from logits before exponentiating in softmax?",
          options: [
            "It changes the probabilities to be more calibrated",
            "It avoids overflow; softmax is unchanged by adding a constant to all logits",
            "It makes gradients larger",
            "It is required for ReLU networks only",
          ],
          answer: 1,
          explain: "e^(z-c) / sum e^(z-c) = e^z / sum e^z. After shifting, the largest exponent is e^0 = 1, so nothing overflows.",
        },
      ],
      explainPrompt:
        "Explain to a junior engineer in 5 sentences what a 2-layer MLP computes, with shapes, and why the ReLU between the layers matters.",
      implementPrompt:
        "From memory, write a NumPy forward pass for a 64 → 128 → 10 MLP with He initialisation, stable softmax and cross-entropy loss, and verify the initial loss is near ln(10).",
      videos: [
        {
          title: "But what is a neural network?",
          channel: "3Blue1Brown",
          url: "https://www.youtube.com/watch?v=aircAruvnKk",
          kind: "video",
          minutes: 19,
          reason: "Watch this first: the clearest picture of layers, weights, biases and 'what the hidden units might be detecting' on digit images.",
        },
      ],
    },
  },

  // ────────────────────────────────────────────────────────────────────────
  {
    slug: "backpropagation",
    title: "Backpropagation, by hand",
    week: 6,
    domain: "ai",
    skills: ["backpropagation"],
    difficulty: "hard",
    minutes: 90,
    summary: "The chain rule, applied backwards through a graph, gives the gradient of the loss with respect to every weight in one pass.",
    prerequisites: ["neural-networks-mlp", "how-machines-learn"],
    tags: ["backprop", "chain-rule", "autograd", "micrograd", "computational-graph"],
    lesson: {
      hook: `Gradient descent needs \`dLoss/dw\` for every weight. For your line that was two formulas. GPT-3 has 175 billion weights.

Deriving 175 billion formulas by hand is impossible. Estimating each one numerically (nudge the weight, rerun the whole network) would cost 175 billion forward passes per step.

**Backpropagation** gets all of them in roughly the cost of **two** forward passes. It is not a special neural-network trick. It is the chain rule from school, applied in the right order and with caching.

Once you have written it by hand once, PyTorch's \`loss.backward()\` stops being magic forever. That is the goal today.`,
      whyItMatters:
        "Backprop is how every model you use was trained. Understanding it lets you reason about vanishing gradients, why residual connections and normalisation exist, why memory usage doubles in training, and what autograd errors actually mean.",
      levels: {
        l1: `The loss depends on the output, which depends on the last layer, which depends on the layer before, and so on. Backpropagation starts at the loss and walks backwards, asking each step "how much did you affect the thing after you?". Multiplying those local answers along the path tells every weight how much it affected the final loss.`,
        l2: {
          analogy: `A FabricNest order arrives late. The customer complains to delivery. Delivery says "I was 2 days late, but half of that was the warehouse handing it over late." The warehouse says "and 80% of my delay was the supplier". Blame flows backwards, each step multiplying by its own local share. Every party learns how much of the final complaint was theirs, in one backward walk, without replaying the whole order.`,
          text: `Treat the computation as a graph of simple operations. Each node knows only its **local derivative** (how its output changes with each input). The chain rule says:

\`dL/d(input) = dL/d(output) × d(output)/d(input)\`

So you run the graph forwards, caching intermediate values, then walk it in reverse, multiplying the incoming gradient by the local derivative and passing it on. When a value feeds into several places, its gradients **add up**.

Local rules you need: add passes gradient through unchanged; multiply swaps (\`d(a*b)/da = b\`); \`tanh\` gives \`1 - tanh^2\`; ReLU passes gradient where input > 0, blocks it otherwise.`,
          diagram: {
            type: "flow",
            title: "One neuron: forward values, backward gradients",
            lanes: [
              {
                label: "Forward",
                tone: "neutral",
                steps: [
                  { label: "x=2, w=-3", note: "inputs" },
                  { label: "x*w = -6", note: "multiply" },
                  { label: "+ b(6.88) = 0.88", note: "add" },
                  { label: "tanh → 0.706", note: "output / loss", accent: true },
                ],
              },
              {
                label: "Backward",
                tone: "good",
                steps: [
                  { label: "dout = 1", note: "seed" },
                  { label: "dn = 1 - 0.706^2 = 0.50", note: "tanh local" },
                  { label: "db = 0.50, d(xw) = 0.50", note: "add passes through" },
                  { label: "dw = x*0.50 = 1.0, dx = w*0.50 = -1.5", note: "multiply swaps", accent: true },
                ],
              },
            ],
          },
        },
        l3: {
          text: `The code below is a tiny scalar autograd engine in the spirit of Karpathy's **micrograd**. Each \`Value\` remembers its inputs and a closure that pushes its gradient to them. \`backward()\` topologically sorts the graph so each node's gradient is complete before it is propagated further.

Note the \`+=\`: if a value is used twice (\`a * a\`, or a weight shared across examples), both paths contribute. Overwriting instead of accumulating is the most common backprop bug.

It reproduces the numbers in the diagram. Watch Karpathy's video after writing this yourself; it will land completely differently.`,
          code: [
            {
              title: "micrograd-style Value with reverse-mode autodiff",
              lang: "python",
              code: `import math

class Value:
    def __init__(self, data, children=()):
        self.data, self.grad = data, 0.0
        self._prev, self._backward = children, lambda: None

    def __add__(self, other):
        out = Value(self.data + other.data, (self, other))
        def _backward():
            self.grad += out.grad                  # d(a+b)/da = 1
            other.grad += out.grad
        out._backward = _backward
        return out

    def __mul__(self, other):
        out = Value(self.data * other.data, (self, other))
        def _backward():
            self.grad += other.data * out.grad     # d(a*b)/da = b
            other.grad += self.data * out.grad
        out._backward = _backward
        return out

    def tanh(self):
        t = math.tanh(self.data)
        out = Value(t, (self,))
        def _backward():
            self.grad += (1 - t * t) * out.grad    # d tanh(x)/dx = 1 - tanh(x)^2
        out._backward = _backward
        return out

    def backward(self):
        order, seen = [], set()
        def visit(v):                              # topological sort
            if v not in seen:
                seen.add(v)
                for child in v._prev:
                    visit(child)
                order.append(v)
        visit(self)
        self.grad = 1.0
        for v in reversed(order):
            v._backward()

x, w, b = Value(2.0), Value(-3.0), Value(6.88)
out = (x * w + b).tanh()
out.backward()
print(f"out={out.data:.4f}  dw={w.grad:.4f}  dx={x.grad:.4f}  db={b.grad:.4f}")`,
              note: "Expected: out=0.7064  dw=1.0019  dx=-1.5029  db=0.5010.",
            },
          ],
        },
        l4: {
          text: `Real networks do backprop on **matrices**, not scalars. For the MLP from the last lesson (\`z1 = X W1 + b1\`, \`h = relu(z1)\`, \`logits = h W2 + b2\`, softmax + cross-entropy averaged over B examples):

- \`dlogits = (probs - onehot(y)) / B\` — shape \`(B, C)\`. The same \`p - y\` from logistic regression.
- \`dW2 = h.T @ dlogits\` — \`(H, B) @ (B, C)\` → \`(H, C)\`, same shape as W2.
- \`db2 = dlogits.sum(axis=0)\` — the bias was broadcast over the batch, so its gradient sums over the batch.
- \`dh = dlogits @ W2.T\` — \`(B, C) @ (C, H)\` → \`(B, H)\`.
- \`dz1 = dh * (z1 > 0)\` — ReLU gate.
- \`dW1 = X.T @ dz1\`, \`db1 = dz1.sum(axis=0)\`.

**Shape rule of thumb**: the gradient of a parameter always has the parameter's shape, and for \`Y = X W\` it is \`dW = X.T @ dY\` and \`dX = dY @ W.T\`. If you know the shapes, there is only one way to multiply them that works.

**Why it is efficient.** This is *reverse-mode* automatic differentiation. With one scalar output (the loss) and N parameters, one backward pass computes all N gradients for a cost of a small constant multiple of the forward pass. Forward-mode would need N passes. The price is **memory**: every intermediate activation from the forward pass must be kept for the backward pass, which is why training needs far more GPU memory than inference, and why tricks like gradient checkpointing (recompute instead of store) exist.

**Vanishing and exploding gradients** fall straight out of this: the gradient at layer 1 is a product of many local Jacobians. If their magnitudes are consistently below 1 it shrinks exponentially with depth; above 1 it explodes. Residual connections (\`x + f(x)\`, gradient of the identity path is exactly 1) and normalisation layers exist to keep that product near 1.`,
          code: [
            {
              title: "Matrix backprop for a 2-layer MLP, with a gradient check",
              lang: "python",
              code: `import numpy as np

rng = np.random.default_rng(0)
B, D, H, C = 4, 5, 8, 3
X, y = rng.normal(size=(B, D)), rng.integers(0, C, size=B)
W1, b1 = rng.normal(size=(D, H)) * 0.5, np.zeros(H)
W2, b2 = rng.normal(size=(H, C)) * 0.5, np.zeros(C)

def forward(W1):
    z1 = X @ W1 + b1                                   # (B, H)
    h = np.maximum(z1, 0)                              # (B, H)
    logits = h @ W2 + b2                               # (B, C)
    logits = logits - logits.max(axis=1, keepdims=True)
    probs = np.exp(logits) / np.exp(logits).sum(axis=1, keepdims=True)
    return -np.log(probs[np.arange(B), y]).mean(), z1, h, probs

loss, z1, h, probs = forward(W1)
dlogits = probs.copy()
dlogits[np.arange(B), y] -= 1
dlogits /= B                                           # (B, C)
dW2, db2 = h.T @ dlogits, dlogits.sum(axis=0)          # (H, C), (C,)
dh = dlogits @ W2.T                                    # (B, H)
dz1 = dh * (z1 > 0)                                    # ReLU gate
dW1, db1 = X.T @ dz1, dz1.sum(axis=0)                  # (D, H), (H,)

eps, i, j = 1e-5, 1, 2                                 # numerically check one entry of W1
Wp, Wm = W1.copy(), W1.copy()
Wp[i, j] += eps
Wm[i, j] -= eps
numeric = (forward(Wp)[0] - forward(Wm)[0]) / (2 * eps)
print(f"analytic {dW1[i, j]:.8f}  numeric {numeric:.8f}")`,
              note: "Check every parameter in a real implementation, not just one entry. Relative error below 1e-6 means your backprop is right.",
            },
          ],
        },
        l5: {
          question: "Why is backpropagation so much cheaper than computing each weight's gradient separately, and what does it cost you in exchange?",
          hint: "Forward-mode vs reverse-mode, and what must be stored between the two passes.",
          answer: `Backprop is reverse-mode automatic differentiation. The loss is a single scalar, so if you start at the loss and apply the chain rule backwards, each intermediate gradient dL/dnode is computed once and reused by everything upstream of it, and one backward pass yields the gradient for every parameter at a cost of roughly one to two forward passes. Computing each partial separately, by finite differences or forward-mode differentiation, costs a full pass per parameter, which is hopeless with millions or billions of weights. The trade-off is memory: the backward pass needs the intermediate activations from the forward pass, such as the ReLU inputs and softmax outputs, so they all have to be stored, and activation memory grows with batch size, sequence length and depth. That is why training needs far more memory than inference, and why techniques like gradient checkpointing recompute some activations during the backward pass to trade compute for memory. It also explains vanishing and exploding gradients, since the gradient at early layers is a long product of local derivatives.`,
        },
      },
      commonMistakes: [
        "Overwriting gradients (grad = ...) instead of accumulating (grad += ...) when a value feeds several downstream nodes.",
        "Forgetting to divide by the batch size in dlogits when the loss is a mean, so gradients scale with batch size.",
        "Getting the transpose wrong: dW = dY @ X instead of X.T @ dY. Let the shapes force the answer.",
        "Skipping the gradient check. A buggy backward pass often still reduces the loss a little, which hides the bug for days.",
      ],
      tryThis:
        "In the micrograd snippet, compute out = (x * x).tanh() instead, so x is used twice. Change += to = inside __mul__'s backward and see the gradient come out wrong. Then change it back.",
      miniTask: {
        title: "Backprop a neuron on paper, then in code",
        kind: "code",
        minutes: 40,
        steps: [
          "On paper, run the forward pass for tanh(x*w + b) with x=2, w=-3, b=6.88 and write every intermediate value.",
          "On paper, run the backward pass: compute dout/dn, then db, dw and dx, using the local rules. Round to 3 decimals.",
          "Type in the Value class and confirm the printed gradients match your paper answers.",
          "Add __sub__ (via add and multiply by -1) and a relu() method with correct backward functions.",
          "Run the matrix backprop snippet and extend the gradient check to loop over every entry of W1 and W2, reporting the maximum relative error.",
        ],
        checklist: [
          "My paper gradients match the code to 3 decimals",
          "relu() backward passes gradient only where the input was positive",
          "The max relative error across all W1 and W2 entries is below 1e-6",
          "I can write dW = X.T @ dY and dX = dY @ W.T from shapes alone",
        ],
        deliverable: "A photo or scan of the paper derivation plus backprop.py with the extended Value class and the full gradient check.",
      },
      quiz: [
        {
          q: "For a layer Y = X @ W with X of shape (B, D) and W of shape (D, H), what is dL/dW given dL/dY of shape (B, H)?",
          options: ["dY @ X.T", "X.T @ dY", "X @ dY.T", "dY.T @ X"],
          answer: 1,
          explain: "dW must have W's shape (D, H). Only X.T (D, B) @ dY (B, H) produces (D, H).",
        },
        {
          q: "In a computational graph, a value a is used in two places. How is its gradient computed?",
          options: [
            "Take the gradient from the last place it is used",
            "Average the two incoming gradients",
            "Sum the gradients coming from both uses",
            "Multiply the two incoming gradients",
          ],
          answer: 2,
          explain: "The multivariable chain rule sums contributions over all paths from a to the loss. That is why autograd engines accumulate with +=.",
        },
        {
          q: "Why does training a network need much more memory than running inference with it?",
          options: [
            "Optimisers store a copy of the dataset",
            "Backprop needs the intermediate activations from the forward pass, so they must be kept until the backward pass",
            "Weights are stored twice during training",
            "Gradients are always stored in float64",
          ],
          answer: 1,
          explain: "Local derivatives such as the ReLU mask or the tanh output depend on forward values. Inference can discard them immediately; training cannot.",
        },
      ],
      explainPrompt:
        "Explain backpropagation to a junior engineer in 5 sentences using the late-delivery blame analogy. Mention local derivatives, the chain rule and why gradients accumulate.",
      implementPrompt:
        "From memory, write the backward pass for a 2-layer ReLU MLP with softmax cross-entropy (dlogits through dW1), with a shape comment on every line, and verify one entry with a numerical gradient.",
      videos: [
        {
          title: "The spelled-out intro to neural networks and backpropagation (micrograd)",
          channel: "Andrej Karpathy",
          url: "https://www.youtube.com/watch?v=VMj-3S1tku0",
          kind: "video",
          minutes: 145,
          reason: "The best backprop resource that exists. Watch it in two sittings, coding along; do the paper exercise first so you can predict each gradient before he computes it.",
        },
        {
          title: "Backpropagation, intuitively",
          channel: "3Blue1Brown",
          url: "https://www.youtube.com/watch?v=Ilg3gGewQ5U",
          kind: "video",
          minutes: 13,
          reason: "Watch this before Karpathy if you want the intuition of 'which nudges to which weights matter most' in 13 minutes.",
        },
      ],
    },
  },
];

export const labs: LabSeed[] = [
  {
    slug: "mlp-from-scratch-numpy",
    title: "An MLP from scratch in NumPy",
    week: 6,
    duration: "3h",
    minutes: 180,
    difficulty: "hard",
    domain: "ai",
    skills: ["neural-networks", "backpropagation", "python"],
    prerequisites: ["NumPy: thinking in arrays", "Neurons to networks: the MLP", "Backpropagation, by hand"],
    topicSlugs: ["numpy-for-ml", "neural-networks-mlp", "backpropagation"],
    objective:
      "Train a 2-layer MLP on scikit-learn's handwritten digits using only NumPy, with a hand-written backward pass verified by a gradient check, and reach over 90% test accuracy.",
    expectedOutput:
      "A script that prints a gradient-check relative error below 1e-6, then per-epoch train loss and test accuracy, finishing above 0.90 test accuracy (0.95 to 0.97 is typical), plus a saved plot of loss and accuracy per epoch.",
    steps: [
      {
        title: "Load, scale and split the data",
        detail:
          "load_digits gives X (1797, 64) with values 0..16 and y (1797,). Divide X by 16. Use train_test_split with test_size=0.2, stratify=y, random_state=0. Print shapes and class counts to confirm the split is balanced.",
      },
      {
        title: "Initialise parameters",
        detail:
          "64 → 128 → 10. W1 ~ N(0, sqrt(2/64)) (He init), W2 ~ N(0, sqrt(1/128)) scaled by 0.1, biases zero. Keep them in a dict params = {'W1': ..., 'b1': ..., 'W2': ..., 'b2': ...} so updates and checks can loop over keys.",
      },
      {
        title: "Forward pass with a cache",
        detail:
          "forward(X, params) returns (loss, cache) where cache holds X, z1, h and probs. Use the stable softmax and mean cross-entropy. Verify the untrained loss is about 2.30 before going further.",
      },
      {
        title: "Backward pass",
        detail:
          "backward(cache, y, params) returns grads with exactly the same keys and shapes as params. Follow dlogits = (probs - onehot) / B, dW2 = h.T @ dlogits, db2 = sum over batch, dh = dlogits @ W2.T, dz1 = dh * (z1 > 0), dW1 = X.T @ dz1, db1 = sum over batch. Assert grads[k].shape == params[k].shape for every k.",
      },
      {
        title: "Gradient check on a tiny batch",
        detail:
          "On 5 examples, compare every analytic gradient entry with a central-difference estimate (eps=1e-5). Report max relative error |a - n| / max(1e-8, |a| + |n|). Do not train until it is below 1e-6.",
      },
      {
        title: "Mini-batch training loop",
        detail:
          "For 30 epochs: shuffle indices with rng.permutation, iterate batches of 64, run forward, backward, and params[k] -= lr * grads[k] with lr = 0.1 to 0.5. After each epoch compute full train loss and test accuracy (argmax of probs). Record both.",
      },
      {
        title: "Plot and inspect errors",
        detail:
          "Plot loss and test accuracy per epoch. Then find 8 misclassified test images, reshape to 8x8 and show them with predicted and true labels. Note which digits get confused.",
      },
    ],
    hints: [
      "If loss goes to nan, check that you subtract the row max before exp, and lower the learning rate.",
      "onehot can be built with np.eye(10)[y], shape (B, 10).",
      "If accuracy is stuck near 10%, your gradient signs or the dlogits division are likely wrong; the gradient check will tell you which.",
      "Evaluate test accuracy with the full test set in one forward pass; no batching needed at this size.",
    ],
    stretch:
      "Add momentum (v = 0.9 * v - lr * g; p += v) and L2 weight decay, and compare curves. Then replace the Python dict of parameters with your extended micrograd Value class for a single example and confirm the gradients agree with your matrix backprop.",
    learned: [
      "Implementing forward and backward passes for an MLP with correct shapes",
      "Verifying backprop with numerical gradient checking",
      "Writing a mini-batch SGD training loop from first principles",
      "Reading errors from a model by looking at misclassified examples",
    ],
    starter: {
      title: "mlp_numpy.py starter",
      lang: "python",
      code: `import numpy as np
from sklearn.datasets import load_digits
from sklearn.model_selection import train_test_split

X, y = load_digits(return_X_y=True)
X = X / 16.0
X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, stratify=y, random_state=0)
rng = np.random.default_rng(0)

params = {
    "W1": rng.normal(0, np.sqrt(2 / 64), size=(64, 128)),
    "b1": np.zeros(128),
    "W2": rng.normal(0, np.sqrt(1 / 128), size=(128, 10)) * 0.1,
    "b2": np.zeros(10),
}

def forward(Xb, yb, p):
    z1 = Xb @ p["W1"] + p["b1"]
    h = np.maximum(z1, 0)
    logits = h @ p["W2"] + p["b2"]
    logits = logits - logits.max(axis=1, keepdims=True)
    probs = np.exp(logits) / np.exp(logits).sum(axis=1, keepdims=True)
    loss = -np.log(probs[np.arange(len(yb)), yb]).mean()
    return loss, (Xb, z1, h, probs)

def backward(cache, yb, p):
    # TODO: return a dict with keys W1, b1, W2, b2 and the same shapes as p
    raise NotImplementedError

loss, _ = forward(X_tr, y_tr, params)
print(f"untrained loss {loss:.3f} (expect about 2.303)")`,
      note: "Implement backward, the gradient check and the training loop.",
    },
  },
];
