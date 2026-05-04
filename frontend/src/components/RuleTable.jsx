function RuleTable({ rules, updatingRuleIds, onToggle }) {
  if (rules.length === 0) {
    return null;
  }

  return (
    <div className="table-responsive">
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rules.map(rule => {
            const isUpdating = updatingRuleIds.includes(rule.Id);

            return (
              <tr key={rule.Id}>
                <td>{rule.ValidationName}</td>
                <td>
                  <span className={`badge ${rule.Active ? 'bg-success' : 'bg-secondary'}`}>
                    {rule.Active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <button
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => onToggle(rule.Id, rule.Active)}
                    disabled={isUpdating}
                  >
                    {isUpdating ? 'Updating...' : rule.Active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default RuleTable;
