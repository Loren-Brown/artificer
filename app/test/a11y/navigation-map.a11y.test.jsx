import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import {
  DATA_TYPE_TABS,
  DataTypeTabList,
  dataTypePanelProps,
} from "../../src/components/DataTypeTabList.jsx";
import { Modal } from "../../src/components/Modal.jsx";

/**
 * Navigation map under test
 * -------------------------
 * 1) Primary chrome
 *    tablist "Resume data types"
 *      tab[i] --ArrowRight--> tab[i+1] (focus + aria-selected)
 *      tab[i] --ArrowLeft---> tab[i-1]
 *      tab[i] --Home--------> first tab
 *      tab[i] --End---------> last tab
 *      selected tab --controls--> tabpanel labelled by that tab
 *
 * 2) Dialog overlay
 *    trigger button --opens--> dialog[aria-modal]
 *      Escape | "Close" | backdrop "Close dialog" --closes--> returns focus to trigger
 */

function TabShell() {
  const [activeId, setActiveId] = useState("resume");
  const prefix = "nav-map";
  const active = DATA_TYPE_TABS.find((tab) => tab.id === activeId);

  return (
    <div>
      <DataTypeTabList
        activeId={activeId}
        onChange={setActiveId}
        idPrefix={prefix}
      />
      <div {...dataTypePanelProps(prefix, activeId)}>
        <p>{active.label} panel content</p>
      </div>
    </div>
  );
}

function ModalHost() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Open editor
      </button>
      {open ? (
        <Modal title="Edit item" onClose={() => setOpen(false)}>
          <label htmlFor="modal-field">
            Name
            <input id="modal-field" defaultValue="Sample" />
          </label>
        </Modal>
      ) : null}
    </div>
  );
}

describe("a11y navigation maps", () => {
  it("moves selection and focus across the data-type tablist", async () => {
    const user = userEvent.setup();
    render(<TabShell />);

    const resume = screen.getByRole("tab", { name: "Resume" });
    const experience = screen.getByRole("tab", {
      name: "Experience",
    });
    const projects = screen.getByRole("tab", { name: "Projects" });
    const education = screen.getByRole("tab", { name: "Education" });
    const certifications = screen.getByRole("tab", {
      name: "Certifications",
    });

    experience.focus();
    await user.click(experience);
    expect(experience).toHaveFocus();
    expect(experience).toHaveAttribute("aria-selected", "true");
    expect(experience.tabIndex).toBe(0);

    await user.keyboard("{ArrowRight}");
    expect(projects).toHaveAttribute("aria-selected", "true");
    expect(projects).toHaveFocus();
    expect(projects.tabIndex).toBe(0);
    expect(experience.tabIndex).toBe(-1);
    expect(
      screen.getByRole("tabpanel", { name: "Projects" }),
    ).toHaveTextContent("Projects panel content");

    await user.keyboard("{Home}");
    expect(resume).toHaveAttribute("aria-selected", "true");
    expect(resume).toHaveFocus();

    await user.keyboard("{End}");
    expect(education).toHaveAttribute("aria-selected", "true");
    expect(education).toHaveFocus();

    await user.keyboard("{ArrowLeft}");
    expect(certifications).toHaveFocus();
    expect(
      screen.getByRole("tabpanel", { name: "Certifications" }),
    ).toBeInTheDocument();
  });

  it("wires tab to tabpanel via aria-controls / aria-labelledby", () => {
    render(<TabShell />);

    const resume = screen.getByRole("tab", { name: "Resume" });
    const panel = screen.getByRole("tabpanel", { name: "Resume" });

    expect(resume.getAttribute("aria-controls")).toBe(panel.id);
    expect(panel.getAttribute("aria-labelledby")).toBe(resume.id);
  });

  it("closes the dialog with Escape and restores focus to the opener", async () => {
    const user = userEvent.setup();
    render(<ModalHost />);

    const opener = screen.getByRole("button", { name: "Open editor" });
    await user.click(opener);

    const dialog = screen.getByRole("dialog", { name: "Edit item" });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("closes the dialog from the labelled dismiss control", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal title="Edit item" onClose={onClose}>
        <p>Body</p>
      </Modal>,
    );

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
