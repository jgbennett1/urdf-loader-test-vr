import * as T from "three";

const lab = {
  texture: new T.TextureLoader().load("assets/lab_curve.jpg"),
  start: new T.Vector3(0.99, 0.95, -0.675),
  end: new T.Vector3(0.99, 1.34, 0.55),
};

const hri = {
  texture: new T.TextureLoader().load("assets/hri_curve.jpg"),
  start: new T.Vector3(0.99, 0.96, -0.68),
  end: new T.Vector3(0.99, 0.97, 0.68),
};

const ros = {
  texture: new T.TextureLoader().load("assets/ros_curve.jpg"),
  start: new T.Vector3(0.99, 1.008, -0.62),
  end: new T.Vector3(0.99, 1.105, 0.335),
};

const traces = {
  lab: lab,
  hri: hri,
  ros: ros,
};

export default traces;
