import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

const BUS_NAME = 'org.corenode.PycoreWindowBridge';
const OBJECT_PATH = '/org/corenode/PycoreWindowBridge';
const BRIDGE_VERSION = 2;
const ACTIVATE_POLL_MS = 20;
const ACTIVATE_TIMEOUT_MS = 500;
const X11_DESCRIPTION_PATTERN = /^(0x[0-9a-fA-F]+)/;
const BRIDGE_INTERFACE = `
<node>
  <interface name="org.corenode.PycoreWindowBridge">
    <method name="GetVersion">
      <arg type="u" direction="out" name="version"/>
    </method>
    <method name="ListWindows">
      <arg type="s" direction="out" name="windows_json"/>
    </method>
    <method name="Activate">
      <arg type="t" direction="in" name="window_id"/>
      <arg type="b" direction="out" name="success"/>
    </method>
    <method name="PointerClick">
      <arg type="d" direction="in" name="x"/>
      <arg type="d" direction="in" name="y"/>
      <arg type="u" direction="in" name="button"/>
      <arg type="b" direction="out" name="success"/>
    </method>
    <method name="Scroll">
      <arg type="d" direction="in" name="x"/>
      <arg type="d" direction="in" name="y"/>
      <arg type="i" direction="in" name="steps"/>
      <arg type="b" direction="out" name="success"/>
    </method>
    <method name="KeyCombo">
      <arg type="as" direction="in" name="keysyms"/>
      <arg type="b" direction="out" name="success"/>
    </method>
    <method name="CaptureWindow">
      <arg type="t" direction="in" name="window_id"/>
      <arg type="ay" direction="out" name="png"/>
    </method>
  </interface>
</node>`;

function nowMicroseconds() {
    return GLib.get_monotonic_time();
}

function findWindow(windowId) {
    return global.display
        .list_all_windows()
        .find(window => String(window.get_id()) === String(windowId)) ?? null;
}

function describeWindow(window, focusWindow) {
    const frame = window.get_frame_rect();
    const isX11 = window.get_client_type() === Meta.WindowClientType.X11;
    const match = isX11 ? X11_DESCRIPTION_PATTERN.exec(window.get_description() ?? '') : null;
    return {
        id: String(window.get_id()),
        xid: match ? match[1].toLowerCase() : '',
        client_type: isX11 ? 'x11' : 'wayland',
        title: window.get_title() ?? '',
        wm_class: window.get_wm_class() ?? '',
        wm_class_instance: window.get_wm_class_instance() ?? '',
        sandboxed_app_id: window.get_sandboxed_app_id() ?? '',
        pid: window.get_pid(),
        workspace: window.get_workspace()?.index() ?? -1,
        minimized: window.minimized,
        focused: window === focusWindow,
        rect: {x: frame.x, y: frame.y, width: frame.width, height: frame.height},
    };
}

class PycoreWindowBridge {
    constructor() {
        const seat = Clutter.get_default_backend().get_default_seat();
        this._pointer = seat.create_virtual_device(Clutter.InputDeviceType.POINTER_DEVICE);
        this._keyboard = seat.create_virtual_device(Clutter.InputDeviceType.KEYBOARD_DEVICE);
        this._keyboardReady = false;
        this._dbus = Gio.DBusExportedObject.wrapJSObject(BRIDGE_INTERFACE, this);
        this._dbus.export(Gio.DBus.session, OBJECT_PATH);
        this._nameId = Gio.bus_own_name_on_connection(
            Gio.DBus.session,
            BUS_NAME,
            Gio.BusNameOwnerFlags.REPLACE,
            null,
            null);
    }

    destroy() {
        Gio.bus_unown_name(this._nameId);
        this._dbus.unexport();
        this._pointer.run_dispose();
        this._keyboard.run_dispose();
    }

    GetVersion() {
        return BRIDGE_VERSION;
    }

    ListWindows() {
        const focusWindow = global.display.get_focus_window();
        const windows = global.display
            .list_all_windows()
            .filter(window => window.get_window_type() === Meta.WindowType.NORMAL)
            .map(window => describeWindow(window, focusWindow));
        return JSON.stringify(windows);
    }

    ActivateAsync([windowId], invocation) {
        const window = findWindow(windowId);
        if (!window) {
            invocation.return_value(new GLib.Variant('(b)', [false]));
            return;
        }
        Main.activateWindow(window);
        const deadline = GLib.get_monotonic_time() + ACTIVATE_TIMEOUT_MS * 1000;
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, ACTIVATE_POLL_MS, () => {
            const focused = global.display.get_focus_window() === window;
            if (!focused && GLib.get_monotonic_time() < deadline)
                return GLib.SOURCE_CONTINUE;
            invocation.return_value(new GLib.Variant('(b)', [focused]));
            return GLib.SOURCE_REMOVE;
        });
    }

    PointerClick(x, y, button) {
        this._pointer.notify_absolute_motion(nowMicroseconds(), x, y);
        this._pointer.notify_button(nowMicroseconds(), button, Clutter.ButtonState.PRESSED);
        this._pointer.notify_button(nowMicroseconds(), button, Clutter.ButtonState.RELEASED);
        return true;
    }

    Scroll(x, y, steps) {
        const direction = steps > 0 ? Clutter.ScrollDirection.UP : Clutter.ScrollDirection.DOWN;
        this._pointer.notify_absolute_motion(nowMicroseconds(), x, y);
        for (let index = 0; index < Math.abs(steps); index++)
            this._pointer.notify_discrete_scroll(nowMicroseconds(), direction, Clutter.ScrollSource.WHEEL);
        return true;
    }

    KeyCombo(keysyms) {
        const keyvals = keysyms.map(name => Clutter[`KEY_${name}`]);
        if (keyvals.some(keyval => keyval === undefined))
            return false;
        if (!this._keyboardReady) {
            this._keyboard.notify_keyval(nowMicroseconds(), Clutter.KEY_Shift_L, Clutter.KeyState.PRESSED);
            this._keyboard.notify_keyval(nowMicroseconds(), Clutter.KEY_Shift_L, Clutter.KeyState.RELEASED);
            this._keyboardReady = true;
        }
        for (const keyval of keyvals)
            this._keyboard.notify_keyval(nowMicroseconds(), keyval, Clutter.KeyState.PRESSED);
        for (const keyval of [...keyvals].reverse())
            this._keyboard.notify_keyval(nowMicroseconds(), keyval, Clutter.KeyState.RELEASED);
        return true;
    }

    CaptureWindowAsync([windowId], invocation) {
        const window = findWindow(windowId);
        const actor = window?.get_compositor_private();
        if (!actor) {
            invocation.return_dbus_error(`${BUS_NAME}.Error.WindowNotFound`, String(windowId));
            return;
        }
        const frame = window.get_frame_rect();
        const buffer = window.get_buffer_rect();
        const content = actor.paint_to_content(null);
        const texture = content?.get_texture();
        if (!texture) {
            invocation.return_dbus_error(`${BUS_NAME}.Error.CaptureFailed`, String(windowId));
            return;
        }
        const scale = texture.get_width() / Math.max(1, buffer.width);
        const stream = Gio.MemoryOutputStream.new_resizable();
        Shell.Screenshot.composite_to_stream(
            texture,
            Math.round((frame.x - buffer.x) * scale),
            Math.round((frame.y - buffer.y) * scale),
            Math.round(frame.width * scale),
            Math.round(frame.height * scale),
            1,
            null,
            0,
            0,
            1,
            stream).then(() => {
            stream.close(null);
            const bytes = stream.steal_as_bytes();
            invocation.return_value(new GLib.Variant('(ay)', [bytes.toArray()]));
        }).catch(error => {
            invocation.return_dbus_error(`${BUS_NAME}.Error.CaptureFailed`, String(error));
        });
    }
}

export default class PycoreWindowBridgeExtension extends Extension {
    enable() {
        this._bridge = new PycoreWindowBridge();
    }

    disable() {
        this._bridge?.destroy();
        this._bridge = null;
    }
}
