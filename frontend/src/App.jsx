import { useEffect, useState } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import {
  AUTH_BASE,
  fetchAuthStatus,
  fetchValidationRules,
  logout,
  updateValidationRule,
} from './api';
import RuleTable from './components/RuleTable';
import Toolbar from './components/Toolbar';

function App() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [authStatus, setAuthStatus] = useState({ authenticated: false, checking: true });
  const [updatingRuleIds, setUpdatingRuleIds] = useState([]);

  const refreshAuthStatus = async () => {
    try {
      const status = await fetchAuthStatus();
      setAuthStatus({ ...status, checking: false });
    } catch {
      setAuthStatus({ authenticated: false, checking: false });
    }
  };

  useEffect(() => {
    refreshAuthStatus();
  }, []);

  const getRules = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const data = await fetchValidationRules();
      setRules(data);
      await refreshAuthStatus();
      setMessage({ type: 'success', text: 'Validation rules loaded successfully.' });
    } catch (error) {
      setMessage({ type: 'danger', text: error.message });
    }

    setLoading(false);
  };

  const toggleRule = async (id, currentActive) => {
    setMessage(null);
    setUpdatingRuleIds(prev => [...prev, id]);

    try {
      const updatedRule = await updateValidationRule(id, !currentActive);

      setRules(prev =>
        prev.map(rule =>
          rule.Id === id ? { ...rule, ...updatedRule } : rule
        )
      );

      setMessage({ type: 'success', text: 'Rule state updated successfully.' });
    } catch (error) {
      setMessage({ type: 'danger', text: error.message });
    }

    setUpdatingRuleIds(prev => prev.filter(ruleId => ruleId !== id));
  };

  const toggleAll = async () => {
    if (rules.length === 0) {
      setMessage({ type: 'warning', text: 'Load rules first before toggling all.' });
      return;
    }

    const allActive = rules.every(rule => rule.Active);
    setLoading(true);
    setMessage(null);

    try {
      const updatedRules = [];

      for (const rule of rules) {
        const updatedRule = await updateValidationRule(rule.Id, !allActive);
        updatedRules.push(updatedRule);
      }

      setRules(prev => prev.map(rule => {
        const updatedRule = updatedRules.find(item => item.Id === rule.Id);
        return updatedRule ? { ...rule, ...updatedRule } : rule;
      }));

      setMessage({
        type: 'success',
        text: `All rules were ${!allActive ? 'activated' : 'deactivated'}.`,
      });
    } catch (error) {
      setMessage({ type: 'danger', text: error.message });
    }

    setLoading(false);
  };

  const deploy = () => {
    setMessage({
      type: 'success',
      text: 'All changes are already synced with Salesforce.',
    });
  };

  const handleLogout = async () => {
    setLoading(true);
    setMessage(null);

    try {
      await logout();
      setRules([]);
      setAuthStatus({ authenticated: false, checking: false });
      setMessage({ type: 'success', text: 'Logged out successfully.' });
    } catch (error) {
      setMessage({ type: 'danger', text: error.message });
    }

    setLoading(false);
  };

  const loginUrl = `${AUTH_BASE}/login`;

  return (
    <div className="app-shell">
      <section className="app-hero card shadow-lg p-4 mb-4 rounded-4 border-0">
        <div className="hero-header d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
          <div>
            <span className="badge bg-primary-soft text-primary mb-2">
              Premium Dashboard
            </span>
            <h1 className="mb-2">
              Salesforce Validation Rules Manager
            </h1>
            <p className="text-muted mb-0">
              Manage Account validation rules directly from your web application with secure OAuth and Salesforce Tooling API.
            </p>
          </div>

          <div className="hero-meta text-end">
            <div className="meta-pill">Live sync + toggle support</div>
          </div>
        </div>

        <Toolbar
          loading={loading}
          authStatus={authStatus}
          loginUrl={loginUrl}
          onFetch={getRules}
          onToggleAll={toggleAll}
          onDeploy={deploy}
          onLogout={handleLogout}
        />

        {message && (
          <div className={`alert alert-${message.type} mt-3`} role="alert">
            {message.text}
          </div>
        )}

        {loading && (
          <div className="d-flex align-items-center gap-3 mt-3">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <span className="text-muted">
              Processing request, please wait...
            </span>
          </div>
        )}
      </section>

      <section className="app-panel card shadow-sm border-0 p-4 rounded-4">
        <RuleTable
          rules={rules}
          updatingRuleIds={updatingRuleIds}
          onToggle={toggleRule}
        />

        {!loading && rules.length === 0 && (
          <p className="text-muted mt-3">
            No rules loaded. Click "Get Validation Rules" to begin.
          </p>
        )}
      </section>
    </div>
  );
}

export default App;
