import { test, expect, type Page, type Locator } from "@playwright/test";
import { createInitialState } from "../../src/game/engine";

const PROFILE = "Workspace UI";
const profileId = "workspace-ui";

async function openApp(page: Page, app: string) {
  await page.getByTestId(`app-${app}`).click();
  await expect(page.getByTestId(`window-${app}`)).toBeVisible();
}
async function command(page: Page, value: string) {
  const input = page.getByTestId("terminal-input");
  await expect(input).toBeFocused();
  await input.fill(value);
  await page.keyboard.press("Enter");
  await expect(input).toHaveValue("");
}
async function rect(locator: Locator) {
  const value = await locator.boundingBox();
  expect(value).not.toBeNull();
  return value!;
}
async function resize(page: Page, dx: number, dy: number) {
  const handle = await rect(page.getByTestId("resize-terminal"));
  const x = handle.x + handle.width / 2;
  const y = handle.y + handle.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 6 });
  await page.mouse.up();
  await expect(page.getByTestId("terminal-input")).toBeFocused();
}
async function readSave(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem("horizon-save-v3")!).state);
}

test.beforeEach(async ({ page }) => {
  const state = createInitialState({ name: PROFILE, avatar: "a2", lang: "fr", createdAt: 1700000000000 });
  state.introSeen = true;
  state.sound.muted = true;
  state.xp = 85;
  state.skills.dns = { level: "learning", xp: 10, attempts: 1, successes: 1 };
  await page.addInitScript((initial) => {
    if (!localStorage.getItem("horizon-save-v3")) localStorage.setItem("horizon-save-v3", JSON.stringify({ version: 3, savedAt: Date.now(), state: initial }));
  }, state);
  await page.goto("/desktop");
  await expect(page.getByTestId("desktop")).toBeVisible();
});

test("resize preserves native selection and reset changes only window geometry", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await openApp(page, "terminal");
  const input = page.getByTestId("terminal-input");
  const initial = await rect(page.getByTestId("window-terminal"));
  await input.fill("echo resize-safe");
  await input.evaluate((field) => (field as HTMLInputElement).setSelectionRange(5, 11));
  await resize(page, -220, -140);
  const smaller = await rect(page.getByTestId("window-terminal"));
  expect(smaller.width).toBeCloseTo(initial.width - 220, 0);
  expect(smaller.height).toBeCloseTo(initial.height - 140, 0);
  expect(await input.evaluate((field) => [(field as HTMLInputElement).selectionStart, (field as HTMLInputElement).selectionEnd])).toEqual([5, 11]);
  await page.keyboard.type("done");
  await expect(input).toHaveValue("echo done-safe");
  await page.getByTestId("maximize-terminal").click();
  await expect(input).toBeFocused();
  await page.getByTestId("maximize-terminal").click();
  expect((await rect(page.getByTestId("window-terminal"))).width).toBeCloseTo(smaller.width, 0);
  await expect(input).toHaveValue("echo done-safe");
  await page.getByTestId("reset-layout-terminal").click();
  await expect(input).toBeFocused();
  expect((await rect(page.getByTestId("window-terminal"))).width).toBeCloseTo(initial.width, 0);
  await expect.poll(async () => (await readSave(page)).xp).toBe(85);
  await expect(input).toHaveValue("echo done-safe");
});

test("dimensions and drafts survive reload and are written to PostgreSQL", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await openApp(page, "terminal");
  await command(page, "whoami");
  await page.getByTestId("terminal-input").fill("ping intranet.horizon");
  await resize(page, -210, -130);
  const savedRect = await rect(page.getByTestId("window-terminal"));
  await page.getByTestId("terminal-host").selectOption("PC-MARIE");
  await page.getByTestId("terminal-input").fill("ip addr");
  await openApp(page, "chat");
  await page.getByTestId("chat-input").fill("Rapport IT en cours");
  await page.getByTestId("window-chat").getByRole("button", { name: "SOC", exact: true }).click();
  await page.getByTestId("chat-input").fill("Message réservé au SOC");
  await openApp(page, "terminal");
  await page.getByRole("button", { name: "Sauvegarde", exact: true }).click();
  await expect(page.getByTestId("save-status")).toHaveAttribute("data-result", "server");
  const response = await page.request.get(`/api/save?profileId=${profileId}`);
  expect(response.ok()).toBe(true);
  const persisted = (await response.json()).state;
  expect(persisted.workspace.terminal.sessions["WS-001"].draft).toBe("ping intranet.horizon");
  expect(persisted.workspace.chat.drafts.itsupport).toBe("Rapport IT en cours");
  expect(persisted.workspace.windows.terminal.width).toBeCloseTo(savedRect.width, 0);
  await page.reload();
  const input = page.getByTestId("terminal-input");
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("ip addr");
  await expect.poll(async () => (await rect(page.getByTestId("window-terminal"))).width).toBeCloseTo(savedRect.width, 0);
  await page.getByTestId("terminal-host").selectOption("WS-001");
  await expect(input).toHaveValue("ping intranet.horizon");
  await expect(page.getByTestId("terminal-output")).toContainText("student");
  const local = await readSave(page);
  expect(local.terminalHistory["WS-001"]).toEqual(["whoami"]);
  expect(local.xp).toBe(85);
  expect(local.skills.dns.level).toBe("learning");
  await openApp(page, "chat");
  await expect(page.getByTestId("chat-input")).toHaveValue("Message réservé au SOC");
  await page.getByTestId("window-chat").getByRole("button", { name: "IT-SUPPORT", exact: true }).click();
  await expect(page.getByTestId("chat-input")).toHaveValue("Rapport IT en cours");
});

test("editor draft is recovered after reload but not applied until explicitly saved", async ({ page }) => {
  await openApp(page, "terminal");
  await command(page, "sudo nano /etc/resolv.conf");
  const editor = page.getByRole("textbox", { name: "Contenu du fichier" });
  await expect(editor).toBeFocused();
  await editor.fill("nameserver 10.0.0.10\n# draft recovered");
  await expect.poll(async () => (await readSave(page)).workspace.editorDraft?.content).toContain("draft recovered");
  await page.reload();
  await expect(editor).toBeFocused();
  await expect(editor).toHaveValue("nameserver 10.0.0.10\n# draft recovered");
  expect((await readSave(page)).world.hosts["WS-001"].dns).toEqual(["192.168.1.53"]);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("terminal-input")).toBeFocused();
  await command(page, "cat /etc/resolv.conf");
  await expect(page.getByTestId("terminal-output")).toContainText("nameserver 192.168.1.53");
});

test("reading position does not jump while typing, during clock ticks or across apps", async ({ page }) => {
  await openApp(page, "terminal");
  for (let i = 0; i < 8; i++) await command(page, `echo line-${i} ${"details ".repeat(28)}`);
  const output = page.getByTestId("terminal-output");
  await output.evaluate((element) => { element.scrollTop = 90; });
  await expect(page.getByTestId("terminal-latest")).toBeVisible();
  const position = await output.evaluate((element) => element.scrollTop);
  await page.getByTestId("terminal-input").fill("echo do-not-move-history");
  // Wait across a real game-clock tick: this was previously a source of jumps.
  await page.waitForTimeout(5300);
  expect(await output.evaluate((element) => element.scrollTop)).toBeCloseTo(position, 0);
  await openApp(page, "mail");
  await openApp(page, "terminal");
  expect(await output.evaluate((element) => element.scrollTop)).toBeCloseTo(position, 0);
  await expect(page.getByTestId("terminal-input")).toHaveValue("echo do-not-move-history");
  await page.getByTestId("terminal-latest").click();
  await expect(page.getByTestId("terminal-latest")).toBeHidden();
  await expect(page.getByTestId("terminal-input")).toBeFocused();
  expect(await output.evaluate((element) => element.scrollHeight - element.scrollTop - element.clientHeight)).toBeLessThan(3);
});

test("keyboard resize is bounded and desktop dimensions return after a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await openApp(page, "terminal");
  await resize(page, -180, -100);
  const grip = page.getByTestId("resize-terminal");
  const original = await rect(page.getByTestId("window-terminal"));
  await grip.focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowUp");
  await expect(grip).toBeFocused();
  expect((await rect(page.getByTestId("window-terminal"))).width).toBeCloseTo(original.width - 16, 0);
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("terminal-input")).toBeFocused();
  const desktop = await rect(page.getByTestId("window-terminal"));
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(grip).toBeHidden();
  await expect(page.getByTestId("terminal-input")).toBeInViewport({ ratio: 1 });
  await command(page, "echo mobile");
  await page.setViewportSize({ width: 1600, height: 1000 });
  await expect(grip).toBeVisible();
  await expect.poll(async () => (await rect(page.getByTestId("window-terminal"))).width).toBeCloseTo(desktop.width, 0);
  await expect(page.getByTestId("terminal-output")).toContainText("mobile");
  await command(page, "echo desktop");
});

test("failed server save is reported honestly and a local draft remains recoverable", async ({ page }) => {
  await openApp(page, "terminal");
  await page.getByTestId("terminal-input").fill("echo offline-draft");
  await page.route("**/api/save", (route) => route.fulfill({ status: 503, contentType: "application/json", body: '{"ok":false}' }));
  await page.getByRole("button", { name: "Sauvegarde", exact: true }).click();
  await expect(page.getByTestId("save-status")).toHaveAttribute("data-result", "local");
  await expect(page.getByTestId("save-status")).toContainText("serveur indisponible");
  await page.reload();
  await expect(page.getByTestId("terminal-input")).toHaveValue("echo offline-draft");
  await expect(page.getByTestId("terminal-input")).toBeFocused();
});
