import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { css } from "styled-system/css";

import { localize } from "../../i18n";
import { reportError } from "../../services/errors";

const image = css({
    display: "block",
    height: "auto",
    justifySelf: "start",
    maxWidth: "full",
  }),
  errorText = css({ color: "fg.error" }),
  pendingText = css({ color: "fg.muted" }),
  svgNamespace = "http://www.w3.org/2000/svg";
type DiagramLanguage = "mermaid" | "svg";
interface DiagramResult {
  code: string;
  language: DiagramLanguage;
  image?: { alt?: string; src: string; width?: number; height?: number };
}

export function Diagram({ code, language }: { code: string; language: DiagramLanguage }) {
  const { t } = useTranslation("conversation"),
    [result, setResult] = useState<DiagramResult>(),
    label = language === "svg" ? "SVG" : "Mermaid",
    showError = useCallback(() => setResult({ code, language }), [code, language, setResult]);
  useEffect(() => {
    let cancelled = false;
    const render = async () => {
      try {
        let markup = code;
        if (language === "mermaid") {
          const { buildMermaidSvg } = await import("./mermaidSvg");
          if (cancelled) {
            return;
          }
          markup = await buildMermaidSvg(code);
        }
        if (!cancelled) {
          setResult({ code, image: svgImage(markup), language });
        }
      } catch (error: unknown) {
        if (!cancelled) {
          reportError(error, { language });
          showError();
        }
      }
    };
    void render();
    return () => {
      cancelled = true;
    };
  }, [code, language, showError]);
  if (result?.code !== code || result.language !== language) {
    return <output className={pendingText}>{t("diagram.rendering", { language: label })}</output>;
  }
  if (!result.image) {
    return <p className={errorText}>{t("diagram.invalid", { language: label })}</p>;
  }
  const { alt, height, src, width } = result.image;
  return (
    <img
      alt={alt ?? t("diagram.label", { language: label })}
      className={image}
      height={height}
      onError={showError}
      src={src}
      width={width}
    />
  );
}

function svgImage(markup: string) {
  const { documentElement: root } = new DOMParser().parseFromString(markup, "image/svg+xml");
  if (
    root.localName !== "svg" ||
    (root.namespaceURI !== svgNamespace && root.namespaceURI !== null)
  ) {
    throw new Error(localize("diagnostics:markdown.svgInvalid"));
  }
  if (root.namespaceURI === null) {
    root.setAttribute("xmlns", svgNamespace);
  }
  const [, , viewWidth, viewHeight] =
    root
      .getAttribute("viewBox")
      ?.trim()
      .split(/[\s,]+/u) ?? [];
  return {
    alt: root.querySelector(":scope > title")?.textContent.trim() || undefined,
    height: pixelDimension(root.getAttribute("height")) ?? pixelDimension(viewHeight),
    src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(root.outerHTML)}`,
    width: pixelDimension(root.getAttribute("width")) ?? pixelDimension(viewWidth),
  };
}

function pixelDimension(value?: string | null) {
  const size = Number(value?.trim().replace(/px$/u, ""));
  return Number.isFinite(size) && size > 0 ? Math.ceil(size) : undefined;
}
