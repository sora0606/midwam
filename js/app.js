import * as THREE from 'three';
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

import vertex from "./shader/vertex.glsl"
import fragment from "./shader/fragment.glsl"

import GUI from "lil-gui";
import { gsap } from 'gsap';

import model from '../human.glb'

export default class Sketch {
    constructor(opstions) {
        this.scene = new THREE.Scene();

        this.container = opstions.dom;
        this.width = this.container.offsetWidth;
        this.height = this.container.offsetHeight;

        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setSize(this.width, this.height);
        this.renderer.setClearColor(0x010101, 1);

        this.container.appendChild(this.renderer.domElement);


        this.camera = new THREE.PerspectiveCamera(
            70,
            this.width / this.height,
            0.001,
            1000.0
        );
        this.camera.position.set(0.0, 0.0, 2.0);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.time = 0;

        this.dracoLoader = new DRACOLoader();
        this.dracoLoader.setDecoderPath('https://raw.githubusercontent.com/mrdoob/three.js/r147/examples/js/libs/draco/');

        this.gltf = new GLTFLoader();
        this.gltf.setDRACOLoader(this.dracoLoader);

        this.isPlaying = true;

        this.addObjects();
        this.resize();
        this.render();
        this.setupResize();
        // this.settings();
    }

    settings() {
        let that = this;
        this.settings = {
            progress: 0,
        };
        this.gui = new GUI();
        this.gui.add(this.settings, "progress", 0.0, 1.0, 0.01);
    }

    setupResize() {
        window.addEventListener('resize', this.resize.bind(this));
    }

    resize() {
        this.width = this.container.offsetWidth;
        this.height = this.container.offsetHeight;
        this.renderer.setSize(this.width, this.height);
        this.camera.aspect = this.width / this.height;

        this.camera.updateProjectionMatrix();
    }

    addObjects() {
        this.gltf.load(model, (gltf) => {
            this.scene.add(gltf.scene);
            this.human = gltf.scene.children[0];
            this.human.scale.set(0.1, 0.1, 0.1);
            this.human.geometry.center();
            this.human.material = new THREE.MeshBasicMaterial({
                color: 0xff6600,
            });
        });
    }

    addLight() {
        const light1 = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(light1);

        const light2 = new THREE.DirectionalLight(0xffffff, 0.5);
        light2.position.set(0.5, 0.0, 0.866)
        this.scene.add(light2);
    }

    stop() {
        this.isPlaying = false;
    }

    play() {
        if (!this.isPlaying) {
            this.isPlaying = true;
            this.render();
        }
    }

    render() {
        if (!this.isPlaying) return;
        this.time += 0.05;
        requestAnimationFrame(this.render.bind(this));
        this.renderer.render(this.scene, this.camera);
    }
}

new Sketch({
    dom: document.getElementById("container")
});