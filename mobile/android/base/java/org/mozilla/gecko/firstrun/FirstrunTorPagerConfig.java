/* -*- Mode: Java; c-basic-offset: 4; tab-width: 4; indent-tabs-mode: nil; -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

package org.mozilla.gecko.firstrun;

import android.content.Context;
import android.os.Bundle;
import android.util.Log;
import org.mozilla.gecko.GeckoSharedPrefs;
import org.mozilla.gecko.R;
import org.mozilla.gecko.Telemetry;
import org.mozilla.gecko.TelemetryContract;
import org.mozilla.gecko.Experiments;

import java.util.LinkedList;
import java.util.List;

public class FirstrunTorPagerConfig {
    public static final String LOGTAG = "FirstrunPagerConfigTor";

    public static final String KEY_IMAGE = "panelImage";
    public static final String KEY_MESSAGE = "panelMessage";
    public static final String KEY_SUBTEXT = "panelDescription";
    public static final String KEY_CTATEXT = "panelCtaText";

    private static Context mContext;

    public static List<FirstrunTorPanelConfig> getDefault(Context context) {
       mContext = context;
       final List<FirstrunTorPanelConfig> panels = new LinkedList<>();
       panels.add(SimplePanelConfigs.welcomeTorPanelConfig);
       panels.add(SimplePanelConfigs.privacyPanelConfig);
       panels.add(SimplePanelConfigs.torNetworkPanelConfig);
       panels.add(SimplePanelConfigs.secSettingsPanelConfig);
       panels.add(SimplePanelConfigs.tipsPanelConfig);
       panels.add(SimplePanelConfigs.onionServicesPanelConfig);

       return panels;
    }

    public static class FirstrunTorPanelConfig {

        private String classname;
        private String title;
        private Bundle args;

        public FirstrunTorPanelConfig(String classname, int title, int image, int message, int subtext, int ctatext) {
            this.classname = classname;
            this.title = mContext.getResources().getString(title);

            this.args = new Bundle();
            this.args.putInt(KEY_IMAGE, image);
            this.args.putString(KEY_MESSAGE, mContext.getResources().getString(message));
            this.args.putString(KEY_SUBTEXT, mContext.getResources().getString(subtext));
            this.args.putString(KEY_CTATEXT, mContext.getResources().getString(ctatext));
        }

        public String getClassname() {
            return this.classname;
        }

        public String getTitle() {
            return this.title;
        }

        public Bundle getArgs() {
            return args;
        }
    }

    private static class SimplePanelConfigs {
        public static final FirstrunTorPanelConfig welcomeTorPanelConfig = new FirstrunTorPanelConfig(FirstrunPanel.class.getName(), R.string.firstrun_welcome_tab_title, R.drawable.figure_welcome, R.string.firstrun_welcome_title, R.string.firstrun_welcome_message, R.string.firstrun_welcome_next);
        public static final FirstrunTorPanelConfig privacyPanelConfig = new FirstrunTorPanelConfig(FirstrunPanel.class.getName(), R.string.firstrun_privacy_tab_title, R.drawable.figure_privacy, R.string.firstrun_privacy_title, R.string.firstrun_privacy_message, R.string.firstrun_privacy_next);
        public static final FirstrunTorPanelConfig torNetworkPanelConfig = new FirstrunTorPanelConfig(FirstrunPanel.class.getName(), R.string.firstrun_tornetwork_tab_title, R.drawable.figure_network, R.string.firstrun_tornetwork_title, R.string.firstrun_tornetwork_message, R.string.firstrun_tornetwork_next);
        public static final FirstrunTorPanelConfig secSettingsPanelConfig = new FirstrunTorPanelConfig(FirstrunPanel.class.getName(), R.string.firstrun_secsettings_tab_title, R.drawable.figure_security, R.string.firstrun_secsettings_title, R.string.firstrun_secsettings_message, R.string.firstrun_secsettings_next);
        public static final FirstrunTorPanelConfig tipsPanelConfig = new FirstrunTorPanelConfig(FirstrunPanel.class.getName(), R.string.firstrun_tips_tab_title, R.drawable.figure_experience, R.string.firstrun_tips_title, R.string.firstrun_tips_message, R.string.firstrun_tips_next);
        public static final FirstrunTorPanelConfig onionServicesPanelConfig = new FirstrunTorPanelConfig(LastPanel.class.getName(), R.string.firstrun_onionservices_tab_title, R.drawable.figure_onion, R.string.firstrun_onionservices_title, R.string.firstrun_onionservices_message, R.string.firstrun_onionservices_next);
    }
}
