import { createBinding, This } from "ags";
import { getter, register, setter } from "ags/gobject";
import { Gtk } from "ags/gtk4";
import AstalMpris from "gi://AstalMpris?version=0.1";
import { cursorPointer } from "../util";

interface MusicControlsProps extends Partial<Gtk.Box> {
  player: AstalMpris.Player,
  size?: number,
  showShuffle?: boolean,
  showLoop?: boolean
}

@register({ Implements: [Gtk.Buildable], CssName: "MusicControls" })
export class MusicControls extends Gtk.Box {
  playerObj!: AstalMpris.Player;
  size: number;
  showShuffle: boolean;
  showLoop: boolean;

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
    delete parent_props.showShuffle;
    delete parent_props.showLoop;
    super(parent_props);

    this.playerObj = props.player;
    this.size = props.size || 24;
    this.showShuffle = props.showShuffle || false;
    this.showLoop = props.showLoop || false;

    void (
      <This this={this as MusicControls}>
        <button onClicked={()=>this.playerObj.shuffle()} valign={Gtk.Align.CENTER} cursor={cursorPointer}
          visible={this.showShuffle}
          sensitive={createBinding(this.playerObj, "shuffleStatus").as(v => v != AstalMpris.Shuffle.UNSUPPORTED)}
          class={createBinding(this.playerObj, "shuffleStatus").as(v => v == AstalMpris.Shuffle.ON ? "activated" : "")}
          >
          <image
            tooltipText="Shuffle"
            pixelSize={this.size}
            iconName="media-playlist-shuffle-symbolic"
          />
        </button>

        <button 
          sensitive={createBinding(this.playerObj, "canGoPrevious")}
          onClicked={()=>this.playerObj.previous()} valign={Gtk.Align.CENTER} cursor={cursorPointer}>
          <image
            tooltipText="Previous"
            pixelSize={this.size}
            iconName="media-skip-backward-symbolic"
          />
        </button>
        <button 
          sensitive={createBinding(this.playerObj, "canPlay")}
          onClicked={()=>this.playerObj.play_pause()} valign={Gtk.Align.CENTER} cursor={cursorPointer}>
          <image
            tooltipText="Toggle play"
            pixelSize={this.size}
            iconName={createBinding(this.playerObj, "playbackStatus").as(status => 
              status != AstalMpris.PlaybackStatus.PLAYING ? "media-playback-start-symbolic" : "media-playback-pause-symbolic"
            )}
          />
        </button>
        <button 
          sensitive={createBinding(this.playerObj, "canGoNext")}
          onClicked={()=>this.playerObj.next()} valign={Gtk.Align.CENTER} cursor={cursorPointer}>
          <image
            tooltipText="Next"
            pixelSize={this.size}
            iconName="media-skip-forward-symbolic"
          />
        </button>

        <button onClicked={()=>this.playerObj.loop()} valign={Gtk.Align.CENTER} cursor={cursorPointer}
          sensitive={createBinding(this.playerObj, "loopStatus").as(v => v != AstalMpris.Loop.UNSUPPORTED)}
          visible={this.showLoop}
          class={createBinding(this.playerObj, "loopStatus").as(v => 
            [AstalMpris.Loop.TRACK, AstalMpris.Loop.PLAYLIST].includes(v) ? "activated" : ""
          )}>
          <image
            tooltipText="Loop"
            pixelSize={this.size}
            iconName={createBinding(this.playerObj, "loopStatus").as(v => v == AstalMpris.Loop.TRACK ?
              "media-playlist-repeat-song-symbolic" : "media-playlist-repeat-symbolic"
            )}
          />
        </button>
      </This>
    )
  }
}
