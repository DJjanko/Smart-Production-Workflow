export function WorkloadPanel({ employees }) {
  return (
    <div className="surface workload">
      <div className="sectionHeader">
        <h2>Zasedenost</h2>
        <span>ure / faze</span>
      </div>
      <div className="workloadList">
        {employees.map((employee) => (
          <div className="workloadItem" key={employee.id}>
            <div>
              <strong>{employee.name}</strong>
              <span>{employee.skills.join(", ")}</span>
            </div>
            <div className="barTrack">
              <div style={{ width: `${Math.min(100, employee.hours * 8)}%` }} />
            </div>
            <b>{employee.hours}h / {employee.phaseCount}</b>
          </div>
        ))}
      </div>
    </div>
  );
}
