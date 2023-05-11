import { createSelector } from "@reduxjs/toolkit";
import { RootState } from "../index";
import { GOT_DEFAULT_CHAT_ID } from "../../constants";

export const selectDefaultChatInfo = createSelector(
  [(state: RootState) => state.gotChatInfos],
  (gotChatInfos) => {
    if (!GOT_DEFAULT_CHAT_ID)
      throw new Error("GOT_DEFAULT_CHAT_ID not provided");
    return gotChatInfos[Number(GOT_DEFAULT_CHAT_ID)];
  }
);
