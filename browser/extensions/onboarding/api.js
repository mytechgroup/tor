/* -*- indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
/* globals  APP_STARTUP, ADDON_INSTALL */
"use strict";

ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm");
XPCOMUtils.defineLazyModuleGetters(this, {
  OnboardingTourType: "resource://onboarding/modules/OnboardingTourType.jsm",
  Services: "resource://gre/modules/Services.jsm",
  UIState: "resource://services-sync/UIState.jsm",
});

XPCOMUtils.defineLazyServiceGetter(this, "resProto",
                                   "@mozilla.org/network/protocol;1?name=resource",
                                   "nsISubstitutingProtocolHandler");

const RESOURCE_HOST = "onboarding";

const {PREF_STRING, PREF_BOOL, PREF_INT} = Ci.nsIPrefBranch;

// In Tor Browser we initialize onboarding upon "final-ui-startup" instead
// of waiting for "browser-delayed-startup-finished"; otherwise, on first
// run the onboarding frame script's "onload" listener is installed too
// late to detect that about:tor is loaded.
const BROWSER_READY_NOTIFICATION = "final-ui-startup";
const BROWSER_SESSION_STORE_NOTIFICATION = "sessionstore-windows-restored";
const PREF_WHITELIST = [
  ["browser.onboarding.enabled", PREF_BOOL],
  ["browser.onboarding.state", PREF_STRING],
  ["browser.onboarding.notification.finished", PREF_BOOL],
  ["browser.onboarding.notification.prompt-count", PREF_INT],
  ["browser.onboarding.notification.last-time-of-changing-tour-sec", PREF_INT],
  ["browser.onboarding.notification.tour-ids-queue", PREF_STRING],
];

[
  // Tor Browser tours:
  "onboarding-tour-tor-welcome",
  "onboarding-tour-tor-privacy",
  "onboarding-tour-tor-network-9-0",
  "onboarding-tour-tor-circuit-display",
  "onboarding-tour-tor-security",
  "onboarding-tour-tor-expect-differences",
  "onboarding-tour-tor-onion-services",
  "onboarding-tour-tor-toolbar-update-9-0",
#if 0
// Firefox tours. To reduce conflicts when rebasing against newer Firefox
// code, we use the preprocessor to omit this code block.
  "onboarding-tour-addons",
  "onboarding-tour-customize",
  "onboarding-tour-default-browser",
  "onboarding-tour-library",
  "onboarding-tour-performance",
  "onboarding-tour-private-browsing",
  "onboarding-tour-screenshots",
  "onboarding-tour-singlesearch",
  "onboarding-tour-sync",
#endif
].forEach(tourId => PREF_WHITELIST.push([`browser.onboarding.tour.${tourId}.completed`, PREF_BOOL]));

let waitingForBrowserReady = true;
let startupData;

/**
 * Set pref. Why no `getPrefs` function is due to the privilege level.
 * We cannot set prefs inside a framescript but can read.
 * For simplicity and efficiency, we still read prefs inside the framescript.
 *
 * @param {Array} prefs the array of prefs to set.
 *   The array element carries info to set pref, should contain
 *   - {String} name the pref name, such as `browser.onboarding.state`
 *   - {*} value the value to set
 **/
function setPrefs(prefs) {
  prefs.forEach(pref => {
    let prefObj = PREF_WHITELIST.find(([name ]) => name == pref.name);
    if (!prefObj) {
      return;
    }

    let [name, type] = prefObj;

    switch (type) {
      case PREF_BOOL:
        Services.prefs.setBoolPref(name, pref.value);
        break;
      case PREF_INT:
        Services.prefs.setIntPref(name, pref.value);
        break;
      case PREF_STRING:
        Services.prefs.setStringPref(name, pref.value);
        break;
      default:
        throw new TypeError(`Unexpected type (${type}) for preference ${name}.`);
    }
  });
}

function openTorTab(aURL, aFrameScript) {
  let win = Services.wm.getMostRecentWindow('navigator:browser');
  if (win) {
    let tabBrowser = win.gBrowser;
    let triggeringPrincipal = Services.scriptSecurityManager.createNullPrincipal({});
    let tab = tabBrowser.addTab(aURL, { triggeringPrincipal });
    tabBrowser.selectedTab = tab;

    if (aFrameScript) {
      let b = tabBrowser.getBrowserForTab(tab);
      b.messageManager.loadFrameScript(aFrameScript, true);
    }
  }
}

/**
 * syncTourChecker listens to and maintains the login status inside, and can be
 * queried at any time once initialized.
 */
let syncTourChecker = {
  _registered: false,
  _loggedIn: false,

  isLoggedIn() {
    return this._loggedIn;
  },

  observe(subject, topic) {
    const state = UIState.get();
    if (state.status == UIState.STATUS_NOT_CONFIGURED) {
      this._loggedIn = false;
    } else {
      this.setComplete();
    }
  },

  init() {
    if (!Services.prefs.getBoolPref("identity.fxaccounts.enabled")) {
      return;
    }
    // Check if we've already logged in at startup.
    const state = UIState.get();
    if (state.status != UIState.STATUS_NOT_CONFIGURED) {
      this.setComplete();
    }
    this.register();
  },

  register() {
    if (this._registered) {
      return;
    }
    Services.obs.addObserver(this, "sync-ui-state:update");
    this._registered = true;
  },

  setComplete() {
    this._loggedIn = true;
    Services.prefs.setBoolPref("browser.onboarding.tour.onboarding-tour-sync.completed", true);
  },

  unregister() {
    if (!this._registered) {
      return;
    }
    Services.obs.removeObserver(this, "sync-ui-state:update");
    this._registered = false;
  },

  uninit() {
    this.unregister();
  },
};

/**
 * Listen and process events from content.
 */
function initContentMessageListener() {
  Services.mm.addMessageListener("Onboarding:OnContentMessage", msg => {
    switch (msg.data.action) {
      case "set-prefs":
        setPrefs(msg.data.params);
        break;
      case "get-login-status":
        msg.target.messageManager.sendAsyncMessage("Onboarding:ResponseLoginStatus", {
          isLoggedIn: syncTourChecker.isLoggedIn(),
        });
        break;
      case "tor-open-tab":
        openTorTab(msg.data.params.url, msg.data.params.frameScriptURL);
        break;
#if 0
// No telemetry in Tor Browser.
      case "ping-centre":
        try {
          OnboardingTelemetry.process(msg.data.params.data);
        } catch (e) {
          Cu.reportError(e);
        }
        break;
#endif
    }
  });
}

/**
 * onBrowserReady - Continues startup of the add-on after browser is ready.
 */
function onBrowserReady() {
  waitingForBrowserReady = false;

  OnboardingTourType.check();
  Services.mm.loadFrameScript("resource://onboarding/onboarding.js", true, true);
  initContentMessageListener();
}

/**
 * observe - nsIObserver callback to handle various browser notifications.
 */
function observe(subject, topic, data) {
  switch (topic) {
    case BROWSER_READY_NOTIFICATION:
      Services.obs.removeObserver(observe, BROWSER_READY_NOTIFICATION);
      onBrowserReady();
      break;
    case BROWSER_SESSION_STORE_NOTIFICATION:
      Services.obs.removeObserver(observe, BROWSER_SESSION_STORE_NOTIFICATION);
      // Postpone Firefox account checking until "before handling user events"
      // phase to meet performance criteria. The reason we don't postpone the
      // whole onBrowserReady here is because in that way we will miss onload
      // events for onboarding.js.
      Services.tm.idleDispatchToMainThread(() => syncTourChecker.init());
      break;
  }
}

this.onboarding = class extends ExtensionAPI {
  onStartup() {
    resProto.setSubstitutionWithFlags(RESOURCE_HOST,
      Services.io.newURI("chrome/content/", null, this.extension.rootURI),
      resProto.ALLOW_CONTENT_ACCESS);

    if (this.extension.rootURI instanceof Ci.nsIJARURI) {
      this.manifest = this.extension.rootURI.JARFile.QueryInterface(Ci.nsIFileURL).file;
    } else if (this.extension.rootURI instanceof Ci.nsIFileURL) {
      this.manifest = this.extension.rootURI.file;
    }

    if (this.manifest) {
      Components.manager.addBootstrappedManifestLocation(this.manifest);
    } else {
      Cu.reportError("Cannot find onboarding chrome.manifest for registring translated strings");
    }

    // Only start Onboarding when the browser UI is ready
    if (Services.startup.startingUp) {
      Services.obs.addObserver(observe, BROWSER_READY_NOTIFICATION);
      Services.obs.addObserver(observe, BROWSER_SESSION_STORE_NOTIFICATION);
    } else {
      onBrowserReady();
      syncTourChecker.init();
    }
  }

  onShutdown() {
    resProto.setSubstitution(RESOURCE_HOST, null);

    // Stop waiting for browser to be ready
    if (waitingForBrowserReady) {
      Services.obs.removeObserver(observe, BROWSER_READY_NOTIFICATION);
    }
    syncTourChecker.uninit();
  }
};
