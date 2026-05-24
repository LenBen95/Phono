import GObject from 'gi://GObject';
import St from 'gi://St';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const SAMPLE_RATES = ['44100', '48000', '88200', '96000', '176400', '192000'];
const BIT_DEPTHS = ['S16_LE', 'S24_LE', 'S32_LE'];
const BIT_DEPTH_LABELS = ['16-bit', '24-bit', '32-bit'];

function execCommand(argv) {
    return new Promise((resolve, reject) => {
        let proc = Gio.Subprocess.new(argv, Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
        proc.communicate_utf8_async(null, null, (proc, res) => {
            try {
                let [, stdout] = proc.communicate_utf8_finish(res);
                resolve(stdout.trim());
            } catch (e) {
                reject(e);
            }
        });
    });
}

async function getSinks() {
    try {
        let output = await execCommand(['pactl', 'list', 'sinks']);
        let sinks = [];
        let blocks = output.split('\n\n');

        for (let block of blocks) {
            if (!block.includes('alsa_output')) continue;

            let nameMatch = block.match(/Name:\s+(alsa_output\S+)/);
            let descMatch = block.match(/Description:\s+(.+)/);

            if (nameMatch && descMatch) {
                sinks.push({
                    name: nameMatch[1].trim(),
                    desc: descMatch[1].trim()
                });
            }
        }
        return sinks;
    } catch (e) {
        return [];
    }
}

async function writeWPConfig(nodeName, format, rate) {
    let confDir = GLib.get_home_dir() + '/.config/wireplumber/wireplumber.conf.d';
    let confFile = confDir + '/51-phono-format.conf';
    let content = `monitor.alsa.rules = [
  {
    matches = [
      {
        node.name = "${nodeName}"
      }
    ]
    actions = {
      update-props = {
        api.alsa.format = "${format}"
        audio.rate = ${rate}
      }
    }
  }
]
`;
    try {
        GLib.mkdir_with_parents(confDir, 0o755);
        let file = Gio.File.new_for_path(confFile);
        file.replace_contents(content, null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
        await execCommand(['systemctl', '--user', 'restart', 'wireplumber']);
    } catch (e) {
        log('Phono: Error writing config: ' + e);
    }
}

const PhonoIndicator = GObject.registerClass(
class PhonoIndicator extends PanelMenu.Button {
    _init(extension) {
        super._init(0.0, 'Phono');
        this._extension = extension;
        this._sinks = [];
        this._currentSinkIndex = 0;
        this._currentRateIndex = 1;
        this._currentDepthIndex = 2;
        this._deviceItems = [];

        let box = new St.BoxLayout({ style_class: 'panel-status-menu-box' });
        let icon = new St.Icon({
            icon_name: 'audio-card-symbolic',
            style_class: 'system-status-icon',
        });
        box.add_child(icon);
        this.add_child(box);

        let deviceHeader = new PopupMenu.PopupMenuItem('Output Device', { reactive: false });
        deviceHeader.label.style = 'font-weight: bold;';
        this.menu.addMenuItem(deviceHeader);

        this._deviceSection = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._deviceSection);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        let rateLabel = new PopupMenu.PopupMenuItem('Sample Rate', { reactive: false });
        rateLabel.label.style = 'font-weight: bold;';
        this.menu.addMenuItem(rateLabel);

        this._rateItems = [];
        for (let i = 0; i < SAMPLE_RATES.length; i++) {
            let item = new PopupMenu.PopupMenuItem(SAMPLE_RATES[i] + ' Hz');
            let idx = i;
            item.connect('activate', () => this._onRateSelected(idx));
            this.menu.addMenuItem(item);
            this._rateItems.push(item);
        }

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        let depthLabel = new PopupMenu.PopupMenuItem('Bit Depth', { reactive: false });
        depthLabel.label.style = 'font-weight: bold;';
        this.menu.addMenuItem(depthLabel);

        this._depthItems = [];
        for (let i = 0; i < BIT_DEPTH_LABELS.length; i++) {
            let item = new PopupMenu.PopupMenuItem(BIT_DEPTH_LABELS[i]);
            let idx = i;
            item.connect('activate', () => this._onDepthSelected(idx));
            this.menu.addMenuItem(item);
            this._depthItems.push(item);
        }

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._statusItem = new PopupMenu.PopupMenuItem('Ready', { reactive: false });
        this._statusItem.label.style = 'font-style: italic; color: #aaaaaa;';
        this.menu.addMenuItem(this._statusItem);

        this._refresh();
    }

    async _refresh() {
        this._sinks = await getSinks();
        this._deviceSection.removeAll();
        this._deviceItems = [];

        for (let i = 0; i < this._sinks.length; i++) {
            let sink = this._sinks[i];
            let item = new PopupMenu.PopupMenuItem(sink.desc);
            let idx = i;
            item.connect('activate', () => this._onDeviceSelected(idx));
            this._deviceSection.addMenuItem(item);
            this._deviceItems.push(item);
        }
        this._updateChecks();
    }

    _onDeviceSelected(idx) {
        this._currentSinkIndex = idx;
        this._updateChecks();
        this._applySettings();
    }

    _onRateSelected(idx) {
        this._currentRateIndex = idx;
        this._updateChecks();
        this._applySettings();
    }

    _onDepthSelected(idx) {
        this._currentDepthIndex = idx;
        this._updateChecks();
        this._applySettings();
    }

    _updateChecks() {
        for (let i = 0; i < this._deviceItems.length; i++) {
            this._deviceItems[i].setOrnament(i === this._currentSinkIndex ?
                PopupMenu.Ornament.CHECK : PopupMenu.Ornament.NONE);
        }
        for (let i = 0; i < this._rateItems.length; i++) {
            this._rateItems[i].setOrnament(i === this._currentRateIndex ?
                PopupMenu.Ornament.CHECK : PopupMenu.Ornament.NONE);
        }
        for (let i = 0; i < this._depthItems.length; i++) {
            this._depthItems[i].setOrnament(i === this._currentDepthIndex ?
                PopupMenu.Ornament.CHECK : PopupMenu.Ornament.NONE);
        }

    }

    async _applySettings() {
        let rate = SAMPLE_RATES[this._currentRateIndex];
        let fmt = BIT_DEPTHS[this._currentDepthIndex];
        let sink = this._sinks[this._currentSinkIndex];

        this._statusItem.label.set_text('Applying...');

        if (sink) {
            await writeWPConfig(sink.name, fmt, rate);
        }

        this._statusItem.label.set_text(
            `${rate} Hz · ${BIT_DEPTH_LABELS[this._currentDepthIndex]}`
        );
    }

    destroy() {
        super.destroy();
    }
});

export default class PhonoExtension extends Extension {
    enable() {
        this._indicator = new PhonoIndicator(this);
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    disable() {
        this._indicator.destroy();
        this._indicator = null;
    }
}
