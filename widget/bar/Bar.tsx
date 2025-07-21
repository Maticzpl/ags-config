import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createPoll } from "ags/time"
import { createBinding, createState, With } from "ags"
import Hyprland from "gi://AstalHyprland"
import Mpris from "gi://AstalMpris"
import Apps from "gi://AstalApps"

function Time() {
  const time = createPoll("", 1000, "date +'%Y-%m-%d %H:%M:%S'");

  return <menubutton 
    $type="end"
    hexpand
    halign={Gtk.Align.END}
    class="Time">
    <label label={time} />
    <popover>
      <Gtk.Calendar />
    </popover>
  </menubutton>
}

function Title() {
  const hypr = Hyprland.get_default();
  const focused = createBinding(hypr, "focusedClient");

  function getTitle(client: Hyprland.Client) {
    if (!client)
      return "";

    const titleLimit = 50;
    let title = client?.title ?? "";
    if (title.length > titleLimit) {
      title = title.substring(0, titleLimit - 3) + "...";
    }
    return title;
  }

  return <box class="windowTitle" visible={focused.as(Boolean)}>
    <label label={focused.as(getTitle)} />
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


  return <box class="Media" visible={player.as(Boolean)}>
    <With value={player}>
      {(player => 
        <box>
          <box class="Cover">
            <image
              visible={createBinding(player, "coverArt").as(Boolean)}
              valign={Gtk.Align.CENTER}
              pixelSize={38}
              file={createBinding(player, "coverArt")}
            />
          </box>
          <box class="Controls">
            <button onClicked={()=>player.previous()}>
              <image
                tooltipText="Previous"
                iconName="media-skip-backward-symbolic"
              />
            </button>
            <button onClicked={()=>player.play_pause()}>
              <image
                tooltipText="Next"
                iconName={ createBinding(player, "playback_status").as(status => 
                  status != Mpris.PlaybackStatus.PLAYING ?
                    "media-playback-start-symbolic" : "media-playback-pause-symbolic"
                )}
              />
            </button>
            <button onClicked={()=>player.next()}>
              <image
                tooltipText="Next"
                iconName="media-skip-forward-symbolic"
              />
            </button>
          </box>
          <label label={createBinding(player, "title")} />
        </box>
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
  
  const monitor = hypr.get_monitor(monitor_id)

  // TODO: FOLLOW BASED ON MONITOR, NOT FOCUSED
  return <box>
    <With value={createBinding(monitor, "activeWorkspace")}>
      {((focused: Hyprland.Workspace) => {
          const monitor = focused.get_monitor().id;
          const root = workspaceCoords(focused.get_id());

          let rows = []
          for (let ry = -height; ry<= height; ry++) {
              let cells = [];
              for (let rx = -width; rx <= width; rx++) {
                  const x = root.x + rx
                  const y = root.y + ry

                  let id = workspaceId(monitor, x, y)

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
        <box $type="start">
          <Workspaces monitor_id={monitor_id} />
          <Media />
        </box>
        <box $type="center">
          <Title />
        </box>
        <box $type="end">
          <Time />
        </box>
      </centerbox>
    </window>
  )
}
