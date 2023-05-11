import i18next from "i18next";
import sprintf from "i18next-sprintf-postprocessor";
import translationFa from "../locales/fa.json";
import translationEn from "../locales/en.json";
import { store } from "./store";
import { GraphTopicsMetadata, TopicId, TopicMetadata } from "../types";
import { selectDefaultChatInfo } from "./store/gotSpaces/selectors";

//TODO: add _md to translation items that should be in markdown format

export const TOPICS_TRANSLATION_PREFIX = "reputationGraph.topics";
export const TOPIC_QUESTION_TRANSLATION_KEY = "question";
export const TOPIC_TITLE_TRANSLATION_KEY = "title";
export const ENDORSED_ON_TOPIC_TRANSLATION_KEY =
  "isEndorsedByYouOrIntermediariesOnThisTopic";
export const NOT_ENDORSED_ON_TOPIC_TRANSLATION_KEY =
  "isNotEndorsedByYouOrIntermediariesOnThisTopic";

export function getTopicTitle(topicId: TopicId) {
  return i18next.t(
    TOPICS_TRANSLATION_PREFIX +
      "." +
      topicId +
      "." +
      TOPIC_TITLE_TRANSLATION_KEY
  );
}

export function getTopicQuestion(topicId: TopicId) {
  return i18next.t(
    TOPICS_TRANSLATION_PREFIX +
      "." +
      topicId +
      "." +
      TOPIC_QUESTION_TRANSLATION_KEY
  );
}

type ValueOf<T> = T[keyof T];

function getTopicTranslations(
  graphTopicsMetadata: GraphTopicsMetadata,
  locale: string
) {
  const topicTranslations: {
    [topicId: TopicId]: ValueOf<TopicMetadata["translations"]>;
  } = {};
  Object.keys(graphTopicsMetadata).forEach(
    (topicId) =>
      (topicTranslations[topicId] =
        graphTopicsMetadata[Number(topicId)].translations[locale] || {})
  );
  return topicTranslations;
}

export async function setupI18n() {
  const {
    reputationGraph: { graphTopicsMetadata },
  } = store.getState();
  await i18next.use(sprintf).init({
    interpolation: {
      escapeValue: false,
    },
    lng: process.env.LOCALE || "fa",
    resources: {
      fa: {
        translation: {
          ...translationFa,
          reputationGraph: {
            topics: getTopicTranslations(graphTopicsMetadata, "fa"),
          },
        },
      },
      en: {
        translation: {
          ...translationEn,
          reputationGraph: {
            topics: getTopicTranslations(graphTopicsMetadata, "en"),
          },
        },
      },
    },
  });
}

export function getChatTypeTranslationArg() {
  const { type } = selectDefaultChatInfo(store.getState());
  return {
    chatType: i18next.t("chatTypes." + type),
  };
}
