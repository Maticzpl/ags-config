import { Accessor, This } from "ags";
import { getter, register, setter } from "ags/gobject";
import { Gtk } from "ags/gtk4";
import { interval } from "ags/time";
import AstalIO from "gi://AstalIO?version=0.1";

interface ScrolledLabelProps extends Partial<Gtk.ScrolledWindow> {
  text: string,
  // width?: number,
  bounceCooldown?: number,
  speed?: number,
  align_text?: Gtk.Align
}

@register({ Implements: [Gtk.Buildable], CssName: "ScrolledLabel" })
export class ScrolledLabel extends Gtk.ScrolledWindow {
  innerLabel!: Gtk.Label
  cooldown: number;

  constructor (props: ScrolledLabelProps) {

    props = props;
    props.hscrollbarPolicy ||= Gtk.PolicyType.EXTERNAL;
    props.vscrollbarPolicy ||= Gtk.PolicyType.NEVER;

    // if (props.width)
    //   parent_props.width_request = props.width;
    let parent_props = JSON.parse(JSON.stringify(props));
    delete parent_props.text;
    delete parent_props.bounceCooldown;
    delete parent_props.speed;
    delete parent_props.align_text;

    super(parent_props);

    this.cooldown = props.bounceCooldown || 120;
    this.speed = props.speed || 0.5;

    void (
      <This this={this as ScrolledLabel}>
        <label 
          $={(self) => {this.innerLabel = self}}
          label={props.text}
          halign={props.align_text || Gtk.Align.START}
        />
      </This>
    );

    this.startAnimation()
  }

  @setter(String)
  set text(text: string) {
    this.innerLabel.label = text;
    this.startAnimation()
  }

  @getter(String)
  get text() {
    return this.innerLabel.label;
  }

  timer?: AstalIO.Time
  speed: number;
  cooldownCounter: number = 0;
  startAnimation() {
    if (this.timer)
      this.timer.cancel()

    this.timer = interval(1000/60, () => {
      const prev = this.hadjustment.value;
      this.hadjustment.value += this.speed;

      if (prev == this.hadjustment.value)
        this.cooldownCounter++;

      if (this.cooldownCounter > this.cooldown) {
        this.speed = -this.speed;
        this.cooldownCounter = 0;
      }
    });
  }
}


