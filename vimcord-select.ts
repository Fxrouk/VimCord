import definePlugin from "@utils/types";

export default definePlugin({
    name: "VimCord-Select",
    description: "Enhanced context menu with keyboard hints and shortcut display",
    authors: [{ name: "BV10", id: 105170831130234880n }],
    dependencies: ["CommandsAPI"],

    start() {

        const config = {
            hintKeys: 'abcdeghjmnpqrtuvwxyz'.split(''),
            hintColors: {
                message: "#B352DD",
                menu: "#B352DD",
                text: "#ffffff"
            },
            highlightColor: "rgba(114, 137, 218, 0.3)",
            messageHintOffset: { x: 5, y: 5 },
            menuHintOffset: { x: -30, y: -12 },
            shortcutsPanel: {
                position: "fixed",
                right: "20px",
                bottom: "20px",
                backgroundColor: "rgba(47, 49, 54, 0.95)",
                borderRadius: "8px",
                padding: "15px",
                minWidth: "220px",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
                zIndex: "9999",
                fontFamily: "'gg sans', 'Noto Sans', sans-serif",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                color: "#ffffff",
                titleColor: "#B352DD",
                keyStyle: {
                    backgroundColor: "#B352DD",
                    color: "white",
                    padding: "3px 8px",
                    borderRadius: "4px",
                    marginRight: "10px",
                    fontWeight: "600",
                    minWidth: "24px",
                    textAlign: "center",
                    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)"
                },
                textStyle: {
                    color: "#ffffff",
                    opacity: "0.9"
                }
            }
        };

        const DOM = {
            getVisibleMessages: () => {
                const allMessages = Array.from(document.querySelectorAll('.message__5126c'));
                return allMessages.filter(msg => {
                    const rect = msg.getBoundingClientRect();
                    return (
                        rect.top >= 0 &&
                        rect.left >= 0 &&
                        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
                        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
                    );
                }) as HTMLElement[];
            },
            contextMenu: () => document.querySelector('[role="menu"]'),
            menuItems: () => document.querySelectorAll('[role="menu"] [role="menuitem"]'),
            messageInput: () => document.querySelector('[role="textbox"]'),
            messageContent: () => document.querySelectorAll('.messageContent__21e69'),
            replyMenuItem: () => document.querySelector('#message-reply'),
            editMenuItem: () => document.querySelector('#message-edit'),
            deleteMenuItem: () => document.querySelector('#message-delete')
        };

        let state = {
            mode: "idle" as "idle" | "messageSelect" | "menuSelect",
            hints: [] as HTMLElement[],
            selectedMessage: null as HTMLElement | null,
            menuObserver: null as MutationObserver | null,
            shortcutsPanel: null as HTMLElement | null
        };

        const utils = {
            createHint: (key: string, element: HTMLElement, color: string, isMenuItem: boolean = false) => {
                const hint = document.createElement("div");
                hint.textContent = key;
                hint.style.position = "absolute";
                hint.style.backgroundColor = color;
                hint.style.color = config.hintColors.text;
                hint.style.padding = "3px 8px";
                hint.style.borderRadius = "4px";
                hint.style.fontWeight = "bold";
                hint.style.zIndex = "9999";
                hint.style.boxShadow = "0 2px 5px rgba(0,0,0,0.3)";
                hint.style.fontFamily = "var(--font-primary)";
                hint.style.fontSize = "14px";
                hint.style.userSelect = "none";
                hint.style.pointerEvents = "none";

                const rect = element.getBoundingClientRect();

                if (isMenuItem) {
                    hint.style.left = `${rect.left + window.scrollX + config.menuHintOffset.x}px`;
                    hint.style.top = `${rect.top + window.scrollY + config.menuHintOffset.y}px`;
                } else {
                    const content = Array.from(DOM.messageContent()).find(c =>
                        c.closest('.message__5126c') === element
                    ) || element;

                    const contentRect = content.getBoundingClientRect();
                    hint.style.left = `${contentRect.left + window.scrollX + config.messageHintOffset.x}px`;
                    hint.style.top = `${contentRect.top + window.scrollY + config.messageHintOffset.y}px`;
                }

                document.body.appendChild(hint);
                return hint;
            },

            createShortcutsPanel: () => {
                if (state.shortcutsPanel) {
                    state.shortcutsPanel.remove();
                }

                const panel = document.createElement("div");
                Object.assign(panel.style, config.shortcutsPanel);
                panel.dataset.vimcordShortcuts = "true";

                const title = document.createElement("div");
                title.textContent = "Raccourcis Message";
                title.style.fontSize = "14px";
                title.style.fontWeight = "600";
                title.style.marginBottom = "12px";
                title.style.color = config.shortcutsPanel.titleColor;
                title.style.textTransform = "uppercase";
                title.style.letterSpacing = "0.5px";
                panel.appendChild(title);

                const shortcuts = [
                    { key: "m", description: "Modifier le message" },
                    { key: "r", description: "Répondre au message" },
                    { key: "d", description: "Supprimer le message" }
                ];

                shortcuts.forEach(shortcut => {
                    const item = document.createElement("div");
                    item.style.display = "flex";
                    item.style.alignItems = "center";
                    item.style.marginBottom = "8px";
                    item.style.fontSize = "14px";

                    const keyElement = document.createElement("span");
                    keyElement.textContent = shortcut.key;
                    Object.assign(keyElement.style, config.shortcutsPanel.keyStyle);

                    const descElement = document.createElement("span");
                    descElement.textContent = shortcut.description;
                    Object.assign(descElement.style, config.shortcutsPanel.textStyle);

                    item.appendChild(keyElement);
                    item.appendChild(descElement);
                    panel.appendChild(item);
                });

                document.body.appendChild(panel);
                state.shortcutsPanel = panel;
                return panel;
            },

            cleanup: () => {
                state.hints.forEach(h => h.remove());
                state.hints = [];
                state.mode = "idle";

                if (state.selectedMessage) {
                    state.selectedMessage.style.backgroundColor = "";
                    state.selectedMessage = null;
                }

                if (state.menuObserver) {
                    state.menuObserver.disconnect();
                    state.menuObserver = null;
                }

                if (state.shortcutsPanel) {
                    state.shortcutsPanel.remove();
                    state.shortcutsPanel = null;
                }
            },

            showMessageHints: () => {
                utils.cleanup();
                const visibleMessages = DOM.getVisibleMessages();
                const messages = visibleMessages.slice(0, config.hintKeys.length);

                messages.forEach((msg, i) => {
                    const hint = utils.createHint(
                        config.hintKeys[i],
                        msg,
                        config.hintColors.message
                    );
                    state.hints.push(hint);
                });

                if (messages.length > 0) {
                    state.mode = "messageSelect";
                }
            },

            setupMenuObserver: () => {
                if (state.menuObserver) return;

                state.menuObserver = new MutationObserver((mutations) => {
                    const menu = DOM.contextMenu();
                    if (menu && state.mode === "messageSelect") {
                        utils.showMenuHints();
                        utils.createShortcutsPanel();
                    }
                });

                document.body.addEventListener('click', () => {
                    if (state.mode === "menuSelect") {
                        utils.cleanup();
                    }
                }, { once: true, capture: true });

                const menu = DOM.contextMenu();
                if (menu) {
                    state.menuObserver.observe(menu, {
                        childList: true,
                        subtree: true
                    });
                }
            },

            showMenuHints: () => {
                state.hints.forEach(h => h.remove());
                state.hints = [];

                const replyItem = DOM.replyMenuItem();
                if (replyItem) {
                    const hint = utils.createHint(
                        'r',
                        replyItem as HTMLElement,
                        config.hintColors.menu,
                        true
                    );
                    state.hints.push(hint);
                }

                const editItem = DOM.editMenuItem();
                if (editItem) {
                    const hint = utils.createHint(
                        'm',
                        editItem as HTMLElement,
                        config.hintColors.menu,
                        true
                    );
                    state.hints.push(hint);
                }

                const deleteItem = DOM.deleteMenuItem();
                if (deleteItem) {
                    const hint = utils.createHint(
                        'd',
                        deleteItem as HTMLElement,
                        config.hintColors.menu,
                        true
                    );
                    state.hints.push(hint);
                }

                state.mode = "menuSelect";
                utils.setupMenuObserver();
            },

            openContextMenu: (message: HTMLElement) => {
                if (state.selectedMessage) {
                    state.selectedMessage.style.backgroundColor = "";
                }

                message.style.backgroundColor = config.highlightColor;
                state.selectedMessage = message;

                const rect = message.getBoundingClientRect();
                const event = new MouseEvent('contextmenu', {
                    bubbles: true,
                    clientX: rect.left + rect.width / 2,
                    clientY: rect.top + rect.height / 2,
                    view: window
                });

                message.dispatchEvent(event);

                const menuObserver = new MutationObserver((_, observer) => {
                    if (DOM.contextMenu()) {
                        utils.showMenuHints();
                        utils.createShortcutsPanel();
                        observer.disconnect();
                    }
                });

                menuObserver.observe(document.body, {
                    childList: true,
                    subtree: true
                });
            },

            selectMenuItem: (key: string) => {
                if (key === 'r') {
                    const replyItem = DOM.replyMenuItem();
                    if (replyItem) {
                        (replyItem as HTMLElement).click();
                    }
                }
                if (key === 'm') {
                    const editItem = DOM.editMenuItem();
                    if (editItem) {
                        (editItem as HTMLElement).click();
                    }
                }
                if (key === 'd') {
                    const deleteItem = DOM.deleteMenuItem();
                    if (deleteItem) {
                        (deleteItem as HTMLElement).click();
                    }
                }
                utils.cleanup();
            },

            shouldIgnoreEvent: (e: KeyboardEvent): boolean => {
                const target = e.target as HTMLElement;

                if (e.key === 'Escape') return false;
                if (e.ctrlKey || e.altKey || e.metaKey) return true;

                const isEditable = target.isContentEditable ||
                                 (target.tagName === 'INPUT' && (target as HTMLInputElement).type !== 'checkbox') ||
                                 target.tagName === 'TEXTAREA' ||
                                 target.tagName === 'SELECT';

                return isEditable;
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                utils.cleanup();
                return;
            }

            if (utils.shouldIgnoreEvent(e)) {
                return;
            }

            if (state.mode === "idle" && e.key === 's') {
                utils.showMessageHints();
                e.preventDefault();
                e.stopPropagation();
                return;
            }

            if (state.mode === "messageSelect") {
                const key = e.key.toLowerCase();
                const index = config.hintKeys.indexOf(key);
                if (index >= 0) {
                    const visibleMessages = DOM.getVisibleMessages();
                    if (index < visibleMessages.length) {
                        utils.openContextMenu(visibleMessages[index]);
                        e.preventDefault();
                    }
                }
            }

            if (state.mode === "menuSelect") {
                const key = e.key.toLowerCase();
                if (key === 'r' || key === 'm' || key === 'd') {
                    utils.selectMenuItem(key);
                    e.preventDefault();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown, true);

        return () => {
            document.removeEventListener('keydown', handleKeyDown, true);
            utils.cleanup();
        };
    },

    stop() {
        document.querySelectorAll('[data-vimcord-hint], [data-vimcord-shortcuts]').forEach(el => el.remove());
    }
});
