// ==UserScript==
// @name         Gutenberg: Toggle target=_blank in all links
// @version      0.0.1
// @description  Adds a "Toggle target=_blank in all links" button to the Gutenberg editor in WordPerss
// @match        *://*/*/wp-admin/post.php*
// @match        *://*/*/wp-admin/post-new.php*
// @match        *://*/wp-admin/post.php*
// @match        *://*/wp-admin/post-new.php*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    function waitForGutenbergReady() {
        return new Promise((resolve) => {
            const interval = setInterval(() => {
                const wpObj = window.wp;
                if (
                    wpObj &&
                    wpObj.data &&
                    wpObj.data.select &&
                    wpObj.data.dispatch &&
                    wpObj.blocks &&
                    wpObj.data.select('core/block-editor') &&
                    wpObj.data.select('core/editor')
                ) {
                    clearInterval(interval);
                    resolve();
                }
            }, 250);
        });
    }

    function injectLinkIndicatorsCSS() {
        if (document.getElementById('gm-gutenberg-link-indicators')) {
            return;
        }

        const style = document.createElement('style');
        style.id = 'gm-gutenberg-link-indicators';
        style.textContent = `
            .block-editor-rich-text__editable a[target="_blank"]::after {
                content: " ↗";
                font-size: 0.8em;
                opacity: 0.8;
            }
            .block-editor-rich-text__editable a:not([target="_blank"])::after {
                content: " •";
                font-size: 0.8em;
                opacity: 0.5;
            }
        `;
        document.head.appendChild(style);
    }

    function addToolbarButton() {
        const tryAttach = () => {
            if (document.getElementById('gm-toggle-link-targets')) {
                return;
            }

            const toolbar =
                document.querySelector('.editor-header__settings') ||
                document.querySelector('.editor-header-settings') ||
                null;

            if (!toolbar) {
                return;
            }

            const btn = document.createElement('button');
            btn.id = 'gm-toggle-link-targets';
            btn.type = 'button';
            btn.className = 'components-button is-secondary';
            btn.textContent = 'Toggle target="_blank"';

            btn.addEventListener('click', toggleAllLinks);
            toolbar.prepend(btn);
        };

        // Run forever, never clear
        setInterval(() => {
            tryAttach();
        }, 500);
    }

    let stateNewTab = true; // true => set all links to open in new tab

    function toggleAllLinks() {
        const wpObj = window.wp;

        const editorSelect = wpObj.data.select('core/editor');
        const { resetBlocks } = wpObj.data.dispatch('core/block-editor');
        const { parse } = wpObj.blocks;

        if (!editorSelect || !resetBlocks || !parse) {
            console.warn('Required Gutenberg APIs not available.');
            return;
        }

        const content = editorSelect.getEditedPostContent();
        if (!content || content.indexOf('<a') === -1) {
            stateNewTab = !stateNewTab; // still flip so the button is a simple toggle
            return;
        }

        const newContent = toggleTargetsInContentDOM(content, stateNewTab);
        if (newContent === content) {
            stateNewTab = !stateNewTab;
            return;
        }

        const blocks = parse(newContent);
        resetBlocks(blocks);

        stateNewTab = !stateNewTab;
    }

    function toggleTargetsInContentDOM(content, setToNewTab) {
        // Wrap the entire serialized content in a <template> to get a fragment.
        const tpl = document.createElement('template');
        tpl.innerHTML = content;

        const anchors = tpl.content.querySelectorAll('a[href]');
        if (!anchors.length) {
            return content;
        }

        anchors.forEach((a) => {
            if (setToNewTab) {
                a.setAttribute('target', '_blank');

                const rel = a.getAttribute('rel') || '';
                const parts = new Set(
                    rel
                        .split(/\s+/)
                        .filter(Boolean)
                        .concat(['noopener', 'noreferrer'])
                );
                a.setAttribute('rel', Array.from(parts).join(' '));
            } else {
                a.removeAttribute('target');
                // Leave rel alone.
            }
        });

        // Serialized back to a string that wp.blocks.parse() can consume.
        return tpl.innerHTML;
    }

    async function init() {
        await waitForGutenbergReady();
        injectLinkIndicatorsCSS();
        addToolbarButton();
    }

    init();
})();
