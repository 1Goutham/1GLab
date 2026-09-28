import type { LabSeed, TopicSeed } from "../../types";

/**
 * Week 5 — How machines learn.
 * Loss, gradient descent, the two classic linear models, and how to tell
 * whether a model is actually any good.
 */

export const topics: TopicSeed[] = [
  // ────────────────────────────────────────────────────────────────────────
  {
    slug: "how-machines-learn",
    title: "How machines learn: loss & gradient descent",
    week: 5,
    domain: "ai",
    skills: ["ml-foundations"],
    difficulty: "medium",
    minutes: 75,
    summary: "A model is a function with knobs. Loss says how wrong it is; the gradient says which way to turn every knob.",
    tags: ["gradient-descent", "loss", "learning-rate", "optimisation", "calculus"],
    lesson: {
      hook: `You have called GPT-4 and Gemini hundreds of times from IdeaGuard and ZtudyLock. Every one of those models started as billions of random numbers that produced garbage.

Nobody wrote the rules that turned the garbage into language. A loop did: guess, measure how wrong the guess was, nudge every number slightly in the direction that makes it less wrong, repeat a few trillion times.

That loop is **gradient descent**, and the thing it measures is the **loss**. Everything this month — neural nets, backprop, PyTorch — is machinery for running that loop faster and on bigger functions.

If you understand it on a straight line with two parameters today, you understand the core of how GPT was trained.`,
      whyItMatters:
        "Every training run, fine-tune and loss curve you will ever debug is gradient descent. Knowing what the loss and learning rate actually do is the difference between fixing a diverging run in five minutes and guessing for a day.",
      levels: {
        l1: `A model is a formula with adjustable numbers in it. You show it examples where you already know the right answer, and a score called the **loss** says how wrong its guesses are. Then you adjust each number a tiny bit in whichever direction lowers the score, and repeat until the score stops dropping. That is learning.`,
        l2: {
          analogy: `You are on a foggy hillside at night and want to reach the valley floor. You cannot see the valley, but you can feel the slope under your feet. So you take a small step in the steepest downhill direction, feel again, step again.

The hillside is the loss surface (one axis per parameter). The slope under your feet is the **gradient**. Your step size is the **learning rate**: too small and you are walking all night; too big and you leap over the valley onto the opposite slope, higher than you started.`,
          text: `Three things define every learning problem:

- **Model**: a function with parameters, e.g. \`y_hat = w * x + b\`.
- **Loss**: one number measuring wrongness over the data, e.g. mean squared error.
- **Optimiser**: the rule for updating parameters. Gradient descent: \`param = param - lr * dLoss/dparam\`.

The gradient points uphill (direction of fastest loss increase), so you step the opposite way. That minus sign is the whole trick.`,
          diagram: {
            type: "cycle",
            title: "One step of gradient descent",
            center: "repeat until loss stops falling",
            steps: [
              { label: "Predict", note: "y_hat = w*x + b for every example" },
              { label: "Measure loss", note: "MSE = mean((y_hat - y)^2)" },
              { label: "Compute gradient", note: "dL/dw, dL/db: which way is uphill?" },
              { label: "Step downhill", note: "w -= lr * dL/dw", accent: true },
            ],
          },
        },
        l3: {
          text: `Take the simplest model there is: a line, \`y_hat = w*x + b\`, with MSE loss:

\`L = (1/n) * sum((w*x_i + b - y_i)^2)\`

Differentiate with the chain rule (the outer square gives \`2 * error\`, the inner \`w*x + b\` gives \`x\` for w and \`1\` for b):

- \`dL/dw = (2/n) * sum(error_i * x_i)\`
- \`dL/db = (2/n) * sum(error_i)\`

where \`error_i = y_hat_i - y_i\`. That is everything you need. The code below uses zero libraries so there is nowhere for understanding to hide. It recovers \`w = 3, b = 2\` from noisy data.`,
          code: [
            {
              title: "Gradient descent on a line, pure Python",
              lang: "python",
              code: `import random

random.seed(0)
# Synthetic data: the true relationship is y = 3x + 2, plus noise
xs = [random.uniform(-1, 1) for _ in range(100)]
ys = [3 * x + 2 + random.gauss(0, 0.1) for x in xs]

w, b = 0.0, 0.0   # start knowing nothing
lr = 0.1          # learning rate
n = len(xs)

for step in range(201):
    preds = [w * x + b for x in xs]
    errors = [p - y for p, y in zip(preds, ys)]
    loss = sum(e * e for e in errors) / n                # MSE
    dw = 2 / n * sum(e * x for e, x in zip(errors, xs))  # dL/dw
    db = 2 / n * sum(errors)                             # dL/db
    w -= lr * dw                                         # step AGAINST the gradient
    b -= lr * db
    if step % 50 == 0:
        print(f"step {step:3d}  loss {loss:.4f}  w {w:.3f}  b {b:.3f}")`,
              note: "Loss should fall from roughly 9 to about 0.008 (the noise floor, 0.1 squared) and w, b should land close to 3 and 2.",
            },
            {
              title: "Same data, three learning rates",
              lang: "python",
              code: `import random

random.seed(0)
xs = [random.uniform(-1, 1) for _ in range(100)]
ys = [3 * x + 2 + random.gauss(0, 0.1) for x in xs]
n = len(xs)

def train(lr, steps=30):
    w, b = 0.0, 0.0
    for _ in range(steps):
        errors = [w * x + b - y for x, y in zip(xs, ys)]
        w -= lr * 2 / n * sum(e * x for e, x in zip(errors, xs))
        b -= lr * 2 / n * sum(errors)
    return sum((w * x + b - y) ** 2 for x, y in zip(xs, ys)) / n

for lr in [0.01, 0.5, 1.1]:
    print(f"lr={lr:<5} loss after 30 steps: {train(lr):.4g}")`,
              note: "0.01 crawls, 0.5 converges, 1.1 explodes. For b the update multiplies the error by (1 - 2*lr) each step; once that factor passes -1 it oscillates with growing amplitude.",
            },
          ],
        },
        l4: {
          text: `**Why the negative gradient?** For a small step \`d\`, the loss changes by roughly \`gradient · d\` (first-order Taylor expansion). Among all steps of a fixed length, the dot product is most negative when \`d\` points exactly opposite the gradient. That is why it is called steepest descent.

**Why the learning rate has a ceiling.** Near a minimum, the loss looks like a bowl with curvature \`k\` along some direction. One step multiplies the distance to the bottom by \`(1 - lr * k)\`. If \`lr * k > 2\` that factor is below -1 and every step overshoots further. For the \`b\` parameter above \`k = 2\`, so anything above \`lr = 1\` diverges. Real networks have millions of directions with different curvatures, and the sharpest one sets your maximum learning rate. This is why loss goes to NaN when you bump the LR.

**Batch vs stochastic vs mini-batch.** The code above uses the full dataset per step (batch GD). With a billion tokens that is impossible, so real training estimates the gradient from a random **mini-batch** of 32 to 4096 examples. The estimate is noisy but unbiased, far cheaper, and the noise even helps escape bad regions. That is SGD, and it is what \`DataLoader(batch_size=64, shuffle=True)\` gives you in week 7.

**How do you know your gradient is right?** Compare it with a numerical derivative: nudge a parameter by \`eps\` both ways and measure the slope. If they disagree beyond about 1e-6 relative error, your calculus is wrong. You will use this again for backprop.`,
          code: [
            {
              title: "Gradient check: analytic vs numerical",
              lang: "python",
              code: `import random

random.seed(1)
xs = [random.uniform(-1, 1) for _ in range(20)]
ys = [3 * x + 2 for x in xs]
n = len(xs)

def loss(w, b):
    return sum((w * x + b - y) ** 2 for x, y in zip(xs, ys)) / n

def analytic_grad(w, b):
    errors = [w * x + b - y for x, y in zip(xs, ys)]
    return 2 / n * sum(e * x for e, x in zip(errors, xs)), 2 / n * sum(errors)

w, b, eps = 0.5, -1.0, 1e-5
num_dw = (loss(w + eps, b) - loss(w - eps, b)) / (2 * eps)  # central difference
num_db = (loss(w, b + eps) - loss(w, b - eps)) / (2 * eps)
dw, db = analytic_grad(w, b)
print(f"dw analytic {dw:.6f} numeric {num_dw:.6f}")
print(f"db analytic {db:.6f} numeric {num_db:.6f}")`,
              note: "Use central differences, (f(x+eps) - f(x-eps)) / 2eps. They are accurate to eps squared instead of eps.",
            },
          ],
        },
        l5: {
          question: "A training run you kicked off has loss decreasing for 300 steps, then it jumps to NaN. Walk me through how you would debug it.",
          hint: "Think learning rate and curvature, then numerics, then data.",
          answer: `First I would look at the loss curve and gradient norm just before the NaN. A loss that spikes upward and then goes to NaN is the classic sign of a learning rate too large for the curvature the model has reached: each step overshoots, and the overshoot grows geometrically. The quick test is to resume from the last good checkpoint with the learning rate halved, or add warmup and gradient clipping (clip the global norm to around 1.0). If the NaN appears suddenly without a spike, I suspect numerics: a log of zero or an exp overflow in a hand-written softmax or cross-entropy, or fp16 overflow, so I would use the fused, numerically stable loss (logits into CrossEntropyLoss) and check for inf with anomaly detection. Finally I check the data: a single corrupt batch with an extreme value or a NaN label will do it, so I log the batch index and inspect it. The key habit is to log loss, gradient norm and learning rate every step, so the cause is visible instead of guessed.`,
        },
      },
      commonMistakes: [
        "Adding the gradient instead of subtracting it. The loss climbs steadily and it looks like a learning-rate problem.",
        "Tuning the learning rate on a bad scale: try 1e-1, 1e-2, 1e-3, 1e-4 (log steps), not 0.01, 0.02, 0.03.",
        "Forgetting the 1/n in the gradient. The effective learning rate now scales with dataset size, and a run that worked on 1k rows diverges on 100k.",
        "Assuming a flat loss means convergence. It can also mean a learning rate so small nothing moves, or dead gradients. Check the gradient norm.",
      ],
      tryThis:
        "In the three-learning-rates snippet, find the largest learning rate that still converges by bisection between 0.5 and 1.1. Compare it with the theory: the b direction has curvature 2, so the limit should be 1.0.",
      miniTask: {
        title: "Watch gradient descent find a line",
        kind: "code",
        minutes: 30,
        steps: [
          "Paste the pure-Python gradient descent snippet into gd.py and run it. Note the final w, b and loss.",
          "Change the true line to y = -1.5x + 4 and rerun. Confirm it recovers the new parameters with no other change.",
          "Record the loss at every step in a list and print every 10th value. Describe the shape of the curve in one sentence.",
          "Set lr to 1.1 and run again. Write down at which step the loss first exceeds its starting value.",
          "Add the central-difference gradient check at the starting point w=0, b=0 and confirm analytic and numeric gradients agree to 5 decimal places.",
        ],
        checklist: [
          "Final w and b are within 0.1 of the true values for both lines",
          "I can explain why the loss plateaus around 0.01 rather than reaching 0",
          "I saw lr=1.1 diverge and can say which parameter blew up first and why",
          "Gradient check agrees to at least 5 decimal places",
        ],
        deliverable: "gd.py plus a three-line note: final parameters, the loss curve shape, and the divergence step at lr=1.1.",
      },
      quiz: [
        {
          q: "In gradient descent, why do we subtract the gradient from the parameters?",
          options: [
            "Because the gradient points in the direction of steepest increase of the loss",
            "Because gradients are always positive",
            "To keep parameters small and prevent overfitting",
            "Because the loss is always convex",
          ],
          answer: 0,
          explain: "The gradient points uphill on the loss surface. Stepping in the opposite direction reduces the loss fastest for a small step.",
        },
        {
          q: "For y_hat = w*x + b with MSE loss, what is dL/db?",
          options: [
            "(2/n) * sum(error_i * x_i)",
            "(2/n) * sum(error_i)",
            "(1/n) * sum(error_i ^ 2)",
            "sum(x_i)",
          ],
          answer: 1,
          explain: "Chain rule: d/db of (w*x + b - y)^2 is 2 * error * 1. Averaged over n examples that is (2/n) * sum(error_i).",
        },
        {
          q: "Loss oscillates with growing amplitude from the first few steps. Most likely cause?",
          options: [
            "Learning rate too small",
            "Too few training examples",
            "Learning rate too large for the curvature of the loss",
            "The model has too few parameters",
          ],
          answer: 2,
          explain: "Each step multiplies the distance to the minimum by (1 - lr * k). When lr * k exceeds 2, the step overshoots further each time and diverges.",
        },
      ],
      explainPrompt:
        "Explain gradient descent to a junior engineer in 5 sentences using the foggy-hillside analogy. Include what the loss, the gradient and the learning rate each correspond to.",
      implementPrompt:
        "From memory, write gradient descent for y = w*x + b with MSE in pure Python, including the two derivative formulas. Then add a central-difference gradient check.",
      videos: [
        {
          title: "Gradient descent, how neural networks learn",
          channel: "3Blue1Brown",
          url: "https://www.youtube.com/watch?v=IHZwWFHWa-w",
          kind: "video",
          minutes: 21,
          reason: "Watch this for the visual picture of a loss surface with thousands of dimensions and why the gradient is 'which nudges matter most'.",
        },
        {
          title: "StatQuest: Gradient Descent, step-by-step",
          channel: "StatQuest",
          url: "https://www.youtube.com/results?search_query=statquest+gradient+descent+step+by+step",
          kind: "search",
          reason: "Watch this if the derivative of the loss with respect to w and b still feels like magic; he does the arithmetic on a tiny dataset by hand.",
        },
      ],
    },
  },

  // ────────────────────────────────────────────────────────────────────────
  {
    slug: "linear-logistic-regression",
    title: "Linear & logistic regression",
    week: 5,
    domain: "ai",
    skills: ["regression", "classification"],
    difficulty: "medium",
    minutes: 80,
    summary: "The two models every neural network is built from: a weighted sum for numbers, and a weighted sum through a sigmoid for probabilities.",
    prerequisites: ["how-machines-learn"],
    tags: ["linear-regression", "logistic-regression", "sigmoid", "cross-entropy", "scikit-learn"],
    lesson: {
      hook: `FabricNest wants two things from its data. First: "how many units of this kurta will sell next week?" That answer is a number. Second: "will this customer abandon their cart?" That answer is yes or no.

The first is **regression**, the second is **classification**, and the two simplest models for them are almost the same thing: a weighted sum of the inputs. Logistic regression just pushes that sum through a squashing function so it becomes a probability.

These are not toy models you graduate from. A neuron in a neural network is literally a logistic regression. The last layer of GPT is a (very wide) multi-class logistic regression over 100k tokens. Get these two right and the MLP next week is just stacking them.`,
      whyItMatters:
        "Linear and logistic regression are the baseline you must beat before shipping anything fancier, and they are the building block of every neural network layer and every LLM output head.",
      levels: {
        l1: `Linear regression predicts a number by giving each input a weight and adding them up, like a recipe where each ingredient has a quantity. Logistic regression does the same sum but then squeezes the result into a range from 0 to 1, so it reads as a probability, like "73% chance this cart is abandoned". Training finds the weights that make the predictions match past data best.`,
        l2: {
          analogy: `Think of a judge scoring a startup idea on IdeaGuard. Each factor (market size, team, novelty) gets a weight, and the judge adds up weighted scores. Linear regression reports that raw total. Logistic regression hands the total to a nervous friend who converts it to confidence: very negative totals become "almost certainly no", very positive become "almost certainly yes", and totals near zero become "coin flip".`,
          text: `Both models compute the same thing first: \`z = w · x + b\`.

- **Linear regression** outputs \`z\` directly and is trained with MSE.
- **Logistic regression** outputs \`p = sigmoid(z) = 1 / (1 + e^-z)\` and is trained with **binary cross-entropy** (log loss).

The decision boundary of logistic regression is where \`p = 0.5\`, which is where \`z = 0\`: a straight line (a hyperplane in more dimensions). That is its power and its limit.`,
          diagram: {
            type: "flow",
            title: "Same core, different head",
            lanes: [
              {
                label: "Linear regression",
                tone: "neutral",
                steps: [
                  { label: "Features x", note: "fabric weight, price, season" },
                  { label: "z = w·x + b", note: "weighted sum" },
                  { label: "Output z", note: "e.g. 412 units" },
                  { label: "MSE loss", accent: true },
                ],
              },
              {
                label: "Logistic regression",
                tone: "neutral",
                steps: [
                  { label: "Features x", note: "cart value, visits, time on page" },
                  { label: "z = w·x + b", note: "weighted sum (logit)" },
                  { label: "p = sigmoid(z)", note: "0.73 = 73% abandon" },
                  { label: "Cross-entropy loss", accent: true },
                ],
              },
            ],
          },
        },
        l3: {
          text: `**Linear regression** has a closed-form solution (least squares), so for small data you do not need gradient descent at all. scikit-learn and \`np.linalg.lstsq\` compute the same answer.

**Logistic regression** has no closed form, so you train it with gradient descent. With the right loss the gradient is beautifully simple: for each example, \`dL/dz = p - y\`. Predicted probability minus the truth. Then chain into the weights:

- \`dL/dw = X.T @ (p - y) / n\`  shapes: \`(d, n) @ (n,) -> (d,)\`
- \`dL/db = mean(p - y)\`

Two rules that matter in practice: **standardise features** (mean 0, std 1) so one feature measured in rupees does not dominate one measured in clicks, and **fit the scaler on the training set only**.`,
          code: [
            {
              title: "Linear regression: least squares vs scikit-learn",
              lang: "python",
              code: `import numpy as np
from sklearn.datasets import load_diabetes
from sklearn.linear_model import LinearRegression

X, y = load_diabetes(return_X_y=True)        # X: (442, 10), y: (442,)
Xb = np.c_[np.ones(len(X)), X]               # prepend a column of 1s for the bias -> (442, 11)

theta, *_ = np.linalg.lstsq(Xb, y, rcond=None)   # solves min ||Xb @ theta - y||^2
sk = LinearRegression().fit(X, y)

print("bias matches:   ", np.allclose(theta[0], sk.intercept_))
print("weights match:  ", np.allclose(theta[1:], sk.coef_))
print("R^2 on train:   ", round(sk.score(X, y), 3))`,
              note: "Both print True. R^2 is about 0.52: a linear model explains half the variance. That number is your baseline for anything fancier.",
            },
            {
              title: "Logistic regression from scratch vs scikit-learn",
              lang: "python",
              code: `import numpy as np
from sklearn.datasets import load_breast_cancer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

X, y = load_breast_cancer(return_X_y=True)   # X: (569, 30), y: (569,) of 0/1
X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=0, stratify=y)
scaler = StandardScaler().fit(X_tr)          # fit on TRAIN only
X_tr, X_te = scaler.transform(X_tr), scaler.transform(X_te)

def sigmoid(z):
    return 1 / (1 + np.exp(-z))

w, b, lr = np.zeros(X_tr.shape[1]), 0.0, 0.1   # w: (30,)
for step in range(1000):
    p = sigmoid(X_tr @ w + b)                  # (n,) probabilities
    dz = (p - y_tr) / len(y_tr)                # dL/dz for sigmoid + cross-entropy
    w -= lr * (X_tr.T @ dz)                    # (30, n) @ (n,) -> (30,)
    b -= lr * dz.sum()

acc = ((sigmoid(X_te @ w + b) >= 0.5) == y_te).mean()
sk = LogisticRegression(max_iter=1000).fit(X_tr, y_tr)
print(f"from scratch: {acc:.3f}   sklearn: {sk.score(X_te, y_te):.3f}")`,
              note: "Both land around 0.96 to 0.98. sklearn adds L2 regularisation by default (C=1.0), so the weights differ slightly.",
            },
          ],
        },
        l4: {
          text: `**Where the normal equation comes from.** MSE in matrix form is \`L = (1/n) ||Xw - y||^2\`. Its gradient is \`(2/n) X.T (Xw - y)\`. Set it to zero and you get \`X.T X w = X.T y\`, so \`w = (X.T X)^-1 X.T y\`. Never compute that inverse directly: \`X.T X\` squares the condition number and is numerically fragile. \`lstsq\` uses an SVD/QR decomposition instead. And when you have 10 million rows, even that is too slow, so you are back to gradient descent.

**Why p - y? The derivation.** Binary cross-entropy for one example is \`L = -[y log p + (1 - y) log(1 - p)]\` with \`p = sigmoid(z)\`.

- \`dL/dp = -y/p + (1 - y)/(1 - p)\`
- \`dp/dz = p(1 - p)\` (the sigmoid's famous derivative)
- Multiply: \`dL/dz = -y(1 - p) + (1 - y)p = p - y\`

The \`p(1 - p)\` cancels perfectly. That cancellation is why cross-entropy and sigmoid (or softmax) are always paired.

**Why cross-entropy and not MSE for probabilities?** Two reasons. It is the maximum-likelihood loss if labels are Bernoulli, so minimising it means "make the observed labels as probable as possible". And MSE through a sigmoid has gradient \`(p - y) * p(1 - p)\`: when the model is confidently wrong (p near 0, y = 1), \`p(1 - p)\` is near 0, so the model barely learns from its worst mistakes. Cross-entropy gives the full \`p - y\` signal.

**Multi-class** generalises with softmax: \`p_k = e^z_k / sum_j e^z_j\`, loss \`-log p_true\`, and the gradient is again \`p - onehot(y)\`. You will see this exact line in the backprop lesson.`,
        },
        l5: {
          question: "Why do we train logistic regression with cross-entropy instead of mean squared error?",
          hint: "Look at the gradient when the model is confidently wrong.",
          answer: `Cross-entropy is the negative log-likelihood of the labels under a Bernoulli model, so minimising it is maximum-likelihood estimation: the principled loss for predicting probabilities. Practically, the gradient with respect to the logit is simply p - y, so the correction is proportional to how wrong the prediction is. With MSE on top of a sigmoid, the gradient picks up an extra factor p(1 - p), which vanishes when the sigmoid saturates. That means a model that says 0.001 for a true positive gets almost no gradient, exactly when it most needs to learn. MSE plus sigmoid is also non-convex in the weights, while cross-entropy with a linear logit is convex, so gradient descent reliably finds the global optimum. The same reasoning is why every classifier and every LLM output layer uses softmax with cross-entropy.`,
        },
      },
      commonMistakes: [
        "Fitting the StandardScaler on the full dataset before splitting. The test set's statistics leak into training and your score is optimistic.",
        "Reading logistic regression coefficients as feature importance without standardising first. A weight on 'price in rupees' and one on 'is_member' are on wildly different scales.",
        "Treating a 0.5 threshold as sacred. The model gives probabilities; the threshold is a business decision (see the evaluation lesson).",
        "Computing sigmoid then log separately for the loss. Use a fused, stable function (log-sum-exp tricks) or you will hit log(0) = -inf on confident predictions.",
      ],
      tryThis:
        "In the from-scratch logistic regression, print the five features with the largest absolute weights using load_breast_cancer().feature_names. Then compare with sk.coef_. Do the top features agree?",
      miniTask: {
        title: "Beat the baseline, then explain the weights",
        kind: "code",
        minutes: 35,
        steps: [
          "Run both code examples and record R^2 for linear regression and test accuracy for both logistic models.",
          "Compute the dumbest baseline for the cancer data: accuracy of always predicting the majority class (y_tr.mean() tells you the ratio).",
          "In the from-scratch logistic model, record the loss every 100 steps using the binary cross-entropy formula and confirm it decreases.",
          "Remove the StandardScaler and rerun the from-scratch model with the same lr. Note what happens and why.",
          "Print the top 5 features by absolute weight with their names.",
        ],
        checklist: [
          "Both logistic models beat the majority-class baseline by a clear margin",
          "Cross-entropy loss decreases monotonically in my log",
          "I can explain why the unscaled run behaves badly (feature scales, overflow warnings)",
          "I can derive dL/dz = p - y on paper without looking",
        ],
        deliverable: "logreg.py with baseline, scratch and sklearn accuracies printed, plus a short note on the unscaled run.",
      },
      quiz: [
        {
          q: "For logistic regression trained with binary cross-entropy, what is the gradient of the loss with respect to the logit z for one example?",
          options: ["y - p", "p - y", "p(1 - p)", "(p - y) * p(1 - p)"],
          answer: 1,
          explain: "dL/dp = -y/p + (1-y)/(1-p) and dp/dz = p(1-p); the product simplifies to p - y. The last option is what you get with MSE instead.",
        },
        {
          q: "What does the decision boundary of a logistic regression look like in feature space?",
          options: [
            "A circle around the positive class",
            "Whatever shape fits the data",
            "A straight line (hyperplane) where w·x + b = 0",
            "A sigmoid curve",
          ],
          answer: 2,
          explain: "p = 0.5 exactly when z = 0, and z = w·x + b = 0 is a hyperplane. Curved boundaries need feature engineering or a neural network.",
        },
        {
          q: "Why is np.linalg.lstsq preferred over computing inv(X.T @ X) @ X.T @ y?",
          options: [
            "lstsq is always faster on any size",
            "X.T @ X squares the condition number, so explicit inversion is numerically unstable",
            "inv does not work on NumPy arrays",
            "lstsq adds regularisation automatically",
          ],
          answer: 1,
          explain: "Forming X.T X squares the condition number and inverting amplifies rounding error. lstsq solves the problem through SVD without forming the inverse.",
        },
      ],
      explainPrompt:
        "Explain to a junior engineer, in 5 sentences, how logistic regression is 'linear regression plus a sigmoid' and why it uses cross-entropy instead of MSE.",
      implementPrompt:
        "From memory, implement logistic regression with NumPy gradient descent on load_breast_cancer, including the scaler fit on train only, and report test accuracy.",
      videos: [
        {
          title: "StatQuest: Logistic Regression",
          channel: "StatQuest",
          url: "https://www.youtube.com/results?search_query=statquest+logistic+regression+clearly+explained",
          kind: "search",
          reason: "Watch this if the move from 'fit a line' to 'fit a probability curve' still feels abstract.",
        },
        {
          title: "StatQuest: Linear Regression, Clearly Explained",
          channel: "StatQuest",
          url: "https://www.youtube.com/results?search_query=statquest+linear+regression+clearly+explained",
          kind: "search",
          reason: "Watch this for R^2 and what 'fitting' means before you trust the numbers scikit-learn prints.",
        },
      ],
    },
  },

  // ────────────────────────────────────────────────────────────────────────
  {
    slug: "model-evaluation-metrics",
    title: "Evaluating models: precision, recall & leakage",
    week: 5,
    domain: "ai",
    skills: ["ml-evaluation", "classification"],
    difficulty: "medium",
    minutes: 80,
    summary: "Accuracy lies on imbalanced data and leakage lies about everything. Confusion matrices, precision, recall, thresholds and honest splits.",
    prerequisites: ["linear-logistic-regression"],
    tags: ["precision", "recall", "f1", "confusion-matrix", "data-leakage", "pr-auc", "thresholds"],
    lesson: {
      hook: `You build a fraud detector for FabricNest payments and it scores **99% accuracy**. You are about to post it on LinkedIn.

Then you notice 99% of transactions are legitimate. A model that prints "not fraud" for everything, one line of code, also scores 99%. Your model might be catching zero fraud.

Accuracy answers the wrong question. The right questions are: of the transactions I flagged, how many were really fraud? And of all the real fraud, how much did I catch? Those are **precision** and **recall**, and choosing between them is a product decision, not a maths one.

And even the right metric lies if information from the test set leaked into training. That is the second half of this lesson.`,
      whyItMatters:
        "Every model you ship, and every LLM eval you build in month 5, needs a metric that matches the cost of mistakes and a test set the model has genuinely never seen. Get either wrong and you ship something that only works on paper.",
      levels: {
        l1: `There are two ways to be wrong: raising a false alarm, or missing the real thing. Precision measures how often your alarms are real. Recall measures how much of the real thing you caught. Leakage is when the model accidentally got a peek at the answers during training, so its test score is fake.`,
        l2: {
          analogy: `An airport metal detector. Tuned very sensitively, it catches every knife (high recall) but beeps at belt buckles all day (low precision), and the queue explodes. Tuned loosely, every beep is a real knife (high precision) but some knives walk through (low recall). The machine is the same; the **threshold** is the dial, and the airport chooses where to set it based on which mistake costs more.`,
          text: `Every binary prediction lands in one of four cells:

- **TP** flagged and really fraud. **FP** flagged but legit (false alarm).
- **FN** missed fraud. **TN** correctly left alone.

Then: **precision = TP / (TP + FP)**, **recall = TP / (TP + FN)**, **F1** = their harmonic mean. Accuracy = (TP + TN) / everything, which is dominated by TN when positives are rare.

The grid shows a realistic fraud model, normalised per actual row. It catches 78% of fraud but flags 2% of legit payments; at a 1:99 ratio that 2% is roughly 2 legit orders per 100, versus 0.78 real frauds per 100, so **precision is only about 28%**.`,
          diagram: {
            type: "grid",
            title: "Confusion matrix, normalised by actual class",
            rowLabels: ["Actual fraud", "Actual legit"],
            colLabels: ["Predicted fraud", "Predicted legit"],
            values: [
              [0.78, 0.22],
              [0.02, 0.98],
            ],
            caption: "Recall = 0.78 (top-left). With 1% fraud, 0.02 of the 99% legit rows is about 1.98 false alarms per 0.78 true catches: precision ≈ 0.28.",
          },
        },
        l3: {
          text: `A model outputs probabilities; **you** choose the threshold. Moving it trades precision for recall. So evaluate the whole curve, then pick the operating point that fits the business:

- Fraud blocking a payment: high precision (angry customers are expensive).
- Cancer screening, or "is this document relevant to the question" in RAG retrieval: high recall (a miss is worse than an extra look).

For imbalanced data, report the **PR curve and average precision (PR-AUC)** rather than ROC-AUC, which looks flattering when negatives are abundant.

**Leakage** is any path by which information unavailable at prediction time reaches training. The most common kind is preprocessing fit on the full dataset. The pair below is a famous demonstration: pure random noise with random labels, where honest accuracy must be 50%.`,
          code: [
            {
              title: "Beyond accuracy: confusion matrix, report, threshold choice",
              lang: "python",
              code: `import numpy as np
from sklearn.datasets import make_classification
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (average_precision_score, classification_report,
                             confusion_matrix, precision_recall_curve)
from sklearn.model_selection import train_test_split

# 1% positives, like fraud
X, y = make_classification(n_samples=20000, n_features=20, weights=[0.99], flip_y=0.01, random_state=0)
X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.3, stratify=y, random_state=0)
model = LogisticRegression(max_iter=1000).fit(X_tr, y_tr)

print("always-legit accuracy:", round(1 - y_te.mean(), 3))
proba = model.predict_proba(X_te)[:, 1]
pred = (proba >= 0.5).astype(int)
print(confusion_matrix(y_te, pred))             # rows = actual, cols = predicted
print(classification_report(y_te, pred, digits=3))
print("PR-AUC (average precision):", round(average_precision_score(y_te, proba), 3))

# Pick the threshold with the best precision among those with recall >= 0.6
prec, rec, thr = precision_recall_curve(y_te, proba)
ok = rec[:-1] >= 0.6                            # prec/rec have one more entry than thr
best = int(np.argmax(np.where(ok, prec[:-1], 0)))
print(f"threshold {thr[best]:.3f} -> precision {prec[best]:.3f}, recall {rec[best]:.3f}")`,
              note: "Accuracy will be around 0.99 for both the baseline and the model. The report and the confusion matrix tell you which one is actually useful.",
            },
            {
              title: "Leakage: feature selection before cross-validation",
              lang: "python",
              variant: "bad",
              code: `import numpy as np
from sklearn.feature_selection import SelectKBest, f_classif
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import cross_val_score

rng = np.random.default_rng(0)
X = rng.normal(size=(200, 10000))   # pure noise
y = rng.integers(0, 2, size=200)    # random labels: honest accuracy is 50%

# Picks the 20 noise columns that happen to correlate with ALL labels, test folds included
X_sel = SelectKBest(f_classif, k=20).fit_transform(X, y)
print(cross_val_score(LogisticRegression(), X_sel, y, cv=5).mean())   # far above 0.5: a lie`,
              note: "The selector saw the test folds' labels. With 10,000 noise columns some will correlate by chance, and the model 'learns' that coincidence.",
            },
            {
              title: "Fix: put every fitted step inside a Pipeline",
              lang: "python",
              variant: "good",
              code: `import numpy as np
from sklearn.feature_selection import SelectKBest, f_classif
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import cross_val_score
from sklearn.pipeline import make_pipeline

rng = np.random.default_rng(0)
X = rng.normal(size=(200, 10000))
y = rng.integers(0, 2, size=200)

# Selection is re-fit inside each training fold only
pipe = make_pipeline(SelectKBest(f_classif, k=20), LogisticRegression())
print(cross_val_score(pipe, X, y, cv=5).mean())   # about 0.5: the truth`,
              note: "Rule: anything that calls .fit (scalers, imputers, selectors, encoders, even TF-IDF vocabularies) goes in the pipeline.",
            },
          ],
        },
        l4: {
          text: `**What the PR curve really is.** Sort test examples by predicted probability. Sweep the threshold from high to low; at each cut, count TP and FP above it. Precision and recall at each cut are the points of the curve. \`average_precision_score\` is the step-wise area: \`sum over thresholds of (R_k - R_k-1) * P_k\`. A random classifier's PR-AUC equals the positive rate (0.01 here), which is why it is an honest baseline for rare classes. A random classifier's ROC-AUC is always 0.5 and the curve is dominated by the huge TN pool.

**F-beta.** \`F_beta = (1 + beta^2) * P * R / (beta^2 * P + R)\`. beta = 2 weighs recall twice as much as precision. Use this when you can state the cost ratio.

**Kinds of leakage you will actually meet:**

- **Preprocessing leakage**: scaler, imputer, selector or vocabulary fit before the split.
- **Target leakage**: a feature that is a consequence of the label, e.g. \`refund_issued\` in a fraud model, or \`days_in_hospital\` when predicting admission.
- **Temporal leakage**: random split on time-ordered data. Train on the past, test on the future (\`TimeSeriesSplit\`), exactly as it will be deployed.
- **Group leakage**: the same user or document in train and test (near-duplicates, multiple chunks of one PDF). Use \`GroupKFold\` keyed by user or document id.
- **Eval contamination** (LLM world): benchmark questions that were in the pretraining data. Same bug, bigger scale.

**Calibration** is separate from ranking: a model can rank perfectly yet say 0.9 for things that are right 60% of the time. If downstream code uses probabilities as confidence (for example, "only auto-approve above 0.95"), check a reliability diagram (\`CalibrationDisplay\`).`,
        },
        l5: {
          question: "Your team's fraud model reports 99.2% accuracy and the PM wants to launch. What questions do you ask before agreeing?",
          hint: "Base rate, the confusion matrix, the cost of each error, and how the test set was built.",
          answer: `First, the base rate: if 99% of transactions are legitimate, 99.2% accuracy is barely better than predicting 'legit' for everything, so accuracy tells us almost nothing. I would ask for the confusion matrix, precision and recall at the chosen threshold, and the PR-AUC compared with the positive rate. Then I would ask what each error costs: a false positive blocks a real customer, a false negative loses money, and that ratio should set the threshold rather than a default 0.5. Next, how the test set was built: was the split by time so we train on the past and test on the future, were the same customers or cards in both sets, and were scalers or encoders fit before splitting? I would also scan the features for anything only known after the fact, like chargeback flags or refund status, which is target leakage. Finally, I would want a shadow deployment on live traffic before blocking payments, because the offline set never perfectly matches production.`,
        },
      },
      commonMistakes: [
        "Reporting accuracy on imbalanced data. Always print the baseline accuracy of predicting the majority class next to it.",
        "Using a random split on time-ordered data (orders, logs, prices). The model learns from the future.",
        "Tuning hyperparameters on the test set until the number looks good. The test set is now a second validation set; keep a final holdout you touch once.",
        "Splitting chunks, not documents: chunks of the same PDF in train and test. The model memorises the document and looks brilliant.",
      ],
      tryThis:
        "Run the bad leakage snippet with k=20, then k=200, then k=2. Watch how the fake accuracy changes. Then run the pipeline version with the same k values and confirm they all hover near 0.5.",
      miniTask: {
        title: "Audit a model the honest way",
        kind: "code",
        minutes: 35,
        steps: [
          "Run the evaluation snippet and write down: baseline accuracy, model accuracy, precision, recall and PR-AUC for the positive class.",
          "Draw the 2x2 confusion matrix by hand from the printed numbers and recompute precision and recall yourself.",
          "Change the recall target from 0.6 to 0.8 and record the new threshold and precision. Describe the trade-off in one sentence.",
          "Run the bad and good leakage snippets and record both cross-validation scores.",
          "Write down two features from one of your own projects (IdeaGuard, FabricNest, ZtudyLock) that would be target leakage if used naively.",
        ],
        checklist: [
          "My hand-computed precision and recall match classification_report",
          "I can state which threshold I would pick for fraud blocking and why",
          "The leaky score is well above 0.5 and the pipeline score is near 0.5",
          "I named two plausible leakage features from my own domain",
        ],
        deliverable: "A short eval note (5-8 lines): metrics table, chosen threshold with justification, and the two leakage examples.",
      },
      quiz: [
        {
          q: "A model flags 50 transactions; 40 are real fraud. There were 200 real frauds in total. Precision and recall?",
          options: [
            "Precision 0.8, recall 0.2",
            "Precision 0.2, recall 0.8",
            "Precision 0.8, recall 0.8",
            "Precision 0.25, recall 0.2",
          ],
          answer: 0,
          explain: "Precision = TP / flagged = 40/50 = 0.8. Recall = TP / all actual positives = 40/200 = 0.2.",
        },
        {
          q: "Which of these is target leakage in a model predicting whether a customer will churn next month?",
          options: [
            "Number of logins in the last 30 days",
            "Whether the account was closed",
            "Plan tier",
            "Days since signup",
          ],
          answer: 1,
          explain: "Account closure is a consequence of churn and would not be known at prediction time. It makes offline metrics look perfect and fails in production.",
        },
        {
          q: "On a dataset with 1% positives, why prefer PR-AUC over ROC-AUC?",
          options: [
            "ROC-AUC cannot be computed for imbalanced data",
            "PR-AUC ignores false positives",
            "ROC-AUC's false-positive rate is diluted by the huge number of negatives, so it looks flattering; PR-AUC's baseline equals the positive rate",
            "PR-AUC is always higher",
          ],
          answer: 2,
          explain: "FPR = FP / (FP + TN). With a massive TN count, many false alarms still give a tiny FPR. Precision exposes those false alarms directly.",
        },
      ],
      explainPrompt:
        "Explain precision vs recall to a junior engineer in 5 sentences using the airport metal detector, and say which one you would favour for Cortex's document retrieval step and why.",
      implementPrompt:
        "From memory, write a scikit-learn Pipeline with a StandardScaler and LogisticRegression, evaluate it with 5-fold cross-validation using average precision as the scorer, and print the confusion matrix on a held-out test set.",
      videos: [
        {
          title: "StatQuest: The Confusion Matrix / Sensitivity and Specificity",
          channel: "StatQuest",
          url: "https://www.youtube.com/results?search_query=statquest+confusion+matrix+sensitivity+specificity",
          kind: "search",
          reason: "Watch this if TP/FP/FN/TN still blur together; the visuals make the four cells stick.",
        },
        {
          title: "Data leakage in machine learning",
          channel: "Various",
          url: "https://www.youtube.com/results?search_query=data+leakage+machine+learning+pipeline+cross+validation",
          kind: "search",
          reason: "Watch one worked example of leakage in a real Kaggle-style pipeline to build the reflex of asking 'what did .fit see?'.",
        },
      ],
    },
  },
];

export const labs: LabSeed[] = [
  {
    slug: "gradient-descent-from-scratch",
    title: "Gradient descent from scratch",
    week: 5,
    duration: "45m",
    minutes: 45,
    difficulty: "easy",
    domain: "ai",
    skills: ["ml-foundations", "regression"],
    prerequisites: ["How machines learn: loss & gradient descent"],
    topicSlugs: ["how-machines-learn", "linear-logistic-regression"],
    objective:
      "Fit a straight line to noisy data using only NumPy and hand-derived gradients, plot the loss curve, and see learning-rate divergence with your own eyes.",
    expectedOutput:
      "A script that prints recovered parameters close to the true w and b, and a saved loss_curve.png showing loss vs step on a log scale for three learning rates (slow, good, diverging).",
    steps: [
      {
        title: "Generate data",
        detail:
          "Create 200 points with x uniform in [-2, 2] and y = 2.5x - 1 + Gaussian noise (std 0.3) using np.random.default_rng(42). Keep x and y as 1-D arrays of shape (200,). Print their shapes to confirm.",
      },
      {
        title: "Write loss and gradient as vectorised functions",
        detail:
          "loss(w, b) returns np.mean((w * x + b - y) ** 2). grad(w, b) returns (2 * np.mean(err * x), 2 * np.mean(err)) where err = w * x + b - y. No Python loops over examples.",
      },
      {
        title: "Gradient check before training",
        detail:
          "At w=0, b=0 compute the central-difference numerical gradient with eps=1e-5 and assert it matches grad() within 1e-6. Never skip this: a wrong gradient still 'trains', just badly.",
      },
      {
        title: "Train and record history",
        detail:
          "Write train(lr, steps=100) that starts at w=b=0, applies w -= lr * dw and b -= lr * db, and returns the list of losses and the final parameters. Run it at lr=0.1 and print the final w, b.",
      },
      {
        title: "Compare learning rates and plot",
        detail:
          "Run lr in [0.01, 0.1, 0.8]. Predict the outcome first: with x in [-2, 2], E[x^2] is about 1.33, so the curvature along w is 2 * 1.33 = 2.67 and the divergence limit is about 2 / 2.67 = 0.75. So 0.8 should blow up along w while b alone would still be stable. Plot all three histories with plt.semilogy and save as loss_curve.png.",
      },
      {
        title: "Compare with the closed form",
        detail:
          "Solve the same problem with np.polyfit(x, y, 1) and confirm your gradient-descent parameters match to 3 decimal places at the good learning rate.",
      },
    ],
    hints: [
      "If numbers become inf or nan, clip the plot or stop training when loss exceeds 1e6; that is the divergence you were looking for.",
      "semilogy (log-scale y axis) turns exponential convergence into a straight line, which makes comparing learning rates easy.",
      "np.polyfit returns coefficients highest power first: [w, b].",
    ],
    stretch:
      "Implement mini-batch SGD with batch size 16 (shuffle indices each epoch with rng.permutation) and plot its noisier loss curve against full-batch GD. Then add momentum (v = 0.9 * v + grad; param -= lr * v) and compare steps-to-converge.",
    learned: [
      "Deriving and vectorising the MSE gradient for a linear model",
      "Using a numerical gradient check to verify calculus",
      "Why too-large learning rates diverge, predicted from curvature",
      "That gradient descent and the closed-form solution agree on convex problems",
    ],
    starter: {
      title: "gd_lab.py starter",
      lang: "python",
      code: `import numpy as np
import matplotlib.pyplot as plt

rng = np.random.default_rng(42)
x = rng.uniform(-2, 2, size=200)
y = 2.5 * x - 1 + rng.normal(0, 0.3, size=200)

def loss(w, b):
    return np.mean((w * x + b - y) ** 2)

def grad(w, b):
    err = w * x + b - y
    return 2 * np.mean(err * x), 2 * np.mean(err)

def train(lr, steps=100):
    w, b, history = 0.0, 0.0, []
    for _ in range(steps):
        history.append(loss(w, b))
        dw, db = grad(w, b)
        w, b = w - lr * dw, b - lr * db
    return w, b, history

w, b, hist = train(0.1)
print(f"w={w:.3f} b={b:.3f} final loss={hist[-1]:.4f}")
plt.semilogy(hist, label="lr=0.1")
plt.xlabel("step"); plt.ylabel("MSE"); plt.legend()
plt.savefig("loss_curve.png", dpi=120)`,
      note: "Add the gradient check and the other learning rates yourself.",
    },
  },
];
