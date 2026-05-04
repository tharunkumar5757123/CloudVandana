function Toolbar({
  loading,
  authStatus,
  loginUrl,
  onFetch,
  onToggleAll,
  onDeploy,
  onLogout,
}) {
  return (
    <div className="mb-3">
      <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
        <span className={`badge ${authStatus.authenticated ? 'bg-success' : 'bg-secondary'}`}>
          {authStatus.checking
            ? 'Checking Salesforce'
            : authStatus.authenticated
              ? 'Salesforce connected'
              : 'Salesforce not connected'}
        </span>

        {authStatus.authenticated && authStatus.instanceUrl && (
          <span className="text-muted small">{authStatus.instanceUrl}</span>
        )}
      </div>

      <div className="d-flex flex-wrap gap-2">
        {!authStatus.authenticated && (
          <a
            className={`btn btn-primary ${loading ? 'disabled' : ''}`}
            href={loading ? undefined : loginUrl}
            aria-disabled={loading}
          >
            Login with Salesforce
          </a>
        )}

        {authStatus.authenticated && (
          <button className="btn btn-outline-danger" onClick={onLogout} disabled={loading}>
            Logout
          </button>
        )}

        <button className="btn btn-secondary" onClick={onFetch} disabled={loading}>
          {loading ? 'Loading...' : 'Get Validation Rules'}
        </button>
        <button className="btn btn-warning" onClick={onToggleAll} disabled={loading}>
          Toggle All
        </button>
        <button className="btn btn-success" onClick={onDeploy} disabled={loading}>
          Deploy
        </button>
      </div>
    </div>
  );
}

export default Toolbar;
