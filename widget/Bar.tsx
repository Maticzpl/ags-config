import { App, Astal, Gtk, Gdk } from "astal/gtk3"
import { timeout } from "astal/time"
import { Variable, bind, exec } from "astal"
import Hyprland from "gi://AstalHyprland"
import Battery from "gi://AstalBattery"
import Network from "gi://AstalNetwork"
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
            <button onClicked={() => {exec(["hyprctl", "dispatch", "exec", "alacritty -T 'Network Manager' -e nmtui"])}}
                tooltipText={bind(wifi, "ssid").as(String)}>
                <icon
                    icon={bind(wifi, "iconName")}
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
        if (ps[0]) {
            return <box className="Media">
                <box
                    className="Cover"
                    valign={Gtk.Align.CENTER}
                    css={bind(ps[0], "coverArt").as(cover =>
                        `background-image: url('${cover}');`
                    )}
                />
                <box className="Controls">
                    <button onClicked={()=>ps[0].previous()}>
                        <icon
                            tooltipText="Previous"
                            icon="media-skip-backward-symbolic"
                        />
                    </button>
                    <button onClicked={()=>ps[0].play_pause()}>
                        <icon
                            tooltipText="Next"
                            icon={
                                bind(ps[0], "playbackStatus").as(status => status != Mpris.PlaybackStatus.PLAYING ?
                                    "media-playback-start-symbolic" : "media-playback-pause-symbolic"
                                )
                            }
                        />
                    </button>
                    <button onClicked={()=>ps[0].next()}>
                        <icon
                            tooltipText="Next"
                            icon="media-skip-forward-symbolic"
                        />
                    </button>
                </box>
                <label
                    label={bind(ps[0], "metadata").as(() =>
                        `${ps[0].title}`
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

let cachedCoords: any = null;
let isCooldown = false;
let pendingCall = false;

function workspaceCoords(): any {
    if (!isCooldown) {
        cachedCoords = JSON.parse(exec("hyprctl -j hyprtasking workspaces"));
        isCooldown = true;

        timeout(500, () => {
            isCooldown = false;
            if (pendingCall) {
                pendingCall = false;
                workspaceCoords();
            }
        });

        return cachedCoords;
    } else {
        pendingCall = true;
        return cachedCoords;
    }
}

function Workspaces() {
    const hypr = Hyprland.get_default()
    const apps = new Apps.Apps()
    const width = 2;
    const height = 1;

    const classReplace = {
        firefox: "schizofox"
    };

    const classPriority = {
        Alacritty: -1
    };

    const important = {
        nvim: "Neovim"
    }

    return <box className="Workspaces" vertical={true}>
        {bind(hypr, "focusedWorkspace").as(focused => {
            const monitor = focused.get_monitor().id
            const coords = workspaceCoords()[monitor]
            const root = coords[focused.get_id()]

            let rows = []
            for (let ry = -height; ry <= height; ry++) {
                let cells = [];
                for (let rx = -width; rx <= width; rx++) {
                    const x = root.x + rx
                    const y = root.y + ry

                    let id = undefined
                    for (let workspaceId in coords) {
                        if (coords[workspaceId].x == x && coords[workspaceId].y == y)
                            id = workspaceId
                    }

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
                <BatteryLevel/>
                <Time/>
            </box>
        </centerbox>
    </window>
}
