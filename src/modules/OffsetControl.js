import Module from "./Module";
import * as T from "three";
import { updateRobot } from "../utilities/robot";

export class OffsetControl extends Module {
  constructor(utilities, options = {}) {
    super("offset-control", utilities);

    // ========== options ==========
    this.showOffsetIndicator = options.showOffsetIndicator ?? true;
    this.controlMode = options.controlMode ?? "grip-toggle";
    this.offset = options.offset ?? new T.Quaternion().identity();
    // =============================

    this.click = new Audio("./assets/click.wav");
  }

  load(config) {
    config.transitions.push({
      name: "activateRemoteControl",
      from: "IDLE",
      to: "OFFSET_CONTROL",
    });
    config.transitions.push({
      name: "deactivateRemoteControl",
      from: "OFFSET_CONTROL",
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

    this.controller.removeButtonAction("grip", "offset-control");
    this.controller.removeButtonAction("gripstart", "offset-control");
    this.controller.removeButtonAction("gripend", "offset-control");
    this.controller.removeButtonAction("trigger", "offset-control");
    this.controller.removeButtonAction("triggerstart", "offset-control");
    this.controller.removeButtonAction("triggerend", "offset-control");

    switch (mode) {
      case "grip-hold":
        this.controller.addButtonAction("gripstart", "offset-control", () => {
          if (this.fsm.is("IDLE")) this.fsm.activateRemoteControl();
        });

        this.controller.addButtonAction("gripend", "offset-control", () => {
          if (this.fsm.is("OFFSET_CONTROL")) this.fsm.deactivateRemoteControl();
        });
        this.modeInstructions =
          "Activate: Press and hold the grip button.\nDeactivate: Release the grip button.";
        break;
      case "grip-toggle":
        this.controller.addButtonAction("grip", "offset-control", () => {
          if (this.fsm.is("IDLE")) {
            this.fsm.activateRemoteControl();
          } else if (this.fsm.is("OFFSET_CONTROL")) {
            this.fsm.deactivateRemoteControl();
          }
        });
        this.modeInstructions =
          "Activate: Press the grip button.\nDeactivate: Press the grip button again.";
        break;
      case "trigger-hold":
        this.controller.addButtonAction(
          "triggerstart",
          "offset-control",
          () => {
            if (this.fsm.is("IDLE")) this.fsm.activateRemoteControl();
          }
        );

        this.controller.addButtonAction("triggerend", "offset-control", () => {
          if (this.fsm.is("OFFSET_CONTROL")) this.fsm.deactivateRemoteControl();
        });
        this.modeInstructions =
          "Activate: Squeeze and hold the trigger.\nDeactivate: Release the trigger.";
        break;
      case "trigger-toggle":
        this.controller.addButtonAction("trigger", "offset-control", () => {
          if (this.fsm.is("IDLE")) {
            this.fsm.activateRemoteControl();
          } else if (this.fsm.is("OFFSET_CONTROL")) {
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
    this.controller.removeButtonAction("grip", "offset-control");
    this.controller.removeButtonAction("gripstart", "offset-control");
    this.controller.removeButtonAction("gripend", "offset-control");
    this.controller.removeButtonAction("trigger", "offset-control");
    this.controller.removeButtonAction("triggerstart", "offset-control");
    this.controller.removeButtonAction("triggerend", "offset-control");
  }

  reset() {
    if (this.fsm.is("OFFSET_CONTROL")) this.fsm.deactivateRemoteControl();
  }

  update(t, info) {
    const ori = info.ctrlPose.ori.clone();
    ori.premultiply(window.robotGroup.quaternion.clone().invert());
    let correctionRot = new T.Quaternion();
    correctionRot.setFromEuler(new T.Euler(-Math.PI / 3, Math.PI / 2, 0));
    ori.multiply(correctionRot);
    ori.multiply(this.offset);
    window.goalEERelThree.quaternion.copy(ori);

    if (this.fsm.is("OFFSET_CONTROL")) {
      const deltaPosi = new T.Vector3();
      deltaPosi.subVectors(info.ctrlPose.posi, info.prevCtrlPose.posi);
      deltaPosi.applyQuaternion(window.robotGroup.quaternion.clone().invert());
      window.goalEERelThree.position.add(deltaPosi);

      this.showOffsetIndicator &&
        this.updateOffsetIndicator(
          info.currEEAbsThree.posi,
          window.goalEERelThree.getWorldPosition(new T.Vector3())
        );
    }

    updateRobot(window.goalEERelThree);
  }

  // this method should only be called when remote control is active
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
