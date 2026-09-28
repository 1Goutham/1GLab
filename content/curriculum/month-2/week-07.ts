import type { LabSeed, TopicSeed } from "../../types";

/**
 * Week 7 — PyTorch.
 * Tensors and autograd, the canonical training loop, and generalisation.
 */

export const topics: TopicSeed[] = [
  // ────────────────────────────────────────────────────────────────────────
  {
    slug: "pytorch-tensors-autograd",
    title: "PyTorch tensors & autograd",
    week: 7,
    domain: "ai",
    skills: ["pytorch"],
    difficulty: "medium",
    minutes: 70,
    summary: "Tensors are NumPy arrays that can live on a GPU and remember how they were computed, so loss.backward() does last week's backprop for you.",
    prerequisites: ["numpy-for-ml", "backpropagation"],
    tags: ["pytorch", "tensors", "autograd", "requires-grad", "gpu"],
    lesson: {
      hook: `Last week you wrote the backward pass for a two-layer MLP by hand: seven lines of careful shape-matching and a gradient check. Now imagine doing that for a transformer with attention, layer norm and 96 layers.

PyTorch's deal is simple: write only the forward pass, in code that looks almost exactly like NumPy, and it builds the computational graph as you go. Call \`loss.backward()\` and it runs the same reverse-mode chain rule you implemented in micrograd, on every tensor that asked for gradients.

That is genuinely all autograd is. You already built a tiny one. Today you learn the full-size version and its sharp edges.`,
      whyItMatters:
        "PyTorch is the language of modern AI: every open model on Hugging Face, every fine-tuning script and most research code. Reading and writing it fluently is non-negotiable for an AI engineer who goes beyond API calls.",
      levels: {
        l1: `A tensor is PyTorch's version of a NumPy array: a grid of numbers with a shape. The difference is that it can live on a graphics card for speed, and if you ask it to, it keeps a record of every calculation done with it. Later, one call walks that record backwards and fills in the gradient for every number that needs one.`,
        l2: {
          analogy: `Git for maths. With \`requires_grad=True\`, every operation on a tensor is committed to a history (the graph), each commit knowing its parent and how to undo its own effect on a gradient. \`loss.backward()\` walks the log from HEAD back to the root commits (your parameters), and deposits a gradient on each. After the walk, the history is discarded; the next forward pass writes a fresh one. That is why PyTorch is called **define-by-run**: the graph is whatever your Python code actually did this time, ifs and loops included.`,
          text: `Key vocabulary:

- **Leaf tensor**: created by you, e.g. parameters with \`requires_grad=True\`. Gradients land in \`.grad\` on leaves only.
- **grad_fn**: every non-leaf result stores the backward function that made it (\`MulBackward0\`, \`AddmmBackward0\`...).
- **backward()**: from a scalar, runs reverse-mode autodiff and **adds** into each leaf's \`.grad\`.
- **torch.no_grad()**: stop recording; use for parameter updates and evaluation.
- **.detach()**: a tensor sharing the data but cut from the graph.
- **device**: \`"cpu"\`, \`"cuda"\` or \`"mps"\` (Apple Silicon). All tensors in one operation must be on the same device.`,
          diagram: {
            type: "flow",
            title: "What loss.backward() walks",
            lanes: [
              {
                label: "Forward (recorded)",
                tone: "neutral",
                steps: [
                  { label: "w, b (leaves)", note: "requires_grad=True" },
                  { label: "w * x", note: "grad_fn=MulBackward0" },
                  { label: "+ b - y, ** 2", note: "AddBackward0, PowBackward0" },
                  { label: "mean() → loss", note: "grad_fn=MeanBackward0", accent: true },
                ],
              },
              {
                label: "Backward (loss.backward())",
                tone: "good",
                steps: [
                  { label: "dloss = 1", note: "seed at the scalar" },
                  { label: "through Mean, Pow, Add", note: "each grad_fn applies its local rule" },
                  { label: "through Mul", note: "d(w*x)/dw = x" },
                  { label: "w.grad, b.grad += ...", note: "accumulated on leaves", accent: true },
                ],
              },
            ],
          },
        },
        l3: {
          text: `Here is week 5's gradient descent rewritten with autograd. Compare it line by line with your pure-Python version: the two derivative formulas are gone.

Three details carry the whole lesson:

1. The update happens inside \`torch.no_grad()\`. Otherwise PyTorch would record "w minus something" as part of the graph, and an in-place change to a leaf that requires grad raises an error anyway.
2. \`.grad\` **accumulates**. If you do not zero it, step 2 uses the gradient of step 1 plus step 2. Optimisers wrap this as \`opt.zero_grad()\`.
3. \`.item()\` pulls a Python number out of a one-element tensor, which is what you log. Never keep appending loss tensors to a list: each one holds its whole graph in memory.`,
          code: [
            {
              title: "Tensor basics you will use every day",
              lang: "python",
              code: `import numpy as np
import torch

device = "cuda" if torch.cuda.is_available() else ("mps" if torch.backends.mps.is_available() else "cpu")

a = torch.tensor([[1.0, 2.0], [3.0, 4.0]])          # float32 by default
b = torch.from_numpy(np.ones((2, 2), dtype=np.float32))   # shares memory with the NumPy array
print(a.shape, a.dtype, a.device)                   # torch.Size([2, 2]) torch.float32 cpu
print(a @ b, a.sum(dim=0), a.mean(dim=1, keepdim=True).shape)   # same semantics as NumPy axis/keepdims

x = torch.randn(64, 784, device=device)             # create directly on the target device
W = torch.randn(784, 10, device=device) * 0.01
print((x @ W).shape, (x @ W).device)
print(x.view(64, 28, 28).shape, x.unsqueeze(1).shape)   # reshape without copying, add a dim
print(x.cpu().numpy().shape)                        # back to NumPy (must be on CPU first)`,
              note: "PyTorch says dim where NumPy says axis, and keepdim where NumPy says keepdims. Everything else about broadcasting is identical.",
            },
            {
              title: "Week 5's gradient descent, with autograd",
              lang: "python",
              code: `import torch

torch.manual_seed(0)
x = torch.linspace(-1, 1, 100)
y = 3 * x + 2 + 0.1 * torch.randn(100)

w = torch.zeros(1, requires_grad=True)   # leaf tensors: gradients will land here
b = torch.zeros(1, requires_grad=True)
lr = 0.1

for step in range(300):
    loss = ((w * x + b - y) ** 2).mean()
    loss.backward()                      # fills w.grad and b.grad
    with torch.no_grad():                # the update itself must not be recorded
        w -= lr * w.grad
        b -= lr * b.grad
    w.grad.zero_()                       # gradients ACCUMULATE: reset every step
    b.grad.zero_()
    if step % 100 == 0:
        print(f"step {step}  loss {loss.item():.4f}")

print(f"w={w.item():.3f}  b={b.item():.3f}")   # close to 3 and 2`,
            },
          ],
        },
        l4: {
          text: `**How autograd is actually built.** Every operation on a tensor with \`requires_grad=True\` creates an output tensor whose \`grad_fn\` is a node object. Each node stores references to its input nodes (\`next_functions\`) and whatever it saved for the backward (for \`mul\`, both inputs; for \`relu\`, the output mask). \`backward()\` does a topological traversal from the loss, calling each node's backward in C++ with the incoming gradient. That is precisely your micrograd \`Value._backward\`, vectorised over tensors and implemented in C++/CUDA.

**Why accumulate?** Because accumulation is the correct semantics for the chain rule (multiple paths sum), and it enables **gradient accumulation**: run 4 micro-batches of 16, calling \`backward()\` on each (loss divided by 4), then take one optimiser step. You get the gradient of a batch of 64 with the memory of 16. Fine-tuning large models on a single GPU relies on this.

**The graph is freed after backward.** By default, backward frees saved tensors to reclaim memory, so calling it twice raises "Trying to backward through the graph a second time". You almost never want \`retain_graph=True\`; you want a fresh forward pass.

**Tensors are NumPy-style views too.** A tensor is storage plus sizes, strides and an offset. \`view\` requires compatible strides (it fails on a transposed tensor; use \`reshape\`, which copies if needed, or \`.contiguous()\` first). In-place operations (anything ending in \`_\`, or \`-=\`) on tensors needed for backward trigger "a variable needed for gradient computation has been modified by an inplace operation". PyTorch tracks a version counter per tensor to detect this.

**Device transfers are the silent performance killer.** \`.item()\`, \`.cpu()\` and printing a CUDA tensor all force the CPU to wait for the GPU to finish (a synchronisation). Calling \`.item()\` inside the inner loop can halve GPU throughput; log every N steps instead.`,
          code: [
            {
              title: "Peek at the graph and at accumulation",
              lang: "python",
              code: `import torch

a = torch.tensor(2.0, requires_grad=True)
b = a * 3
c = b.tanh()
print(c.grad_fn)                     # <TanhBackward0 ...>
print(c.grad_fn.next_functions)      # ((<MulBackward0 ...>, 0),)
print(a.is_leaf, b.is_leaf)          # True False

for _ in range(3):
    loss = (a * 3) ** 2              # d/da = 18a = 36 each time
    loss.backward()
    print(a.grad.item())             # 36.0, 72.0, 108.0 -> accumulating!
a.grad = None                        # what optimizer.zero_grad() does by default

with torch.no_grad():
    d = a * 3
print(d.requires_grad)               # False: nothing recorded`,
            },
          ],
        },
        l5: {
          question: "Why does PyTorch accumulate gradients into .grad instead of overwriting them, and how would you use that deliberately?",
          hint: "Chain rule with multiple paths, and fitting a large batch into limited GPU memory.",
          answer: `Accumulation is the mathematically correct behaviour: when a parameter contributes to the loss through several paths, such as a shared embedding matrix or a weight used at every time step, its total gradient is the sum over those paths, so autograd adds each contribution into .grad. Making that persistent across backward calls also gives you gradient accumulation for free. If a batch of 64 sequences does not fit in GPU memory, I run four micro-batches of 16, divide each loss by 4 so the sum equals the mean over 64, call backward on each, and only then call optimizer.step() followed by optimizer.zero_grad(). The resulting update is mathematically the same as a batch of 64, apart from layers like batch norm that compute batch statistics. The cost of this design is the classic bug of forgetting zero_grad, which silently makes every step use a running sum of old gradients, with an effective learning rate that keeps growing.`,
        },
      },
      commonMistakes: [
        "Forgetting to zero gradients each step. The model 'trains' with stale, growing gradients.",
        "Updating parameters outside torch.no_grad(), which either errors on a leaf or pollutes the graph.",
        "Storing loss tensors in a list for logging (losses.append(loss)) instead of loss.item(), keeping every graph alive until you run out of memory.",
        "Mixing devices: a model on cuda and a batch on cpu gives 'Expected all tensors to be on the same device'. Move batches with .to(device) inside the loop.",
      ],
      tryThis:
        "In the autograd gradient-descent snippet, delete the two zero_() lines and rerun. Watch what happens to the loss, then explain it in terms of an effective learning rate.",
      miniTask: {
        title: "Replace your hand-written backprop with autograd",
        kind: "code",
        minutes: 35,
        steps: [
          "Run both l3 snippets. Note your device and confirm w and b converge near 3 and 2.",
          "Take the tiny MLP from last week's matrix-backprop snippet (B=4, D=5, H=8, C=3). Rebuild it with torch tensors and requires_grad=True on W1, b1, W2, b2.",
          "Compute the loss with torch.nn.functional.cross_entropy(logits, y) and call backward().",
          "Compare W1.grad with your NumPy dW1 (use the same initial values via torch.from_numpy) using torch.allclose with atol=1e-6.",
          "Call backward() a second time without a new forward pass and read the error message. Then explain it in one sentence.",
        ],
        checklist: [
          "Autograd gradients match my hand-written NumPy gradients for all four parameters",
          "I can explain what grad_fn and is_leaf mean",
          "I saw and understood the 'backward through the graph a second time' error",
          "I know why the update step goes inside torch.no_grad()",
        ],
        deliverable: "autograd_check.py printing True for torch.allclose on W1, b1, W2 and b2 gradients.",
      },
      quiz: [
        {
          q: "You call loss.backward() twice (two different forward passes) without zeroing. What is in w.grad?",
          options: [
            "The gradient from the second backward only",
            "The sum of both gradients",
            "The average of both gradients",
            "An error is raised",
          ],
          answer: 1,
          explain: "backward() adds into .grad. With separate forward passes there is no error; the gradients simply accumulate.",
        },
        {
          q: "Which tensors get a populated .grad after loss.backward() by default?",
          options: [
            "Every tensor involved in the computation",
            "Only leaf tensors with requires_grad=True",
            "Only the loss",
            "Only tensors on the GPU",
          ],
          answer: 1,
          explain: "Intermediate (non-leaf) gradients are computed but not retained unless you call .retain_grad() on them.",
        },
        {
          q: "Why wrap evaluation code in torch.no_grad()?",
          options: [
            "It makes predictions more accurate",
            "It switches dropout off",
            "It stops graph recording, saving memory and compute",
            "It moves tensors to the CPU",
          ],
          answer: 2,
          explain: "no_grad only disables graph construction. Switching dropout and batch norm to inference behaviour is model.eval(), a separate call.",
        },
      ],
      explainPrompt:
        "Explain to a junior engineer in 5 sentences what happens between loss = ... and loss.backward() in PyTorch, using the terms leaf, grad_fn and accumulation.",
      implementPrompt:
        "From memory, write linear regression with PyTorch tensors and manual parameter updates (no nn.Module, no optimiser), including no_grad and zeroing gradients correctly.",
      videos: [
        {
          title: "PyTorch autograd explained",
          channel: "Various",
          url: "https://www.youtube.com/results?search_query=pytorch+autograd+explained+computational+graph+grad_fn",
          kind: "search",
          reason: "Watch one if grad_fn and leaf tensors still feel abstract after the micrograd comparison.",
        },
        {
          title: "PyTorch in 100 Seconds",
          channel: "Fireship",
          url: "https://www.youtube.com/results?search_query=fireship+pytorch+in+100+seconds",
          kind: "search",
          reason: "A two-minute overview of where PyTorch fits, useful before diving into the docs.",
        },
      ],
    },
  },

  // ────────────────────────────────────────────────────────────────────────
  {
    slug: "training-loop",
    title: "The training loop",
    week: 7,
    domain: "ai",
    skills: ["pytorch", "neural-networks"],
    difficulty: "medium",
    minutes: 80,
    summary: "nn.Module, DataLoader, loss, optimiser: the eight lines that train almost every model, and the silent bugs that hide in them.",
    prerequisites: ["pytorch-tensors-autograd"],
    tags: ["pytorch", "training-loop", "dataloader", "optimizer", "adam", "train-eval"],
    lesson: {
      hook: `Every PyTorch project you open on GitHub, from a digit classifier to a Llama fine-tune, has the same heartbeat in the middle: get a batch, forward, loss, zero grads, backward, step. Repeat.

The loop is short enough to memorise and dangerous enough to deserve a whole lesson. Most of its bugs do not crash. Forget \`model.eval()\` and your validation accuracy drops a few points. Apply softmax before \`CrossEntropyLoss\` and training just gets mysteriously slow. Nothing turns red.

Today you write the loop properly once, so you can spot a broken one in someone else's repo in ten seconds.`,
      whyItMatters:
        "Fine-tuning, training small classifiers for guardrails or routing, and reading research code all come down to this loop. Knowing its failure modes turns 'the model is not learning' from a mystery into a checklist.",
      levels: {
        l1: `Training is a loop. Grab a small handful of examples, let the model guess, score the guesses, figure out which way to nudge every weight, then nudge them. After going through all the data once (an epoch), check the model on examples it never trains on, to see whether it is genuinely improving.`,
        l2: {
          analogy: `A gym routine with a coach. Each set (batch): do the reps (forward), the coach scores your form (loss), wipes last set's notes (zero_grad), works out what to fix (backward), and you adjust (step). Once a week (epoch) you do a test lift in front of a different judge who has never watched you train (validation). If gym numbers climb but the test lift gets worse, you are learning the gym, not getting stronger.`,
          text: `The building blocks:

- **nn.Module**: your model; holds parameters and defines \`forward\`. \`nn.Sequential\` for simple stacks.
- **Dataset / DataLoader**: yields shuffled mini-batches. \`TensorDataset\` wraps in-memory tensors.
- **Loss**: \`nn.CrossEntropyLoss\` for classification (takes raw logits and integer class labels), \`nn.MSELoss\` for regression.
- **Optimiser**: \`torch.optim.Adam\` or \`AdamW\`; owns the update rule.
- **model.train() / model.eval()**: switch dropout and batch-norm behaviour.`,
          diagram: {
            type: "cycle",
            title: "One training step (repeated for every batch)",
            center: "every N batches or once per epoch: model.eval() + validation under no_grad",
            steps: [
              { label: "Next batch", note: "xb, yb = next(iter(loader)); .to(device)" },
              { label: "Forward", note: "logits = model(xb)" },
              { label: "Loss", note: "loss = loss_fn(logits, yb)" },
              { label: "Zero grads", note: "opt.zero_grad()" },
              { label: "Backward", note: "loss.backward()", accent: true },
              { label: "Step", note: "opt.step() updates every parameter" },
            ],
          },
        },
        l3: {
          text: `The good version below is a complete, correct loop on the digits dataset. It trains in seconds on a laptop CPU and reaches about 97% validation accuracy.

The bad version is how the same loop typically looks when it "trains but underperforms". Three silent bugs: softmax before a loss that already applies log-softmax, never zeroing gradients, and evaluating in train mode with the graph recording.

The pattern for evaluation is always the pair: \`model.eval()\` (behaviour) plus \`torch.no_grad()\` (no graph). And always switch back with \`model.train()\` at the start of the next epoch.`,
          code: [
            {
              title: "Three silent bugs",
              lang: "python",
              variant: "bad",
              code: `import torch
from torch import nn

model = nn.Sequential(nn.Linear(64, 128), nn.ReLU(), nn.Dropout(0.2), nn.Linear(128, 10), nn.Softmax(dim=1))
opt = torch.optim.Adam(model.parameters(), lr=1e-3)
loss_fn = nn.CrossEntropyLoss()     # already applies log-softmax: now softmax runs twice

def train_epoch(loader):
    for xb, yb in loader:
        loss = loss_fn(model(xb), yb)
        loss.backward()             # no opt.zero_grad(): gradients pile up across batches
        opt.step()

def evaluate(loader):               # still in train mode: dropout is active during eval
    correct = sum((model(xb).argmax(1) == yb).sum().item() for xb, yb in loader)   # graph is recorded
    return correct / len(loader.dataset)`,
              note: "It still reaches decent accuracy on easy data, which is exactly why these bugs survive code review.",
            },
            {
              title: "A correct training loop on the digits dataset",
              lang: "python",
              variant: "good",
              code: `import torch
from sklearn.datasets import load_digits
from torch import nn
from torch.utils.data import DataLoader, TensorDataset, random_split

torch.manual_seed(0)
X, y = load_digits(return_X_y=True)
ds = TensorDataset(torch.tensor(X / 16.0, dtype=torch.float32), torch.tensor(y))
train_ds, val_ds = random_split(ds, [1437, 360], generator=torch.Generator().manual_seed(0))
train_dl = DataLoader(train_ds, batch_size=64, shuffle=True)
val_dl = DataLoader(val_ds, batch_size=256)

model = nn.Sequential(nn.Linear(64, 128), nn.ReLU(), nn.Dropout(0.2), nn.Linear(128, 10))   # outputs logits
opt = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-2)
loss_fn = nn.CrossEntropyLoss()

for epoch in range(20):
    model.train()
    for xb, yb in train_dl:
        loss = loss_fn(model(xb), yb)
        opt.zero_grad()
        loss.backward()
        opt.step()
    model.eval()
    correct, val_loss = 0, 0.0
    with torch.no_grad():
        for xb, yb in val_dl:
            logits = model(xb)
            val_loss += loss_fn(logits, yb).item() * len(yb)
            correct += (logits.argmax(dim=1) == yb).sum().item()
    print(f"epoch {epoch:2d}  val loss {val_loss / len(val_ds):.3f}  val acc {correct / len(val_ds):.3f}")`,
              note: "1437 + 360 = 1797, the full dataset. torch.tensor(y) from int64 NumPy gives the int64 labels CrossEntropyLoss expects.",
            },
          ],
        },
        l4: {
          text: `**What opt.step() does.** Every optimiser holds references to the parameters and, for each, some state. After \`backward()\`, \`step()\` reads each \`p.grad\` and updates \`p\` in place under no_grad:

- **SGD**: \`p -= lr * g\`
- **SGD + momentum**: \`v = mu * v + g; p -= lr * v\` — a running velocity smooths noisy mini-batch gradients.
- **Adam**: keeps \`m = b1*m + (1-b1)*g\` (mean of gradients) and \`v = b2*v + (1-b2)*g^2\` (mean of squared gradients), bias-corrects them (\`m_hat = m/(1-b1^t)\`, \`v_hat = v/(1-b2^t)\`), then \`p -= lr * m_hat / (sqrt(v_hat) + eps)\`. Each parameter effectively gets its own step size. Defaults \`b1=0.9, b2=0.999\`.
- **AdamW**: Adam plus weight decay applied directly to the weights (\`p -= lr * wd * p\`) rather than through the gradient. It is the default for transformers.

Adam's two state tensors are each the size of the model, which is why training a 7B model with Adam needs memory for the weights, the gradients **and** two more copies: about 16 bytes per parameter in mixed precision, before activations.

**What the DataLoader does.** Each epoch it draws a random permutation of indices (\`shuffle=True\`), groups them into batches, fetches items from the Dataset and stacks them with \`collate_fn\`. \`num_workers > 0\` loads batches in parallel worker processes so the GPU is not waiting on disk or tokenisation; \`pin_memory=True\` speeds up host-to-GPU copies.

**train() vs eval()** flips a boolean on every submodule. Dropout zeroes random units in train mode and is the identity in eval. BatchNorm uses batch statistics in train mode and running averages in eval. Neither has anything to do with gradients.`,
          code: [
            {
              title: "opt.step() for plain SGD, written out",
              lang: "python",
              code: `import torch
from torch import nn

model = nn.Linear(3, 1)
x, y = torch.randn(8, 3), torch.randn(8, 1)
lr = 0.1

loss = nn.functional.mse_loss(model(x), y)
loss.backward()

with torch.no_grad():                 # equivalent to torch.optim.SGD(model.parameters(), lr).step()
    for p in model.parameters():
        p -= lr * p.grad
        p.grad = None                 # equivalent to opt.zero_grad()

print(nn.functional.mse_loss(model(x), y).item() < loss.item())   # True: the loss went down`,
            },
          ],
        },
        l5: {
          question: "A teammate says 'the model is not learning'. Walk me through the checks you would run on their training loop, in order.",
          hint: "Initial loss, overfit one batch, then the classic silent bugs.",
          answer: `First I check the initial loss against the expected value for a random model, for example ln(10) ≈ 2.3 for 10 classes; if it is far off, the initialisation or the loss wiring is wrong. Second, I try to overfit a single small batch for a few hundred steps: a correct model and loop should drive that loss to nearly zero, and if it cannot, the bug is in the code, not the data or the capacity. Then I read the loop for the silent bugs: missing optimizer.zero_grad(), softmax or sigmoid applied before a loss that expects logits, labels with the wrong dtype or shape, a missing model.train() after evaluation so dropout stays off, and parameters that never reach the optimiser because they were created outside the module. I also log the gradient norm per layer to catch dead ReLUs or vanishing gradients, and try a learning-rate sweep over powers of ten. If single-batch overfitting works but full training does not, I look at the data: shuffling, label alignment after any augmentation, and class balance. This order separates code bugs from optimisation problems from data problems quickly.`,
        },
      },
      commonMistakes: [
        "Applying nn.Softmax at the end of the model while using nn.CrossEntropyLoss, which expects raw logits.",
        "Evaluating without model.eval(), so dropout randomly zeroes units during validation and scores fluctuate.",
        "Calling model.eval() for validation and never switching back with model.train(), so dropout is silently off for the rest of training.",
        "Shuffling the validation loader or, worse, not shuffling the training loader when data is sorted by class.",
      ],
      tryThis:
        "Before running the good loop, add a sanity check: take one batch of 64, train only on it for 200 steps and print the loss. It should approach 0. If it does not, your loop has a bug.",
      miniTask: {
        title: "Write the loop from memory, then break it on purpose",
        kind: "code",
        minutes: 40,
        steps: [
          "Close this page and write the good training loop from memory. Then compare with the reference and fix differences.",
          "Run it and record the final validation accuracy (expect about 0.96 to 0.98).",
          "Add the overfit-one-batch check and confirm the loss approaches zero.",
          "Introduce each of the three bugs from the bad example one at a time. Record final validation accuracy and loss for each.",
          "Log the total gradient norm each epoch with torch.nn.utils.clip_grad_norm_(model.parameters(), float('inf')), which returns the norm without clipping.",
        ],
        checklist: [
          "My from-memory loop ran correctly after at most small fixes",
          "Overfit-one-batch drives the loss below 0.05",
          "I recorded the effect of each of the three bugs separately",
          "I can state what model.eval() changes and what torch.no_grad() changes",
        ],
        deliverable: "train_loop.py plus a 4-row table: correct, double softmax, no zero_grad, eval-in-train-mode, with final val accuracy for each.",
      },
      quiz: [
        {
          q: "What input does nn.CrossEntropyLoss expect from the model?",
          options: [
            "Probabilities that sum to 1",
            "Raw logits; it applies log-softmax internally",
            "One-hot encoded predictions",
            "Log-probabilities from nn.LogSoftmax",
          ],
          answer: 1,
          explain: "CrossEntropyLoss = LogSoftmax + NLLLoss, computed stably from logits. Log-probabilities go into nn.NLLLoss instead.",
        },
        {
          q: "Which statement about model.eval() is true?",
          options: [
            "It disables gradient computation",
            "It changes the behaviour of layers like Dropout and BatchNorm",
            "It freezes the weights",
            "It moves the model to the CPU",
          ],
          answer: 1,
          explain: "eval() only flips the training flag on modules. Gradient recording is controlled separately by torch.no_grad() or torch.inference_mode().",
        },
        {
          q: "Adam keeps two extra tensors per parameter. What are they?",
          options: [
            "The previous weights and the previous gradients",
            "Running averages of the gradient and of the squared gradient",
            "The learning rate and the momentum",
            "The maximum and minimum gradient seen",
          ],
          answer: 1,
          explain: "m (first moment) and v (second moment). Their ratio gives each parameter an adaptive step size, and they double the optimiser memory.",
        },
      ],
      explainPrompt:
        "Explain the PyTorch training loop to a junior engineer in 5 sentences, naming each line's job and the difference between model.eval() and torch.no_grad().",
      implementPrompt:
        "From memory, write a complete PyTorch training loop for load_digits with a DataLoader, AdamW, a validation pass under eval + no_grad, and per-epoch logging of val loss and accuracy.",
      videos: [
        {
          title: "Building makemore (intro to language modeling)",
          channel: "Andrej Karpathy",
          url: "https://www.youtube.com/watch?v=PaCmpygFfXo",
          kind: "video",
          minutes: 117,
          reason: "Watch the second half, where he replaces counting with a tiny neural net trained by a hand-written forward, backward, update loop in PyTorch; it is this lesson without the nn.Module wrapping, and bridges straight into language models.",
        },
        {
          title: "PyTorch training loop explained",
          channel: "Various",
          url: "https://www.youtube.com/results?search_query=pytorch+training+loop+explained+zero_grad+backward+step",
          kind: "search",
          reason: "Watch one if the order of zero_grad, backward and step still needs repetition to stick.",
        },
      ],
    },
  },

  // ────────────────────────────────────────────────────────────────────────
  {
    slug: "overfitting-regularisation",
    title: "Overfitting, regularisation & generalisation",
    week: 7,
    domain: "ai",
    skills: ["ml-evaluation", "neural-networks"],
    difficulty: "medium",
    minutes: 70,
    summary: "A model that memorises its training set is useless. Read the learning curves, then use data, weight decay, dropout and early stopping to generalise.",
    prerequisites: ["training-loop", "model-evaluation-metrics"],
    tags: ["overfitting", "regularisation", "weight-decay", "dropout", "early-stopping", "bias-variance"],
    lesson: {
      hook: `Your digit classifier hits 100% training accuracy. Validation says 91% and falling. The model is getting better at the thing you do not care about.

With 9,610 parameters and 1,437 training images, a network can simply memorise which pixels belong to which label, including the noise and the one badly scanned 7. That is **overfitting**: fitting the training set at the expense of the world.

The whole game in ML is **generalisation**, performance on data you have never seen. Every technique in this lesson trades a little training accuracy for a lot of real-world accuracy. The same instinct applies to prompts and RAG systems: if you only ever tune against the same 10 examples, you are overfitting them too.`,
      whyItMatters:
        "Knowing whether a model is underfitting or overfitting tells you what to do next: more capacity, or more data and regularisation. Reading those curves correctly saves days of random hyperparameter changes, and the same logic applies to fine-tuning LLMs.",
      levels: {
        l1: `Overfitting is when a model memorises the practice questions instead of learning the subject: perfect on practice, poor on the real exam. Regularisation is anything that makes memorising harder, so the model is forced to learn general patterns. You detect overfitting by always keeping some data aside that the model never trains on.`,
        l2: {
          analogy: `Two students preparing for an exam with last year's paper. One memorises every answer word for word: 100% on last year's paper, lost on any new question. The other learns why each answer is right: 85% on the old paper, 85% on the new one. Regularisation is the teacher who shuffles the question wording (augmentation), makes you explain answers in fewer words (weight decay), randomly covers parts of your notes (dropout), and stops your cramming when practice scores stop transferring (early stopping).`,
          text: `Read your learning curves:

- **Underfitting (high bias)**: train and val loss both high and close. Fix: bigger model, more features, train longer, lower regularisation.
- **Overfitting (high variance)**: train loss keeps falling, val loss bottoms out then rises. Fix: more data, augmentation, weight decay, dropout, early stopping, smaller model.
- **Good fit**: both low, small gap, val flat.

The toolbox, in order of reliability: **more (and cleaner) data** > **data augmentation** > **early stopping** > **weight decay** > **dropout** > shrinking the model.`,
          diagram: {
            type: "compare",
            title: "Underfitting vs overfitting",
            left: {
              label: "Underfitting (high bias)",
              points: [
                "Train loss high, val loss high, small gap",
                "Model too simple or training too short",
                "Degree-1 polynomial on a sine wave",
                "Fix: more capacity, better features, train longer",
              ],
            },
            right: {
              label: "Overfitting (high variance)",
              points: [
                "Train loss near zero, val loss rising",
                "Model memorises noise in a small dataset",
                "Degree-15 polynomial through 30 noisy points",
                "Fix: more data, weight decay, dropout, early stopping",
              ],
            },
          },
        },
        l3: {
          text: `The first snippet is the classic demonstration: 30 noisy points from a sine wave, fit with polynomials of increasing degree. Degree 1 underfits, degree 4 is about right, degree 15 nails the training points and is wild in between. Adding a small L2 penalty (Ridge) to degree 15 tames it.

The second snippet is **early stopping**, the cheapest regularisation you will ever write: keep the weights from the epoch with the best validation loss and stop after \`patience\` epochs without improvement. Plug it into last lesson's loop.

In PyTorch, the other two are one-liners: \`weight_decay=1e-2\` on \`AdamW\`, and \`nn.Dropout(p)\` layers between hidden layers.`,
          code: [
            {
              title: "Under-, over- and regularised fits",
              lang: "python",
              code: `import numpy as np
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.metrics import mean_squared_error
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import PolynomialFeatures, StandardScaler

rng = np.random.default_rng(0)
def sample(n):
    x = rng.uniform(0, 1, n)[:, None]
    return x, np.sin(2 * np.pi * x).ravel() + rng.normal(0, 0.2, n)

x_tr, y_tr = sample(30)
x_val, y_val = sample(200)

for degree, reg in [(1, LinearRegression()), (4, LinearRegression()),
                    (15, LinearRegression()), (15, Ridge(alpha=1e-3))]:
    model = make_pipeline(PolynomialFeatures(degree), StandardScaler(), reg).fit(x_tr, y_tr)
    tr = mean_squared_error(y_tr, model.predict(x_tr))
    va = mean_squared_error(y_val, model.predict(x_val))
    print(f"degree {degree:2d} {type(reg).__name__:16s} train {tr:.3f}  val {va:.3f}")`,
              note: "Expect degree 1 to be bad on both, degree 15 unregularised to have the lowest train error and a much worse val error, and Ridge to pull val back down. The noise floor is 0.04 (0.2 squared).",
            },
            {
              title: "Early stopping that restores the best weights",
              lang: "python",
              code: `import copy

class EarlyStopping:
    def __init__(self, patience=5, min_delta=1e-4):
        self.patience, self.min_delta = patience, min_delta
        self.best, self.bad_epochs, self.best_state = float("inf"), 0, None

    def step(self, val_loss, model):
        """Call once per epoch. Returns True when training should stop."""
        if val_loss < self.best - self.min_delta:
            self.best, self.bad_epochs = val_loss, 0
            self.best_state = copy.deepcopy(model.state_dict())
            return False
        self.bad_epochs += 1
        return self.bad_epochs >= self.patience

# In the training loop, after computing val_loss for the epoch:
#     if stopper.step(val_loss, model):
#         break
# After the loop:
#     model.load_state_dict(stopper.best_state)`,
              note: "deepcopy matters: state_dict() returns references to the live tensors, which keep changing as training continues.",
            },
          ],
        },
        l4: {
          text: `**Weight decay, mathematically.** Add \`(lambda/2) * ||w||^2\` to the loss. Its gradient is \`lambda * w\`, so the SGD update becomes \`w = w - lr * (grad + lambda * w) = (1 - lr * lambda) * w - lr * grad\`. Every step shrinks every weight by a constant factor before applying the gradient: literally "decay". Large weights are needed to fit sharp wiggles through noise; penalising them favours smoother functions.

**Why AdamW exists.** In Adam, an L2 term added to the loss goes through the adaptive denominator \`sqrt(v_hat)\`, so parameters with large gradients get almost no decay: L2 and weight decay stop being the same thing. AdamW (Loshchilov & Hutter) applies \`w -= lr * wd * w\` separately from the adaptive step. Use AdamW, and usually exclude biases and normalisation weights from decay in large models.

**Dropout, the implementation.** In train mode, each unit is zeroed with probability p and the survivors are scaled by \`1/(1-p)\` ("inverted dropout"), so the expected activation is unchanged and eval mode needs no rescaling. No unit can rely on a specific partner being present, which discourages co-adapted, memorised features. It behaves like training an ensemble of thinned networks that share weights.

**Early stopping is implicit regularisation.** Starting from small weights, gradient descent fits the large, simple structure first and the noise later; stopping early caps how far the weights travel. For linear models it is provably similar to L2.

**Bias-variance, and the modern twist.** Classical theory says test error is U-shaped in model size. Very large networks show **double descent**: past the point where they can exactly fit the training data, test error can fall again. That is why huge LLMs generalise despite having more parameters than training examples. Regularisation still matters; model size alone just is not the whole story.`,
          code: [
            {
              title: "Inverted dropout from scratch",
              lang: "python",
              code: `import numpy as np

def dropout(h, p, training, rng=np.random.default_rng(0)):
    if not training or p == 0:
        return h                                   # identity at eval time
    mask = (rng.random(h.shape) >= p) / (1 - p)    # keep with prob 1-p, scale survivors up
    return h * mask

h = np.ones((10000, 100))
out = dropout(h, p=0.3, training=True)
print((out == 0).mean().round(3))    # about 0.3 of units zeroed
print(out.mean().round(3))           # about 1.0: expectation preserved
print(dropout(h, 0.3, training=False).mean())   # exactly 1.0`,
            },
          ],
        },
        l5: {
          question: "Your classifier has 99% train accuracy and 72% validation accuracy. What do you do, in order, and why that order?",
          hint: "Check the split before you touch the model. Then cheapest and most reliable first.",
          answer: `A gap that large is overfitting, but before touching the model I would check the validation set is sound: same distribution as training, no duplicates or near-duplicates leaking across, and labels of similar quality. If val comes from a different distribution, regularisation will not close the gap and I need representative training data instead. Assuming the split is sound, the most reliable fix is more data or data augmentation, because it attacks variance directly. In parallel I would add the cheap regularisers: early stopping on validation loss with best-weight restore, AdamW weight decay around 1e-2, and dropout between hidden layers, tuning each on the validation set and never the test set. If the gap persists, I reduce capacity or start from a pretrained model and fine-tune, which usually generalises far better on small data. Throughout, I would plot train and val curves per epoch rather than comparing final numbers, since the curves show whether the gap opens early (too much capacity) or late (training too long).`,
        },
      },
      commonMistakes: [
        "Judging a model by training accuracy, or by a single final number instead of train and val curves over epochs.",
        "Tuning regularisation strength on the test set. Use validation; touch the test set once at the end.",
        "Keeping the last epoch's weights after early stopping instead of restoring the best checkpoint.",
        "Adding dropout to an underfitting model. If train accuracy is poor, regularisation makes it worse.",
      ],
      tryThis:
        "In the polynomial snippet, try Ridge alphas of 1e-6, 1e-3, 1e-1 and 10 at degree 15. Find the alpha with the lowest validation error, and notice that too much regularisation turns it back into underfitting.",
      miniTask: {
        title: "Diagnose and fix an overfitting network",
        kind: "build",
        minutes: 45,
        steps: [
          "Take last lesson's training loop and make the network overfit on purpose: two hidden layers of 512, no dropout, weight_decay=0, and train on only 300 of the training images.",
          "Train for 100 epochs, recording train and val loss per epoch. Plot both curves on one chart.",
          "Mark on the plot the epoch where val loss is lowest.",
          "Add EarlyStopping(patience=10) with best-weight restore and record the final val accuracy.",
          "Add Dropout(0.3) and AdamW weight_decay=5e-2 and train again. Compare all three runs in a small table.",
        ],
        checklist: [
          "The first run shows a clear gap: train loss near zero, val loss rising",
          "Early stopping restored the best epoch's weights (verified by recomputing val loss after loading)",
          "The regularised run has a smaller train/val gap than the baseline",
          "I can say which change helped most, with numbers",
        ],
        deliverable: "overfit.py plus curves.png and a 3-row table: baseline, early stopping, early stopping + dropout + weight decay.",
      },
      quiz: [
        {
          q: "Train loss is 1.9 and val loss is 1.95 after many epochs on a 10-class task. What is the most likely diagnosis?",
          options: ["Overfitting", "Underfitting", "Data leakage", "A perfect fit"],
          answer: 1,
          explain: "Both losses are high and close together. The model lacks capacity or has not trained enough: high bias. Regularisation would make it worse.",
        },
        {
          q: "With plain SGD, adding an L2 penalty (lambda/2)||w||^2 to the loss changes the update to:",
          options: [
            "w = w - lr * grad - lambda",
            "w = (1 - lr * lambda) * w - lr * grad",
            "w = w - lr * grad / lambda",
            "w = lambda * w - lr * grad",
          ],
          answer: 1,
          explain: "The penalty's gradient is lambda * w. Folding it into the update multiplies w by (1 - lr * lambda) every step: weight decay.",
        },
        {
          q: "Why does inverted dropout divide surviving activations by (1 - p) during training?",
          options: [
            "To make gradients larger",
            "To keep the expected activation the same, so no rescaling is needed at eval time",
            "To normalise the layer to unit variance",
            "Because p is the keep probability",
          ],
          answer: 1,
          explain: "Each unit survives with probability 1 - p. Scaling by 1/(1 - p) keeps its expected value unchanged, so eval mode is just the identity.",
        },
      ],
      explainPrompt:
        "Explain to a junior engineer in 5 sentences how to tell underfitting from overfitting using train and val curves, and one fix for each.",
      implementPrompt:
        "From memory, implement an EarlyStopping class with patience and best-weight restore, and integrate it into a PyTorch training loop that uses AdamW with weight decay and a Dropout layer.",
      videos: [
        {
          title: "StatQuest: Machine Learning Fundamentals: Bias and Variance",
          channel: "StatQuest",
          url: "https://www.youtube.com/results?search_query=statquest+bias+and+variance",
          kind: "search",
          reason: "Watch this if the words bias and variance still feel like jargon; six minutes with a clear picture.",
        },
        {
          title: "StatQuest: Regularization Part 1: Ridge (L2) Regression",
          channel: "StatQuest",
          url: "https://www.youtube.com/results?search_query=statquest+ridge+regression+regularization",
          kind: "search",
          reason: "Watch this to see why penalising weight size produces smoother models, before trusting weight_decay as a knob.",
        },
      ],
    },
  },
];

export const labs: LabSeed[] = [
  {
    slug: "pytorch-training-loop",
    title: "The digit classifier, in PyTorch",
    week: 7,
    duration: "90m",
    minutes: 90,
    difficulty: "medium",
    domain: "ai",
    skills: ["pytorch", "neural-networks", "ml-evaluation"],
    prerequisites: ["An MLP from scratch in NumPy", "The training loop", "Overfitting, regularisation & generalisation"],
    topicSlugs: ["pytorch-tensors-autograd", "training-loop", "overfitting-regularisation"],
    objective:
      "Rebuild last week's NumPy classifier in idiomatic PyTorch, with a proper train/validation/test split, a DataLoader, early stopping with best-weight restore, and a saved checkpoint you can reload for inference.",
    expectedOutput:
      "A script that logs train loss, val loss and val accuracy per epoch, stops early when val loss stalls, restores the best weights, reports final test accuracy (about 0.96 to 0.98), saves model.pt, and reproduces the same test accuracy after reloading.",
    steps: [
      {
        title: "Three-way split",
        detail:
          "From load_digits, make train (70%), val (15%) and test (15%) with two calls to train_test_split(stratify=...). Scale by dividing by 16. Wrap each in a TensorDataset with float32 features and int64 labels. The test set is touched once, at the very end.",
      },
      {
        title: "Model as an nn.Module class",
        detail:
          "Write class DigitMLP(nn.Module) with __init__(self, hidden=128, p_drop=0.2) building Linear(64, hidden), ReLU, Dropout, Linear(hidden, 10), and forward returning logits. Print sum(p.numel() for p in model.parameters()) and check it against your hand count.",
      },
      {
        title: "Sanity checks before training",
        detail:
          "Check the initial loss on one batch is about ln(10). Then overfit a single batch of 32 for 300 steps and confirm the loss goes below 0.05. Only then train on the full data.",
      },
      {
        title: "Train with early stopping",
        detail:
          "DataLoader(train, batch_size=64, shuffle=True). AdamW(lr=1e-3, weight_decay=1e-2). Up to 200 epochs with the EarlyStopping class (patience=10). Each epoch: train mode loop, then eval mode + no_grad validation computing mean val loss and accuracy. Log all three numbers per epoch to a list of dicts.",
      },
      {
        title: "Restore, test and save",
        detail:
          "Load the best state_dict, compute test accuracy and a confusion matrix with sklearn. Save with torch.save({'state_dict': model.state_dict(), 'hidden': 128}, 'model.pt').",
      },
      {
        title: "Reload and predict",
        detail:
          "In a separate function, build a fresh DigitMLP, load the checkpoint with torch.load('model.pt', weights_only=True) and load_state_dict, call eval(), and verify it reproduces the exact test accuracy. Write predict(pixels) that takes a (64,) array and returns the digit and its softmax confidence.",
      },
    ],
    hints: [
      "torch.tensor(y) on an int64 NumPy array already gives torch.int64; CrossEntropyLoss requires integer class labels of that dtype.",
      "For mean val loss, accumulate loss.item() * batch_size and divide by the dataset size, so a smaller last batch is weighted correctly.",
      "If the reloaded model gives different results, you probably forgot model.eval() and dropout is active.",
      "Set torch.manual_seed(0) at the top so runs are comparable when you change one thing.",
    ],
    stretch:
      "Add a learning-rate scheduler (torch.optim.lr_scheduler.ReduceLROnPlateau on val loss) and a tiny hyperparameter sweep over hidden in [64, 128, 256] and weight_decay in [0, 1e-2, 1e-1], choosing the best by val accuracy only, then reporting test accuracy for the winner once.",
    learned: [
      "Structuring a model as an nn.Module and training it with DataLoader and AdamW",
      "Honest evaluation with separate train, validation and test sets",
      "Early stopping with best-weight restore and checkpointing with state_dict",
      "Sanity checks (initial loss, overfit one batch) that catch bugs before long runs",
    ],
    starter: {
      title: "train_digits.py starter",
      lang: "python",
      code: `import torch
from sklearn.datasets import load_digits
from sklearn.model_selection import train_test_split
from torch import nn
from torch.utils.data import DataLoader, TensorDataset

torch.manual_seed(0)
X, y = load_digits(return_X_y=True)
X = X / 16.0
X_tr, X_tmp, y_tr, y_tmp = train_test_split(X, y, test_size=0.3, stratify=y, random_state=0)
X_val, X_te, y_val, y_te = train_test_split(X_tmp, y_tmp, test_size=0.5, stratify=y_tmp, random_state=0)

def to_ds(a, b):
    return TensorDataset(torch.tensor(a, dtype=torch.float32), torch.tensor(b))

train_dl = DataLoader(to_ds(X_tr, y_tr), batch_size=64, shuffle=True)
val_dl = DataLoader(to_ds(X_val, y_val), batch_size=512)
test_dl = DataLoader(to_ds(X_te, y_te), batch_size=512)

class DigitMLP(nn.Module):
    def __init__(self, hidden=128, p_drop=0.2):
        super().__init__()
        self.net = nn.Sequential(nn.Linear(64, hidden), nn.ReLU(), nn.Dropout(p_drop), nn.Linear(hidden, 10))

    def forward(self, x):
        return self.net(x)

model = DigitMLP()
print("params:", sum(p.numel() for p in model.parameters()))`,
      note: "Add the sanity checks, the training loop with early stopping, evaluation and checkpointing.",
    },
  },
];
