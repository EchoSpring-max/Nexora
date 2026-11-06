/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { useSettings } from "@api/Settings";
import { Button } from "@components/Button";
import { Divider } from "@components/Divider";
import { Heading } from "@components/Heading";
import { Notice } from "@components/Notice";
import { Paragraph } from "@components/Paragraph";
import { SettingsTab, wrapTab } from "@components/settings/tabs/BaseTab";
import { classNameFactory } from "@utils/css";
import { Margins } from "@utils/margins";
import type { Channel } from "@vencord/discord-types";
import { findComponentByCodeLazy } from "@webpack";
import { ChannelStore, FluxDispatcher, IconUtils, Popout, React, RestAPI, Select, SelectedChannelStore, useRef, useState, useStateFromStores } from "@webpack/common";

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

const cl = classNameFactory("vc-typing-indicator-picker-");
const ReactionEmojiPicker = findComponentByCodeLazy<ReactionEmojiPickerProps>(
    "showAddEmojiButton:",
    "pickerIntention:",
    "messageId:"
);

const statusOptions = [
    { label: "is yapping…", value: 1 },
    { label: "is venting…", value: 2 },
    { label: "is oversharing…", value: 3 },
    { label: "is barking…", value: 4 },
    { label: "is babbling…", value: 5 },
    { label: "is daydreaming…", value: 6 },
    { label: "is meowing…", value: 7 },
];

const animationOptions = [
    { label: "None", value: 0 },
    { label: "Pulse", value: 1 },
    { label: "Ring", value: 2 },
    { label: "Wave", value: 3 },
];

function parseEmoji(value: string) {
    const emoji = value.trim();
    const customEmoji = emoji.match(/^<(a?):([^:>]+):(\d+)>$/)
        ?? emoji.match(/^(a?):?([^:>]+):(\d+)$/);

    return customEmoji
        ? { custom_emoji_id: customEmoji[3] }
        : { unicode_emoji: emoji };
}

function getEmojiValue(emoji: EmojiSelectPayload | null | undefined) {
    if (!emoji) return "";
    if (emoji.id && emoji.name)
        return `<${emoji.animated ? "a" : ""}:${emoji.name}:${emoji.id}>`;

    return emoji.optionallyDiverseSequence?.trim() || emoji.name?.trim() || "";
}

function EmojiPreview({ value }: { value: string; }) {
    const emoji = value.trim();
    const customEmoji = emoji.match(/^<(a?):([^:>]+):(\d+)>$/)
        ?? emoji.match(/^(a?):?([^:>]+):(\d+)$/);

    if (customEmoji) {
        return (
            <img
                className={cl("image")}
                src={IconUtils.getEmojiURL({ id: customEmoji[3], animated: customEmoji[1] === "a", size: 48 })}
                alt={customEmoji[2]}
            />
        );
    }

    return <span className={cl("unicode")}>{emoji || "?"}</span>;
}

function EmojiPickerField({
    label,
    value,
    onChange
}: {
    label: string;
    value: string;
    onChange(value: string): void;
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
                            onChange(nextValue);
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
                    className={cl("field")}
                    role="button"
                    aria-label={`${label}: choose emoji`}
                >
                    <span className={cl("preview")}><EmojiPreview value={selectedEmoji} /></span>
                    <span>
                        <span className={cl("label")}>{label}</span>
                        <span className={cl("hint")}>Standard and server emoji</span>
                    </span>
                </div>
            )}
        </Popout>
    );
}

function TypingIndicatorTab() {
    const settings = useSettings(["plugins.CustomTypingIndicator.*"]);
    const typingSettings = settings.plugins.CustomTypingIndicator;
    const [message, setMessage] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const emojiOne = typingSettings.emojiOne ?? "✨";
    const emojiTwo = typingSettings.emojiTwo ?? "💜";
    const emojiThree = typingSettings.emojiThree ?? "🌙";
    const animation = typingSettings.animation ?? 0;
    const status = typingSettings.status ?? 1;

    async function save(style: Record<string, unknown> | null) {
        const response = await RestAPI.patch({
            url: "/users/@me",
            body: { typing_indicator_style: style }
        }) as { body: Record<string, unknown>; };

        FluxDispatcher.dispatch({ type: "CURRENT_USER_UPDATE", user: response.body });
    }

    async function apply() {
        const emojis = [emojiOne, emojiTwo, emojiThree].map(parseEmoji);
        const identities = emojis.map(emoji => "custom_emoji_id" in emoji ? emoji.custom_emoji_id : emoji.unicode_emoji);

        if (identities.some(emoji => !emoji)) {
            setMessage("Choose all three emojis before applying your typing indicator.");
            return;
        }

        if (new Set(identities).size !== identities.length) {
            setMessage("Discord requires three different emojis for a custom typing indicator.");
            return;
        }

        setSaving(true);
        setMessage(null);

        try {
            await save({ emojis, animation, typing_suggestion: status });
            setMessage("Saved to your Discord account. Your indicator appears when you are the only person typing.");
        } catch (error) {
            setMessage(error instanceof Error
                ? `Discord did not save the typing indicator: ${error.message}`
                : "Discord did not save the typing indicator. Make sure your account has the feature enabled.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <SettingsTab>
            <Heading className={Margins.top16}>Custom Typing Indicator</Heading>
            <Paragraph className={Margins.bottom16}>
                Choose the same typing indicator controls available in Discord mobile, right from Nexora desktop.
            </Paragraph>

            <Notice.Info className={Margins.bottom16}>
                This saves through Discord's normal profile settings. Discord must have enabled Custom Typing Indicator for your account.
            </Notice.Info>

            <Heading>Emojis</Heading>
            <Paragraph className={Margins.bottom8}>
                Select three different emojis using Discord's picker. Standard emoji and emoji from servers you can access are supported.
            </Paragraph>
            <div className={cl("grid")}>
                <EmojiPickerField label="First emoji" value={emojiOne} onChange={value => { typingSettings.emojiOne = value; }} />
                <EmojiPickerField label="Second emoji" value={emojiTwo} onChange={value => { typingSettings.emojiTwo = value; }} />
                <EmojiPickerField label="Third emoji" value={emojiThree} onChange={value => { typingSettings.emojiThree = value; }} />
            </div>

            <Divider className={Margins.top20} />

            <Heading className={Margins.top20}>Animation</Heading>
            <Select
                options={animationOptions}
                isSelected={value => value === animation}
                select={value => { typingSettings.animation = value; }}
                serialize={value => String(value)}
                closeOnSelect
            />

            <Heading className={Margins.top20}>Typing text</Heading>
            <Select
                options={statusOptions}
                isSelected={value => value === status}
                select={value => { typingSettings.status = value; }}
                serialize={value => String(value)}
                closeOnSelect
            />

            <Divider className={Margins.top20} />

            <Button disabled={saving} onClick={apply}>
                {saving ? "Applying…" : "Apply typing indicator"}
            </Button>
            <Button
                variant="dangerPrimary"
                className={Margins.left8}
                disabled={saving}
                onClick={async () => {
                    setSaving(true);
                    setMessage(null);
                    try {
                        await save(null);
                        setMessage("Your custom typing indicator was removed.");
                    } catch (error) {
                        setMessage(error instanceof Error
                            ? `Discord did not remove the typing indicator: ${error.message}`
                            : "Discord did not remove the typing indicator.");
                    } finally {
                        setSaving(false);
                    }
                }}
            >
                Reset
            </Button>
            {message && <Paragraph className={Margins.top16}>{message}</Paragraph>}
        </SettingsTab>
    );
}

export default wrapTab(TypingIndicatorTab, "Typing Indicator");
