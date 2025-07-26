import { createBinding, This } from "ags";
import { getter, register, setter } from "ags/gobject";
import { Gdk, Gtk } from "ags/gtk4";
import AstalMpris from "gi://AstalMpris?version=0.1";

interface MusicControlsProps extends Partial<Gtk.Box> {
  player: AstalMpris.Player,
  size?: number
}

let cursorPointer = Gdk.Cursor.new_from_name("pointer", null)

@register({ Implements: [Gtk.Buildable], CssName: "MusicControls" })
export class MusicControls extends Gtk.Box {
  playerObj!: AstalMpris.Player;
  size: number;

  @setter(AstalMpris.Player)
  set player(player: AstalMpris.Player) {
    this.playerObj = player;
  }

  @getter(AstalMpris.Player)
  get player() {
    return this.playerObj;
  }

  constructor (props: MusicControlsProps) {
    let parent_props = JSON.parse(JSON.stringify(props));
    delete parent_props.player;
    delete parent_props.size;
    super(parent_props);

    this.playerObj = props.player;
    this.size = props.size || 24;

    void (
      <This this={this as MusicControls}>
        <button onClicked={()=>this.playerObj.previous()} valign={Gtk.Align.CENTER} cursor={cursorPointer}>
          <image
            tooltipText="Previous"
            pixelSize={this.size}
            iconName="media-skip-backward-symbolic"
          />
        </button>
        <button onClicked={()=>this.playerObj.play_pause()} valign={Gtk.Align.CENTER} cursor={cursorPointer}>
          <image
            tooltipText="Toggle play"
            pixelSize={this.size}
            iconName={createBinding(this.playerObj, "playbackStatus").as(status => 
              status != AstalMpris.PlaybackStatus.PLAYING ? "media-playback-start-symbolic" : "media-playback-pause-symbolic"
            )}
          />
        </button>
        <button onClicked={()=>this.playerObj.next()} valign={Gtk.Align.CENTER} cursor={cursorPointer}>
          <image
            tooltipText="Next"
            pixelSize={this.size}
            iconName="media-skip-forward-symbolic"
          />
        </button>
      </This>
    )
  }
}
