import { Menu } from "@ark-ui/react/menu";
import { Portal } from "@ark-ui/react/portal";
import { ExternalLink, FolderOpen } from "lucide-react";
import { type ReactNode, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { sva } from "styled-system/css";

import type { FilePathKind } from "../../../../fileLinks/types";
import { activateFileLink } from "../../services/client";
import { reportPromiseErrors } from "../../services/errors";
import { useFileLinkSession } from "./context";

const positioning = { gutter: 4, placement: "bottom-start" as const },
  fileMenu = sva({
    base: {
      content: {
        background: "bg.default",
        borderColor: "border.default",
        borderRadius: "none",
        borderWidth: "hairline",
        boxShadow: "menu",
        padding: "1",
        width: "max",
        zIndex: "dropdown",
      },
      item: {
        _highlighted: { background: "bg.emphasized" },
        alignItems: "center",
        background: "transparent",
        borderWidth: "0",
        color: "fg.default",
        cursor: "pointer",
        display: "flex",
        fontFamily: "body",
        gap: "2",
        minHeight: "controlTarget",
        paddingBlock: "1.5",
        paddingInline: "2",
        textAlign: "left",
        whiteSpace: "nowrap",
        width: "full",
      },
      positioner: { zIndex: "dropdown" },
      trigger: {
        _focusVisible: { layerStyle: "focusRing" },
        background: "transparent",
        borderWidth: "0",
        color: "current",
        cursor: "pointer",
        display: "inline",
        font: "inherit",
        lineHeight: "inherit",
        padding: "0",
        textAlign: "inherit",
        verticalAlign: "baseline",
        whiteSpace: "inherit",
      },
    },
    defaultVariants: { decoration: "label" },
    slots: ["trigger", "label", "positioner", "content", "item"],
    variants: {
      decoration: {
        label: { label: { textStyle: "pathUnderline" } },
        tokens: {},
      },
    },
  });
export function FileLinkMenu({
  children,
  decoration = "label",
  kind,
  path,
}: {
  children: ReactNode;
  decoration?: "label" | "tokens";
  kind: FilePathKind;
  path: string;
}) {
  const { t } = useTranslation("conversation"),
    classes = fileMenu({ decoration }),
    sessionId = useFileLinkSession(),
    open = useCallback(() => {
      reportPromiseErrors(activateFileLink(sessionId, path, "open"));
    }, [path, sessionId]),
    reveal = useCallback(() => {
      reportPromiseErrors(activateFileLink(sessionId, path, "reveal"));
    }, [path, sessionId]);
  return (
    <Menu.Root positioning={positioning}>
      <Menu.Trigger className={classes.trigger} title={path} type="button">
        <span className={classes.label}>{children}</span>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner className={classes.positioner}>
          <Menu.Content className={classes.content}>
            <Menu.Item asChild value="open" onSelect={open}>
              <button className={classes.item} type="button">
                <ExternalLink aria-hidden size={14} />
                {t("openFileLink")}
              </button>
            </Menu.Item>
            {kind === "file" ? (
              <Menu.Item asChild value="reveal" onSelect={reveal}>
                <button className={classes.item} type="button">
                  <FolderOpen aria-hidden size={14} />
                  {t("revealFileLink")}
                </button>
              </Menu.Item>
            ) : null}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}
