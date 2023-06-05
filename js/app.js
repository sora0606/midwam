import * as THREE from 'three';
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

import vertex from "./shader/vertex.glsl"
import fragment from "./shader/fragment.glsl"

import GUI from "lil-gui";
import { gsap } from 'gsap';

import model from '../human.glb'
import env from '../env.jpg'

export default class Sketch {
    constructor(opstions) {
        this.scene = new THREE.Scene();

        this.container = opstions.dom;
        this.width = this.container.offsetWidth;
        this.height = this.container.offsetHeight;

        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setSize(this.width, this.height);
        this.renderer.setClearColor(0x050505, 1);

        this.container.appendChild(this.renderer.domElement);


        this.camera = new THREE.PerspectiveCamera(
            70,
            this.width / this.height,
            0.001,
            1000.0
        );
        this.camera.position.set(0.0, 1.0, 1.5);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.time = 0;

        this.dracoLoader = new DRACOLoader();
        this.dracoLoader.setDecoderPath('https://raw.githubusercontent.com/mrdoob/three.js/r147/examples/js/libs/draco/');

        this.gltf = new GLTFLoader();
        this.gltf.setDRACOLoader(this.dracoLoader);

        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;

        this.isPlaying = true;
        this.settings();
        this.initPost();
        this.addObjects();
        this.resize();
        this.render();
        this.setupResize();
    }

    initPost(){
        this.renderScene = new RenderPass( this.scene, this.camera );

        this.bloomPass = new UnrealBloomPass(new THREE.Vector2( window.innerWidth, window.innerHeight ), 1.5, 0.4, 0.85);
        this.bloomPass.threshold = this.settings.bloomThreshold;
        this.bloomPass.strength = this.settings.bloomStrength;
        this.bloomPass.radius = this.settings.bloomRadius;

        this.composer = new EffectComposer( this.renderer );
        this.composer.addPass( this.renderScene );
        this.composer.addPass( this.bloomPass );
    }

    settings() {
        let that = this;
        this.settings = {
            exposure: 1.0,
            bloomStrength: 0.7,
            bloomThreshold: 0.05,
            bloomRadius: 0.8,
        };
        this.gui = new GUI();
        this.gui.add(this.settings, "exposure", 0.0, 1.6, 0.01).onChange(() => {
            that.renderer.toneMappingExposure = this.settings.exposure;
        });

        this.gui.add(this.settings, "bloomStrength", 0.0, 2.0, 0.01).onChange((val) => {
            that.bloomPass.strength = val;
        });
        this.gui.add(this.settings, "bloomThreshold", 0.0, 2.0, 0.01).onChange((val) => {
            that.bloomPass.threshold = val;
        });
        this.gui.add(this.settings, "bloomRadius", 0.0, 2.0, 0.01).onChange((val) => {
            that.bloomPass.radius = val;
        });
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
        this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        this.pmremGenerator.compileEquirectangularShader();

        this.envMap = new THREE.TextureLoader().load(env, (texture) => {
            this.envMap = this.pmremGenerator.fromEquirectangular(texture).texture;
            // this.envMap.mapping = THREE.EquirectangularReflectionMapping;
            // this.scene.environment = envMap;
            // texture.dispose();

            this.pmremGenerator.dispose();

            this.gltf.load(model, (gltf) => {
                this.scene.add(gltf.scene);
                this.human = gltf.scene.children[0];
                this.human.scale.set(0.1, 0.1, 0.1);
                this.human.geometry.center();
                // this.human.material = new THREE.MeshBasicMaterial({
                //     color: 0xff6600,
                // });

                this.m = new THREE.MeshStandardMaterial({
                    metalness: 1,
                    roughness: 0.28,
                });

                this.m.envMap = this.envMap;

                this.m.onBeforeCompile = (shader) => {
                    shader.uniforms.uTime = { value: 0 };

                    shader.fragmentShader = `
                    uniform float uTime;
                    mat4 rotationMatrix(vec3 axis, float angle) {
                        axis = normalize(axis);
                        float s = sin(angle);
                        float c = cos(angle);
                        float oc = 1.0 - c;

                        return mat4(oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
                                    oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
                                    oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
                                    0.0,                                0.0,                                0.0,                                1.0);
                    }

                    vec3 rotate(vec3 v, vec3 axis, float angle) {
                        mat4 m = rotationMatrix(axis, angle);
                        return (m * vec4(v, 1.0)).xyz;
                    }
                    ` + shader.fragmentShader;

                    shader.fragmentShader = shader.fragmentShader.replace(
                        `#include <envmap_physical_pars_fragment>`,
                        `#ifdef USE_ENVMAP

                            vec3 getIBLIrradiance( const in vec3 normal ) {

                                #ifdef ENVMAP_TYPE_CUBE_UV

                                    vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );

                                    vec4 envMapColor = textureCubeUV( envMap, worldNormal, 1.0 );

                                    return PI * envMapColor.rgb * envMapIntensity;

                                #else

                                    return vec3( 0.0 );

                                #endif

                            }

                            vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {

                                #ifdef ENVMAP_TYPE_CUBE_UV

                                    vec3 reflectVec = reflect( - viewDir, normal );

                                    // Mixing the reflection with the normal is more accurate and keeps rough objects from gathering light from behind their tangent plane.
                                    reflectVec = normalize( mix( reflectVec, normal, roughness * roughness) );

                                    reflectVec = inverseTransformDirection( reflectVec, viewMatrix );

                                    reflectVec = rotate(reflectVec, vec3(1.0, 0.0, 0.0), uTime * 0.05);

                                    vec4 envMapColor = textureCubeUV( envMap, reflectVec, roughness );

                                    return envMapColor.rgb * envMapIntensity;

                                #else

                                    return vec3( 0.0 );

                                #endif

                            }

                            #ifdef USE_ANISOTROPY

                                vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {

                                    #ifdef ENVMAP_TYPE_CUBE_UV

                                    // https://google.github.io/filament/Filament.md.html#lighting/imagebasedlights/anisotropy
                                        vec3 bentNormal = cross( bitangent, viewDir );
                                        bentNormal = normalize( cross( bentNormal, bitangent ) );
                                        bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );

                                        return getIBLRadiance( viewDir, bentNormal, roughness );

                                    #else

                                        return vec3( 0.0 );

                                    #endif

                                }

                            #endif

                        #endif
                        `
                    )

                    this.m.userData.shader = shader;
                }

                this.human.material = this.m;
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
        this.composer.render(this.scene, this.camera);
        // this.renderer.render(this.scene, this.camera);

        if (this.human) {

            if (this.m.userData) {
                this.human.material.userData.shader.uniforms.uTime.value = this.time;
            }

            // this.human.rotation.y = this.time * 0.05
        }
    }
}

new Sketch({
    dom: document.getElementById("container")
});