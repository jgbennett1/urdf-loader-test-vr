use crate::groove::vars::{RelaxedIKVars, VarsConstructorData};
use crate::groove::collision_nn::{CollisionNNConstructorData};
use crate::utils_rust::yaml_utils::EnvCollisionFileParserConstructorData;
// use crate::groove::groove::{OptimizationEngineOpen, OptimizationEngineNLopt};
use crate::groove::groove::{OptimizationEngineOpen};
use crate::groove::objective_master::ObjectiveMaster;
use crate::utils_rust::subscriber_utils::EEPoseGoalsSubscriber;
use crate::utils_rust::transformations::{*};
use nalgebra::{Vector3, UnitQuaternion, Quaternion};
use wasm_bindgen::prelude::*;
use js_sys::Array;
extern crate serde_json;
extern crate console_error_panic_hook;
use serde::{Serialize, Deserialize};

#[wasm_bindgen]
pub struct RelaxedIK {
    pub(crate) vars: RelaxedIKVars,
    pub(crate) om: ObjectiveMaster,
    pub(crate) groove: OptimizationEngineOpen
    // pub groove_nlopt: OptimizationEngineNLopt
}

#[wasm_bindgen]
impl RelaxedIK {
    #[wasm_bindgen(constructor)]
    pub fn new( config:  &JsValue, nn_config:  &JsValue, env_config: &JsValue ) -> Self {
        console_error_panic_hook::set_once();

        let cfg: VarsConstructorData = config.into_serde().unwrap();
        let nn_config: CollisionNNConstructorData = nn_config.into_serde().unwrap();
        let env_config: EnvCollisionFileParserConstructorData = env_config.into_serde().unwrap();

        let vars = RelaxedIKVars::new(cfg, nn_config, env_config);
        let mut om = ObjectiveMaster::relaxed_ik(vars.robot.num_chains);
        let groove = OptimizationEngineOpen::new(vars.robot.num_dof.clone());
        Self{vars, om, groove}
    }

    pub fn recover_vars(&mut self, init_state:  &JsValue) {
        let mut starting_config: Vec<f64> = init_state.into_serde().unwrap();
        // if init_state is empty, move robot to previous init state
        if (starting_config.len() == 0) {
            starting_config = self.vars.init_state.clone();
        }
        self.vars.goal_positions.clear();
        self.vars.goal_quats.clear();
        self.vars.init_ee_positions = self.vars.robot.get_ee_positions(starting_config.as_slice());
        self.vars.init_ee_quats = self.vars.robot.get_ee_quats(starting_config.as_slice());

        for i in 0..self.vars.robot.joint_names.len() {
            self.vars.goal_positions.push(self.vars.init_ee_positions[i]);
            self.vars.goal_quats.push(self.vars.init_ee_quats[i]);
        }
        self.vars.xopt = starting_config.clone();
        self.vars.prev_state = starting_config.clone();
        self.vars.prev_state2 = starting_config.clone();
        self.vars.prev_state3 = starting_config.clone();
    }

    pub fn solve(&mut self, pos_goal:  &JsValue,  quat_goal:  &JsValue) -> Array{
        let pos_vec: Vec<f64> = pos_goal.into_serde().unwrap();
        let quat_vec: Vec<f64> = quat_goal.into_serde().unwrap();
       
        let mut ee_sub = EEPoseGoalsSubscriber::new();

        for i in 0..self.vars.robot.num_chains {
            ee_sub.pos_goals.push( Vector3::new( pos_vec[3*i], pos_vec[3*i+1], pos_vec[3*i+2] ) );
            let tmp_quat = Quaternion::new(quat_vec[4*i], quat_vec[4*i+1], quat_vec[4*i+2], quat_vec[4*i+3]);
            ee_sub.quat_goals.push( UnitQuaternion::from_quaternion(tmp_quat) );
        }

        let res = self.solve_helper(&ee_sub);

        res.into_iter().map(JsValue::from).collect()
    }

}

impl RelaxedIK {
    pub fn solve_helper(&mut self, ee_sub: &EEPoseGoalsSubscriber) -> Vec<f64> {
        let mut out_x = self.vars.xopt.clone();

        for i in 0..self.vars.robot.num_chains {
            if self.vars.position_mode_relative {
                    self.vars.goal_positions[i] = self.vars.init_ee_positions[i] + ee_sub.pos_goals[i];
            } else {
                    self.vars.goal_positions[i] = ee_sub.pos_goals[i].clone();
            }
            if self.vars.rotation_mode_relative {
                self.vars.goal_quats[i] = ee_sub.quat_goals[i] * self.vars.init_ee_quats[i];
            } else {
                self.vars.goal_quats[i] = ee_sub.quat_goals[i].clone();
            }
        }

        let in_collision = self.vars.update_collision_world();
        if !in_collision {
            self.groove.optimize(&mut out_x, &self.vars, &self.om, 100);
            self.vars.update(out_x.clone());
        }
        out_x
    }

    // pub fn new(info_file_name: String, mode: usize) -> Self {
    //     let path_to_src = get_path_to_src();
    //     let fp = path_to_src + "relaxed_ik_core/config/info_files/" + info_file_name.as_str();
    //     RelaxedIK::from_yaml_path(fp.clone(), mode.clone())
    // }

    // pub fn from_info_file_name(info_file_name: String, mode: usize) -> Self {
    //     let path_to_src = get_path_to_src();
    //     let fp = path_to_src + "relaxed_ik_core/config/info_files/" + info_file_name.as_str();
    //     RelaxedIK::from_yaml_path(fp.clone(), mode.clone())
    // }

    // pub fn from_yaml_path(fp: String, mode: usize) -> Self {
    //     let vars = RelaxedIKVars::from_yaml_path(fp.clone(), true, true);
    //     let mut om = ObjectiveMaster::relaxed_ik(vars.robot.num_chains, vars.objective_mode.clone());
    //     if mode == 0 {
    //         om = ObjectiveMaster::standard_ik(vars.robot.num_chains);
    //     }

    //     let groove = OptimizationEngineOpen::new(vars.robot.num_dof.clone());
    //     // let groove_nlopt = OptimizationEngineNLopt::new();

    //     // Self{vars, om, groove, groove_nlopt}
    //     Self{vars, om, groove}
    // }

    // pub fn from_loaded(mode: usize) -> Self {
    //     let path_to_src = get_path_to_src();
    //     let fp1 = path_to_src +  "relaxed_ik_core/config/settings.yaml";
    //     let info_file_name = get_info_file_name(fp1);
    //     RelaxedIK::from_info_file_name(info_file_name.clone(), mode.clone())
    // }

    // pub fn solve_precise(&mut self, ee_sub: &EEPoseGoalsSubscriber) -> (Vec<f64>) {
    //     let mut out_x = self.vars.xopt.clone();

    //     if self.vars.rotation_mode_relative {
    //         for i in 0..self.vars.robot.num_chains {
    //             self.vars.goal_positions[i] = self.vars.init_ee_positions[i] + ee_sub.pos_goals[i];
    //             self.vars.goal_quats[i] = ee_sub.quat_goals[i] * self.vars.init_ee_quats[i];
    //         }
    //     } else {
    //         for i in 0..self.vars.robot.num_chains  {
    //             self.vars.goal_positions[i] = ee_sub.pos_goals[i].clone();
    //             self.vars.goal_quats[i] = ee_sub.quat_goals[i].clone();
    //         }
    //     }

    //     self.groove_nlopt.optimize(&mut out_x, &self.vars, &self.om, 200);

    //     let mut max_pos_error = 0.0;
    //     let mut max_rot_error = 0.0;
    //     let ee_poses = self.vars.robot.get_ee_pos_and_quat_immutable(&out_x);
    //     for i in 0..self.vars.robot.num_chains {
    //         let pos_error = (self.vars.goal_positions[i] - ee_poses[i].0).norm();
    //         let rot_error = angle_between(self.vars.goal_quats[i].clone(), ee_poses[i].1.clone());
    //         if pos_error > max_pos_error { max_pos_error = pos_error; }
    //         if rot_error > max_rot_error { max_rot_error = rot_error; }
    //     }

    //     while max_pos_error > 0.005 || max_rot_error > 0.005 {
    //         let res = self.solve_randstart(ee_sub);
    //         out_x = res.1.clone();
    //         max_pos_error = 0.0; max_rot_error = 0.0;
    //         let ee_poses = self.vars.robot.get_ee_pos_and_quat_immutable(&out_x);
    //         for i in 0..self.vars.robot.num_chains {
    //             let pos_error = (self.vars.goal_positions[i] - ee_poses[i].0).norm();
    //             let rot_error = angle_between(self.vars.goal_quats[i].clone(), ee_poses[i].1.clone());
    //             if pos_error > max_pos_error { max_pos_error = pos_error; }
    //             if rot_error > max_rot_error { max_rot_error = rot_error; }
    //         }
    //     }

    //     self.vars.update(out_x.clone());
    //     self.vars.update_collision_world();

    //     out_x
    // }

    // pub fn solve_randstart(&mut self, ee_sub: &EEPoseGoalsSubscriber) -> (bool, Vec<f64>) {
    //     let mut out_x = self.vars.sampler.sample().data.as_vec().clone();

    //     if self.vars.rotation_mode_relative {
    //         for i in 0..self.vars.robot.num_chains {
    //             self.vars.goal_positions[i] = self.vars.init_ee_positions[i] + ee_sub.pos_goals[i];
    //             self.vars.goal_quats[i] = ee_sub.quat_goals[i] * self.vars.init_ee_quats[i];
    //         }
    //     } else {
    //         for i in 0..self.vars.robot.num_chains  {
    //             self.vars.goal_positions[i] = ee_sub.pos_goals[i].clone();
    //             self.vars.goal_quats[i] = ee_sub.quat_goals[i].clone();
    //         }
    //     }

    //     self.groove_nlopt.optimize(&mut out_x, &self.vars, &self.om, 200);

    //     let mut max_pos_error = 0.0;
    //     let mut max_rot_error = 0.0;
    //     let ee_poses = self.vars.robot.get_ee_pos_and_quat_immutable(&out_x);
    //     for i in 0..self.vars.robot.num_chains {
    //         let pos_error = (self.vars.goal_positions[i] - ee_poses[i].0).norm();
    //         let rot_error = angle_between(self.vars.goal_quats[i].clone(), ee_poses[i].1.clone());
    //         if pos_error > max_pos_error {max_pos_error = pos_error;}
    //         if rot_error > max_rot_error {max_rot_error = rot_error;}
    //     }

    //     if max_pos_error > 0.005 || max_rot_error > 0.005 {
    //         return (false, out_x)
    //     } else {
    //         // self.vars.update(out_x.clone());
    //         return (true, out_x)
    //     }
    // }
}
