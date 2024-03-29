import { WalletConnection } from "../../../types";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type WalletConnectionsState = WalletConnection[];

const initialWalletConnectionsState: WalletConnectionsState = [];

export const walletConnectionsSlice = createSlice({
  name: "walletConnections",
  initialState: initialWalletConnectionsState,
  reducers: {
    addWalletConnection: (state, action: PayloadAction<WalletConnection>) => {
      state = state.filter(
        (walletConnection) =>
          walletConnection.account !== action.payload.account
      );

      state.push(action.payload);
      return state;
    },
  },
});

export const { addWalletConnection } = walletConnectionsSlice.actions;
