import { useCredentialPools } from '../../hooks/useCredentialPools';
import { CredentialPoolsView } from './CredentialPoolsView';

/** Data-bound wrapper: hides itself on backends that do not expose /credential-pools. */
export function CredentialPoolsBlock() {
  const { data, loading, unsupported, error, reload } = useCredentialPools();
  if (unsupported) return null;
  return <CredentialPoolsView data={data} loading={loading} error={error} onReload={reload} />;
}
