import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import axe from "axe-core";
import {
  CheckboxField,
  FieldArea,
  FieldText,
  SelectField,
  StringListField,
} from "../../src/components/FormFields.jsx";
import { Modal } from "../../src/components/Modal.jsx";
import { ItemList } from "../../src/components/ItemList.jsx";
import { DataTypeTabList } from "../../src/components/DataTypeTabList.jsx";

async function expectNoA11yViolations(container, options = {}) {
  const results = await axe.run(container, {
    rules: {
      // jsdom does not implement full CSS/color; skip color-contrast noise
      "color-contrast": { enabled: false },
      ...options.rules,
    },
    ...options,
  });

  const condensed = results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    nodes: violation.nodes.map((node) => node.target),
  }));

  expect(condensed, JSON.stringify(condensed, null, 2)).toEqual([]);
}

describe("a11y component tagging", () => {
  it("FormFields expose labelled controls", async () => {
    const { container, getByLabelText } = render(
      <div>
        <FieldText label="Company" value="Acme" onChange={() => {}} />
        <FieldArea label="Summary" value="Built things" onChange={() => {}} />
        <SelectField
          label="Category"
          value="professional"
          onChange={() => {}}
          options={["professional", "hobby"]}
        />
        <CheckboxField label="Current role" checked onChange={() => {}} />
        <StringListField
          label="Skills"
          values={["TypeScript"]}
          onChange={() => {}}
        />
      </div>,
    );

    expect(getByLabelText("Company")).toBeInTheDocument();
    expect(getByLabelText("Summary")).toBeInTheDocument();
    expect(getByLabelText("Category")).toBeInTheDocument();
    expect(getByLabelText("Current role")).toBeInTheDocument();
    expect(getByLabelText("Skills item 1")).toBeInTheDocument();
    expect(getByLabelText("Remove Skills item 1")).toBeInTheDocument();

    await expectNoA11yViolations(container);
  });

  it("Modal uses dialog tagging and accessible close controls", async () => {
    const { container, getByRole, getByLabelText } = render(
      <Modal title="Edit project" onClose={() => {}}>
        <p>Body copy</p>
      </Modal>,
    );

    const dialog = getByRole("dialog", { name: "Edit project" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(getByLabelText("Close dialog")).toBeInTheDocument();
    expect(getByRole("button", { name: "Close" })).toBeInTheDocument();

    await expectNoA11yViolations(container);
  });

  it("ItemList tags edit and reorder controls", async () => {
    const { container, getByRole, getByLabelText } = render(
      <ItemList
        onReorder={() => {}}
        items={[
          {
            key: "a",
            title: "Project A",
            meta: "2022-01",
            misaligned: true,
            onClick: () => {},
          },
          {
            key: "b",
            title: "Project B",
            meta: "2021-01",
            onClick: () => {},
          },
        ]}
      />,
    );

    expect(getByRole("list", { name: "Editable items" })).toBeInTheDocument();
    expect(getByLabelText("Edit Project A")).toBeInTheDocument();
    expect(
      getByLabelText(/Reorder Project A\. Drag, or use arrow keys to move\./),
    ).toBeInTheDocument();
    expect(getByLabelText("Edit Project B")).toBeInTheDocument();

    await expectNoA11yViolations(container);
  });

  it("DataTypeTabList uses tablist/tab tagging", async () => {
    const { container, getByRole } = render(
      <div>
        <DataTypeTabList
          activeId="projects"
          onChange={() => {}}
          idPrefix="test"
        />
        <div
          role="tabpanel"
          id="test-panel-projects"
          aria-labelledby="test-projects"
        >
          Projects panel
        </div>
      </div>,
    );

    expect(
      getByRole("tablist", { name: "Resume data types" }),
    ).toBeInTheDocument();
    expect(getByRole("tab", { name: "Projects" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(getByRole("tab", { name: "Experience" })).toHaveAttribute(
      "aria-selected",
      "false",
    );

    await expectNoA11yViolations(container);
  });
});
