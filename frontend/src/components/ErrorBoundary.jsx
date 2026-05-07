import { Component } from "react";

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error(error);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="fallbackPage">
          <div className="fallbackPanel">
            <h1>Smart Production Workflow</h1>
            <p>{this.state.error.message || "Frontend render error."}</p>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
