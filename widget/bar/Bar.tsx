import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createPoll } from "ags/time"
import { Accessor, createBinding, createComputed, For, With } from "ags"
import Hyprland from "gi://AstalHyprland"
import Apps from "gi://AstalApps"
import Tray from "gi://AstalTray"
import Network from "gi://AstalNetwork"
import Bluetooth from "gi://AstalBluetooth"
import { exec } from "ags/process"
import { MediaPlayer } from "../../components/MediaPlayer"
import { Bat } from "./Battery"
import { cursorPointer, stringLimit } from "../../util"

function Time() {
  const time = createPoll("", 1000, "date +'%Y-%m-%d %H:%M:%S'");

  return <menubutton class="Time" valign={Gtk.Align.CENTER} cursor={cursorPointer}>
    <label label={time} />
    <popover>
      <Gtk.Calendar />
    </popover>
  </menubutton>
}

// function WithAll<T>(props: { children: (val: T) => GObject.Object, value: Accessor<T> }) {
//   return <box>
//     <With value={props.value}>
//       { unwrapped => {
//         if (unwrapped instanceof Accessor) {
//           return <WithAll value={unwrapped}>
//             {props.children}
//           </WithAll>
//         }
//         else {
//           print(unwrapped) // executed too many times when switching workspaces
//           return unwrapped && props.children(unwrapped) 
//         }
//       }}
//     </With>
//   </box>
// }


function Title(props: { monitor_id: number }) {
  const hypr = Hyprland.get_default();
  const monitor = createBinding(hypr, "monitors").as(m => m[props.monitor_id])
  const ws = createBinding(monitor.get(), "activeWorkspace") // TODO: DONT USE .get

  // const title = monitor(
  // m => createBinding(m, "activeWorkspace")
  //   (ws => 
  //     createComputed(
  //       [createBinding(ws, "lastClient"), createBinding(hypr, "focusedClient")],
  //       (wsClient, focused) => {
  //         if (focused?.monitor.id == monitor.get().id)
  //           return focused;
  //         else
  //           return wsClient;
  //       }
  //     )
  //     (cl => createBinding(cl, "title"))
  //   )
  // )

  // return <WithAll value={title}>
  //   {t => <label label={stringLimit(50)(t)} />}
  // </WithAll>

  return <box class="windowTitle" >
    <With value={ws}>
      {ws => (
        <box><With value={createComputed(
            [createBinding(ws, "lastClient"), createBinding(hypr, "focusedClient")],
            (wsClient, focused) => {
              if (focused?.monitor?.id == monitor.get().id)
                return focused;
              else
                return wsClient;
            })}>
          {(cl: Hyprland.Client) => 
              cl && <label label={createBinding(cl, "title").as(stringLimit(50))} />
          }
        </With></box>
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
        <menubutton $={(self) => init(self, item)} cursor={cursorPointer}>
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
          cursor={cursorPointer}
          tooltipText={tooltip(net)}>
          <image iconName={createBinding(net, "iconName")} pixelSize={20} />
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
          cursor={cursorPointer}
          tooltipText={device ? createBinding(device, "name").as(String) : ""}>
          <image iconName="bluetooth-symbolic" pixelSize={20} />
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
            if (x < 0 || y < 0 || x >= COLS || y >= ROWS)
              continue;

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
          <MediaPlayer />
        </box>
        <box halign={Gtk.Align.CENTER} $type="center">
          <Title monitor_id={monitor_id} />
        </box>
        <box halign={Gtk.Align.END} $type="end">
          <box hexpand={true} />
          <Wifi />
          <BT />
          <Bat/>
          <Time />
        </box>
      </centerbox>
    </window>
  )
}
