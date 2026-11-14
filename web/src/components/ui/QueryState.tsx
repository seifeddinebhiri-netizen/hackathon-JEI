import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ErrorState } from './ErrorState';
import { LoadingBlock } from './Skeleton';

/**
 * Les 4 états d'un écran qui charge des données : chargement, erreur, vide, succès.
 */
export function QueryState<T>({
  query,
  isEmpty,
  empty,
  loading,
  errorTitle,
  children,
}: {
  query: UseQueryResult<T>;
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
  loading?: ReactNode;
  errorTitle?: string;
  children: (data: T) => ReactNode;
}) {
  if (query.isPending) return <>{loading ?? <LoadingBlock />}</>;
  if (query.isError)
    return (
      <ErrorState title={errorTitle} error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} />
    );
  if (isEmpty?.(query.data)) return <>{empty}</>;
  return <>{children(query.data)}</>;
}
