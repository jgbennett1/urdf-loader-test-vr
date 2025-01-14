import Module from "./Module";
import * as T from "three";
import { getCurrEEPose, updateRobot, resetRobot } from "../utilities/robot";

export class RedirectedControl extends Module {
  constructor(utilities, options = {}) {
    super("redirected-control", utilities);

    // ========== options ==========
    this.showOffsetIndicator = options.showOffsetIndicator ?? true;
    this.controlMode = options.controlMode ?? "grip-toggle";
    this.slerpFactor = 1;
    // =============================

    this.click = new Audio("./assets/click.wav");
  }

  load(config) {
    config.transitions.push({
      name: "activateRemoteControl",
      from: "IDLE",
      to: "REDIRECTED_CONTROL",
    });
    config.transitions.push({
      name: "deactivateRemoteControl",
      from: "REDIRECTED_CONTROL",
      to: "IDLE",
    });
    config.methods["onActivateRemoteControl"] = () => {
      this.click.play();
    };
    config.methods["onDeactivateRemoteControl"] = () => {
      window.scene.remove(this.offsetIndicator);
      window.goalEERelThree.material.color.setHex(0xffffff);
    };

    this.loadControlMode(this.controlMode);
  }

  loadControlMode(mode) {
    if (
      !["grip-toggle", "grip-hold", "trigger-hold", "trigger-toggle"].includes(
        mode
      )
    )
      throw new Error(
        `Control mode \"${mode}\" does not exist for Remote Control`
      );

    this.controller.removeButtonAction("grip", "redirected-control");
    this.controller.removeButtonAction("gripstart", "redirected-control");
    this.controller.removeButtonAction("gripend", "redirected-control");
    this.controller.removeButtonAction("trigger", "redirected-control");
    this.controller.removeButtonAction("triggerstart", "redirected-control");
    this.controller.removeButtonAction("triggerend", "redirected-control");

    switch (mode) {
      case "grip-hold":
        this.controller.addButtonAction(
          "gripstart",
          "redirected-control",
          () => {
            if (this.fsm.is("IDLE")) this.fsm.activateRemoteControl();
          }
        );

        this.controller.addButtonAction("gripend", "redirected-control", () => {
          if (this.fsm.is("REDIRECTED_CONTROL"))
            this.fsm.deactivateRemoteControl();
        });
        this.modeInstructions =
          "Activate: Press and hold the grip button.\nDeactivate: Release the grip button.";
        break;
      case "grip-toggle":
        this.controller.addButtonAction("grip", "redirected-control", () => {
          if (this.fsm.is("IDLE")) {
            this.fsm.activateRemoteControl();
          } else if (this.fsm.is("REDIRECTED_CONTROL")) {
            this.fsm.deactivateRemoteControl();
          }
        });
        this.modeInstructions =
          "Activate: Press the grip button.\nDeactivate: Press the grip button again.";
        break;
      case "trigger-hold":
        this.controller.addButtonAction(
          "triggerstart",
          "redirected-control",
          () => {
            if (this.fsm.is("IDLE")) this.fsm.activateRemoteControl();
          }
        );

        this.controller.addButtonAction(
          "triggerend",
          "redirected-control",
          () => {
            if (this.fsm.is("REDIRECTED_CONTROL"))
              this.fsm.deactivateRemoteControl();
          }
        );
        this.modeInstructions =
          "Activate: Squeeze and hold the trigger.\nDeactivate: Release the trigger.";
        break;
      case "trigger-toggle":
        this.controller.addButtonAction("trigger", "redirected-control", () => {
          if (this.fsm.is("IDLE")) {
            this.fsm.activateRemoteControl();
          } else if (this.fsm.is("REDIRECTED_CONTROL")) {
            this.fsm.deactivateRemoteControl();
          }
        });
        this.modeInstructions =
          "Activate: Squeeze the trigger.\nDeactivate: Squeeze the trigger again.";
        break;
      default:
        break;
    }
  }

  unload() {
    this.controller.removeButtonAction("grip", "redirected-control");
    this.controller.removeButtonAction("gripstart", "redirected-control");
    this.controller.removeButtonAction("gripend", "redirected-control");
    this.controller.removeButtonAction("trigger", "redirected-control");
    this.controller.removeButtonAction("triggerstart", "redirected-control");
    this.controller.removeButtonAction("triggerend", "redirected-control");
  }

  reset() {
    if (this.fsm.is("REDIRECTED_CONTROL")) this.fsm.deactivateRemoteControl();
  }

  update(t, info) {
    if (this.fsm.is("REDIRECTED_CONTROL")) {
      const deltaPosi = new T.Vector3();
      deltaPosi.subVectors(info.ctrlPose.posi, info.prevCtrlPose.posi);
      deltaPosi.applyQuaternion(window.robotGroup.quaternion.clone().invert());
      window.goalEERelThree.position.add(deltaPosi);

      let ctrlOri = info.ctrlPose.ori
        .clone()
        .premultiply(window.robotGroup.quaternion.clone().invert());
      let prevCtrlOri = info.prevCtrlPose.ori
        .clone()
        .premultiply(window.robotGroup.quaternion.clone().invert());
      const deltaOri = new T.Quaternion();
      deltaOri.multiplyQuaternions(
        ctrlOri.clone(),
        prevCtrlOri.clone().invert()
      );
      window.goalEERelThree.quaternion.premultiply(deltaOri);

      let factor = Math.abs(ctrlOri.angleTo(prevCtrlOri)) / (2 * Math.PI);
      factor *= this.slerpFactor;
      if (factor > 1) {
        factor = 1;
      }

      let controllerOri = ctrlOri.clone();
      let correctionRot = new T.Quaternion();
      correctionRot.setFromEuler(new T.Euler(-Math.PI / 3, Math.PI / 2, 0));
      controllerOri.multiply(correctionRot);
      window.goalEERelThree.quaternion.slerp(controllerOri, factor);

      this.showOffsetIndicator &&
        this.updateOffsetIndicator(
          info.currEEAbsThree.posi,
          window.goalEERelThree.getWorldPosition(new T.Vector3())
        );
      updateRobot(window.goalEERelThree);
    }
  }

  // this method should only be called when redirected control is active
  updateOffsetIndicator(p0, p1) {
    window.scene.remove(this.offsetIndicator);

    const length = p0.distanceTo(p1);

    let color;
    if (length < 0.1) color = 0x00ff00;
    else if (length < 0.2) color = 0xffcc00;
    else color = 0xff0000;

    this.offsetIndicator = new T.Line(
      new T.BufferGeometry().setFromPoints([p0, p1]),
      new T.LineBasicMaterial({ transparent: true, opacity: 1, color })
    );

    window.goalEERelThree.material.color.setHex(color);
    window.scene.add(this.offsetIndicator);
  }
}
