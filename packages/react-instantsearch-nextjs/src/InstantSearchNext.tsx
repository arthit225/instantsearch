import { safelyRunOnBrowser } from 'instantsearch.js/es/lib/utils';
import { headers } from 'next/headers';
import React, { useEffect, useMemo, useRef } from 'react';
import {
  InstantSearch,
  InstantSearchRSCContext,
  InstantSearchSSRProvider,
} from 'react-instantsearch-core';

import { InitializePromise } from './InitializePromise';
import { TriggerSearch } from './TriggerSearch';
import { useInstantSearchRouting } from './useInstantSearchRouting';
import { warn } from './warn';

import type { InitialResults, StateMapping, UiState } from 'instantsearch.js';
import type { BrowserHistoryArgs } from 'instantsearch.js/es/lib/routers/history';
import type {
  InstantSearchProps,
  PromiseWithState,
} from 'react-instantsearch-core';

const InstantSearchInitialResults = Symbol.for('InstantSearchInitialResults');
declare global {
  interface Window {
    [InstantSearchInitialResults]?: InitialResults;
  }
}

export type InstantSearchNextRouting<TUiState, TRouteState> = {
  router?: Partial<BrowserHistoryArgs<TRouteState>>;
  stateMapping?: StateMapping<TUiState, TRouteState>;
};

export type InstantSearchNextProps<
  TUiState extends UiState = UiState,
  TRouteState = TUiState
> = Omit<InstantSearchProps<TUiState, TRouteState>, 'routing'> & {
  routing?: InstantSearchNextRouting<TUiState, TRouteState> | boolean;
};

export function InstantSearchNext<
  TUiState extends UiState = UiState,
  TRouteState = TUiState
>({
  children,
  routing: passedRouting,
  ...instantSearchProps
}: InstantSearchNextProps<TUiState, TRouteState>) {
  const isMounting = useRef(true);
  const isServer = typeof window === 'undefined';

  const hasRouteChanged = useMemo(() => {
    // On server, always return false
    if (isServer) {
      return false;
    }

    // On client, route has changed if initialResults have been cleaned up
    const hasInitialResults = window[InstantSearchInitialResults] !== undefined;
    return !hasInitialResults;
  }, [isServer]);

  // We only want to trigger a search from a server environment
  // or if a Next.js route change has happened on the client
  const shouldTriggerSearch = isServer || hasRouteChanged;

  useEffect(() => {
    isMounting.current = false;
    return () => {
      // This is to make sure that they're not reused if mounting again on a different route
      delete window[InstantSearchInitialResults];
    };
  }, []);

  const nonce = safelyRunOnBrowser(() => undefined, {
    fallback: () => headers().get('x-nonce') || undefined,
  });

  const routing = useInstantSearchRouting(passedRouting, isMounting);

  const promiseRef = useRef<PromiseWithState<void> | null>(null);

  const initialResults = safelyRunOnBrowser(
    () => window[InstantSearchInitialResults]
  );

  warn(
    false,
    `InstantSearchNext relies on experimental APIs and may break in the future.
This message will only be displayed in development mode.`
  );

  return (
    <InstantSearchRSCContext.Provider value={promiseRef}>
      <InstantSearchSSRProvider initialResults={initialResults}>
        <InstantSearch {...instantSearchProps} routing={routing}>
          {shouldTriggerSearch && <InitializePromise nonce={nonce} />}
          {children}
          {shouldTriggerSearch && <TriggerSearch />}
        </InstantSearch>
      </InstantSearchSSRProvider>
    </InstantSearchRSCContext.Provider>
  );
}
