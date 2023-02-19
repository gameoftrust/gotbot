import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  GraphTopicsMetadata,
  ReputationGraphMetadata,
  ScoreFromContract,
  TopicId,
  TopicMetadata,
} from "../../../types";
import { reputationGraphContract, web3 } from "../../web3";
import axios from "axios";
import ReputationTopicAbi from "../../abis/ReputationTopic.json";
import { AbiItem } from "web3-utils";
import { ReputationTopic } from "../../../types/web3-v1-contracts";

export const fetchGraphId = createAsyncThunk(
  "reputationGraph/fetchGraphId",
  async () => await reputationGraphContract.methods.graphId().call()
);

export const fetchReputationGraphMetadata = createAsyncThunk(
  "reputationGraph/fetchMetadata",
  async () => {
    const metaDataURI = await reputationGraphContract.methods
      .metadataURI()
      .call();
    const metadata = (await axios.get<ReputationGraphMetadata>(metaDataURI))
      .data;

    const reputationTopicContract = new web3.eth.Contract(
      ReputationTopicAbi as AbiItem[],
      metadata.topicNftContract.address
    ) as any as ReputationTopic;

    const topicMetadata: GraphTopicsMetadata = {};

    const getTopicMetadata = async (topicId: TopicId) => {
      const topicMetadataURI = await reputationTopicContract.methods
        .tokenURI(topicId)
        .call();
      topicMetadata[topicId] = (
        await axios.get<TopicMetadata>(topicMetadataURI)
      ).data;
    };
    await Promise.all(
      metadata.questionTopicIds.map((topicId) => getTopicMetadata(topicId))
    );
    return {
      metadata,
      topicMetadata,
    };
  }
);
export const fetchScores = createAsyncThunk(
  "reputationGraph/fetchScores",
  async () => {
    const scoresLength = Number(
      await reputationGraphContract.methods.getScoresLength().call()
    );
    if (scoresLength === 0) return [];
    const scoresArray = (await reputationGraphContract.methods
      .getScores(0, scoresLength - 1)
      .call()) as any as ScoreFromContract[];
    return scoresArray.map((s) => ({
      timestamp: s.timestamp,
      from: s.from,
      to: s.to,
      topicId: s.topicId,
      score: s.score,
      confidence: s.confidence,
    }));
  }
);
