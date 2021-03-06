Primrose.Input.FPSInput = (function () {
  "use strict";

  const SETTINGS_TO_ZERO = ["heading", "pitch", "roll", "pointerPitch", "headX", "headY", "headZ"],
    AXIS_PREFIXES = ["L", "R"];

  var temp = new THREE.Quaternion();

  pliny.class({
    parent: "Primrose.Input",
    name: "FPSInput",
    description: "| [under construction]"
  });
  class FPSInput {
    constructor(DOMElement) {
      DOMElement = DOMElement || window;

      this.listeners = {
        zero: [],
        lockpointer: [],
        fullscreen: [],
        pointerstart: [],
        pointerend: [],
        motioncontroller: []
      };

      this.managers = [];

      this.add(new Primrose.Input.Media());

      this.add(new Primrose.Input.VR());

      this.add(new Primrose.Input.Keyboard(DOMElement, {
        lockPointer: {
          buttons: [Primrose.Keys.ANY, -Primrose.Keys.F],
          repetitions: 1,
          commandDown: emit.bind(this, "lockpointer")
        },
        fullScreen: {
          buttons: [Primrose.Keys.F],
          repetitions: 1,
          commandDown: emit.bind(this, "fullscreen")
        },
        strafeLeft: {
          buttons: [
            -Primrose.Keys.A,
            -Primrose.Keys.LEFTARROW]
        },
        strafeRight: {
          buttons: [
            Primrose.Keys.D,
            Primrose.Keys.RIGHTARROW]
        },
        strafe: { commands: ["strafeLeft", "strafeRight"] },
        boost: { buttons: [ Primrose.Keys.E ], scale: 0.2 },
        driveForward: {
          buttons: [
            -Primrose.Keys.W,
            -Primrose.Keys.UPARROW]
        },
        driveBack: {
          buttons: [
            Primrose.Keys.S,
            Primrose.Keys.DOWNARROW]
        },
        drive: { commands: ["driveForward", "driveBack"] },
        select: { buttons: [Primrose.Keys.ENTER] },
        dSelect: { buttons: [Primrose.Keys.ENTER], delta: true },
        zero: {
          buttons: [Primrose.Keys.Z],
          metaKeys: [
            -Primrose.Keys.CTRL,
            -Primrose.Keys.ALT,
            -Primrose.Keys.SHIFT,
            -Primrose.Keys.META
          ],
          commandUp: emit.bind(this, "zero")
        }
      }));

      this.add(new Primrose.Input.Mouse(DOMElement, {
        lockPointer: { buttons: [Primrose.Keys.ANY], commandDown: emit.bind(this, "lockpointer") },
        pointer: {
          buttons: [Primrose.Keys.ANY],
          commandDown: emit.bind(this, "pointerstart"),
          commandUp: emit.bind(this, "pointerend")
        },
        buttons: { axes: [Primrose.Input.Mouse.BUTTONS] },
        dButtons: { axes: [Primrose.Input.Mouse.BUTTONS], delta: true },
        pointerX: { axes: [Primrose.Input.Mouse.X] },
        pointerY: { axes: [Primrose.Input.Mouse.Y] },
        dx: { axes: [-Primrose.Input.Mouse.X], delta: true, scale: 0.005, min: -5, max: 5 },
        heading: { commands: ["dx"], integrate: true },
        dy: { axes: [-Primrose.Input.Mouse.Y], delta: true, scale: 0.005, min: -5, max: 5 },
        pitch: { commands: ["dy"], integrate: true, min: -Math.PI * 0.5, max: Math.PI * 0.5 },
        pointerPitch: { commands: ["dy"], integrate: true, min: -Math.PI * 0.25, max: Math.PI * 0.25 }
      }));

      this.add(new Primrose.Input.Touch(DOMElement, {
        lockPointer: { buttons: [Primrose.Keys.ANY], commandUp: emit.bind(this, "lockpointer") },
        pointer: {
          buttons: [Primrose.Keys.ANY],
          commandDown: emit.bind(this, "pointerstart"),
          commandUp: emit.bind(this, "pointerend")
        },
        buttons: { axes: [Primrose.Input.Touch.FINGERS] },
        dButtons: { axes: [Primrose.Input.Touch.FINGERS], delta: true },
        pointerX: { axes: [Primrose.Input.Touch.X0] },
        pointerY: { axes: [Primrose.Input.Touch.Y0] },
        dx: { axes: [-Primrose.Input.Touch.X0], delta: true, scale: 0.005, min: -5, max: 5 },
        heading: { commands: ["dx"], integrate: true },
        dy: { axes: [-Primrose.Input.Touch.Y0], delta: true, scale: 0.005, min: -5, max: 5 },
        pitch: { commands: ["dy"], integrate: true, min: -Math.PI * 0.5, max: Math.PI * 0.5 }
      }));

      Primrose.Input.Gamepad.addEventListener("gamepadconnected", (pad) => {
        var pose = pad.pose,
          isMotion = pad.id === "OpenVR Gamepad",
          padCommands = null,
          controllerNumber = 0;

        if(isMotion){
          padCommands = {
            pointer: {
              buttons: [Primrose.Input.Gamepad.VIVE_BUTTONS.TRIGGER_PRESSED],
              commandDown: emit.bind(this, "pointerstart"),
              commandUp: emit.bind(this, "pointerend")
            }
          };

          for(var i = 0; i < this.managers.length; ++i){
            var mgr = this.managers[i];
            if(mgr.currentPad && mgr.currentPad.id === pad.id){
              ++controllerNumber;
            }
          }
        }
        else {
          padCommands = {
            pointer: {
              buttons: [Primrose.Input.Gamepad.XBOX_BUTTONS.A],
              commandDown: emit.bind(this, "pointerstart"),
              commandUp: emit.bind(this, "pointerend")
            },
            strafe: { axes: [Primrose.Input.Gamepad.LSX], deadzone: 0.2 },
            drive: { axes: [Primrose.Input.Gamepad.LSY], deadzone: 0.2 },
            heading: { axes: [-Primrose.Input.Gamepad.RSX], deadzone: 0.2, integrate: true },
            dheading: { commands: ["heading"], delta: true },
            pitch: { axes: [-Primrose.Input.Gamepad.RSY], deadzone: 0.2, integrate: true }
          };
        }
        var mgr = new Primrose.Input.Gamepad(pad, controllerNumber, padCommands);
        this.add(mgr);

        if(isMotion){
          emit.call(this, "motioncontroller", mgr);
        }
      });

      Primrose.Input.Gamepad.addEventListener("gamepaddisconnected", this.remove.bind(this));

      this.ready = Promise.all(this.managers
        .map((mgr) => mgr.ready)
        .filter(identity));
    }

    remove(id){
      var mgr = this[id],
        mgrIdx = this.managers.indexOf(mgr);
      if(mgrIdx > -1){
        this.managers.splice(mgrIdx, 1);
        delete this[id];
      }
      console.log("removed", mgr);
    }

    add(mgr){
      for(var i = this.managers.length - 1; i >= 0; --i){
        if(this.managers[i].name === mgr.name){
          this.managers.splice(i, 1);
        }
      }
      this.managers.push(mgr);
      this[mgr.name] = mgr;
    }

    zero() {
      if (this.vr && this.vr.currentDisplay) {
        this.vr.currentDisplay.resetPose();
      }
      if (this.motion) {
        this.motion.zeroAxes();
      }
      for (var i = 0; i < this.managers.length; ++i) {
        var mgr = this.managers[i];
        for (var j = 0; mgr.enabled && j < SETTINGS_TO_ZERO.length; ++j) {
          mgr.setValue(SETTINGS_TO_ZERO[j], 0);
        }
      }
    }

    update() {
      Primrose.Input.Gamepad.poll();
      for (var i = 0; i < this.managers.length; ++i) {
        var mgr = this.managers[i];
        if (mgr.enabled) {
          if (mgr.poll) {
            mgr.poll();
          }
          mgr.update();
        }
      }
    }

    addEventListener(evt, thunk, bubbles) {
      if (this.listeners[evt]) {
        this.listeners[evt].push(thunk);
      }
      else {
        this.managers.forEach(function (mgr) {
          if (mgr.addEventListener) {
            mgr.addEventListener(evt, thunk, bubbles);
          }
        });
      }
    }

    getValue(name) {
      var value = 0;
      for (var i = 0; i < this.managers.length; ++i) {
        var mgr = this.managers[i];
        if (mgr.enabled) {
          value += mgr.getValue(name);
        }
      }
      return value;
    }

    getLatestValue(name) {
      var value = 0,
        maxT = Number.MIN_VALUE;
      for (var i = 0; i < this.managers.length; ++i) {
        var mgr = this.managers[i];
        if (mgr.enabled && mgr.lastT > maxT) {
          maxT = mgr.lastT;
          value = mgr.getValue(name);
        }
      }
      return value;
    }
  }

  return FPSInput;
})();