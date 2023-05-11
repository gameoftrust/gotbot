import { createSelector } from "@reduxjs/toolkit";
import { RootState } from "../index";
import { GOT_DEFAULT_CHAT_ID } from "../../constants";

export const selectDefaultChatInfo = createSelector(
  [(state: RootState) => state.gotSpaces.spaceChatInfos],
  (spaceChatInfos) => {
    if (!GOT_DEFAULT_CHAT_ID)
      throw new Error("GOT_DEFAULT_CHAT_ID not provided");
    const chatInfo = spaceChatInfos.find(
      (chatInfo) => chatInfo.id === Number(GOT_DEFAULT_CHAT_ID)
    );
    if (!chatInfo) throw new Error("chatInfo not loaded");
    return chatInfo;
  }
);
