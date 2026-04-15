import { describe, it, expect } from "vitest";
import { tokenize } from "./tokenizer";

describe("tokenize", () => {
  it("returns plain text for a simple string", () => {
    const result = tokenize("go north");
    expect(result).toEqual([{ type: "text", value: "go north" }]);
  });

  it("parses (img:waypoint) as an icon token", () => {
    const result = tokenize("get (img:waypoint)");
    expect(result).toEqual([
      { type: "text", value: "get " },
      { type: "icon", value: "waypoint" },
    ]);
  });

  it("parses multiple icon types", () => {
    const icons = ["waypoint", "checkpoint", "quest_2", "portal", "skill", "support", "in-out2", "lab"];
    for (const icon of icons) {
      const result = tokenize(`(img:${icon})`);
      expect(result).toEqual([{ type: "icon", value: icon }]);
    }
  });

  it("parses (color:hex)text as color tokens", () => {
    const result = tokenize("(color:red)important info");
    expect(result).toEqual([
      { type: "color_start", value: "", color: "red" },
      { type: "text", value: "important info" },
    ]);
  });

  it("parses (color:cc99ff)location_name", () => {
    const result = tokenize("go to (color:cc99ff)mysterious_campsite");
    expect(result).toEqual([
      { type: "text", value: "go to " },
      { type: "color_start", value: "", color: "cc99ff" },
      { type: "text", value: "mysterious_campsite" },
    ]);
  });

  it("parses (hint)_ prefix", () => {
    const result = tokenize("(hint)_ this is a hint");
    expect(result).toEqual([{ type: "text", value: "this is a hint" }]);
  });

  it("parses (hint)__ prefix (double underscore)", () => {
    const result = tokenize("(hint)__ indented hint");
    expect(result).toEqual([{ type: "text", value: "indented hint" }]);
  });

  it("parses areaid with zone name", () => {
    const result = tokenize("enter areaidg1_town ;; clearfell encampment");
    expect(result).toEqual([
      { type: "text", value: "enter " },
      { type: "zone", value: "clearfell encampment", zoneId: "g1_town" },
    ]);
  });

  it("parses arena: references", () => {
    const result = tokenize("arena:devourer in the cave");
    expect(result).toEqual([
      { type: "arena", value: "devourer" },
      { type: "text", value: " in the cave" },
    ]);
  });

  it("parses (quest:name) references", () => {
    const result = tokenize("kill boss for (quest:ring)");
    expect(result).toEqual([
      { type: "text", value: "kill boss for " },
      { type: "quest", value: "ring" },
    ]);
  });

  it("parses || as separator", () => {
    const result = tokenize("do thing || go somewhere");
    expect(result).toEqual([
      { type: "text", value: "do thing " },
      { type: "separator", value: "||" },
      { type: "text", value: " go somewhere" },
    ]);
  });

  it("parses kill keyword with enemy name", () => {
    const result = tokenize("kill the_bloated_miller");
    expect(result).toEqual([
      { type: "kill", value: "kill" },
      { type: "text", value: " the_bloated_miller" },
    ]);
  });

  it("handles complex mixed markup", () => {
    const input = "(img:quest_2) renly: (img:skill) || enter areaidg1_2 ;; clearfell";
    const result = tokenize(input);
    expect(result.length).toBeGreaterThan(3);
    expect(result.find((t) => t.type === "icon" && t.value === "quest_2")).toBeTruthy();
    expect(result.find((t) => t.type === "icon" && t.value === "skill")).toBeTruthy();
    expect(result.find((t) => t.type === "separator")).toBeTruthy();
    expect(result.find((t) => t.type === "zone" && t.zoneId === "g1_2")).toBeTruthy();
  });

  it("handles color followed by another markup", () => {
    const input = "(color:ff00ff)2_tasks: get (img:waypoint)";
    const result = tokenize(input);
    const colorToken = result.find((t) => t.type === "color_start");
    const iconToken = result.find((t) => t.type === "icon");
    expect(colorToken).toBeTruthy();
    expect(colorToken!.color).toBe("ff00ff");
    expect(iconToken).toBeTruthy();
    expect(iconToken!.value).toBe("waypoint");
  });
});
