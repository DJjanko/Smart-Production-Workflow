import { memo, useMemo } from "react";
import "./LogoLoop.css";

const toCssLength = (value) => (typeof value === "number" ? `${value}px` : (value ?? undefined));

export const LogoLoop = memo(
  ({
    logos,
    speed = 120,
    direction = "left",
    width = "100%",
    logoHeight = 28,
    gap = 32,
    hoverSpeed,
    scaleOnHover = false,
    renderItem,
    ariaLabel = "Partner logos",
    className,
    style
  }) => {
    const duration = Math.max(14, 1200 / Math.max(1, Math.abs(speed)));
    const shouldPauseOnHover = hoverSpeed === 0;

    const rootStyle = {
      width: toCssLength(width) ?? "100%",
      "--logoloop-gap": `${gap}px`,
      "--logoloop-logoHeight": `${logoHeight}px`,
      "--logoloop-duration": `${duration}s`,
      "--logoloop-direction": direction === "right" ? "reverse" : "normal",
      ...style
    };

    const rootClassName = [
      "logoloop",
      scaleOnHover && "logoloop--scale-hover",
      shouldPauseOnHover && "logoloop--pause-hover",
      className
    ]
      .filter(Boolean)
      .join(" ");

    const renderLogoItem = (item, key) => {
      if (renderItem) {
        return (
          <li className="logoloop__item" key={key} role="listitem">
            {renderItem(item, key)}
          </li>
        );
      }

      const isNodeItem = "node" in item;
      const content = isNodeItem ? (
        <span className="logoloop__node" aria-hidden={!!item.href && !item.ariaLabel}>
          {item.node}
        </span>
      ) : (
        <img
          src={item.src}
          srcSet={item.srcSet}
          sizes={item.sizes}
          width={item.width}
          height={item.height}
          alt={item.alt ?? ""}
          title={item.title}
          loading="lazy"
          decoding="async"
          draggable={false}
        />
      );

      const itemAriaLabel = isNodeItem ? (item.ariaLabel ?? item.title) : (item.alt ?? item.title);
      const itemContent = item.href ? (
        <a className="logoloop__link" href={item.href} aria-label={itemAriaLabel || "logo link"} target="_blank" rel="noreferrer noopener">
          {content}
        </a>
      ) : (
        content
      );

      return (
        <li className="logoloop__item" key={key} role="listitem">
          {itemContent}
        </li>
      );
    };

    const logoGroups = useMemo(
      () =>
        [0, 1, 2].map((copyIndex) => (
          <ul className="logoloop__list" key={copyIndex} role="list" aria-hidden={copyIndex > 0}>
            {logos.map((item, itemIndex) => renderLogoItem(item, `${copyIndex}-${itemIndex}`))}
          </ul>
        )),
      [logos, renderItem]
    );

    return (
      <div className={rootClassName} style={rootStyle} role="region" aria-label={ariaLabel}>
        <div className="logoloop__track">{logoGroups}</div>
      </div>
    );
  }
);

LogoLoop.displayName = "LogoLoop";

export default LogoLoop;
