/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { app } from "electron";
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const suffix = IS_DEV ? "dev" : "";

const defaultDataDir = (name: string) => (
    process.env.DISCORD_USER_DATA_DIR
        ? join(process.env.DISCORD_USER_DATA_DIR, "..", `${name}Data`, suffix)
        : join(app.getPath("userData"), "..", name, suffix)
);

export const DATA_DIR = process.env.NEXORA_USER_DATA_DIR ?? defaultDataDir("Nexora");
const EQUICORD_DATA_DIR = defaultDataDir("Equicord");

export const SETTINGS_DIR = join(DATA_DIR, "settings");
export const THEMES_DIR = join(DATA_DIR, "themes");
export const QUICK_CSS_PATH = join(SETTINGS_DIR, "quickCss.css");
export const SETTINGS_FILE = join(SETTINGS_DIR, "settings.json");
export const NATIVE_SETTINGS_FILE = join(SETTINGS_DIR, "native-settings.json");
export const DEV_MIGRATED = join(SETTINGS_DIR, "migration");
const EQUICORD_SETTINGS_FILE = join(EQUICORD_DATA_DIR, "settings", "settings.json");
const EQUICORD_QUICK_CSS_PATH = join(EQUICORD_DATA_DIR, "settings", "quickCss.css");
const EQUICORD_THEMES_DIR = join(EQUICORD_DATA_DIR, "themes");
export const ALLOWED_PROTOCOLS = [
    "https:",
    "http:",
    "steam:",
    "spotify:",
    "com.epicgames.launcher:",
    "tidal:",
    "itunes:",
    "vrcx:",
    "tg:",
];

export const IS_VANILLA = /* @__PURE__ */ process.argv.includes("--vanilla");

if (!IS_DEV && !process.env.NEXORA_USER_DATA_DIR && !existsSync(SETTINGS_FILE) && existsSync(EQUICORD_SETTINGS_FILE)) {
    mkdirSync(SETTINGS_DIR, { recursive: true });
    copyFileSync(EQUICORD_SETTINGS_FILE, SETTINGS_FILE);
    if (existsSync(EQUICORD_QUICK_CSS_PATH)) copyFileSync(EQUICORD_QUICK_CSS_PATH, QUICK_CSS_PATH);
    if (existsSync(EQUICORD_THEMES_DIR) && !existsSync(THEMES_DIR)) cpSync(EQUICORD_THEMES_DIR, THEMES_DIR, { recursive: true });
}

if (IS_DEV) {
    const prodDir = join(DATA_DIR, "..");
    const settings = join(prodDir, "settings", "settings.json");
    const quickCss = join(prodDir, "settings", "quickCss.css");

    let migrated = false;
    if (existsSync(DEV_MIGRATED)) {
        const content = readFileSync(DEV_MIGRATED, "utf-8");
        migrated = content.includes("migrated");
    }

    if (!migrated) {
        setTimeout(() => {
            try {
                if (existsSync(settings)) copyFileSync(settings, SETTINGS_FILE);
                if (existsSync(quickCss)) copyFileSync(quickCss, QUICK_CSS_PATH);
                writeFileSync(DEV_MIGRATED, "migrated");
                app.relaunch();
                app.exit(0);
            } catch (err) {
                console.error("[Nexora] Failed to copy production data:", err);
            }
        }, 5000);
    }
}
