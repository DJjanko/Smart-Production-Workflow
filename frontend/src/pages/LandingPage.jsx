import { AlertTriangle, LogIn } from "lucide-react";
import { SiExpress, SiMongodb, SiNodedotjs, SiOpenai, SiReact } from "react-icons/si";
import GlassSurface from "../components/GlassSurface.jsx";
import LogoLoop from "../components/LogoLoop.jsx";
import { SafeSilk } from "../components/SafeSilk.jsx";
import logo from "../images/logo.png";

const techLogos = [
  { node: <SiMongodb />, title: "MongoDB", ariaLabel: "MongoDB" },
  { node: <SiExpress />, title: "Express", ariaLabel: "Express" },
  { node: <SiReact />, title: "React", ariaLabel: "React" },
  { node: <SiNodedotjs />, title: "Node.js", ariaLabel: "Node.js" },
  { node: <SiOpenai />, title: "OpenAI API", ariaLabel: "OpenAI API" }
];

export function LandingPage({ error, loading, login, setLogin, onLogin, onAbout }) {
  return (
    <main className="landingPage">
      <div className="landingSilk" aria-hidden="true">
        <SafeSilk
          speed={5}
          scale={1.2}
          color="#5227ff"
          noiseIntensity={0.9}
          rotation={0.36}
        />
      </div>

      <GlassSurface
        width="min(90vw, 980px)"
        height={72}
        borderRadius={14}
        borderWidth={0.03}
        brightness={50}
        opacity={0.93}
        blur={11}
        displace={0.5}
        backgroundOpacity={0.1}
        saturation={1}
        distortionScale={-180}
        redOffset={0}
        greenOffset={10}
        blueOffset={20}
        className="landingNavGlass"
      >
        <nav className="landingNav" aria-label="Landing">
          <span className="landingNavLogo">
            <img src={logo} alt="Smart Production Workflow logo" />
          </span>
          <div className="landingNavActions">
            <span className="landingNavTagline">AI-Powered Production Workflow</span>
          </div>
        </nav>
      </GlassSurface>

      <section className="landingContent">
        <div className="landingCenterPanel">
          <div className="landingBrand">
            <div>
              <p>WorkOrder AI</p>
              <h1>Smart Production Workflow</h1>
              <span>Production orders, inventory checks, and employee phase planning in one workspace.</span>
            </div>
          </div>

          {error && (
            <div className="alert landingAlert">
              <AlertTriangle size={18} />
              {error}
            </div>
          )}

          <form className="landingLogin" onSubmit={onLogin}>
            <label>
              Email
              <input value={login.email} onChange={(event) => setLogin({ ...login, email: event.target.value })} />
            </label>
            <label>
              Password
              <input type="password" value={login.password} onChange={(event) => setLogin({ ...login, password: event.target.value })} autoComplete="off" />
            </label>
            <div className="landingActions">
              <button className="primary landingButton" disabled={loading}>
                <LogIn size={17} />
                Prijava
              </button>
              <GlassSurface
                width={150}
                height={44}
                borderRadius={14}
                borderWidth={0.03}
                brightness={50}
                opacity={0.93}
                blur={11}
                displace={0.5}
                backgroundOpacity={0.1}
                saturation={1}
                distortionScale={-180}
                redOffset={0}
                greenOffset={10}
                blueOffset={20}
                className="landingSecondaryGlass"
              >
                <button type="button" className="landingSecondaryButton" onClick={onAbout}>O projektu</button>
              </GlassSurface>
            </div>
          </form>
        </div>
      </section>

      <GlassSurface
        width="min(92vw, 760px)"
        height={64}
        borderRadius={14}
        borderWidth={0.03}
        brightness={50}
        opacity={0.93}
        blur={11}
        displace={0.5}
        backgroundOpacity={0.1}
        saturation={1}
        distortionScale={-180}
        redOffset={0}
        greenOffset={10}
        blueOffset={20}
        className="landingLogoLoopGlass"
      >
        <div className="landingLogoLoop">
          <LogoLoop
            logos={techLogos}
            speed={48}
            direction="left"
            logoHeight={24}
            gap={44}
            hoverSpeed={0}
            ariaLabel="Technology stack"
          />
        </div>
      </GlassSurface>
    </main>
  );
}
