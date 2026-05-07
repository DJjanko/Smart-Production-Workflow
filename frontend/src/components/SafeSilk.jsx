import { useEffect, useState } from "react";

export function SafeSilk(props) {
  const [SilkComponent, setSilkComponent] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let mounted = true;

    import("./Silk.jsx")
      .then((module) => {
        if (mounted) {
          setSilkComponent(() => module.default);
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

  if (failed || !SilkComponent) {
    return <div className="silkFallback" />;
  }

  return <SilkComponent {...props} />;
}
