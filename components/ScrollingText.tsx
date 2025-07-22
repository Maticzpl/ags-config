import { Accessor, This } from "ags";
import { getter, register, setter, signal } from "ags/gobject";
import { Gtk } from "ags/gtk4";
import { interval } from "ags/time";
import AstalIO from "gi://AstalIO?version=0.1";

interface ScrolledLabelProps extends Partial<Gtk.ScrolledWindow> {
  text: string,
  width: number,
  bounceCooldown?: number,
  speed?: number
}

@register({ Implements: [Gtk.Buildable] })
export class ScrolledLabel extends Gtk.ScrolledWindow {
  innerLabel!: Gtk.Label
  cooldown: number;

  constructor (props: ScrolledLabelProps) {
    super({
      widthRequest: props.width,
      hscrollbarPolicy: Gtk.PolicyType.EXTERNAL,
      vscrollbarPolicy: Gtk.PolicyType.NEVER,
    });

    this.cooldown = props.bounceCooldown || 120;
    this.speed = props.speed || 0.5;

    // this.hadjustment.value = (this.hadjustment.upper + this.hadjustment.lower)/2;
    void (
      <This this={this as ScrolledLabel}>
        <label
          $={(self) => {this.innerLabel = self}}
          label={props.text}
          halign={Gtk.Align.START}
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


