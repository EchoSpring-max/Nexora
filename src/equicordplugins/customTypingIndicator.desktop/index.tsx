/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { definePluginSettings } from "@api/Settings";
import { Button } from "@components/Button";
import { NexoraDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import definePlugin, { OptionType, type PluginSettingComponentProps } from "@utils/types";
import type { Channel } from "@vencord/discord-types";
import { findComponentByCodeLazy } from "@webpack";
import { ChannelStore, FluxDispatcher, IconUtils, Popout, React, RestAPI, SelectedChannelStore, useRef, useState, useStateFromStores } from "@webpack/common";

type Emoji = {
    id?: string;
    name: string;
    animated?: boolean;
};

type EmojiSelectPayload = {
    id?: string | null;
    name?: string | null;
    optionallyDiverseSequence?: string;
    animated?: boolean;
};

type ReactionEmojiPickerProps = {
    channel?: Channel | null;
    closePopout(): void;
    onSelectEmoji(selection: {
        emoji: EmojiSelectPayload | null;
        willClose: boolean;
    }): void;
};

const cl = classNameFactory("eq-custom-typing-indicator-");
const ReactionEmojiPicker = findComponentByCodeLazy<ReactionEmojiPickerProps>(
    "showAddEmojiButton:",
    "pickerIntention:",
    "messageId:"
);

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
        type: OptionType.COMPONENT,
        displayName: "First emoji",
        description: "Choose a standard emoji or an emoji from a server you can access.",
        component: FirstEmojiPicker,
        default: "✨"
    },
    emojiTwo: {
        type: OptionType.COMPONENT,
        displayName: "Second emoji",
        description: "Choose a different standard or server emoji.",
        component: SecondEmojiPicker,
        default: "💜"
    },
    emojiThree: {
        type: OptionType.COMPONENT,
        displayName: "Third emoji",
        description: "Choose one more standard or server emoji.",
        component: ThirdEmojiPicker,
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

function getEmojiValue(emoji: EmojiSelectPayload | null | undefined) {
    if (!emoji) return "";
    if (emoji.id && emoji.name)
        return `<${emoji.animated ? "a" : ""}:${emoji.name}:${emoji.id}>`;

    return emoji.optionallyDiverseSequence?.trim() || emoji.name?.trim() || "";
}

function EmojiPreview({ value }: { value: string; }) {
    const emoji = parseEmoji(value);

    if (emoji.id) {
        return (
            <img
                className={cl("preview-image")}
                src={IconUtils.getEmojiURL({ id: emoji.id, animated: emoji.animated ?? false, size: 48 })}
                alt={emoji.name || "Server emoji"}
            />
        );
    }

    return <span className={cl("preview-unicode")}>{emoji.name || "?"}</span>;
}

function EmojiPickerSetting({
    value,
    setValue
}: {
    value: string;
    setValue(value: string): void;
}) {
    const [selectedEmoji, setSelectedEmoji] = useState(value);
    const triggerRef = useRef<HTMLDivElement>(null);
    const channel = useStateFromStores([SelectedChannelStore, ChannelStore], () => {
        const channelId = SelectedChannelStore.getChannelId();
        return channelId ? ChannelStore.getChannel(channelId) : null;
    });

    return (
        <Popout
            position="bottom"
            align="left"
            targetElementRef={triggerRef}
            renderPopout={({ closePopout }) => (
                <ReactionEmojiPicker
                    channel={channel}
                    closePopout={closePopout}
                    onSelectEmoji={({ emoji, willClose }) => {
                        const nextValue = getEmojiValue(emoji);
                        if (nextValue) {
                            setSelectedEmoji(nextValue);
                            setValue(nextValue);
                        }
                        if (willClose) closePopout();
                    }}
                />
            )}
        >
            {popoutProps => (
                <div
                    {...popoutProps}
                    ref={triggerRef}
                    className={cl("picker-button")}
                >
                    <span className={cl("preview")}><EmojiPreview value={selectedEmoji} /></span>
                    <span className={cl("picker-label")}>Choose emoji</span>
                </div>
            )}
        </Popout>
    );
}

function FirstEmojiPicker({ setValue }: PluginSettingComponentProps) {
    return <EmojiPickerSetting value={settings.store.emojiOne} setValue={setValue} />;
}

function SecondEmojiPicker({ setValue }: PluginSettingComponentProps) {
    return <EmojiPickerSetting value={settings.store.emojiTwo} setValue={setValue} />;
}

function ThirdEmojiPicker({ setValue }: PluginSettingComponentProps) {
    return <EmojiPickerSetting value={settings.store.emojiThree} setValue={setValue} />;
}

function parseEmoji(value: string): Emoji {
    const emoji = value.trim();
    const customEmoji = emoji.match(/^<(a?):([^:>]+):(\d+)>$/)
        ?? emoji.match(/^(a?):?([^:>]+):(\d+)$/);

    if (customEmoji) {
        return {
            id: customEmoji[3],
            name: customEmoji[2],
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
                variant="dangerPrimary"
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
