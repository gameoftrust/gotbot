import { createSlice } from "@reduxjs/toolkit";
import {
  GraphTopicsMetadata,
  ReputationGraphMetadata,
  Score,
} from "../../../types";
import {
  fetchGraphId,
  fetchReputationGraphMetadata,
  fetchScores,
} from "./actions";

export type ReputationGraphState = {
  graphId: string;
  scores: Score[] | null;
  scoresLastFetchedTimestamp: number | null;
  metadata: ReputationGraphMetadata;
  graphTopicsMetadata: GraphTopicsMetadata;
};

const initialReputationGraphState: ReputationGraphState = {
  graphId: "",
  scores: null,
  scoresLastFetchedTimestamp: null,
  metadata: {
    topicNftContract: {
      address: "0x0",
      chainId: 0,
    },
    endorsementManifestURI: "",
    mainTopicId: "0",
    questionTopicIds: ["0"],
  },
  graphTopicsMetadata: {},
};

export const reputationGraphSlice = createSlice({
  name: "reputationGraph",
  initialState: initialReputationGraphState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(fetchScores.fulfilled, (state, action) => {
      state.scores = action.payload;
      state.scoresLastFetchedTimestamp = Date.now();
    });
    builder.addCase(fetchReputationGraphMetadata.fulfilled, (state, action) => {
      state.metadata = action.payload.metadata;
      state.graphTopicsMetadata = action.payload.topicMetadata;
    });
    builder.addCase(fetchGraphId.fulfilled, (state, action) => {
      state.graphId = action.payload;
    });
  },
});
