import { createSelector } from "@reduxjs/toolkit";
import { RootState } from "../index";

export const selectWalletConnections = createSelector(
  (state: RootState) => state.walletConnections,
  (walletConnections) => {
    return walletConnections;
  }
);

export const selectAccountLastConnection = createSelector(
  (state: RootState) => state.walletConnections,
  (state: RootState, account: string | null | undefined) => account,
  (walletConnections, account) => {
    return walletConnections.find((c) => c.account === account);
  }
);
