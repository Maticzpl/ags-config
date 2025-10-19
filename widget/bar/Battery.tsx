import { Gdk, Gtk } from "ags/gtk4"
import { Accessor, createBinding, createComputed, createState, For } from "ags"
import Battery from "gi://AstalBattery"
import { readFile } from "ags/file"
import { exec, execAsync } from "ags/process";
import { timeout } from "ags/time";
import { cursorPointer } from "../../util";

let [getProcDataStatus, setProcDataStatus] = createState("");
let [getProcDataLocked, setProcDataLocked] = createState(false);
let [getProcData, setProcData] = createState([] as { pid: string, cmd: string, cmdShort: string, cpu: number }[])
function updateProcData() {
  setProcDataStatus(`Loading data...`);
  execAsync(`bash -c "atop -r ~/.local/share/batlogs/atop.log -J PRC | jq '
    reduce inputs.PRC[]? as $proc (
      {}; 
      .[($proc.pid|tostring)] += {
        cpu: ((.[$proc.pid|tostring].cpu // 0) + (($proc.utime + $proc.stime) // 0)),
        cmd: $proc.cmd
      }
    )
    | to_entries
    | map({
        pid: .key,
        cpu: (.value.cpu / 100),   # convert ticks to seconds
        cmd: .value.cmd
      })
    | map(select(.cpu >= 0.01))
    | sort_by(-.cpu)
  '"`)
  .catch(err => {
    printerr(err);
    setProcDataLocked(false);
    setProcDataStatus(`Error: ${err}`);
  })
  .then(rawJson => {
    if (!rawJson)
      return;

    let procData: { pid: string, cmd: string, cmdShort: string, cpu: number }[] = []
    for (const { pid, cpu, cmd } of JSON.parse(rawJson)) {
      if (procData.length >= 20)
        break;

      let cmdline = "[couldn't access cmdline]";
      try {
        cmdline = exec(`bash -c "tr '\\0' ' ' < /proc/${pid}/cmdline"`).trim() || '[cmdline not found]';
      } catch (err) {
        // do nothing lol
      }

      procData.push({ pid: pid, cmd: cmdline, cpu: Number(cpu), cmdShort: cmd });
    }
    setProcData(procData);
    setProcDataLocked(false);
    setProcDataStatus("");
  })
}

function procDataMeasure() {
  if (getProcDataLocked.get()) {
    printerr("Tried proc data measure with lock");
    return;
  }

  setProcDataLocked(true);
  setProcDataStatus(`Running 60s measurement...`);

  exec(`bash -c "rm ~/.local/share/batlogs/atop.log"`);
  execAsync(`bash -c "atop -w ~/.local/share/batlogs/atop.log 5 12"`)
  .catch(err => {
    printerr(err);
    setProcDataLocked(false);
    setProcDataStatus(`Error: ${err}`);
  })
  .then(() => updateProcData());
}


export function Bat() {
  updateProcData()
  const battery = Battery.get_default();

  const icon = createBinding(battery, "batteryIconName");
  const percentage = createBinding(battery, "percentage").as(p => `${Math.floor(p * 100)}%`);
  const power = createBinding(battery, "energyRate");
  const timeFull = createBinding(battery, "timeToFull");
  const timeEmpty = createBinding(battery, "timeToEmpty");
  const charging = createBinding(battery, "charging");

  const tooltip = createComputed(
    [percentage, power, timeFull, timeEmpty, charging],
    (perc, pow, timeF, timeE, charge) => {
      if (!charge)
        pow *= -1;

      let seconds: any = charge ? timeF : timeE;
      let minutes: any = Math.floor(seconds / 60);
      seconds %= 60;
      const hours: any = Math.floor(minutes / 60);
      minutes %= 60;

      if (seconds > 0 && seconds < 10)
        seconds = "0" + seconds;
      if (minutes > 0 && minutes < 10)
        minutes = "0" + minutes;

      let timeStr = `${seconds}s`;
      if (minutes != 0)
        timeStr = `${minutes}m` + timeStr;
      if (hours != 0)
        timeStr = `${hours}h` + timeStr;

      return `${perc}\n${pow}W\n${timeStr}`;
    }
  )

  function parseData(yesterday: string[], today: string[]) {
    let points = [];

    const lists = [yesterday, today]
    for (let lines of lists) {
      const day = lists.indexOf(lines)
      for (let line of lines) {
        const [time, value] = line.split(", ");
        const valueInt = parseInt(value);
        const h = parseInt(time.substring(0,2));
        const m = parseInt(time.substring(2,4));
        const s = parseInt(time.substring(4,6));
        const timeSec = s + ((m + ((h + (day * 24)) * 60)) * 60);

        if (!Number.isNaN(valueInt))
          points.push({ seconds: timeSec, value: valueInt });
      }
    }

    return points;
  }

  function pointPos(p: any, w: number, h: number, start: number, end: number) {
    const range = end - start;

    const x = ((p.seconds - start) / range) * w;
    const y = h - ((p.value / 100) * h);

    return [x, y];
  }

  let canvas: Gtk.DrawingArea | undefined;
  let graphStart = -9999999999;
  let graphEnd =    9999999999;

  const zoomScrollController = new Gtk.EventControllerScroll({
    name: "BatteryGraphScrollController",
    flags: Gtk.EventControllerScrollFlags.BOTH_AXES
  });
  zoomScrollController.connect("scroll", (_src, dx, dy) => {
    graphStart -= dx * 60 * 2;
    graphEnd -= dx * 60 * 2;


    const center = (graphStart + graphEnd) / 2;
    graphStart = center - Math.min(12*60*60, (center - graphStart) + dy * 60)
    graphEnd   = center + Math.min(12*60*60, (graphEnd - center  ) + dy * 60)

    if (canvas)
      canvas.queue_draw()
  });

  let canRefresh = true;

  const hourOffsetController = new Gtk.EventControllerKey({
    name: "BatteryGraphHourOffsetController"
  });
  hourOffsetController.connect("key-pressed", (src, keyVal, _keyCode, _mod) => {
    switch (keyVal) {
      case Gdk.KEY_F5:
        exec("systemctl --user start battery-logger");
        canRefresh = true;
        tryRefreshData();
        if (canvas)
          canvas.queue_draw();
        break;
    }

    if (canvas)
      canvas.queue_draw();
  });

  let points: {seconds: number, value: number}[] = [];
  function tryRefreshData() {
    if (canRefresh) {
      const date = exec("date +'%Y%m%d'");
      const dateYesterday = exec("date -d 'yesterday' +'%Y%m%d'");
      const logPath = "/home/maticzpl/.local/share/batlogs";
      const dataYesterday = readFile(`${logPath}/${dateYesterday}.csv`).split("\n");
      const dataToday = readFile(`${logPath}/${date}.csv`).split("\n");
      points = parseData(dataYesterday, dataToday);

      let secondsLeft = charging.get() ? timeFull.get() : timeEmpty.get();
      let finishS: any = points[points.length-1].seconds + secondsLeft
      points.push({ seconds: finishS, value: charging.get() ? 100 : 0 })

      canRefresh = false;
      timeout(60000, () => {canRefresh = true;});
    }
  }

  // 37.5W - 38.1W 8:56

  const graph: Gtk.DrawingAreaDrawFunc = (canvas, cr, w, h) => {
    tryRefreshData()

    const step = h / 10;
    for (let y = step; y < h; y += step) {
      cr.moveTo(0, y)
      cr.lineTo(w, y)
      cr.setSourceRGBA(1, 1, 1, 0.1)
      cr.stroke()
      cr.moveTo(3, y - 3)
      cr.setSourceRGBA(1, 1, 1, 0.3)
      cr.showText(`${(h - y) / h * 100}%`)
    }

    let end = points[points.length - 1].seconds
    let start = points[0].seconds
    graphEnd = Math.min(graphEnd, end)
    graphStart = Math.max(graphStart, graphEnd - 24*60*60)
    graphStart = Math.max(graphStart, start)
    if (graphEnd <= graphStart)
      graphEnd = graphStart + 60
    start = graphStart
    end = graphEnd

    for (let hour = 0; hour <= 23 * 3; hour++) {
      const sec = hour * 60 * 60
      const x = (sec - start) / (end - start) * w;

      cr.moveTo(x, 0)
      cr.lineTo(x, h)
      cr.setSourceRGBA(1, 1, 1, 0.1)
      cr.stroke()

      cr.moveTo(x + 2, h - 3)
      cr.setSourceRGBA(1, 1, 1, 0.3)
      let displayHour = hour % 24;
      if (displayHour == 0)
        displayHour = 24
      cr.showText(`${displayHour}`)
    }

    const p = points[0]
    const [x, y] = pointPos(p, w, h, start, end)
    cr.moveTo(x, y)

    let currentX = 0;
    let currentY = 0;

    for (let p of points) {
      const [x, y] = pointPos(p, w, h, start, end);

      cr.setSourceRGB(0.3,0.6,1);
      if (points.indexOf(p) == points.length - 1) {
        cr.setSourceRGB(1, 0.5, 0.5);
        const currentPos = cr.getCurrentPoint();
        currentX = currentPos[0];
        currentY = currentPos[1];
      }

      cr.lineTo(x,y);
      cr.stroke();
      cr.moveTo(x, y);
    }

    cr.arc(currentX, currentY, 3, 0, 2*Math.PI);
    cr.setSourceRGB(0, 0.5, 1);
    cr.fill()
  };

  // TODO: Nice graph of charge over time?
  return <box class="Battery" valign={Gtk.Align.CENTER} visible={battery.isPresent}>
    {(battery && 
      <menubutton
        cursor={cursorPointer}
        tooltipText={tooltip}>
        <box>
          <image iconName={icon} pixelSize={20} />
          <label label={percentage} />
        </box>
        <popover >
          <box class="BatteryBig" orientation={Gtk.Orientation.VERTICAL}>
            <drawingarea class="Canvas" contentWidth={500} contentHeight={300}
              $={self=>{
                canvas = self
                self.add_controller(zoomScrollController)
                self.add_controller(hourOffsetController)
                self.set_focusable(true)
                self.set_draw_func(graph)
              }} 
            />
            <box class="ProcData" orientation={Gtk.Orientation.VERTICAL}>
              <box>
                <label label="Top process CPU usage" class="ProcDataHeader" />
                <box hexpand />
                <button label="Measure" sensitive={getProcDataLocked.as(v => !v)}
                  cursor={cursorPointer}
                  onClicked={procDataMeasure} />
              </box>
              <label label={getProcDataStatus} visible={getProcDataStatus.as(v => v != "")} />
              <Gtk.FlowBox class="FlowBox" maxChildrenPerLine={2}>
                <For each={getProcData}>
                  {(p =>
                    <box tooltipText={`${p.cmd}`}>
                      <label 
                        halign={Gtk.Align.START}
                        label={`${p.cmdShort}`}
                         />
                      <box hexpand/>
                      <label 
                        halign={Gtk.Align.END}
                        label={`${p.cpu}s`} />
                    </box>
                  )}
                </For>
              </Gtk.FlowBox>
            </box>
          </box>
        </popover>
      </menubutton>
    )}
  </box>
}
