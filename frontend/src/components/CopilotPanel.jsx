import { Bot, CalendarClock, CheckCircle2, ChevronRight, Play, XCircle } from "lucide-react";
import { EmptyState } from "./EmptyState.jsx";
import { label } from "../utils/i18n.js";

export function CopilotPanel({
  activities,
  command,
  provider,
  result,
  loading,
  setCommand,
  setProvider,
  onRunCommand,
  onAcceptPending,
  onDeclinePending,
  onHide
}) {
  const providerName = provider === "openai" ? "OpenAI API" : "Ollama";

  return (
    <aside className="copilot">
      <div className="copilotHeader">
        <div className="copilotTitle">
          <Bot size={22} />
          <div>
            <strong>Assistant {providerName}</strong>
          </div>
        </div>
        <button type="button" className="copilotHideButton" onClick={onHide} aria-label="Skrij AI asistenta">
          <ChevronRight size={18} />
        </button>
      </div>

      <form onSubmit={onRunCommand} className="commandForm">
        <div className="segmented">
          <button type="button" className={provider === "openai" ? "selected" : ""} onClick={() => setProvider("openai")}>OpenAI</button>
          <button type="button" className={provider === "ollama" ? "selected" : ""} onClick={() => setProvider("ollama")}>Ollama</button>
        </div>
        <textarea value={command} onChange={(event) => setCommand(event.target.value)} rows={7} />
        <button className="primary runButton" disabled={loading}>
          <Play size={17} />
          {label("run")}
        </button>
      </form>

      <div className="resultPanel">
        <div className="sectionHeader compact">
          <h2>{label("result")}</h2>
          {result?.interpreted?.intent && <span>{result.interpreted.intent}</span>}
        </div>
        {loading ? (
          <div className="chatBubble assistantBubble copilotTyping" aria-label="Assistant pripravlja odgovor">
            <span />
            <span />
            <span />
          </div>
        ) : result ? (
          <div className="resultContent chatBubble assistantBubble" key={result.result?.message || result.interpreted?.message || result.interpreted?.intent}>
            <p>{result.result?.message || result.interpreted?.message}</p>
            {result.result?.workOrder && (
              <div className="resultSummary">
                <CheckCircle2 size={18} />
                <div>
                  <strong>{result.result.workOrder.code}</strong>
                  <span>{result.result.phases.length} {label("phasesShort")} - {result.result.workOrder.inventoryStatus}</span>
                </div>
              </div>
            )}
            {result.pendingAction?.status === "pending" && (
              <div className="confirmationCard">
                <div>
                  <strong>Confirmation required</strong>
                  <span>{result.pendingAction.previewMessage || result.result?.message}</span>
                </div>
                <div className="confirmationActions">
                  <button type="button" className="primary acceptButton" onClick={() => onAcceptPending?.(result.pendingAction.id)} disabled={loading}>
                    <CheckCircle2 size={16} />
                    Accept
                  </button>
                  <button type="button" className="iconText declineButton" onClick={() => onDeclinePending?.(result.pendingAction.id)} disabled={loading}>
                    <XCircle size={16} />
                    Decline
                  </button>
                </div>
              </div>
            )}
            <pre>{JSON.stringify(result.interpreted, null, 2)}</pre>
          </div>
        ) : (
          <EmptyState label={label("waitingForCommand")} />
        )}
      </div>

      <div className="activityPanel">
        <div className="sectionHeader compact">
          <h2>{label("activityLog")}</h2>
          <CalendarClock size={16} />
        </div>
        {activities.map((activity) => (
          <div className="activityItem" key={activity._id}>
            <strong>{activity.mcpTool || activity.action}</strong>
            <span>{activity.llmProvider} - {activity.durationMs} ms</span>
          </div>
        ))}
      </div>
    </aside>
  );
}
