import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { reputationGraphSlice, ReputationGraphState } from "./reputationGraph";
import { nicknamesSlice, NicknamesState } from "./nickname";
import { persistReducer, persistStore } from "redux-persist";
import { AsyncNodeStorage } from "redux-persist-node-storage";
import {
  walletConnectionsSlice,
  WalletConnectionsState,
} from "./walletConnections";

export type RootState = {
  reputationGraph: ReputationGraphState;
  nicknames: NicknamesState;
  walletConnections: WalletConnectionsState;
};

if (process.env.REDUX_PERSISTANT_STORAGE_FOLDER === undefined) {
  throw new Error(
    "Please provide the REDUX_PERSISTANT_STORAGE_FOLDER in .env file"
  );
}

const persistConfig = {
  key: "root",
  storage: new AsyncNodeStorage(process.env.REDUX_PERSISTANT_STORAGE_FOLDER),
};

const persistedReducer = persistReducer(
  persistConfig,
  combineReducers({
    reputationGraph: reputationGraphSlice.reducer,
    nicknames: nicknamesSlice.reducer,
    walletConnections: walletConnectionsSlice.reducer,
  })
);

// Define the store
export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types
        ignoredActions: ["persist/PERSIST", "persist/REHYDRATE"],
      },
    }),
});

const persistor = persistStore(store);
