import { useEffect, useState } from "react";

export function SafeOrb(props) {
  const [OrbComponent, setOrbComponent] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let mounted = true;

    import("./Orb.jsx")
      .then((module) => {
        if (mounted) {
          setOrbComponent(() => module.default);
        }
      })
      .catch((error) => {
        console.error(error);
        if (mounted) {
          setFailed(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (failed || !OrbComponent) {
    return <div className="orbFallback" />;
  }

  return <OrbComponent {...props} onFail={() => setFailed(true)} />;
}
