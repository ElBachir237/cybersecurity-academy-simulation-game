import { test, expect, type Page, type Locator } from "@playwright/test";
import { createInitialState } from "../../src/game/engine";

async function openApp(page: Page, id: string) {
  await page.getByTestId(`app-${id}`).click();
  await expect(page.getByTestId(`window-${id}`)).toBeVisible();
  await expect(page.locator('.hz-window:visible')).toHaveCount(1);
}

async function command(page: Page, text: string) {
  const input = page.getByTestId("terminal-input");
  await expect(input).toBeFocused();
  await page.keyboard.type(text);
  await page.keyboard.press("Enter");
  await expect(input).toHaveValue("");
}

async function box(locator: Locator) {
  const bounds = await locator.boundingBox();
  expect(bounds).not.toBeNull();
  return bounds!;
}

async function checkTerminalGeometry(page: Page) {
  const stage = await box(page.getByTestId("window-stage"));
  const frame = await box(page.getByTestId("window-terminal"));
  const title = await box(page.getByTestId("titlebar-terminal"));
  const toolbar = await box(page.getByTestId("terminal-toolbar"));
  const output = await box(page.getByTestId("terminal-output"));
  const composer = await box(page.getByTestId("terminal-composer"));
  const input = await box(page.getByTestId("terminal-input"));
  expect(frame.x).toBeGreaterThanOrEqual(stage.x - 1);
  expect(frame.y).toBeGreaterThanOrEqual(stage.y - 1);
  expect(frame.x + frame.width).toBeLessThanOrEqual(stage.x + stage.width + 1);
  expect(frame.y + frame.height).toBeLessThanOrEqual(stage.y + stage.height + 1);
  expect(toolbar.y).toBeGreaterThanOrEqual(title.y + title.height - 1);
  expect(output.y).toBeGreaterThanOrEqual(toolbar.y + toolbar.height - 1);
  expect(composer.y).toBeGreaterThanOrEqual(output.y + output.height - 1);
  expect(composer.y + composer.height).toBeLessThanOrEqual(frame.y + frame.height + 1);
  expect(input.width).toBeGreaterThan(100);
  expect(input.height).toBeGreaterThan(25);
  expect(input.y + input.height).toBeLessThanOrEqual(composer.y + composer.height);
  // Hit-testing catches overlays even if a field is technically 'visible'.
  expect(await page.getByTestId("terminal-input").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2) === element;
  })).toBe(true);
  expect(await page.getByTestId("terminal-output").evaluate((element) => getComputedStyle(element).position)).toBe("relative");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
}

test.beforeEach(async ({ page }) => {
  const state = createInitialState({ name: "Agent UI", avatar: "a1", lang: "fr", createdAt: Date.now() });
  state.introSeen = true;
  state.sound.muted = true;
  await page.addInitScript((saved) => {
    if (!localStorage.getItem("horizon-save-v3")) localStorage.setItem("horizon-save-v3", JSON.stringify({ version: 3, savedAt: Date.now(), state: saved }));
  }, state);
  await page.goto("/desktop");
  await expect(page.getByTestId("desktop")).toBeVisible();
});

test("native caret and keyboard survive maximize, restore, minimize and reopen", async ({ page }) => {
  await page.setViewportSize({ width: 1145, height: 713 });
  await openApp(page, "terminal");
  const input = page.getByTestId("terminal-input");
  await expect(input).toBeFocused();
  await command(page, "help");
  await command(page, "whoami");
  await checkTerminalGeometry(page);
  const element = await input.elementHandle();
  await page.keyboard.type("hostname");
  await page.getByTestId("maximize-terminal").click();
  await expect(page.getByTestId("window-terminal")).toHaveAttribute("data-expanded", "true");
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("hostname");
  expect(await element!.evaluate((field) => field === document.querySelector('[data-testid="terminal-input"]'))).toBe(true);
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("terminal-output")).toContainText("ws-001");
  await checkTerminalGeometry(page);
  await page.screenshot({ path: "tests/artifacts/desktop-maximized.png" });
  await page.getByTestId("maximize-terminal").click();
  await expect(page.getByTestId("window-terminal")).toHaveAttribute("data-expanded", "false");
  await expect(input).toBeFocused();
  await command(page, "echo restored");
  await expect(page.getByTestId("terminal-output")).toContainText("restored");
  await page.keyboard.type("echo kept");
  await page.getByRole("button", { name: "Réduire la fenêtre", exact: true }).click();
  await expect(page.getByTestId("window-terminal")).toBeHidden();
  await page.getByRole("tab", { name: "Terminal", exact: true }).click();
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("echo kept");
  await page.getByRole("button", { name: "Fermer Terminal", exact: true }).click();
  await expect(page.getByTestId("window-terminal")).toBeHidden();
  await openApp(page, "terminal");
  await expect(input).toHaveValue("echo kept");
  await expect(input).toBeFocused();
  await expect(page.getByTestId("terminal-output")).toContainText("restored");
  await checkTerminalGeometry(page);
});

test("switching apps and hosts keeps drafts and does not steal keyboard input", async ({ page }) => {
  await openApp(page, "terminal");
  const input = page.getByTestId("terminal-input");
  await command(page, "help");
  await page.keyboard.type("ping intranet.horizon");
  await openApp(page, "chat");
  const chat = page.getByTestId("chat-input");
  await expect(chat).toBeFocused();
  await page.keyboard.type("Bonjour depuis le chat");
  await expect(chat).toHaveValue("Bonjour depuis le chat");
  await expect(input).toHaveValue("ping intranet.horizon");
  await openApp(page, "mail");
  await expect(page.getByTestId("mail-search")).toBeFocused();
  await page.keyboard.type("from:itsd");
  await expect(page.getByTestId("mail-search")).toHaveValue("from:itsd");
  await page.getByRole("tab", { name: "Terminal", exact: true }).click();
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("ping intranet.horizon");
  await page.getByTestId("terminal-host").selectOption("PC-MARIE");
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("");
  await page.keyboard.type("ip addr");
  await page.getByTestId("terminal-host").selectOption("WS-001");
  await expect(input).toHaveValue("ping intranet.horizon");
  await page.getByTestId("terminal-host").selectOption("PC-MARIE");
  await expect(input).toHaveValue("ip addr");
  await expect(input).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("terminal-output")).toContainText("169.254.8.41");
  await page.getByTestId("terminal-host").selectOption("WS-001");
  await expect(page.getByTestId("terminal-output")).toContainText("Commandes disponibles");
  await page.getByRole("tab", { name: "Chat", exact: true }).click();
  await expect(chat).toBeFocused();
  await expect(chat).toHaveValue("Bonjour depuis le chat");
});

test("file editor owns focus, stays outside windows and restores the prompt on save or Escape", async ({ page }) => {
  await openApp(page, "terminal");
  await page.getByTestId("maximize-terminal").click();
  await command(page, "sudo nano /etc/resolv.conf");
  const editor = page.getByRole("textbox", { name: "Contenu du fichier" });
  await expect(editor).toBeFocused();
  await expect(page.getByTestId("terminal-input")).toBeDisabled();
  expect(await editor.evaluate((field) => !field.closest(".hz-window"))).toBe(true);
  await editor.fill("nameserver 10.0.0.10\n");
  await page.keyboard.press("Control+s");
  await expect(editor).not.toBeVisible();
  await expect(page.getByTestId("terminal-input")).toBeFocused();
  await command(page, "cat /etc/resolv.conf");
  await expect(page.getByTestId("terminal-output")).toContainText("nameserver 10.0.0.10");
  await command(page, "sudo nano /etc/resolv.conf");
  await expect(editor).toBeFocused();
  await editor.fill("this draft should not be saved");
  await page.keyboard.press("Escape");
  await expect(editor).not.toBeVisible();
  await expect(page.getByTestId("terminal-input")).toBeFocused();
  await command(page, "cat /etc/resolv.conf");
  await expect(page.getByTestId("terminal-output")).not.toContainText("this draft should not be saved");
  await checkTerminalGeometry(page);
});

test("titlebar drag is clamped and control buttons never start dragging", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await openApp(page, "terminal");
  const title = await box(page.getByTestId("titlebar-terminal"));
  await page.mouse.move(title.x + 280, title.y + 26);
  await page.mouse.down();
  await page.mouse.move(-100, -100, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByTestId("window-terminal")).not.toHaveClass(/is-dragging/);
  await expect(page.getByTestId("terminal-input")).toBeFocused();
  await checkTerminalGeometry(page);
  await command(page, "echo after-drag");
  await page.getByTestId("maximize-terminal").click();
  await expect(page.getByTestId("window-terminal")).toHaveAttribute("data-expanded", "true");
  await expect(page.getByTestId("terminal-input")).toBeFocused();
  await checkTerminalGeometry(page);
  await page.getByTestId("maximize-terminal").click();
  await command(page, "echo after-restore");
});

test("only history scrolls; long lines and viewport resizing cannot hide the input", async ({ page }) => {
  await openApp(page, "terminal");
  for (let index = 0; index < 12; index++) await command(page, `echo ${index} ${"x".repeat(240)}`);
  expect(await page.getByTestId("terminal-output").evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  const sizes = [
    { width: 1145, height: 713 },
    { width: 820, height: 760 },
    { width: 736, height: 481 },
    { width: 390, height: 844 },
    { width: 360, height: 640 },
    { width: 390, height: 500 },
  ];
  for (const size of sizes) {
    await page.setViewportSize(size);
    await expect(page.getByTestId("terminal-input")).toBeInViewport({ ratio: 1 });
    await expect.poll(async () => {
      const bounds = await page.getByTestId("window-terminal").boundingBox();
      return !!bounds && bounds.x + bounds.width <= size.width;
    }).toBe(true);
    await checkTerminalGeometry(page);
    await page.getByTestId("terminal-input").click();
    await command(page, `echo viewport-${size.width}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await command(page, "clear");
  await command(page, "ip addr");
  await page.screenshot({ path: "tests/artifacts/desktop-mobile.png" });
});

test("dialogs prevent background typing and return keyboard control when dismissed", async ({ page }) => {
  await openApp(page, "terminal");
  await page.keyboard.type("echo preserved");
  await page.getByRole("button", { name: "Notifications", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Centre de notifications" });
  await expect(dialog).toBeVisible();
  await expect(page.getByTestId("terminal-input")).toBeDisabled();
  await page.keyboard.type("not-in-terminal");
  await expect(page.getByTestId("terminal-input")).toHaveValue("echo preserved");
  for (let i = 0; i < 12; i++) await page.keyboard.press("Tab");
  expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("terminal-input")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("terminal-output")).toContainText("preserved");
});

test("all applications remain contained on a small screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const id of ["academy", "mail", "chat", "network", "soc", "files", "tickets", "skills", "portfolio", "browser", "terminal"]) {
    await openApp(page, id);
    const frame = page.getByTestId(`window-${id}`);
    const rect = await box(frame);
    const stage = await box(page.getByTestId("window-stage"));
    expect(rect.x + rect.width, id).toBeLessThanOrEqual(390);
    expect(rect.y + rect.height, id).toBeLessThanOrEqual(stage.y + stage.height + 1);
    expect(await frame.locator(".hz-app-content").evaluate((element) => element.scrollWidth <= element.clientWidth + 1), `${id}: no clipped horizontal overflow`).toBe(true);
  }
  await checkTerminalGeometry(page);
});

test("chapter lab still works through UI dialogs, file editing and debriefing", async ({ page }) => {
  await openApp(page, "academy");
  await page.getByTestId("mission-c1_lab").getByRole("button", { name: "Démarrer", exact: true }).click();
  const brief = page.getByRole("dialog", { name: "Premier poste" });
  await expect(brief).toBeVisible();
  expect(await brief.evaluate((element) => !element.closest(".hz-window"))).toBe(true);
  await brief.getByRole("button", { name: "Commencer", exact: true }).click();
  await expect(page.getByTestId("window-terminal")).toBeVisible();
  await expect(page.getByTestId("terminal-input")).toBeFocused();
  for (const cmd of ["help", "whoami", "hostname", "ip addr", "ping 192.168.10.1", "ping 10.0.0.10", "ping intranet.horizon", "cat /etc/resolv.conf", "sudo nano /etc/resolv.conf"]) await command(page, cmd);
  const editor = page.getByRole("textbox", { name: "Contenu du fichier" });
  await editor.fill("nameserver 10.0.0.10\n");
  await page.keyboard.press("Control+s");
  await expect(page.getByTestId("terminal-input")).toBeFocused();
  await command(page, "ping intranet.horizon");
  const debrief = page.getByRole("dialog", { name: "Débriefing" });
  await expect(debrief).toBeVisible();
  await debrief.getByRole("button", { name: "Terminer", exact: true }).click();
  await expect(page.getByTestId("terminal-input")).toBeFocused();
  await command(page, "echo ready-for-next");
  await openApp(page, "academy");
  await expect(page.getByTestId("mission-c1_mission").getByRole("button", { name: "Démarrer", exact: true })).toBeEnabled();
});
