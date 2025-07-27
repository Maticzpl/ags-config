import { Accessor, createState, Setter, This } from "ags";
import { getter, register, setter } from "ags/gobject";
import { Gtk } from "ags/gtk4";
import { interval } from "ags/time";
import AstalIO from "gi://AstalIO?version=0.1";

interface ScrolledLabelProps extends Partial<Gtk.Overlay> {
  text: string,
  // width?: number,
  bounceCooldown?: number,
  speed?: number,
  align_text?: Gtk.Align
}

@register({ Implements: [Gtk.Buildable], CssName: "ScrolledLabel" })
export class ScrolledLabel extends Gtk.Overlay {
  innerLabel!: Gtk.Label
  window!: Gtk.ScrolledWindow;
  cooldown: number;
  overlay: Gtk.Widget;

  shadowSize: Accessor<string>; // cant do setters getters for nicer types bruh
  setShadowSize: Setter<string>;

  constructor (props: ScrolledLabelProps) {

    props = props;

    let parent_props = JSON.parse(JSON.stringify(props));
    delete parent_props.text;
    delete parent_props.bounceCooldown;
    delete parent_props.speed;
    delete parent_props.align_text;

    super(parent_props);

    this.cooldown = props.bounceCooldown || 120;
    this.speed = props.speed || 0.5;
    const [shadowSize, setShadowSize] = createState("10,10");
    this.shadowSize = shadowSize;
    this.setShadowSize = setShadowSize;

    void (
      <This this={this as ScrolledLabel}>
        <Gtk.ScrolledWindow
          $={self => this.window = self}
          hscrollbarPolicy={Gtk.PolicyType.EXTERNAL}
          vscrollbarPolicy={Gtk.PolicyType.NEVER}
        >
          <label 
            $={(self) => {this.innerLabel = self}}
            label={props.text}
            halign={props.align_text || Gtk.Align.START}
          />
        </Gtk.ScrolledWindow>
      </This>
    );

    const css = this.shadowSize.as(size => `
      --left-shadow: ${size.split(',')[0]}px;
      --right-shadow: ${size.split(',')[1]}px;
    `);

    this.overlay = <box css={css} class="Overlay"/> as Gtk.Widget;
    this.add_overlay(this.overlay);

    this.startAnimation();
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
      this.timer.cancel();

    this.timer = interval(1000/60, () => {
      const max = this.window.hadjustment.upper - this.get_width();

      const prev = this.window.hadjustment.value;
      const lShadow = Math.min(10, this.window.hadjustment.value);
      const rShadow = Math.min(10, max - this.window.hadjustment.value);
      
      this.setShadowSize(`${lShadow},${rShadow}`);

      this.window.hadjustment.value += this.speed;

      if (prev == this.window.hadjustment.value)
        this.cooldownCounter++;

      if (this.cooldownCounter > this.cooldown) {
        this.speed = -this.speed;
        this.cooldownCounter = 0;
      }
    });
  }
}


