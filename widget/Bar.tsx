import { App, Astal, Gtk, Gdk } from "astal/gtk3"
import { timeout } from "astal/time"
import { Variable, bind, exec } from "astal"
import Hyprland from "gi://AstalHyprland"
import Battery from "gi://AstalBattery"
import Network from "gi://AstalNetwork"
import Bluetooth from "gi://AstalBluetooth"
import Tray from "gi://AstalTray"
import Mpris from "gi://AstalMpris"
import Apps from "gi://AstalApps"

function SysTray() {
    const tray = Tray.get_default()

    return <box className="SysTray">
        {bind(tray, "items").as(items => items.map(item => (
            <menubutton
                tooltipMarkup={bind(item, "tooltipMarkup")}
                usePopover={false}
                actionGroup={bind(item, "actionGroup").as(ag => ["dbusmenu", ag])}
                menuModel={bind(item, "menuModel")}>
                <icon gicon={bind(item, "gicon")} />
            </menubutton>
        )))}
    </box>
}

function Wifi() {
    const network = Network.get_default()
    const wifi = bind(network, "wifi")

    return <box visible={wifi.as(Boolean)} className="Wifi">
        {wifi.as(wifi => wifi && (
            <button onClicked={() => {exec(["hyprctl", "dispatch", "exec", "nm-connection-editor"])}}
                tooltipText={bind(wifi, "ssid").as(String)}>
                <icon
                    icon={bind(wifi, "iconName")}
                />
            </button>
        ))}
    </box>
}

function BT() {
    const bt = Bluetooth.get_default()
    const device = bind(bt, "devices").as(devs => devs.filter(d => d.connected)[0])

    return <box visible={device.as(Boolean)} className="Bluetooth">
        {device.as(dev => dev && (
            <button onClicked={() => {exec(["hyprctl", "dispatch", "exec", "overskride"])}}
                tooltipText={bind(dev, "name").as(String)}>
                <icon
                    icon="bluetooth-symbolic"
                />
            </button>
        ))}
    </box>
}

function Time() {
    const time = Variable("").poll(1000, 'date +"%Y-%m-%d %H:%M:%S"')
    return <label className="Time" label={time()} />
}

function Title() {
    const hypr = Hyprland.get_default()
    const focused = bind(hypr, "focusedClient")
    const titleLimit = 50;
    const title = focused.as(client => 
        client && bind(client, "title").as(title => {
            if (title.length > titleLimit) {
                title = title.substring(0, titleLimit - 3) + "..."
            }
            return title;
        })
    )

    return title.as(title => {
        if (title) { 
            return <box className="windowTitle">
                {title}
            </box>
        }
        return <label></label>
    })
}


let previousPlayerId = 0;
function Media() {
    const mpris = Mpris.get_default()
// - ${ps[0].artist}`
    //
// playerctl --player playerctld play-pause"
    //exec(["playerctl", "--player", "playerctld", "previous"])
// playerctl --player playerctld next"
    //exec(["playerctl", "--player", "playerctld", "play-pause"])
// playerctl --player playerctld previous"
    //exec(["playerctl", "--player", "playerctld", "next"])

    return bind(mpris, "players").as(ps => {
        if (ps.length <= previousPlayerId)
            previousPlayerId = 0;

        let player = ps[previousPlayerId]

        for (const p of ps) {
            if (p.get_playback_status() == Mpris.PlaybackStatus.PLAYING)
                player = p;
        }

        previousPlayerId = ps.indexOf(player)

        if (player) {
            return <box className="Media">
                <box
                    className="Cover"
                    valign={Gtk.Align.CENTER}
                    css={bind(player, "coverArt").as(cover =>
                        `background-image: url('${cover}');`
                    )}
                />
                <box className="Controls">
                    <button onClicked={()=>player.previous()}>
                        <icon
                            tooltipText="Previous"
                            icon="media-skip-backward-symbolic"
                        />
                    </button>
                    <button onClicked={()=>player.play_pause()}>
                        <icon
                            tooltipText="Next"
                            icon={
                                bind(player, "playbackStatus").as(status => status != Mpris.PlaybackStatus.PLAYING ?
                                    "media-playback-start-symbolic" : "media-playback-pause-symbolic"
                                )
                            }
                        />
                    </button>
                    <button onClicked={()=>player.next()}>
                        <icon
                            tooltipText="Next"
                            icon="media-skip-forward-symbolic"
                        />
                    </button>
                </box>
                <label
                    label={bind(player, "metadata").as(() =>
                        `${player.title}`
                    )}
                />
            </box>
        }
        else {
            return <label/>
        }
    })
}

function BatteryLevel() {
    const bat = Battery.get_default()

    let eta = Variable.derive(
        [
            bind(bat, "charging"),
            bind(bat, "timeToFull"),
            bind(bat, "timeToEmpty")
        ],
        (charging, fullEta, emptyEta) => {
            const time = charging ? fullEta : emptyEta;

            const hours = Math.floor(time / 3600);
            const minutes = Math.floor((time % 3600) / 60);

            let out = ""
            if (hours != 0)
                out += `${hours}h `
            // if (minutes != 0)
                out += `${minutes}m left`
            out += `\n${Math.abs(bat.energyRate)}W`

            return out;
        }
    )

    return <box className="Battery"
        halign={Gtk.Align.END}
        tooltipText={bind(eta)}
        visible={bind(bat, "isPresent")}>
        <icon icon={bind(bat, "batteryIconName")} />
        <label label={bind(bat, "percentage").as(p =>
            `${Math.floor(p * 100)}%`
        )} />
    </box>
}

function Workspaces() {
    const hypr = Hyprland.get_default()
    const apps = new Apps.Apps()
    const width = 2;
    const height = 1;

    const classReplace = {
        // firefox: "schizofox"
    };

    const classPriority = {
        Alacritty: -1
    };

    const important = {
        nvim: "Neovim"
    }

    const COLS = 6; // TODO: DONT HARDCODE!!!!!!!!!!!!!!!
    const ROWS = 6;
    function workspaceCoords(id: number) {
        id--;

        let monitor = Math.floor(id / (COLS * ROWS));
        id %= COLS*ROWS;
        let row = Math.floor(id / COLS);
        let column = id % COLS;
        
        return { x: column, y: row, monitor: monitor };
    }

    function workspaceId(monitor: number, x: number, y: number) {
        return (monitor * ROWS + y) * COLS + x + 1;
    }

    return <box className="Workspaces" vertical={true}>
        {bind(hypr, "focusedWorkspace").as(focused => {
            const monitor = focused.get_monitor().id;
            const root = workspaceCoords(focused.get_id());


            let rows = []
            for (let ry = -height; ry<= height; ry++) {
                let cells = [];
                for (let rx = -width; rx <= width; rx++) {
                    const x = root.x + rx
                    const y = root.y + ry

                    let id = workspaceId(monitor, x, y)

                    const center = (rx == 0 && ry == 0) ? "center" : ""

                    if (id) {
                        const workspace = hypr.get_workspace(id)
                        if (workspace) {
                            let clients = workspace.get_clients()
                            clients.sort((a, b) => {
                                let extraA = 0
                                let extraB = 0
                                for (let title in important) {
                                    extraA += a.title.includes(title) ? 1 : 0;
                                    extraB += b.title.includes(title) ? 1 : 0;
                                }

                                return (extraB + classPriority[b.initialClass] || 0) - (extraA + classPriority[a.initialClass] || 0)
                            })
                            const client = clients[0]

                            if (client) {
                                let appClass = classReplace[client.initialClass] || client.initialClass
                                if (appClass == "Alacritty") {
                                    for (let title in important) {
                                        if (client.title.includes(title))
                                            appClass = important[title]
                                    }
                                }

                                const app = apps.fuzzy_query(appClass)[0] || apps.fuzzy_query(client.initialTitle)[0]
                                if (app)
                                    cells.push(<icon icon={app.iconName} className={center}/>)
                                else
                                    cells.push(<label label="?" className={center}/>)

                                continue
                            }
                        }
                    }

                    cells.push(<label label=" " className={center}/>)
                }
                rows.push(<box>{cells}</box>)
            }

            return rows;
        })}
    </box>
}

export default function Bar(gdkmonitor: Gdk.Monitor) {
    const { TOP, LEFT, RIGHT } = Astal.WindowAnchor


    return <window
        className="Bar"
        gdkmonitor={gdkmonitor}
        exclusivity={Astal.Exclusivity.EXCLUSIVE}
        anchor={TOP | LEFT | RIGHT}
        application={App}>
        <centerbox>
            <box halign={Gtk.Align.START}>
                <Workspaces/>
                <Media/>
            </box>
            <box halign={Gtk.Align.CENTER}>
                <Title/>
            </box>
            <box halign={Gtk.Align.END}>
                <Wifi/>
                <BT/>
                <BatteryLevel/>
                <Time/>
            </box>
        </centerbox>
    </window>
}
