import { NicknameObject } from "../../../types";
import { createSlice } from "@reduxjs/toolkit";
import { fetchNicknames } from "./actions";

export type NicknamesState = {
  nicknameObjects: NicknameObject[] | null;
  nicknamesLastFetchedTimestamp: number | null;
};

const initialNicknamesState: NicknamesState = {
  nicknameObjects: null,
  nicknamesLastFetchedTimestamp: null,
};

export const nicknamesSlice = createSlice({
  name: "nicknames",
  initialState: initialNicknamesState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(fetchNicknames.fulfilled, (state, action) => {
      state.nicknameObjects = action.payload;
      state.nicknamesLastFetchedTimestamp = Date.now();
    });
  },
});
