import { ChatInfo } from "../../../types";
import { createSlice } from "@reduxjs/toolkit";
import { getChatInfo } from "./actions";

export interface GotChatInfosState {
  [chatId: number]: ChatInfo;
}

const initialGotChatInfosState: GotChatInfosState = {};

export const gotChatInfosSlice = createSlice({
  name: "gotChatInfos",
  initialState: initialGotChatInfosState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(getChatInfo.fulfilled, (state, action) => {
      const chatInfo = action.payload;
      return {
        ...state,
        [chatInfo.id]: chatInfo,
      };
    });
  },
});
