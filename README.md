# Phono

A GNOME Shell extension for audiophiles on Linux. Control your audio output device sample rate and bit depth directly from the top bar, with per-device configuration powered by PipeWire and WirePlumber.

## Features

- Select output device from the top bar
- Switch sample rate (44100, 48000, 88200, 96000, 176400, 192000 Hz)
- Switch bit depth (16-bit, 24-bit, 32-bit)
- Per-device configuration saved via WirePlumber
- Live device detection — automatically updates when devices are connected or disconnected
- Clean native GNOME UI

## Requirements

- GNOME Shell 50+
- PipeWire
- WirePlumber
- Fedora 44+ (may work on other distributions with PipeWire/WirePlumber)

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/lenben/phono
   ```

2. Copy to your GNOME extensions folder:
   ```bash
   cp -r phono ~/.local/share/gnome-shell/extensions/phono@lenben
   ```

3. Enable the extension:
   ```bash
   gnome-extensions enable phono@lenben
   ```

4. Log out and back in.

## Usage

Click the audio card icon in the top bar to open the Phono menu. Select your output device, then choose your desired sample rate and bit depth. Changes are applied immediately and persist across reboots.

## Known Limitations

- Requires WirePlumber restart when changing settings which causes a brief audio interruption
- Only supports ALSA output devices (USB DACs, built-in audio)
- Network audio devices are filtered out

## License

Copyright (C) 2026 LenBen — GPL-2.0-or-later
