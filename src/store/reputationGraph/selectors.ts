import { createSelector } from "@reduxjs/toolkit";
import { RootState } from "../index";
import { GraphTopicsMetadata, TopicId } from "../../../types";
import {
  filterOldScores,
  toLowerCaseWalletAddresses,
} from "../../web-of-trust";

export const selectQuestionTopicIds = createSelector(
  (state: RootState) => state.reputationGraph.metadata.questionTopicIds,
  (questionTopicIds) => questionTopicIds
);

export const selectGraphId = createSelector(
  (state: RootState) => state.reputationGraph.graphId,
  (graphId) => graphId
);

export const selectTopicScoreType = createSelector(
  [
    (state: RootState) => state.reputationGraph.graphTopicsMetadata,
    (state: RootState, topicId: TopicId) => topicId,
  ],
  (graphTopicsMetadata: GraphTopicsMetadata, topicId) => {
    return graphTopicsMetadata[topicId].scoreType;
  }
);

export const selectEndorsementsGraph = createSelector(
  (state: RootState) => state.reputationGraph.scores,
  (scores) => {
    if (scores === null) throw new Error("scores not loaded");
    return filterOldScores(toLowerCaseWalletAddresses(scores));
  }
);

export const selectIsEvaluatedBy = createSelector(
  [
    selectEndorsementsGraph,
    (state: RootState, [fromAccount, toAccount]: [string, string]) => [
      fromAccount,
      toAccount,
    ],
  ],
  (scores, [fromAccount, toAccount]) => {
    return (
      scores.filter(
        (s) =>
          s.from === fromAccount.toLowerCase() &&
          s.to === toAccount.toLowerCase()
      ).length > 0
    );
  }
);
