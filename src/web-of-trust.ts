import { store } from "./store";
import { Score } from "../types";
import { getMaximumConfidenceValue, getMaximumScoreValue } from "./score";
import {
  selectEndorsementsGraph,
  selectTopicScoreType,
} from "./store/reputationGraph/selectors";

type Graph = Score[];

function shortestPath(
  graph: Graph,
  source: string,
  destination: string
): string[] | null {
  const adjacencyList = new Map<string, string[]>();

  // Build the adjacency list for the graph
  for (const { from: u, to: v } of graph) {
    if (!adjacencyList.has(u)) {
      adjacencyList.set(u, []);
    }
    adjacencyList.get(u)?.push(v);
  }

  // BFS traversal to find the shortest path
  const queue: string[] = [source];
  const visited = new Set<string>();
  const parent = new Map<string, string>();

  visited.add(source);
  parent.set(source, "");

  while (queue.length > 0) {
    const u = queue.shift()!;
    const neighbors = adjacencyList.get(u) ?? [];

    for (const v of neighbors) {
      if (!visited.has(v)) {
        visited.add(v);
        parent.set(v, u);
        queue.push(v);
      }
      if (v === destination) {
        // Build and return the shortest path
        const path: string[] = [];
        let curr = v;
        while (curr !== "") {
          path.push(curr);
          curr = parent.get(curr)!;
        }
        return path.reverse();
      }
    }
  }

  // If the destination is not reachable from the source, return null
  return null;
}

export function filterOldScores(scores: Score[]): Score[] {
  const reversedArr = Array.from(scores);
  reversedArr.sort((y, z) => Number(z.timestamp) - Number(y.timestamp)); // Reverse the array to keep the last occurrence of each score
  const finalScores: Score[] = [];

  reversedArr.forEach((s) => {
    if (
      !finalScores.find(
        (finalScore) =>
          finalScore.topicId === s.topicId &&
          finalScore.to === s.to &&
          finalScore.from === s.from
      )
    ) {
      finalScores.unshift(s); // Add the number to the beginning of the array to keep the last occurrence
    }
  });

  return finalScores; // Return the unique scores in their original order
}

export function toLowerCaseWalletAddresses(scores: Score[]): Score[] {
  return scores.map((s) => ({
    ...s,
    from: s.from.toLowerCase(),
    to: s.to.toLowerCase(),
  }));
}

export function findEndorsementPath(
  fromAccount: string,
  toAccount: string,
  topicId: string,
  minimumScore: number,
  minimumConfidence: number
): Score[] | null {
  if (fromAccount === toAccount) return [];
  const graph = selectEndorsementsGraph(store.getState()).filter(
    (s) =>
      s.topicId === topicId &&
      Number(s.score) >= minimumScore &&
      Number(s.confidence) >= minimumConfidence
  );
  const accountsPath = shortestPath(
    graph,
    fromAccount.toLowerCase(),
    toAccount.toLowerCase()
  );
  if (!accountsPath) return null;
  const endorsementPath: Score[] = [];
  for (let i = 0; i < accountsPath.length - 1; i++) {
    endorsementPath.push(
      graph.find(
        (s) => s.from === accountsPath[i] && s.to === accountsPath[i + 1]
      )!
    );
  }
  return endorsementPath;
}

export function findPerfectEndorsementPath(
  fromAccount: string,
  toAccount: string,
  topicId: string
): Score[] | null {
  const scoreType = selectTopicScoreType(store.getState(), topicId);

  return findEndorsementPath(
    fromAccount,
    toAccount,
    topicId,
    getMaximumScoreValue(scoreType),
    getMaximumConfidenceValue(scoreType)
  );
}
