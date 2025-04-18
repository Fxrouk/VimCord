import definePlugin from "@utils/types";

export default definePlugin({
    name: "VimCord",
    description: "Vimium-style navigation with keyboard controls",
    authors: [{ name: "BV10", id: 105170831130234880n }],
    dependencies: ["CommandsAPI"],

    start() {
        const selectors = {
            servers: "div[role='treeitem'][data-list-item-id^='guildsnav']",
            channels: "[data-list-item-id^='channels']",
            channelsContainer: ".scroller__629e4.thin__99f8c.scrollerBase__99f8c.fade__99f8c.customTheme__99f8c",
            messagesContainer: ".scroller__36d07.customTheme_d125d2.auto_d125d2.scrollerBase_d125d2.disableScrollAnchor_d125d2.managedReactiveScroller_d125d2",
            messages: ".message",
            messageInput: 'div[role="textbox"][aria-label="Message #"]',
            userSettings: 'button[aria-label="Paramètres utilisateur"]'
        };

        const config = {
            scrollSpeed: 0.25,
            smoothScrolling: false
        };

        let keyBindings: Record<string, HTMLElement> = {};
        let hintElements: HTMLElement[] = [];
        let pendingPrefix: string | null = null;

        const isElementInViewport = (el: HTMLElement) => {
            const rect = el.getBoundingClientRect();
            return (
                rect.top >= 0 &&
                rect.left >= 0 &&
                rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
                rect.right <= (window.innerWidth || document.documentElement.clientWidth)
            );
        };

        const isElementPartiallyInViewport = (el: HTMLElement) => {
            const rect = el.getBoundingClientRect();
            return (
                rect.top <= (window.innerHeight || document.documentElement.clientHeight) &&
                rect.bottom >= 0 &&
                rect.left <= (window.innerWidth || document.documentElement.clientWidth) &&
                rect.right >= 0
            );
        };

        const createHint = (key: string, target: HTMLElement) => {
            const hint = document.createElement("div");
            hint.textContent = key;
            hint.style.position = "fixed";
            hint.style.backgroundColor = "#9e01df";
            hint.style.color = "white";
            hint.style.padding = "2px 6px";
            hint.style.borderRadius = "4px";
            hint.style.fontSize = "14px";
            hint.style.fontWeight = "bold";
            hint.style.zIndex = "9999";
            hint.style.boxShadow = "0 2px 4px rgba(0,0,0,0.2)";
            hint.style.pointerEvents = "none";

            const rect = target.getBoundingClientRect();
            hint.style.left = `${rect.left + window.scrollX - 20}px`;
            hint.style.top = `${rect.top + window.scrollY}px`;

            document.body.appendChild(hint);
            return hint;
        };

        const performEscapeAction = () => {
            const activeElement = document.activeElement as HTMLElement;
            if (activeElement && (
                activeElement instanceof HTMLInputElement ||
                activeElement instanceof HTMLTextAreaElement ||
                activeElement.isContentEditable
            )) {
                activeElement.blur();
            }

            const menus = document.querySelectorAll('[role="menu"], [role="dialog"]');
            menus.forEach(menu => {
                const closeButton = menu.querySelector('[aria-label="Close"], [aria-label="Fermer"]');
                if (closeButton && isElementVisible(closeButton as HTMLElement)) {
                    (closeButton as HTMLElement).click();
                }
            });
        };

        const isElementVisible = (el: HTMLElement) => {
            return el.offsetWidth > 0 && el.offsetHeight > 0;
        };

        const handleElementClick = (element: HTMLElement) => {
            element.click();
            cleanupHints();

            setTimeout(() => {
                performEscapeAction();

                if (element.matches(selectors.channels)) {
                    setTimeout(() => {
                        const messageInput = document.querySelector(selectors.messageInput) as HTMLElement;
                        if (messageInput) {
                            messageInput.focus();
                        }
                    }, 100);
                }
            }, 50);
        };

        const scrollChannels = (direction: 'up' | 'down') => {
            const container = document.querySelector(selectors.channelsContainer) as HTMLElement;
            if (container) {
                const scrollAmount = window.innerHeight * config.scrollSpeed;
                container.scrollBy({
                    top: direction === 'up' ? -scrollAmount : scrollAmount,
                    behavior: config.smoothScrolling ? 'smooth' : 'auto'
                });
            }
        };

        const scrollMessages = (direction: 'up' | 'down') => {
            const container = document.querySelector(selectors.messagesContainer) as HTMLElement;
            if (container) {
                const scrollAmount = window.innerHeight * config.scrollSpeed;
                container.scrollBy({
                    top: direction === 'up' ? -scrollAmount : scrollAmount,
                    behavior: config.smoothScrolling ? 'smooth' : 'auto'
                });
            }
        };

        const scrollToBottom = () => {
            const container = document.querySelector(selectors.messagesContainer) as HTMLElement;
            if (container) {
                container.scrollTo({
                    top: container.scrollHeight,
                    behavior: config.smoothScrolling ? 'smooth' : 'auto'
                });
            }
        };

        const openUserSettings = () => {
            const settingsButton = document.querySelector(selectors.userSettings) as HTMLElement;
            if (settingsButton) {
                settingsButton.click();

                setTimeout(() => {
                    const settingsPanel = document.querySelector('[role="dialog"][aria-label*="paramètres"]');
                    if (settingsPanel) {
                        const firstFocusable = settingsPanel.querySelector<HTMLElement>(
                            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                        );
                        firstFocusable?.focus();
                    }
                }, 200);
            }
        };

        const showHints = () => {
            cleanupHints();

            const serverElements = document.querySelectorAll(selectors.servers);
            const channelElements = document.querySelectorAll(selectors.channels);

            const visibleServerTargets = Array.from(serverElements)
                .filter(el => isElementPartiallyInViewport(el as HTMLElement)) as HTMLElement[];

            const visibleChannelTargets = Array.from(channelElements)
                .filter(el => isElementPartiallyInViewport(el as HTMLElement)) as HTMLElement[];

            const allTargets = [...visibleServerTargets, ...visibleChannelTargets];

            allTargets.sort((a, b) => {
                const rectA = a.getBoundingClientRect();
                const rectB = b.getBoundingClientRect();
                return rectA.top - rectB.top || rectA.left - rectB.left;
            });

            const singleLetterTargets = allTargets.slice(0, 19);
            singleLetterTargets.forEach((target, index) => {
                const key = String.fromCharCode(97 + index);
                if (target && target.offsetParent !== null) {
                    keyBindings[key] = target;
                    hintElements.push(createHint(key, target));
                }
            });

            if (allTargets.length > 19) {
                const twoLetterTargets = allTargets.slice(19);

                twoLetterTargets.forEach((target, index) => {
                    const suffix = String.fromCharCode(97 + (index % 26));
                    const keyCombo = 'z' + suffix;

                    if (target && target.offsetParent !== null) {
                        keyBindings[keyCombo] = target;
                        hintElements.push(createHint(keyCombo, target));
                    }
                });
            }
        };

        const cleanupHints = () => {
            hintElements.forEach(el => el.remove());
            hintElements = [];
            keyBindings = {};
            pendingPrefix = null;
        };

        const handleKeyPress = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            const isInput = target instanceof HTMLInputElement ||
                          target instanceof HTMLTextAreaElement ||
                          target?.isContentEditable;

            if (Object.keys(keyBindings).length === 0 && !isInput) {
                if (e.key === 'i') {
                    scrollChannels('up');
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    return;
                } else if (e.key === 'k') {
                    scrollChannels('down');
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    return;
                } else if (e.key === 'o') {
                    scrollMessages('up');
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    return;
                } else if (e.key === 'l') {
                    scrollMessages('down');
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    return;
                } else if (e.key === 'G' && e.shiftKey) {
                    scrollToBottom();
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    return;
                } else if (e.key === 'u') {
                    openUserSettings();
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    return;
                }
            }

            if (Object.keys(keyBindings).length > 0) {
                if (pendingPrefix) {
                    if (e.key.length === 1 && e.key.match(/[a-z]/)) {
                        const fullCombo = pendingPrefix + e.key;
                        if (keyBindings[fullCombo]) {
                            handleElementClick(keyBindings[fullCombo]);
                            e.preventDefault();
                            e.stopImmediatePropagation();
                        } else {
                            cleanupHints();
                        }
                    } else if (e.key === "Escape") {
                        cleanupHints();
                    }
                    return;
                }

                if (e.key === 'z') {
                    pendingPrefix = e.key;
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    return;
                }

                if (keyBindings[e.key]) {
                    handleElementClick(keyBindings[e.key]);
                    e.preventDefault();
                    e.stopImmediatePropagation();
                } else if (e.key === "Escape") {
                    cleanupHints();
                    e.preventDefault();
                    e.stopImmediatePropagation();
                }
                return;
            }

            if (e.key === "Escape" && isInput) {
                performEscapeAction();
                e.preventDefault();
                e.stopImmediatePropagation();
                return;
            }

            if (e.key === "f" && !isInput && !e.ctrlKey && !e.metaKey && !e.altKey) {
                showHints();
                e.preventDefault();
                e.stopImmediatePropagation();
            }
        };

        document.addEventListener("keydown", handleKeyPress, true);

        return () => {
            document.removeEventListener("keydown", handleKeyPress, true);
            cleanupHints();
        };
    },

    stop() {}
});
