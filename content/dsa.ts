/**
 * DSA problem bank. Real LeetCode problems grouped by pattern, ordered within
 * each pattern from warm-up to interview-hard. `hint` is the one idea that
 * unlocks the problem — shown only when asked for.
 *
 * `freq` is interview relevance (3 = asked everywhere).
 */
import type { Difficulty } from "./types";

export const DSA_PATTERNS = [
  { id: "arrays", name: "Arrays", idea: "Index arithmetic, prefix sums, in-place tricks." },
  { id: "strings", name: "Strings", idea: "Character counts, two ends, building output carefully." },
  { id: "hashing", name: "Hashing", idea: "Trade memory for O(1) lookups: seen-sets and count maps." },
  { id: "two-pointers", name: "Two Pointers", idea: "Two indices moving toward or after each other on sorted data." },
  { id: "sliding-window", name: "Sliding Window", idea: "Grow the right edge, shrink the left while the window is invalid." },
  { id: "stack", name: "Stack", idea: "Last-in-first-out: matching, monotonic stacks, undo." },
  { id: "queue", name: "Queue", idea: "First-in-first-out: BFS, streams, monotonic deques." },
  { id: "linked-list", name: "Linked List", idea: "Pointer surgery: dummy heads, fast/slow pointers." },
  { id: "binary-search", name: "Binary Search", idea: "Halve a monotonic search space — on indices or on the answer." },
  { id: "trees", name: "Trees", idea: "Recursion that returns something useful from each subtree." },
  { id: "bst", name: "BST", idea: "In-order is sorted; every node carries a valid range." },
  { id: "heap", name: "Heap", idea: "Keep the k best seen so far; merge sorted streams." },
  { id: "trie", name: "Trie", idea: "A tree of characters for prefix questions." },
  { id: "graphs", name: "Graphs", idea: "Model it as nodes + edges, then BFS / DFS / topo sort." },
  { id: "greedy", name: "Greedy", idea: "Make the locally optimal choice and prove it never hurts." },
  { id: "backtracking", name: "Backtracking", idea: "Choose, explore, un-choose — with pruning." },
  { id: "dynamic-programming", name: "Dynamic Programming", idea: "Define the state, the transition, the base case — then cache." },
  { id: "union-find", name: "Union Find", idea: "Track connected components with near-O(1) merges." },
] as const;

export type DsaPatternId = (typeof DSA_PATTERNS)[number]["id"];

export type DsaProblemSeed = {
  slug: string;
  title: string;
  pattern: DsaPatternId;
  difficulty: Difficulty;
  minutes: number;
  freq: 1 | 2 | 3;
  hint: string;
};

const p = (
  slug: string,
  title: string,
  pattern: DsaPatternId,
  difficulty: Difficulty,
  freq: 1 | 2 | 3,
  hint: string,
): DsaProblemSeed => ({
  slug,
  title,
  pattern,
  difficulty,
  minutes: difficulty === "easy" ? 20 : difficulty === "medium" ? 35 : 55,
  freq,
  hint,
});

export const DSA_PROBLEMS: DsaProblemSeed[] = [
  // Arrays
  p("contains-duplicate", "Contains Duplicate", "arrays", "easy", 2, "A set tells you in O(1) whether you've seen a value."),
  p("best-time-to-buy-and-sell-stock", "Best Time to Buy and Sell Stock", "arrays", "easy", 3, "Track the minimum price so far; profit is today minus that minimum."),
  p("product-of-array-except-self", "Product of Array Except Self", "arrays", "medium", 3, "Prefix products from the left times suffix products from the right."),
  p("maximum-subarray", "Maximum Subarray", "arrays", "medium", 3, "Kadane: a negative running sum never helps the future — reset it."),
  p("rotate-array", "Rotate Array", "arrays", "medium", 2, "Reverse the whole array, then reverse the two parts."),
  p("subarray-sum-equals-k", "Subarray Sum Equals K", "arrays", "medium", 3, "Prefix sums + a count map of earlier prefixes equal to sum - k."),
  p("merge-intervals", "Merge Intervals", "arrays", "medium", 3, "Sort by start; extend the last merged interval or start a new one."),
  p("first-missing-positive", "First Missing Positive", "arrays", "hard", 2, "Place each value v at index v-1 by swapping; then scan."),

  // Strings
  p("valid-anagram", "Valid Anagram", "strings", "easy", 2, "Equal character counts — a 26-slot array is enough."),
  p("valid-palindrome", "Valid Palindrome", "strings", "easy", 2, "Two pointers skipping non-alphanumerics, compare lowercased."),
  p("longest-common-prefix", "Longest Common Prefix", "strings", "easy", 1, "Shrink a candidate prefix until every word starts with it."),
  p("string-to-integer-atoi", "String to Integer (atoi)", "strings", "medium", 1, "A tiny state machine: whitespace, sign, digits, clamp on overflow."),
  p("longest-palindromic-substring", "Longest Palindromic Substring", "strings", "medium", 3, "Expand around each of the 2n-1 centres."),
  p("encode-and-decode-strings", "Encode and Decode Strings", "strings", "medium", 2, "Length-prefix each string: '5#hello' can't be confused by content."),
  p("minimum-window-substring", "Minimum Window Substring", "strings", "hard", 3, "Sliding window with a 'formed' counter of satisfied characters."),

  // Hashing
  p("two-sum", "Two Sum", "hashing", "easy", 3, "For each x, ask the map whether target - x was already seen."),
  p("group-anagrams", "Group Anagrams", "hashing", "medium", 3, "Key each word by its sorted letters (or a count tuple)."),
  p("top-k-frequent-elements", "Top K Frequent Elements", "hashing", "medium", 3, "Count, then bucket by frequency — O(n) instead of sorting."),
  p("longest-consecutive-sequence", "Longest Consecutive Sequence", "hashing", "medium", 3, "Only start counting from numbers whose predecessor is absent."),
  p("valid-sudoku", "Valid Sudoku", "hashing", "medium", 2, "Sets per row, column and box; box index is (r // 3, c // 3)."),
  p("lru-cache", "LRU Cache", "hashing", "medium", 3, "Hash map to nodes + doubly linked list for recency order."),

  // Two pointers
  p("two-sum-ii-input-array-is-sorted", "Two Sum II", "two-pointers", "medium", 2, "Sum too small → move left up; too big → move right down."),
  p("3sum", "3Sum", "two-pointers", "medium", 3, "Sort, fix one number, two-pointer the rest; skip duplicates."),
  p("container-with-most-water", "Container With Most Water", "two-pointers", "medium", 3, "Always move the shorter wall — the taller one can't improve area."),
  p("move-zeroes", "Move Zeroes", "two-pointers", "easy", 1, "A write pointer for the next non-zero slot."),
  p("sort-colors", "Sort Colors", "two-pointers", "medium", 2, "Dutch national flag: low, mid, high pointers."),
  p("trapping-rain-water", "Trapping Rain Water", "two-pointers", "hard", 3, "Water at i = min(maxLeft, maxRight) - height; move the smaller side."),

  // Sliding window
  p("longest-substring-without-repeating-characters", "Longest Substring Without Repeating Characters", "sliding-window", "medium", 3, "Store last index of each char; jump left past the duplicate."),
  p("longest-repeating-character-replacement", "Longest Repeating Character Replacement", "sliding-window", "medium", 3, "Window is valid while length - maxFreq <= k."),
  p("permutation-in-string", "Permutation in String", "sliding-window", "medium", 2, "Fixed-size window; compare 26-count arrays as you slide."),
  p("maximum-average-subarray-i", "Maximum Average Subarray I", "sliding-window", "easy", 1, "Fixed window of k: add the new element, subtract the old."),
  p("minimum-size-subarray-sum", "Minimum Size Subarray Sum", "sliding-window", "medium", 2, "Grow until sum >= target, then shrink while it still holds."),
  p("sliding-window-maximum", "Sliding Window Maximum", "sliding-window", "hard", 3, "Monotonic deque of indices, decreasing values."),

  // Stack
  p("valid-parentheses", "Valid Parentheses", "stack", "easy", 3, "Push openers; each closer must match the top."),
  p("min-stack", "Min Stack", "stack", "medium", 2, "Store (value, minSoFar) pairs."),
  p("evaluate-reverse-polish-notation", "Evaluate Reverse Polish Notation", "stack", "medium", 2, "Operands on the stack; an operator pops two, pushes one."),
  p("daily-temperatures", "Daily Temperatures", "stack", "medium", 3, "Monotonic decreasing stack of indices waiting for a warmer day."),
  p("car-fleet", "Car Fleet", "stack", "medium", 1, "Sort by position descending; compare arrival times."),
  p("largest-rectangle-in-histogram", "Largest Rectangle in Histogram", "stack", "hard", 3, "Increasing stack; when popping, the bar's width is known."),

  // Queue
  p("implement-queue-using-stacks", "Implement Queue using Stacks", "queue", "easy", 1, "An in-stack and an out-stack; refill out only when empty."),
  p("number-of-recent-calls", "Number of Recent Calls", "queue", "easy", 1, "Push the new time, pop from the front while it's too old."),
  p("design-circular-queue", "Design Circular Queue", "queue", "medium", 1, "Fixed array + head index + size; wrap with modulo."),
  p("rotting-oranges", "Rotting Oranges", "queue", "medium", 3, "Multi-source BFS from every rotten orange at once."),
  p("task-scheduler", "Task Scheduler", "queue", "medium", 2, "The most frequent task decides the frame: (maxFreq-1)*(n+1) + ties."),

  // Linked list
  p("reverse-linked-list", "Reverse Linked List", "linked-list", "easy", 3, "Three pointers: prev, curr, next."),
  p("merge-two-sorted-lists", "Merge Two Sorted Lists", "linked-list", "easy", 3, "A dummy head removes every edge case."),
  p("linked-list-cycle", "Linked List Cycle", "linked-list", "easy", 2, "Fast moves two, slow moves one — they meet inside a cycle."),
  p("reorder-list", "Reorder List", "linked-list", "medium", 2, "Find the middle, reverse the second half, weave."),
  p("remove-nth-node-from-end-of-list", "Remove Nth Node From End of List", "linked-list", "medium", 2, "Lead pointer n steps ahead, then move both."),
  p("add-two-numbers", "Add Two Numbers", "linked-list", "medium", 2, "Walk both lists with a carry."),
  p("merge-k-sorted-lists", "Merge k Sorted Lists", "linked-list", "hard", 3, "Min-heap of list heads — or divide and conquer merges."),

  // Binary search
  p("binary-search", "Binary Search", "binary-search", "easy", 2, "lo <= hi, mid = lo + (hi - lo) // 2, and be exact about the bounds."),
  p("search-a-2d-matrix", "Search a 2D Matrix", "binary-search", "medium", 2, "Treat it as one sorted array: row = mid // cols."),
  p("koko-eating-bananas", "Koko Eating Bananas", "binary-search", "medium", 3, "Binary search on the answer: the smallest speed that works."),
  p("find-minimum-in-rotated-sorted-array", "Find Minimum in Rotated Sorted Array", "binary-search", "medium", 3, "Compare mid with the right end to know which half is sorted."),
  p("search-in-rotated-sorted-array", "Search in Rotated Sorted Array", "binary-search", "medium", 3, "One half is always sorted; check if target lies in it."),
  p("time-based-key-value-store", "Time Based Key-Value Store", "binary-search", "medium", 2, "Timestamps arrive sorted: binary search the last <= t."),
  p("median-of-two-sorted-arrays", "Median of Two Sorted Arrays", "binary-search", "hard", 2, "Binary search the partition of the smaller array."),

  // Trees
  p("invert-binary-tree", "Invert Binary Tree", "trees", "easy", 2, "Swap children, recurse."),
  p("maximum-depth-of-binary-tree", "Maximum Depth of Binary Tree", "trees", "easy", 2, "1 + max(depth(left), depth(right))."),
  p("diameter-of-binary-tree", "Diameter of Binary Tree", "trees", "easy", 2, "Return height, but update the global best with left + right."),
  p("same-tree", "Same Tree", "trees", "easy", 1, "Both null, or equal values and equal subtrees."),
  p("binary-tree-level-order-traversal", "Binary Tree Level Order Traversal", "trees", "medium", 3, "BFS; process the queue one level (its current length) at a time."),
  p("binary-tree-right-side-view", "Binary Tree Right Side View", "trees", "medium", 2, "Last node of each BFS level."),
  p("lowest-common-ancestor-of-a-binary-tree", "Lowest Common Ancestor of a Binary Tree", "trees", "medium", 3, "If both sides return a node, you're the LCA."),
  p("construct-binary-tree-from-preorder-and-inorder-traversal", "Construct Binary Tree from Preorder and Inorder", "trees", "medium", 2, "Preorder gives the root; inorder splits left from right."),
  p("binary-tree-maximum-path-sum", "Binary Tree Maximum Path Sum", "trees", "hard", 3, "Return the best single branch; update the answer with both branches."),
  p("serialize-and-deserialize-binary-tree", "Serialize and Deserialize Binary Tree", "trees", "hard", 2, "Preorder with explicit null markers."),

  // BST
  p("validate-binary-search-tree", "Validate Binary Search Tree", "bst", "medium", 3, "Pass down (low, high) bounds — not just parent comparisons."),
  p("kth-smallest-element-in-a-bst", "Kth Smallest Element in a BST", "bst", "medium", 3, "In-order traversal visits values in sorted order."),
  p("lowest-common-ancestor-of-a-binary-search-tree", "Lowest Common Ancestor of a BST", "bst", "medium", 2, "Walk down: split point is where p and q go different ways."),
  p("insert-into-a-binary-search-tree", "Insert into a Binary Search Tree", "bst", "medium", 1, "Walk down to the empty slot where the value belongs."),
  p("delete-node-in-a-bst", "Delete Node in a BST", "bst", "medium", 2, "Two children? Replace with the in-order successor."),

  // Heap
  p("kth-largest-element-in-a-stream", "Kth Largest Element in a Stream", "heap", "easy", 2, "A min-heap of size k: its top is the answer."),
  p("last-stone-weight", "Last Stone Weight", "heap", "easy", 1, "Max-heap (negate values in Python's heapq)."),
  p("k-closest-points-to-origin", "K Closest Points to Origin", "heap", "medium", 3, "Max-heap of size k keyed by distance."),
  p("kth-largest-element-in-an-array", "Kth Largest Element in an Array", "heap", "medium", 3, "Min-heap of size k, or quickselect for average O(n)."),
  p("find-median-from-data-stream", "Find Median from Data Stream", "heap", "hard", 3, "Max-heap for the low half, min-heap for the high half, balanced."),

  // Trie
  p("implement-trie-prefix-tree", "Implement Trie (Prefix Tree)", "trie", "medium", 3, "Node = children map + end-of-word flag."),
  p("design-add-and-search-words-data-structure", "Design Add and Search Words", "trie", "medium", 2, "On '.', DFS into every child."),
  p("search-suggestions-system", "Search Suggestions System", "trie", "medium", 1, "Sort products, then binary search or walk a trie per prefix."),
  p("word-search-ii", "Word Search II", "trie", "hard", 3, "Build a trie of words and DFS the board once, pruning dead prefixes."),

  // Graphs
  p("number-of-islands", "Number of Islands", "graphs", "medium", 3, "Each unvisited '1' starts a flood fill: one island."),
  p("clone-graph", "Clone Graph", "graphs", "medium", 2, "Map old node → new node; DFS and wire neighbours."),
  p("max-area-of-island", "Max Area of Island", "graphs", "medium", 2, "Flood fill returns the area it covered."),
  p("pacific-atlantic-water-flow", "Pacific Atlantic Water Flow", "graphs", "medium", 2, "Search backwards from each ocean; intersect."),
  p("course-schedule", "Course Schedule", "graphs", "medium", 3, "Cycle detection: Kahn's topological sort with in-degrees."),
  p("course-schedule-ii", "Course Schedule II", "graphs", "medium", 2, "Same topo sort — return the order."),
  p("network-delay-time", "Network Delay Time", "graphs", "medium", 2, "Dijkstra from k with a min-heap."),
  p("word-ladder", "Word Ladder", "graphs", "hard", 2, "BFS over words; wildcard patterns like h*t as adjacency keys."),

  // Greedy
  p("jump-game", "Jump Game", "greedy", "medium", 3, "Track the farthest reachable index."),
  p("jump-game-ii", "Jump Game II", "greedy", "medium", 2, "BFS by ranges: each jump extends to the farthest in the current range."),
  p("gas-station", "Gas Station", "greedy", "medium", 2, "If the tank goes negative, start after this station."),
  p("partition-labels", "Partition Labels", "greedy", "medium", 2, "Record last occurrence; cut when i reaches the window's last."),
  p("non-overlapping-intervals", "Non-overlapping Intervals", "greedy", "medium", 2, "Sort by end; keep intervals that finish earliest."),
  p("meeting-rooms-ii", "Meeting Rooms II", "greedy", "medium", 3, "Sort starts and ends separately, or a min-heap of end times."),

  // Backtracking
  p("subsets", "Subsets", "backtracking", "medium", 3, "At each index, include or skip."),
  p("permutations", "Permutations", "backtracking", "medium", 3, "Choose an unused element, recurse, un-choose."),
  p("combination-sum", "Combination Sum", "backtracking", "medium", 3, "Recurse with the same index to allow reuse; stop when over target."),
  p("word-search", "Word Search", "backtracking", "medium", 3, "DFS from each cell, mark visited, restore on the way back."),
  p("palindrome-partitioning", "Palindrome Partitioning", "backtracking", "medium", 2, "Cut at every palindromic prefix and recurse on the rest."),
  p("n-queens", "N-Queens", "backtracking", "hard", 2, "Sets for columns and both diagonals (r+c, r-c)."),

  // Dynamic programming
  p("climbing-stairs", "Climbing Stairs", "dynamic-programming", "easy", 3, "ways(n) = ways(n-1) + ways(n-2)."),
  p("min-cost-climbing-stairs", "Min Cost Climbing Stairs", "dynamic-programming", "easy", 1, "cost to reach i = cost[i] + min of the two before."),
  p("house-robber", "House Robber", "dynamic-programming", "medium", 3, "best(i) = max(best(i-1), best(i-2) + nums[i])."),
  p("coin-change", "Coin Change", "dynamic-programming", "medium", 3, "dp[a] = 1 + min(dp[a - coin]); unbounded knapsack."),
  p("longest-increasing-subsequence", "Longest Increasing Subsequence", "dynamic-programming", "medium", 3, "O(n log n): patience sorting with binary search on tails."),
  p("word-break", "Word Break", "dynamic-programming", "medium", 3, "dp[i] is true if some word ends at i and dp[i - len] is true."),
  p("decode-ways", "Decode Ways", "dynamic-programming", "medium", 2, "Like stairs, but each step is valid only for '1'-'26'."),
  p("unique-paths", "Unique Paths", "dynamic-programming", "medium", 2, "Grid DP: paths from above + paths from the left."),
  p("longest-common-subsequence", "Longest Common Subsequence", "dynamic-programming", "medium", 3, "2D table: match → diagonal + 1, else max of left/up."),
  p("partition-equal-subset-sum", "Partition Equal Subset Sum", "dynamic-programming", "medium", 2, "0/1 knapsack to half the total; iterate sums downward."),
  p("edit-distance", "Edit Distance", "dynamic-programming", "hard", 3, "Insert, delete, replace: min of three neighbours + 1."),

  // Union find
  p("number-of-provinces", "Number of Provinces", "union-find", "medium", 2, "Union every connected pair; count distinct roots."),
  p("redundant-connection", "Redundant Connection", "union-find", "medium", 2, "The first edge whose endpoints already share a root."),
  p("number-of-connected-components-in-an-undirected-graph", "Number of Connected Components", "union-find", "medium", 2, "Start with n components; each successful union removes one."),
  p("accounts-merge", "Accounts Merge", "union-find", "medium", 2, "Union emails within an account; group by root."),
  p("graph-valid-tree", "Graph Valid Tree", "union-find", "medium", 2, "A tree has n-1 edges and no union ever joins two nodes already connected."),
];

export function leetcodeUrl(slug: string) {
  return `https://leetcode.com/problems/${slug}/`;
}
