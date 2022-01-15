import PickAndPlaceStatic from "./tasks/PickAndPlaceStatic"
import PickAndPlaceDynamic from "./tasks/PickAndPlaceDynamic"
import PickAndPlaceMoving from "./tasks/PickAndPlaceMoving"
import PickAndPlace from "./tasks/PickAndPlace"
import * as T from 'three'

import {
    getBrowser, threejsVector3ToMathjsMat,
} from "./utils.js";

export class TaskControl {
    constructor(options) {
        this.scene = options.scene
        this.browser = getBrowser();
        this.task = new PickAndPlace({ scene: this.scene });
        this.camera = options.camera;
        // document.querySelector('#tasks-select').addEventListener('change', (e) => {
        //     switch(e.target.value) {
        //         case 'PickAndPlaceStatic':
        //             this.task.reset();
        //             this.task = new PickAndPlaceStatic({ scene: this.scene });
        //             break;
        //         case 'PickAndPlaceDynamic':
        //             this.task.reset();
        //             this.task = new PickAndPlaceDynamic({ scene: this.scene });
        //             break;
        //         case 'PickAndPlaceMoving':
        //             this.task.reset();
        //             this.task = new PickAndPlaceMoving({ scene: this.scene });
        //             break;
        //         default:
        //             break;
        //     }

        //     this.init();
        // });

        this.init();
    }

    finishRound() {
        this.task.clearRound();

        if (this.task.currentRound < this.task.rounds.length - 1) {
            this.task.currentRound++;
            this.task.displayRound();
        } else {
            this.task.finished = true;
            alert('All tasks are completed');
        }
    }

    // pubTaskPrepare() {
    //     this.study.pubTaskPrepare();
    // }

    // pubRound() {
    //     let that = this;
    //     this.study.removeBricks();
    //     this.study.bricks = [];
    
    //     this.rounds[this.round - 1].forEach((brick) => {
    //         this.study.bricks.push(brick);
    //     });

    //     this.study.pubTaskPrepare();
    // }

    init() {
        this.task.init();
    }

    // this is called in relaxedikDemo.js about every 5 ms
    update(ee_pose) {
        if (!this.task.finished) this.task.update(ee_pose);
    }
}