/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * This class handles hooking into the Thunderbird message window to be able
 * to manage the message preview correctly.
 */
export class Window {
  async init() {
    // Set up our monkey patches which aren't really listeners, but this
    // is a good way to manage them.
    browser.convMsgWindow.onMonkeyPatch.addListener(() => {});

    browser.convMsgWindow.onThreadPaneDoubleClick.addListener(
      async (windowId, msgHdrs) => {
        for (const hdr of msgHdrs) {
          const account = await browser.accounts.get(hdr.folder.accountId);
          if (account.type == "nntp" || account.type == "rss") {
            return {};
          }
        }
        const urls = [];
        for (const hdr of msgHdrs) {
          urls.push(await browser.conversations.getMessageUriForId(hdr.id));
        }
        await this.openConversation(windowId, urls);
        return {
          cancel: true,
        };
      }
    );

    browser.convMsgWindow.onThreadPaneMiddleClick.addListener(
      async (windowId, msgHdrs) => {
        for (const hdr of msgHdrs) {
          const account = await browser.accounts.get(hdr.folder.accountId);
          if (account.type == "nntp" || account.type == "rss") {
            return {};
          }
        }
        const urls = [];
        for (const hdr of msgHdrs) {
          urls.push(await browser.conversations.getMessageUriForId(hdr.id));
        }
        const url = this.makeConversationUrl(urls);
        await browser.conversations.createTab({
          url,
          type: "chromeTab",
        });
        return {
          cancel: true,
        };
      }
    );

    browser.convMsgWindow.onSummarizeThread.addListener(async () => {});
  }

  async openConversation(windowId, urls) {
    switch (
      await browser.conversations.getCorePref("mail.openMessageBehavior")
    ) {
      case 0: // fall-through
      case 1: {
        if ("getCurrent" in browser.mailTabs) {
          // Thunderbird 91
          browser.convMsgWindow.openNewWindow(
            "chrome://conversations/content/stubWrapper.xhtml",
            this.getQueryString(urls) + "&standalone=1"
          );
        } else {
          // Thunderbird 78
          browser.convMsgWindow.openNewWindow(
            `chrome://conversations/content/stub.html${this.getQueryString(
              urls
            )}`
          );
        }

        break;
      }
      case 2: {
        await browser.conversations.createTab({
          url: `chrome://conversations/content/stub.html${this.getQueryString(
            urls
          )}`,
          type: "contentTab",
        });
        break;
      }
    }
  }

  /**
   * Returns a string of parameters for us in URLs when opening stub windows.
   *
   * @param {string[]} urls
   *   An array of urls to be opened.
   * @returns {string}
   */
  getQueryString(urls) {
    return "?urls=" + encodeURIComponent(urls.join(","));
  }
}
