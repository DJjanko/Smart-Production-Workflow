import { EmptyState } from "./EmptyState.jsx";
import { StatusBadge } from "./StatusBadge.jsx";
import { formatDate } from "../utils/date.js";

export function TimelinePanel({ timeline }) {
  return (
    <div className="surface timeline">
      <div className="sectionHeader">
        <h2>Casovnica Faz</h2>
        <span>{timeline.length} faz</span>
      </div>
      <div className="timelineList">
        {timeline.map((phase) => (
          <div className="phaseItem" key={phase._id}>
            <div className="phaseTime">{formatDate(phase.start)} - {formatDate(phase.end)}</div>
            <div className="phaseBody">
              <strong>{phase.name}</strong>
              <span>{phase.assignedToName} · {phase.requiredSkill}</span>
            </div>
            <StatusBadge value={phase.status} />
          </div>
        ))}
        {timeline.length === 0 && <EmptyState label="Casovnica je prazna" />}
      </div>
    </div>
  );
}
