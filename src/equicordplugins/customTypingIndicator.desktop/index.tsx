/*
 * Nexora, a Discord client mod
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { NexoraDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { Button, FluxDispatcher, React, RestAPI } from "@webpack/common";

type Emoji = {
    id?: string;
    name: string;
    animated?: boolean;
};

const statusOptions = [
    { label: "is yapping…", value: 1, default: true },
    { label: "is venting…", value: 2 },
    { label: "is oversharing…", value: 3 },
    { label: "is barking…", value: 4 },
    { label: "is babbling…", value: 5 },
    { label: "is daydreaming…", value: 6 },
    { label: "is meowing…", value: 7 },
];

const animationOptions = [
    { label: "None", value: 0, default: true },
    { label: "Pulse", value: 1 },
    { label: "Ring", value: 2 },
    { label: "Wave", value: 3 },
];

const settings = definePluginSettings({
    emojiOne: {
        type: OptionType.STRING,
        displayName: "First emoji",
        description: "A Unicode emoji, or a Discord custom emoji copied as <:name:id>.",
        default: "✨"
    },
    emojiTwo: {
        type: OptionType.STRING,
        displayName: "Second emoji",
        description: "Use a different emoji that you can use in Discord.",
        default: "💜"
    },
    emojiThree: {
        type: OptionType.STRING,
        displayName: "Third emoji",
        description: "Use a different emoji that you can use in Discord.",
        default: "🌙"
    },
    animation: {
        type: OptionType.SELECT,
        description: "Motion style for the three-emoji indicator.",
        options: animationOptions
    },
    status: {
        type: OptionType.SELECT,
        description: "The preset text shown after your name while you type.",
        options: statusOptions
    },
    apply: {
        type: OptionType.COMPONENT,
        description: "Saves these choices to your Discord account. Discord must have enabled the Custom Typing Indicator beta for your Nitro account.",
        component: ApplyButton
    },
    reset: {
        type: OptionType.COMPONENT,
        description: "Removes your custom typing indicator from your Discord account.",
        component: ResetButton
    }
});

function parseEmoji(value: string): Emoji {
    const emoji = value.trim();
    const customEmoji = emoji.match(/^<(a?):[^:>]+:(\d+)>$/);

    if (customEmoji) {
        return {
            id: customEmoji[2],
            name: "",
            animated: customEmoji[1] === "a"
        };
    }

    return { name: emoji };
}

function getStyle() {
    const emojis = [settings.store.emojiOne, settings.store.emojiTwo, settings.store.emojiThree]
        .map(parseEmoji);

    if (emojis.some(emoji => !emoji.id && !emoji.name))
        throw new Error("Choose all three emojis before applying your typing indicator.");

    const uniqueEmojis = new Set(emojis.map(emoji => emoji.id ?? emoji.name));
    if (uniqueEmojis.size !== emojis.length)
        throw new Error("Discord requires three different emojis for a custom typing indicator.");

    return {
        emojis: emojis.map(emoji => emoji.id
            ? { custom_emoji_id: emoji.id }
            : { unicode_emoji: emoji.name }),
        animation: settings.store.animation,
        typing_suggestion: settings.store.status
    };
}

async function saveStyle(style: ReturnType<typeof getStyle> | null) {
    const response = await RestAPI.patch({
        url: "/users/@me",
        body: { typing_indicator_style: style }
    }) as { body: Record<string, unknown>; };

    // Keep Discord's current-user store in sync immediately, just as its own
    // mobile settings screen does after a successful profile update.
    FluxDispatcher.dispatch({ type: "CURRENT_USER_UPDATE", user: response.body });
}

function ApplyButton() {
    const [message, setMessage] = React.useState<string | null>(null);
    const [saving, setSaving] = React.useState(false);

    return (
        <>
            <Button
                disabled={saving}
                onClick={async () => {
                    setSaving(true);
                    setMessage(null);

                    try {
                        await saveStyle(getStyle());
                        setMessage("Saved to your Discord account. Other people will see it when you are the only person typing.");
                    } catch (error) {
                        setMessage(error instanceof Error
                            ? `Discord did not save the typing indicator: ${error.message}`
                            : "Discord did not save the typing indicator. Make sure your account has the mobile beta and full Nitro.");
                    } finally {
                        setSaving(false);
                    }
                }}
            >
                {saving ? "Applying…" : "Apply typing indicator"}
            </Button>
            {message && <div style={{ marginTop: 8 }}>{message}</div>}
        </>
    );
}

function ResetButton() {
    const [message, setMessage] = React.useState<string | null>(null);
    const [resetting, setResetting] = React.useState(false);

    return (
        <>
            <Button
                color={Button.Colors.RED}
                disabled={resetting}
                onClick={async () => {
                    setResetting(true);
                    setMessage(null);

                    try {
                        await saveStyle(null);
                        setMessage("Your custom typing indicator was removed.");
                    } catch (error) {
                        setMessage(error instanceof Error
                            ? `Discord did not remove the typing indicator: ${error.message}`
                            : "Discord did not remove the typing indicator.");
                    } finally {
                        setResetting(false);
                    }
                }}
            >
                {resetting ? "Resetting…" : "Reset typing indicator"}
            </Button>
            {message && <div style={{ marginTop: 8 }}>{message}</div>}
        </>
    );
}

export default definePlugin({
    name: "CustomTypingIndicator",
    description: "Brings Discord's mobile Custom Typing Indicator controls to Nexora desktop.",
    authors: [NexoraDevs.EchoSpring],
    tags: ["Chat", "Appearance", "Customisation"],
    settings
});
