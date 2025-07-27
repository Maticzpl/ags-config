import { Accessor, createBinding, createState, For, Setter, State, This } from "ags";
import { ParamSpec, register } from "ags/gobject";
import { Gdk, Gtk } from "ags/gtk4";
import Mpris from "gi://AstalMpris";
import { ScrolledLabel } from "./ScrollingText";
import { MusicControls } from "./MusicControls";

interface MediaPlayerProps extends Partial<Gtk.Box> {
}

const cursorPointer = Gdk.Cursor.new_from_name("pointer", null)
const mpris = Mpris.get_default();

const [skipLive, setSkipLive] = createState(false);

@register({ Implements: [Gtk.Buildable], CssName: "MediaPlayer" })
export class MediaPlayer extends Gtk.Box {
  static players: Accessor<Mpris.Player[]>;
  static player: Accessor<Mpris.Player | undefined>;
  static setPlayer: Setter<Mpris.Player | undefined>;

  checkPlayer(player: Mpris.Player, playing: Mpris.PlaybackStatus) {
    if (playing == Mpris.PlaybackStatus.PLAYING && 
        MediaPlayer.player.get()?.playback_status != Mpris.PlaybackStatus.PLAYING) {
      MediaPlayer.setPlayer(player);
    }

    if (MediaPlayer.player.get() === undefined) {
      MediaPlayer.setPlayer(player);
    }

    return "";
  }

  volumeScroll() {
    let controller = new Gtk.EventControllerScroll({
      name: "CoverVolumeScroll",
      flags: Gtk.EventControllerScrollFlags.VERTICAL // idk if necessary
    });

    controller.connect("scroll", (_src, _dx, dy) => {
      let player = MediaPlayer.player.get()
      if (!player)
        return;
      player.volume -= dy/50;
    });

    return controller;
  }

  playerScroll(callback: (player: Mpris.Player) => void) {
    let controller = new Gtk.EventControllerScroll({
      name: "CoverVolumeScroll",
      flags: Gtk.EventControllerScrollFlags.VERTICAL // idk if necessary
    });

    controller.connect("scroll", (_src, _dx, dy) => {
      const ps = MediaPlayer.players.get();
      const player = MediaPlayer.player.get();
      if (!player)
        return;

      let index = ps.indexOf(player) + dy;
      if (index < 0)
        index = ps.length + index;
      index %= ps.length;

      const chosen = ps[index];
      MediaPlayer.setPlayer(chosen);
      callback(chosen);
    });

    return controller;
  }

  secToTime(seconds: number) {
    let min = Math.floor(seconds / 60);
    let sec: any = Math.floor(seconds) % 60;
    if (sec <= 9)
      sec = `0${sec}`;
    return `${min}:${sec}`;
  }

  constructor (props: MediaPlayerProps) {
    super(props);

    const [advancedExpand, setAdvancedExpand] = createState(false);
    const [showBigPlayer, setShowBigPlayer] = createState("");


    void (
      <This this={this as MediaPlayer}>
        <For each={MediaPlayer.players}>
          {
            ((player) => {
              const coverCss = createBinding(player, "artUrl").as(url => {
                return `background-image: url('${url}');`
              });
              let timeBar: Gtk.Scale;

              // TODO: this with tooptipText is bullshit
              return <box tooltipText={createBinding(player, "playbackStatus").as(status => this.checkPlayer(player, status))} 
              visible={MediaPlayer.player.as(p => p != undefined && p == player)}>
              <menubutton class="Cover" 
                $={self => {self.add_controller(this.volumeScroll());}}
                cursor={cursorPointer}
                css={coverCss}
                valign={Gtk.Align.CENTER}>
                <label/>
                <popover class="BigPlayer"
                  visible={showBigPlayer.as(v => v == player.busName)}>
                  <box orientation={Gtk.Orientation.VERTICAL}>
                    <box
                      $={self => {
                        self.add_controller(
                          this.playerScroll(p => {
                            setShowBigPlayer(p.bus_name);
                          })
                        );
                      }}
                      class="BigCover"
                      tooltipText={createBinding(player, "title").as(title => { // not binding for checkbox cause dont want to skip mid song
                        if (title.toLowerCase().includes("live") && skipLive.get()) {
                          player.position = player.length;// - 0.1
                        }
                        return "";
                      })}
                      css={coverCss}/>
                    <box class="Progress">
                      <label label={createBinding(player, "position").as(this.secToTime)}/>
                      <Gtk.Scale hexpand
                        $={self => {timeBar = self; self.set_range(0,1)}}
                        tooltipText={createBinding(player, "position").as(pos => {
                          if (timeBar) {
                            timeBar.set_range(0, player.length);
                            timeBar.set_value(pos);
                          }
                          return "";
                        })}
                        onChangeValue={(self, _, __) => {
                          player.position = self.get_value();
                        }}
                      />
                      <label label={createBinding(player, "length").as(this.secToTime)}/>
                    </box>
                    <ScrolledLabel speed={1} class="BigTitle"
                      hexpand
                      align_text={Gtk.Align.CENTER}
                      visible={createBinding(player, "title").as(v => v != "")}
                      text={createBinding(player, "title")}
                      tooltipText={createBinding(player, "title")}/>
                    <ScrolledLabel speed={1} class="Artist"
                      hexpand
                      align_text={Gtk.Align.CENTER}
                      visible={createBinding(player, "artist").as(v => v != "")}
                      tooltipText={createBinding(player, "artist")}
                      text={createBinding(player, "artist")} />
                    <ScrolledLabel speed={1} class="Album"
                      hexpand
                      align_text={Gtk.Align.CENTER}
                      visible={createBinding(player, "album").as(v => v != "")}
                      tooltipText={createBinding(player, "album")}
                      text={createBinding(player, "album")} />
                    <MusicControls player={player} size={31} halign={Gtk.Align.CENTER} showLoop showShuffle/>

                    <button class={advancedExpand.as(expand => `Advanced ${expand ? "expanded" :""}`)}
                      onClicked={_ => {
                        setAdvancedExpand(!advancedExpand.get())
                      }}
                    >
                      <image iconName={advancedExpand.as(expand => 
                        expand ? "pan-up-symbolic" : "pan-down-symbolic"
                      )}/>
                    </button>
                    <Gtk.Revealer transitionType={Gtk.RevealerTransitionType.SLIDE_DOWN}
                      revealChild={advancedExpand}
                      class={advancedExpand.as(expand => `Advanced ${expand ? "expanded" :""}`)}
                    >
                      <box>
                        <Gtk.CheckButton
                          label="Skip live" 
                          active={skipLive}
                          onToggled={checkbox => {
                            setSkipLive(checkbox.active)
                          }}/>
                      </box>
                    </Gtk.Revealer>
                  </box>
                </popover>
              </menubutton>
              <MusicControls player={player}/>
              <ScrolledLabel speed={1} widthRequest={200} class="Title"
                text={createBinding(player, "title")}
                tooltipText={createBinding(player, "title")}/>
            </box>
            })
          }
        </For>
      </This>
    )
  }
}

MediaPlayer.players = createBinding(mpris, "players");

const playerState = createState(undefined) as State<Mpris.Player | undefined>;
MediaPlayer.player = playerState[0];
MediaPlayer.setPlayer = playerState[1];

