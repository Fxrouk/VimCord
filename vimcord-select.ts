import definePlugin from "@utils/types";

export default definePlugin({
    name: "VimCord-Select",
    description: "Enhanced context menu with keyboard hints and shortcut display",
    authors: [{ name: "BV10", id: 105170831130234880n }],
    dependencies: ["CommandsAPI"],

    start() {
        const config = {
            hintKeys: 'abcdeghijklmnopqrstvwxy'.split(''),
            hintColors: {
                message: "#B352DD",
                menu: "#B352DD",
                media: "#F202F2",
                link: "#F202F2",
                text: "#ffffff"
            },
            highlightColor: "rgba(114, 137, 218, 0.3)",
            messageHintOffset: { x: 5, y: 5 },
            mediaHintOffset: { x: 5, y: 5 },
            linkHintOffset: { x: 5, y: 5 },
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
            getAllLinks: () => {
                return Array.from(document.querySelectorAll(
                    '.message__5126c a[href], .chatContent__5dca8 a[href]'
                )) as HTMLElement[];
            },
            getVisibleElements: () => {
                const elements = {
                    messages: [] as HTMLElement[],
                    media: [] as HTMLElement[],
                    links: [] as HTMLElement[]
                };

                const allMessages = Array.from(document.querySelectorAll('.message__5126c'));
                elements.messages = allMessages.filter(msg => {
                    const rect = msg.getBoundingClientRect();
                    return (
                        rect.top >= 0 &&
                        rect.left >= 0 &&
                        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
                        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
                    );
                }) as HTMLElement[];

                const mediaElements = Array.from(document.querySelectorAll(
                    '.message__5126c img, .message__5126c video, .message__5126c .embedWrapper__6d7d7'
                ));
                elements.media = mediaElements.filter(el => {
                    const rect = el.getBoundingClientRect();
                    return (
                        rect.top >= 0 &&
                        rect.left >= 0 &&
                        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
                        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
                    );
                }) as HTMLElement[];

                const allLinks = DOM.getAllLinks();
                elements.links = allLinks.filter(link => {
                    const rect = link.getBoundingClientRect();
                    return (
                        rect.width > 0 &&
                        rect.height > 0 &&
                        getComputedStyle(link).visibility !== 'hidden'
                    );
                });

                return elements;
            },
            contextMenu: () => document.querySelector('[role="menu"]'),
            menuItems: () => document.querySelectorAll('[role="menu"] [role="menuitem"]'),
            messageInput: () => document.querySelector('[role="textbox"]'),
            messageContent: () => document.querySelectorAll('.messageContent__21e69'),
            replyMenuItem: () => document.querySelector('#message-reply'),
            editMenuItem: () => document.querySelector('#message-edit'),
            deleteMenuItem: () => document.querySelector('#message-delete'),
            getMenuItems: () => {
                return {
                    reply: document.querySelector('#message-reply'),
                    edit: document.querySelector('#message-edit'),
                    delete: document.querySelector('#message-delete')
                };
            },
            getMediaViewer: () => document.querySelector('[class^="imageWrapper-"]')
        };


        let state = {
            mode: "idle" as "idle" | "elementSelect" | "menuSelect",
            hints: [] as HTMLElement[],
            selectedElement: null as HTMLElement | null,
            menuObserver: null as MutationObserver | null,
            shortcutsPanel: null as HTMLElement | null,
            elementsMap: new Map<string, {element: HTMLElement, type: string}>(),
            menuActions: new Map<string, {action: string, element: HTMLElement | null}>([
                ['r', {action: 'reply', element: null}],
                ['m', {action: 'edit', element: null}],
                ['d', {action: 'delete', element: null}]
            ]),
            scrollPosition: 0,
            pendingPrefix: null as string | null,
            pressedKeys: [] as string[]
        };


        const utils = {
            createHint: (key: string, element: HTMLElement, type: "message" | "media" | "link" | "menu") => {
                const hint = document.createElement("div");
                hint.textContent = key;
                hint.style.position = "absolute";
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

                switch (type) {
                    case "message":
                        hint.style.backgroundColor = config.hintColors.message;
                        break;
                    case "media":
                        hint.style.backgroundColor = config.hintColors.media;
                        break;
                    case "link":
                        hint.style.backgroundColor = config.hintColors.link;
                        break;
                    case "menu":
                        hint.style.backgroundColor = config.hintColors.menu;
                        break;
                }

                const rect = element.getBoundingClientRect();

                switch (type) {
                    case "menu":
                        hint.style.left = `${rect.left + window.scrollX + config.menuHintOffset.x}px`;
                        hint.style.top = `${rect.top + window.scrollY + config.menuHintOffset.y}px`;
                        break;
                    default:
                        const offset = type === "media" ? config.mediaHintOffset :
                                     type === "link" ? config.linkHintOffset :
                                     config.messageHintOffset;
                        hint.style.left = `${rect.left + window.scrollX + offset.x}px`;
                        hint.style.top = `${rect.top + window.scrollY + offset.y}px`;
                        break;
                }

                document.body.appendChild(hint);
                return hint;
            },

            updateHintStyles: (currentCombo: string) => {
                state.hints.forEach(hint => {
                    const hintText = hint.textContent || '';
                    if (hintText.startsWith(currentCombo)) {
                        const zSpan = document.createElement('span');
                        zSpan.textContent = 'z';
                        zSpan.style.color = '#520175';
                        zSpan.style.fontWeight = 'bold';

                        const restSpan = document.createElement('span');
                        restSpan.textContent = hintText.slice(1);
                        restSpan.style.color = 'white';

                        hint.innerHTML = '';
                        hint.appendChild(zSpan);
                        hint.appendChild(restSpan);

                        hint.style.backgroundColor = config.hintColors.message;
                        hint.style.display = "block";
                    } else {
                        hint.style.display = "none";
                    }
                });
            },

            createShortcutsPanel: (mode: "elements" | "menu") => {
                if (state.shortcutsPanel) {
                    state.shortcutsPanel.remove();
                }

                const panel = document.createElement("div");
                Object.assign(panel.style, config.shortcutsPanel);
                panel.dataset.vimcordShortcuts = "true";

                const title = document.createElement("div");
                title.textContent = mode === "elements" ? "Sélection d'éléments" : "Actions Message";
                title.style.fontSize = "14px";
                title.style.fontWeight = "600";
                title.style.marginBottom = "12px";
                title.style.color = config.shortcutsPanel.titleColor;
                title.style.textTransform = "uppercase";
                title.style.letterSpacing = "0.5px";
                panel.appendChild(title);

                const shortcuts = mode === "elements" ? [
                    { key: "Esc", description: "Annuler la sélection" },
                    { key: "a-z", description: "Sélectionner un élément" },
                    { key: "Rose", description: "Cliquer sur le lien"},
                    { key: "Violet", description: "Interagir avec le message"}
                ] : [
                    { key: "r", description: "Répondre au message" },
                    { key: "m", description: "Modifier le message" },
                    { key: "d", description: "Supprimer le message" },
                    { key: "Esc", description: "Fermer le menu" }
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
                state.scrollPosition = window.scrollY;

                state.hints.forEach(h => h.remove());
                state.hints = [];
                state.mode = "idle";
                state.elementsMap.clear();
                state.pendingPrefix = null;
                state.pressedKeys = [];

                if (state.selectedElement) {
                    state.selectedElement.style.backgroundColor = "";
                    state.selectedElement = null;
                }

                if (state.menuObserver) {
                    state.menuObserver.disconnect();
                    state.menuObserver = null;
                }

                if (state.shortcutsPanel) {
                    state.shortcutsPanel.remove();
                    state.shortcutsPanel = null;
                }

                setTimeout(() => {
                    window.scrollTo(0, state.scrollPosition);
                }, 0);
            },

            showElementHints: () => {
                state.scrollPosition = window.scrollY;
                utils.cleanup();
                const visibleElements = DOM.getVisibleElements();
                state.elementsMap.clear();


                const singleLetterElements = [
                    ...visibleElements.messages,
                    ...visibleElements.media,
                    ...visibleElements.links
                ].slice(0, 23);

                singleLetterElements.forEach((element, index) => {
                    if (index >= 23) return;
                    const key = config.hintKeys[index];
                    const type =
                        visibleElements.messages.includes(element) ? "message" :
                        visibleElements.media.includes(element) ? "media" : "link";

                    const hint = utils.createHint(key, element, type);
                    state.hints.push(hint);
                    state.elementsMap.set(key, {element, type});
                });


                const remainingElements = [
                    ...visibleElements.messages,
                    ...visibleElements.media,
                    ...visibleElements.links
                ].slice(23);

                remainingElements.forEach((element, index) => {
                    if (index >= 23) return;
                    const suffix = config.hintKeys[index];
                    const keyCombo = `z${suffix}`;
                    const type =
                        visibleElements.messages.includes(element) ? "message" :
                        visibleElements.media.includes(element) ? "media" : "link";

                    const hint = utils.createHint(keyCombo, element, type);
                    state.hints.push(hint);
                    state.elementsMap.set(keyCombo, {element, type});
                });

                utils.createShortcutsPanel("elements");
                state.mode = "elementSelect";
            },

            showMenuHints: () => {
                state.hints.forEach(h => h.remove());
                state.hints = [];

                const menuItems = DOM.getMenuItems();
                state.menuActions.forEach((value, key) => {
                    let element: HTMLElement | null = null;
                    switch (value.action) {
                        case 'reply': element = menuItems.reply as HTMLElement; break;
                        case 'edit': element = menuItems.edit as HTMLElement; break;
                        case 'delete': element = menuItems.delete as HTMLElement; break;
                    }

                    if (element) {
                        const hint = utils.createHint(key, element, "menu");
                        state.hints.push(hint);
                        state.menuActions.set(key, { ...value, element });
                    }
                });

                utils.createShortcutsPanel("menu");
                state.mode = "menuSelect";
            },

            setupMenuObserver: () => {
                if (state.menuObserver) return;

                state.menuObserver = new MutationObserver(() => {
                    if (DOM.contextMenu() && state.mode === "elementSelect") {
                        utils.showMenuHints();
                    }
                });

                state.menuObserver.observe(document.body, {
                    childList: true,
                    subtree: true
                });
            },

            clickElement: (element: HTMLElement) => {
                const rect = element.getBoundingClientRect();
                const event = new MouseEvent('click', {
                    bubbles: true,
                    clientX: rect.left + rect.width / 2,
                    clientY: rect.top + rect.height / 2,
                    view: window
                });
                element.dispatchEvent(event);
                utils.cleanup();
            },

            openContextMenu: (element: HTMLElement) => {
                if (state.selectedElement) {
                    state.selectedElement.style.backgroundColor = "";
                }

                element.style.backgroundColor = config.highlightColor;
                state.selectedElement = element;

                const rect = element.getBoundingClientRect();
                const event = new MouseEvent('contextmenu', {
                    bubbles: true,
                    clientX: rect.left + rect.width / 2,
                    clientY: rect.top + rect.height / 2,
                    view: window
                });

                element.dispatchEvent(event);
                utils.setupMenuObserver();
            },

            executeMenuAction: (key: string) => {
                const action = state.menuActions.get(key);
                if (action && action.element) {
                    action.element.click();
                    utils.cleanup();
                }
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
            },

            closeMediaViewer: () => {
                const mediaViewer = DOM.getMediaViewer();
                if (mediaViewer) {
                    const closeButton = mediaViewer.querySelector('[aria-label="Fermer"]') as HTMLElement;
                    if (closeButton) {
                        closeButton.click();
                        return true;
                    }
                }
                return false;
            }
        };


        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (utils.closeMediaViewer()) {
                    return;
                }

                utils.cleanup();
                return;
            }

            if (utils.shouldIgnoreEvent(e)) {
                return;
            }

            if (state.mode === "idle" && e.key === 's') {
                utils.showElementHints();
                e.preventDefault();
                e.stopPropagation();
                return;
            }

            if (state.mode === "elementSelect") {
                if (state.pendingPrefix) {
                    if (e.key.length === 1 && e.key.match(/[a-z]/)) {
                        state.pressedKeys.push(e.key);
                        const fullCombo = state.pressedKeys.join('');
                        utils.updateHintStyles(fullCombo);

                        const elementInfo = state.elementsMap.get(fullCombo);
                        if (elementInfo) {
                            if (elementInfo.type === "message") {
                                utils.openContextMenu(elementInfo.element);
                            } else {
                                utils.clickElement(elementInfo.element);
                            }
                            e.preventDefault();
                            e.stopPropagation();
                        }
                    } else if (e.key === "Escape") {
                        utils.cleanup();
                    }
                    return;
                }

                if (e.key === 'z') {
                    state.pendingPrefix = e.key;
                    state.pressedKeys = [e.key];
                    utils.updateHintStyles(state.pressedKeys.join(''));
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }

                const key = e.key.toLowerCase();
                const elementInfo = state.elementsMap.get(key);

                if (elementInfo) {
                    if (elementInfo.type === "message") {
                        utils.openContextMenu(elementInfo.element);
                    } else {
                        utils.clickElement(elementInfo.element);
                    }
                    e.preventDefault();
                    e.stopPropagation();
                } else if (e.key === "Escape") {
                    utils.cleanup();
                    e.preventDefault();
                    e.stopPropagation();
                }
            }

            if (state.mode === "menuSelect") {
                const key = e.key.toLowerCase();
                if (state.menuActions.has(key)) {
                    utils.executeMenuAction(key);
                    e.preventDefault();
                    e.stopPropagation();
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
