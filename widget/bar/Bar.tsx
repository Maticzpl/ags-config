import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createPoll } from "ags/time"
import { Accessor, createBinding, createComputed, createState, For, With } from "ags"
import Hyprland from "gi://AstalHyprland"
import Mpris from "gi://AstalMpris"
import Apps from "gi://AstalApps"
import Tray from "gi://AstalTray"
import Network from "gi://AstalNetwork"
import Bluetooth from "gi://AstalBluetooth"
import { exec } from "ags/process"
import { ScrolledLabel } from "../../components/ScrollingText"


function stringLimit(limit: number) {
  return (title?: string) => {
    if (!title)
      return "";

    if (title.length > limit) {
      title = title.substring(0, limit - 3) + "...";
    }
    return title;
  }
}

function Time() {
  const time = createPoll("", 1000, "date +'%Y-%m-%d %H:%M:%S'");

  return <menubutton class="Time" valign={Gtk.Align.CENTER}>
    <label label={time} />
    <popover>
      <Gtk.Calendar />
    </popover>
  </menubutton>
}

function Title() {
  const hypr = Hyprland.get_default();
  const focused = createBinding(hypr, "focusedClient");

  return <box class="windowTitle" visible={focused.as(Boolean)}>
    <With value={focused}>
      {(focused => focused && 
        <label label={createBinding(focused, "title").as(stringLimit(50))} />
      )}
    </With>
  </box>
}

function Media() {
  const mpris = Mpris.get_default();

  const [previousPlayerId, setPreviousPlayerId] = createState(0);
  const player = createBinding(mpris, "players").as(players => {
    if (players.length <= previousPlayerId.get())
      setPreviousPlayerId(0);

    let player = players[previousPlayerId.get()];

    for (const p of players) {
      if (p.get_playback_status() == Mpris.PlaybackStatus.PLAYING)
        player = p;
    }

    setPreviousPlayerId(players.indexOf(player));

    return player;
  });

  // TODO: Big nice popover of cover art with stuff, big playter ui basically

  return <box class="Media" visible={player.as(Boolean)}>
    <With value={player}>
      {(player => player &&
        <box>
          <box class="Cover" 
            css={createBinding(player, "artUrl").as(url => `background-image: url('${url}');`)}
            valign={Gtk.Align.CENTER}/>
          <box class="Controls">
            <button onClicked={()=>player.previous()} valign={Gtk.Align.CENTER}>
              <image
                tooltipText="Previous"
                iconName="media-skip-backward-symbolic"
              />
            </button>
            <button onClicked={()=>player.play_pause()} valign={Gtk.Align.CENTER}>
              <image
                tooltipText="Next"
                iconName={ createBinding(player, "playback_status").as(status => 
                  status != Mpris.PlaybackStatus.PLAYING ?
                    "media-playback-start-symbolic" : "media-playback-pause-symbolic"
                )}
              />
            </button>
            <button onClicked={()=>player.next()} valign={Gtk.Align.CENTER}>
              <image
                tooltipText="Next"
                iconName="media-skip-forward-symbolic"
              />
            </button>
          </box>
          <ScrolledLabel speed={1} width={200} class="Title"
            text={createBinding(player, "title")}
            tooltipText={createBinding(player, "title")}/>
        </box>
      )}
    </With>
  </box>
}


function SysTray() {
  const tray = Tray.get_default()

  const init = (btn: Gtk.MenuButton, item: Tray.TrayItem) => {
    btn.menuModel = item.menuModel
    btn.insert_action_group("dbusmenu", item.actionGroup)
    item.connect("notify::action-group", () => {
      btn.insert_action_group("dbusmenu", item.actionGroup)
    })
  }

  return <box class="SysTray">
    <For each={createBinding(tray, "items")}>
      {(item: Tray.TrayItem, index: Accessor<number>) => (
        <menubutton $={(self) => init(self, item)}>
          <image 
            gicon={createBinding(item, "gicon")} 
            pixelSize={25}
          />
        </menubutton>
      )}
    </For>
  </box>
}

function Wifi() {
  const network = Network.get_default()

  const net = createBinding(network, "primary").as(_ => {
    return network.get_wired() || network.get_wifi();
  });

  function tooltip(net: Network.Wifi | Network.Wired | null): Accessor<string> | string {
    if (net instanceof Network.Wifi) {
      const ssid = createBinding(net, "ssid");
      const strength = createBinding(net, "strength");

      return createComputed([ssid, strength], (ssid, strength) => `${ssid}\n${strength}%`);
    }
    else if (net instanceof Network.Wired){
      return "Wired";
    }
    return "";
  }

  return <box class="Wifi" valign={Gtk.Align.CENTER}>
    <With value={net}>
      {(net: Network.Wifi | Network.Wired | null) => (net && 
        <button onClicked={() => {exec(["hyprctl", "dispatch", "exec", "nm-connection-editor"])}}
          tooltipText={tooltip(net)}>
          <image iconName={createBinding(net, "iconName")} />
        </button>
      )}
    </With>
  </box>
}

function BT() {
  const bt = Bluetooth.get_default();
  const devices = createBinding(bt, "devices");

  return <box class="Bluetooth" valign={Gtk.Align.CENTER}>
    <With value={devices.as(devs => devs.filter(d => d.connected)[0])}>
      {(device: Bluetooth.Device | null) => (
        <button onClicked={() => {exec(["hyprctl", "dispatch", "exec", "overskride"])}}
          tooltipText={device ? createBinding(device, "name").as(String) : ""}>
          <image iconName="bluetooth-symbolic" />
        </button>
      )}
    </With>
  </box>
}

interface WorkspaceProps {
  monitor_id: number
}
function Workspaces({ monitor_id } : WorkspaceProps) {
  const hypr = Hyprland.get_default()
  const apps = new Apps.Apps()
  const width = 2;
  const height = 1;
  const totalWidth = 6;
  const totalHeight = 6;

  const classReplace: { [key: string]: string } = {
    // firefox: "schizofox"
  };

  // TODO: Redo this priority system for icons including the other stupid logic
  const classPriority: { [key: string]: number }  = {
    Alacritty: -1
  };

  const important: { [key: string]: string } = {
    nvim: "Neovim",
    btop: "btop++"
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
  
  const monitor = hypr.get_monitor(monitor_id);

  return <box>
    <With value={createBinding(monitor, "activeWorkspace")}>
      {((active: Hyprland.Workspace) => {
        const root = workspaceCoords(active.get_id());

        let rows = []
        for (let ry = -height; ry<= height; ry++) {
          let cells = [];
          for (let rx = -width; rx <= width; rx++) {
            const x = root.x + rx
            const y = root.y + ry

            let id = workspaceId(monitor_id, x, y)

            let cssClasses = (rx == 0 && ry == 0) ? "center" : "cell"
            if (x >= 0 && y >= 0 && x < totalWidth && y < totalHeight)
                cssClasses += ` xp${x + 1} yp${y + 1}`
            else
                cssClasses += "oob"

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

                  if (appClass.includes(".")) {
                    const split = appClass.split(".")
                    appClass = split[split.length - 1]
                  }

                  const app = apps.fuzzy_query(appClass)[0] || apps.fuzzy_query(client.initialTitle)[0]
                  if (app)
                    cells.push(<image pixelSize={10} iconName={app.iconName} class={cssClasses}/>)
                  else
                    cells.push(<label label="?" class={cssClasses}/>)

                  continue
                }
              }
            }

            cells.push(<label label=" " class={cssClasses}/>)
          }
          rows.push(<box>{cells}</box>)
        }

        return <box class="Workspaces" orientation={Gtk.Orientation.VERTICAL}>{rows}</box>
      })}
    </With>
  </box>
}

export default function Bar(gdkmonitor: Gdk.Monitor, monitor_id: number) {
  const { TOP, LEFT, RIGHT } = Astal.WindowAnchor

  return (
    <window
      visible
      name="bar"
      class="Bar"
      gdkmonitor={gdkmonitor}
      exclusivity={Astal.Exclusivity.EXCLUSIVE}
      anchor={TOP | LEFT | RIGHT}
      application={app}
    >
      <centerbox cssName="centerbox">
        <box halign={Gtk.Align.START} $type="start">
          <Workspaces monitor_id={monitor_id} />
          <Media />
        </box>
        <box halign={Gtk.Align.CENTER} $type="center">
          <Title />
        </box>
        <box halign={Gtk.Align.END} $type="end">
          <box hexpand={true} />
          <Wifi />
          <BT />
          <Time />
        </box>
      </centerbox>
    </window>
  )
}
